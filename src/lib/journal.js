import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, deleteDoc, doc, getDocs as _getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";

export async function logAction(action) {
  const admin = auth.currentUser;
  await addDoc(collection(db, "logs"), {
    admin: admin?.email || "système",
    action,
    date: serverTimestamp(),
  });
}

export async function getJournal() {
  const q = query(collection(db, "logs"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function effacerJournal() {
  const snap = await _getDocs(collection(db, "logs"));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "logs", d.id))));
}
