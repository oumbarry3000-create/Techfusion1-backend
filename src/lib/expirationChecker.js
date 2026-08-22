import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { createNotificationSiAbsente } from "./notifications";
import { libererSlot } from "./slotManager";
import { logAction } from "./journal";

const MS_JOUR = 24 * 60 * 60 * 1000;
const CLE_DERNIERE_VERIF = "techno_derniere_verif_expiration";

function toDate(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

/**
 * Lance toutes les vérifications d'expiration/rappel/suppression.
 * À appeler au montage de l'app (admin ET client), avec un throttle
 * pour ne pas le refaire à chaque re-render (1x / heure suffit largement).
 */
export async function verifierExpirations() {
  const derniere = localStorage.getItem(CLE_DERNIERE_VERIF);
  if (derniere && Date.now() - Number(derniere) < 60 * 60 * 1000) {
    return; // déjà vérifié il y a moins d'1h
  }
  localStorage.setItem(CLE_DERNIERE_VERIF, String(Date.now()));

  const maintenant = new Date();

  await passerExpiresEnInactif(maintenant);
  await genererRappelsJ7(maintenant);
  await notifierRetardsSuperieurs7Jours(maintenant);
  await supprimerInactifsDepuis30Jours(maintenant);
}

/** 1. Actif dont dateFin < maintenant -> Inactif */
async function passerExpiresEnInactif(maintenant) {
  const q = query(collection(db, "subscribers"), where("statut", "==", "Actif"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dateFin = toDate(data.dateFin);
    if (dateFin && dateFin < maintenant) {
      await updateDoc(doc(db, "subscribers", d.id), { statut: "Inactif" });
      await createNotificationSiAbsente({
        destinataire: "admin",
        type: "expiration",
        message: `${data.nom} (${data.service}) vient d'expirer.`,
        subscriberId: d.id,
      });
      await createNotificationSiAbsente({
        destinataire: data.userId,
        type: "expiration",
        message: `Ton abonnement ${data.service} a expiré. Renouvelle pour continuer à en profiter.`,
        subscriberId: d.id,
      });
      await logAction(`Auto: ${data.nom} passé Inactif (expiration ${data.service})`);
    }
  }
}

/** 2. Rappels J-7, J-3, J-0 pour les actifs qui approchent de la fin */
async function genererRappelsJ7(maintenant) {
  const q = query(collection(db, "subscribers"), where("statut", "==", "Actif"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dateFin = toDate(data.dateFin);
    if (!dateFin) continue;
    const joursRestants = Math.ceil((dateFin - maintenant) / MS_JOUR);
    if (joursRestants <= 7 && joursRestants >= 0) {
      const msg = `${data.nom} (${data.service}) expire dans ${joursRestants} jour(s).`;
      await createNotificationSiAbsente({
        destinataire: "admin",
        type: `renouvellement`,
        message: msg,
        subscriberId: d.id,
      });
      await createNotificationSiAbsente({
        destinataire: data.userId,
        type: "renouvellement",
        message: `Ton abonnement ${data.service} expire dans ${joursRestants} jour(s). Pense à renouveler !`,
        subscriberId: d.id,
      });
    }
  }
}

/** 3. Inactif depuis plus de 7 jours sans renouvellement -> notifie l'admin (slot à libérer) */
async function notifierRetardsSuperieurs7Jours(maintenant) {
  const q = query(collection(db, "subscribers"), where("statut", "==", "Inactif"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dateFin = toDate(data.dateFin);
    if (!dateFin) continue;
    const joursDepasses = Math.floor((maintenant - dateFin) / MS_JOUR);
    if (joursDepasses > 7) {
      await createNotificationSiAbsente({
        destinataire: "admin",
        type: "retard",
        message: `${data.nom} (${data.service}) : ${joursDepasses} jours sans renouvellement. Slot à libérer ou remplacer.`,
        subscriberId: d.id,
      });
    }
  }
}

/** 4. Inactif depuis 30+ jours -> suppression définitive + libération du slot */
async function supprimerInactifsDepuis30Jours(maintenant) {
  const q = query(collection(db, "subscribers"), where("statut", "==", "Inactif"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dateFin = toDate(data.dateFin);
    if (!dateFin) continue;
    const joursDepasses = Math.floor((maintenant - dateFin) / MS_JOUR);
    if (joursDepasses >= 30) {
      if (data.emailId) await libererSlot(data.emailId);
      await deleteDoc(doc(db, "subscribers", d.id));
      await logAction(`Auto: ${data.nom} supprimé (inactif 30j+, slot libéré)`);
    }
  }
}

/** Remplacement manuel d'un abonné expiré par un nouveau (libère puis réutilise le slot) */
export async function remplacerAbonne(subscriberId, emailId) {
  await libererSlot(emailId);
  await deleteDoc(doc(db, "subscribers", subscriberId));
  await logAction(`Abonné ${subscriberId} remplacé manuellement, slot libéré`);
}
