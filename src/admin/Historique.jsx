import { useEffect, useState } from "react";
import { getHistorique, archiverMoisCourant } from "../lib/monthlyReport";
import { useToast } from "../components/Toast";

export default function Historique() {
  const [historique, setHistorique] = useState([]);
  const { showToast } = useToast();

  async function charger() {
    const h = await getHistorique();
    setHistorique(h.sort((a, b) => (a.mois < b.mois ? 1 : -1)));
  }

  useEffect(() => {
    charger();
  }, []);

  async function archiverManuel() {
    try {
      const mois = await archiverMoisCourant();
      showToast(`Bilan ${mois} archivé`, "success");
      charger();
    } catch (err) {
      showToast("Erreur: " + err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Historique mensuel</h1>
        <button className="btn-primary" onClick={archiverManuel}>Archiver le mois en cours</button>
      </div>
      <p className="text-xs text-white/40 mb-4">
        Le mois précédent est archivé automatiquement à la première ouverture de l'app admin
        après le changement de mois. Tu peux aussi forcer l'archivage du mois en cours ci-dessus.
      </p>
      <div className="space-y-3">
        {historique.map((h) => (
          <div key={h.id} className="card grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-4 font-semibold mb-1">{h.mois}</div>
            <div><p className="text-xs text-white/40">Abonnés</p><p className="font-bold">{h.abonnes}</p></div>
            <div><p className="text-xs text-white/40">Actifs</p><p className="font-bold text-techno-accent">{h.actifs}</p></div>
            <div><p className="text-xs text-white/40">Nouveaux</p><p className="font-bold">{h.nouveaux}</p></div>
            <div><p className="text-xs text-white/40">Renouvellements</p><p className="font-bold">{h.renouvellements}</p></div>
            <div><p className="text-xs text-white/40">Revenus</p><p className="font-bold">{h.revenus?.toLocaleString()} F</p></div>
            <div><p className="text-xs text-white/40">Dépenses</p><p className="font-bold text-techno-danger">{h.depenses?.toLocaleString()} F</p></div>
            <div><p className="text-xs text-white/40">Capital net</p><p className="font-bold text-techno-accent">{h.capitalNet?.toLocaleString()} F</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
