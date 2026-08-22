import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);

const app = express();
app.use(cors());
app.use(express.json());

// --- Initialisation Firebase Admin SDK ---
// Pour Vercel, on utilise la variable d'environnement FIREBASE_SERVICE_ACCOUNT (JSON string)
// ou on charge un fichier en local.
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // En développement local, on peut charger un fichier
  serviceAccount = require('./firebase-service-account.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// --- Configuration CinetPay ---
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
const CINETPAY_SECRET = process.env.CINETPAY_SECRET;
const CINETPAY_API_URL = process.env.CINETPAY_API_URL || 'https://api.cinetpay.com/v1';

// --- Endpoint 1: Initier un paiement ---
app.post('/api/payment/init', async (req, res) => {
  try {
    const { userId, serviceId, montant } = req.body;

    // Vérifier que l'utilisateur existe
    const user = await admin.auth().getUser(userId);

    // Récupérer le service pour obtenir le prix par défaut si non fourni
    let finalMontant = montant;
    if (!finalMontant) {
      const serviceDoc = await db.collection('services').doc(serviceId).get();
      if (!serviceDoc.exists) {
        return res.status(404).json({ error: 'Service non trouvé' });
      }
      finalMontant = serviceDoc.data().prix || 500; // 500 FCFA par défaut
    }

    // Générer un ID de transaction unique
    const transactionId = `txn_${Date.now()}_${userId.substring(0, 6)}`;

    // Préparer la requête vers CinetPay
    const payload = {
      transaction_id: transactionId,
      amount: finalMontant,
      currency: 'XOF',
      site_id: CINETPAY_SITE_ID,
      api_key: CINETPAY_API_KEY,
      notify_url: `${process.env.BASE_URL}/api/payment/webhook`,
      return_url: `${process.env.BASE_URL}/payment-confirmation?transactionId=${transactionId}`,
      customer_id: userId,
      customer_email: user.email || '',
      customer_phone: '',
      description: `Abonnement service ${serviceId}`,
    };

    const response = await axios.post(`${CINETPAY_API_URL}/payment/init`, payload);
    const data = response.data;

    if (data.code === '201') {
      // Sauvegarder la transaction en attente dans Firestore
      await db.collection('transactions').doc(transactionId).set({
        userId,
        serviceId,
        montant: finalMontant,
        statut: 'initie',
        dateCreation: admin.firestore.FieldValue.serverTimestamp(),
        cinetpayData: data,
      });

      // Retourner l'URL de paiement
      res.json({ paymentUrl: data.data.payment_url, transactionId });
    } else {
      res.status(400).json({ error: data.message || 'Erreur CinetPay' });
    }
  } catch (error) {
    console.error('Erreur init paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoint 2: Webhook de confirmation ---
app.post('/api/payment/webhook', async (req, res) => {
  try {
    // Vérifier la signature (à adapter selon la doc CinetPay)
    // CinetPay envoie généralement un token dans le header ou dans le body
    // On va vérifier que le webhook provient bien de CinetPay en comparant un secret partagé.
    // Pour simplifier, on suppose que CinetPay envoie un champ "token" dans le body.
    const { transaction_id, status, token } = req.body;

    // Vérifier le token (exemple : on compare avec un hash HMAC)
    // Si CinetPay ne fournit pas de token, on peut plutôt rappeler l'API CinetPay pour vérifier le statut.
    // Nous allons faire un check status systématiquement.

    // Récupérer la transaction dans Firestore
    const txDoc = await db.collection('transactions').doc(transaction_id).get();
    if (!txDoc.exists) {
      return res.status(404).send('Transaction not found');
    }
    const txData = txDoc.data();

    // Vérifier que le webhook n'a pas déjà été traité
    if (txData.statut === 'paye' || txData.statut === 'echoue') {
      return res.status(200).send('OK (already processed)');
    }

    // Appel à l'API CinetPay pour vérifier le statut réel (recommandé)
    const checkPayload = {
      transaction_id: transaction_id,
      site_id: CINETPAY_SITE_ID,
      api_key: CINETPAY_API_KEY,
    };
    const checkResponse = await axios.post(`${CINETPAY_API_URL}/payment/check`, checkPayload);
    const checkData = checkResponse.data;

    // Vérifier que le statut est bien 'payé'
    const isPaid = checkData.data && checkData.data.status === 'payé';

    if (isPaid) {
      // Paiement confirmé : créer l'abonnement dans Firestore
      const { userId, serviceId, montant } = txData;

      // Calculer la date de fin (un mois plus tard)
      const dateDebut = new Date();
      const dateFin = new Date(dateDebut);
      dateFin.setMonth(dateFin.getMonth() + 1);

      // Créer le document dans subscribers
      // Utiliser un ID personnalisé : `${userId}_${serviceId}_${Date.now()}`
      const subId = `${userId}_${serviceId}_${Date.now()}`;
      await db.collection('subscribers').doc(subId).set({
        userId,
        serviceId,
        dateDebut: admin.firestore.Timestamp.fromDate(dateDebut),
        dateFin: admin.firestore.Timestamp.fromDate(dateFin),
        statut: 'actif',
        emailId: null, // on peut attribuer un slot plus tard ou immédiatement si service existant
        // On peut aussi attribuer un email disponible via un helper
      });

      // Mettre à jour la transaction avec statut 'paye'
      await db.collection('transactions').doc(transaction_id).update({
        statut: 'paye',
        subscriberId: subId,
        datePaiement: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Envoyer une notification à l'utilisateur (optionnel)
      await db.collection('notifications').add({
        userId,
        message: 'Votre abonnement a été activé !',
        type: 'paiement_reussi',
        lu: false,
        date: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log dans journal
      await db.collection('journal').add({
        action: 'abonnement_cree',
        userId,
        serviceId,
        subscriberId: subId,
        date: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).send('OK');
    } else {
      // Paiement échoué
      await db.collection('transactions').doc(transaction_id).update({
        statut: 'echoue',
        dateEchec: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).send('KO');
    }
  } catch (error) {
    console.error('Erreur webhook:', error);
    // Répondre 200 pour que CinetPay ne réessaie pas en boucle, mais logguer l'erreur
    return res.status(200).send('Erreur interne');
  }
});

// --- Endpoint 3: Vérifier le statut d'une transaction ---
app.get('/api/payment/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const txDoc = await db.collection('transactions').doc(transactionId).get();
    if (!txDoc.exists) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    const data = txDoc.data();
    res.json({
      transactionId,
      statut: data.statut,
      subscriberId: data.subscriberId || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoint proxy Claude (existant) ---
// ... (le code existant pour /api/chat)

export default app;
