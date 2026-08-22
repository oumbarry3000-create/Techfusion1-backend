import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { logAction } from "../lib/journal";

export default function Paiements() {
  const [transactions, setTransactions] = useState([]);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("datePaiement", "desc"));
    const unsub = onSnapshot(q, (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function supprimer(id) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await deleteDoc(doc(db, "transactions", id));
    await logAction(`Transaction supprimée: ${id}`);
  }

  const filtrees = transactions.filter(
    (t) =>
      t.nom?.toLowerCase().includes(recherche.toLowerCase()) ||
      t.service?.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Paiements</h1>
      <input
        placeholder="Rechercher par nom ou service..."
        className="input mb-4 max-w-sm"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      <div className="space-y-2">
        {filtrees.map((t) => (
          <div key={t.id} className="card flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{t.nom} — {t.service}</p>
              <p className="text-xs text-white/40">
                {t.type === "inscription" ? "Nouvelle inscription" : "Renouvellement"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-techno-accent font-semibold">+{Number(t.montant).toLocaleString()} F</span>
              <button onClick={() => supprimer(t.id)} className="text-white/30 hover:text-techno-danger text-sm">Suppr.</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
