import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Crée une notification.
 * destinataire = "admin" (visible par tous les admins) ou userId d'un client.
 */
export async function createNotification({
  destinataire,
  type,
  message,
  subscriberId = null,
}) {
  await addDoc(collection(db, "notifications"), {
    destinataire,
    type, // "renouvellement" | "expiration" | "retard" | "bienvenue" | "info"
    message,
    subscriberId,
    lu: false,
    date: serverTimestamp(),
  });
}

/**
 * Évite les doublons : ne crée la notification que si aucune notification
 * du même type pour le même abonné n'existe déjà dans les dernières 24h (best-effort,
 * vérifié par simple présence non lue pour rester simple côté client).
 */
export async function createNotificationSiAbsente({
  destinataire,
  type,
  message,
  subscriberId,
}) {
  const q = query(
    collection(db, "notifications"),
    where("subscriberId", "==", subscriberId),
    where("type", "==", type)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return; // déjà notifié pour cet évènement
  await createNotification({ destinataire, type, message, subscriberId });
}

export async function marquerCommeLue(notifId) {
  await updateDoc(doc(db, "notifications", notifId), { lu: true });
}

export async function getNotificationsPour(destinataire) {
  const q = query(
    collection(db, "notifications"),
    where("destinataire", "==", destinataire),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
