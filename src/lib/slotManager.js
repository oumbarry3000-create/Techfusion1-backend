import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { logAction } from "./journal";
import { createNotification } from "./notifications";

export const CAPACITE_MAX_EMAIL = 5;

/**
 * Trouve un email du service avec de la place disponible (< 5 abonnés actifs/en attente de suppression).
 * Retourne null si aucun email n'a de place (l'admin doit en ajouter un).
 */
export async function trouverEmailDisponible(serviceId) {
  const q = query(
    collection(db, "emails"),
    where("serviceId", "==", serviceId),
    where("slotsOccupes", "<", CAPACITE_MAX_EMAIL),
    orderBy("slotsOccupes", "desc"), // remplit un email avant d'en occuper un autre
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Abonne un client à un service : trouve un slot, crée le subscriber,
 * incrémente le compteur d'occupation de l'email, crée la transaction.
 * Tout est fait dans une transaction Firestore pour éviter les doubles-réservations.
 */
export async function abonnerClient({
  serviceId,
  serviceNom,
  userId,
  nom,
  mois,
  prix,
  remise = 0,
}) {
  const emailDisponible = await trouverEmailDisponible(serviceId);
  if (!emailDisponible) {
    throw new Error(
      "SERVICE_COMPLET: Aucun slot disponible pour ce service actuellement. Réessaie plus tard."
    );
  }

  const net = Math.max(0, prix - remise);
  const dateAbonnement = new Date();
  const dateFin = new Date();
  dateFin.setMonth(dateFin.getMonth() + Number(mois));

  const subscriberRef = doc(collection(db, "subscribers"));
  const transactionRef = doc(collection(db, "transactions"));
  const emailRef = doc(db, "emails", emailDisponible.id);

  await runTransaction(db, async (tx) => {
    const emailSnap = await tx.get(emailRef);
    const slotsActuels = emailSnap.data().slotsOccupes || 0;
    if (slotsActuels >= CAPACITE_MAX_EMAIL) {
      throw new Error("SERVICE_COMPLET: Le slot vient d'être pris, réessaie.");
    }

    tx.set(subscriberRef, {
      emailId: emailDisponible.id,
      serviceId,
      service: serviceNom,
      userId,
      nom,
      mois: Number(mois),
      prix: Number(prix),
      remise: Number(remise),
      net,
      dateAbonnement,
      dateFin,
      statut: "Actif",
      renewalMissedCount: 0,
      createdAt: serverTimestamp(),
    });

    tx.set(transactionRef, {
      abonneId: subscriberRef.id,
      nom,
      service: serviceNom,
      email: emailDisponible.adresse,
      montant: net,
      datePaiement: serverTimestamp(),
      type: "inscription",
    });

    tx.update(emailRef, { slotsOccupes: slotsActuels + 1 });
  });

  await createNotification({
    destinataire: userId,
    type: "bienvenue",
    message: `Ton abonnement à ${serviceNom} est actif. Identifiants: ${emailDisponible.adresse}`,
    subscriberId: subscriberRef.id,
  });

  await logAction(
    `Nouvel abonnement auto: ${nom} -> ${serviceNom} (email ${emailDisponible.adresse})`
  );

  return { subscriberId: subscriberRef.id, email: emailDisponible.adresse };
}

/**
 * Libère un slot (appelé à la suppression définitive ou au remplacement d'un abonné).
 */
export async function libererSlot(emailId) {
  const emailRef = doc(db, "emails", emailId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(emailRef);
    if (!snap.exists()) return;
    const slots = Math.max(0, (snap.data().slotsOccupes || 1) - 1);
    tx.update(emailRef, { slotsOccupes: slots });
  });
}
