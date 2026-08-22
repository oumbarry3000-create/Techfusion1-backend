import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [subsSnap, depSnap, transSnap] = await Promise.all([
        getDocs(collection(db, "subscribers")),
        getDocs(collection(db, "depenses")),
        getDocs(collection(db, "transactions")),
      ]);
      const abonnes = subsSnap.docs.map((d) => d.data());
      const depenses = depSnap.docs.reduce((s, d) => s + Number(d.data().montant || 0), 0);
      const revenus = transSnap.docs.reduce((s, d) => s + Number(d.data().montant || 0), 0);

      setStats({
        total: abonnes.length,
        actifs: abonnes.filter((a) => a.statut === "Actif").length,
        inactifs: abonnes.filter((a) => a.statut === "Inactif").length,
        enAttente: abonnes.filter((a) => a.statut === "En attente").length,
        depenses,
        revenus,
        net: revenus - depenses,
      });
    })();
  }, []);

  if (!stats) return <p className="text-white/50">Chargement...</p>;

  const cards = [
    { label: "Abonnés totaux", value: stats.total },
    { label: "Actifs", value: stats.actifs, color: "text-techno-accent" },
    { label: "Inactifs", value: stats.inactifs, color: "text-techno-danger" },
    { label: "En attente", value: stats.enAttente, color: "text-techno-warn" },
    { label: "Revenus", value: `${stats.revenus.toLocaleString()} F` },
    { label: "Dépenses", value: `${stats.depenses.toLocaleString()} F`, color: "text-techno-danger" },
    { label: "Capital net", value: `${stats.net.toLocaleString()} F`, color: "text-techno-accent" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Tableau de bord</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-white/50 text-xs mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color || ""}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
