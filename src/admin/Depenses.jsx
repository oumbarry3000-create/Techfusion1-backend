import { useEffect, useState } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { logAction } from "../lib/journal";

export default function Depenses() {
  const [depenses, setDepenses] = useState([]);
  const [modal, setModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "depenses"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => setDepenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function ajouter(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await addDoc(collection(db, "depenses"), {
        date: form.get("date") || new Date().toISOString().slice(0, 10),
        montant: Number(form.get("montant")),
        service: form.get("service"),
        motif: form.get("motif"),
        admin: auth.currentUser?.email,
        createdAt: serverTimestamp(),
      });
      await logAction(`Dépense ajoutée: ${form.get("montant")} F (${form.get("motif")})`);
      showToast("Dépense ajoutée", "success");
      setModal(false);
      e.target.reset();
    } catch (err) {
      showToast("Erreur: " + err.message, "error");
    }
  }

  async function supprimer(id) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await deleteDoc(doc(db, "depenses", id));
    await logAction(`Dépense supprimée: ${id}`);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Dépenses</h1>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Nouvelle dépense</button>
      </div>
      <div className="space-y-2">
        {depenses.map((d) => (
          <div key={d.id} className="card flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{d.motif} — {d.service}</p>
              <p className="text-xs text-white/40">{d.date} • {d.admin}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-techno-danger font-semibold">-{Number(d.montant).toLocaleString()} F</span>
              <button onClick={() => supprimer(d.id)} className="text-white/30 hover:text-techno-danger text-sm">Suppr.</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle dépense">
        <form onSubmit={ajouter} className="space-y-3">
          <input name="date" type="date" className="input" defaultValue={new Date().toISOString().slice(0,10)} />
          <input name="montant" type="number" placeholder="Montant (F)" className="input" required />
          <input name="service" placeholder="Service concerné" className="input" />
          <input name="motif" placeholder="Motif" className="input" required />
          <button type="submit" className="btn-primary w-full">Ajouter</button>
        </form>
      </Modal>
    </div>
  );
}
