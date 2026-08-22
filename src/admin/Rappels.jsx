import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { logAction } from "../lib/journal";
import { remplacerAbonne } from "../lib/expirationChecker";

function toDate(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}
function joursEntre(a, b) {
  return Math.ceil((a - b) / (1000 * 60 * 60 * 24));
}

export default function Rappels() {
  const [abonnes, setAbonnes] = useState([]);
  const [cible, setCible] = useState(null);
  const [modalRenouv, setModalRenouv] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "subscribers"), (snap) => {
      setAbonnes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const maintenant = new Date();
  const actifs = abonnes.filter((a) => a.statut === "Actif" && toDate(a.dateFin));
  const j0 = actifs.filter((a) => joursEntre(toDate(a.dateFin), maintenant) === 0);
  const j1a3 = actifs.filter((a) => {
    const j = joursEntre(toDate(a.dateFin), maintenant);
    return j >= 1 && j <= 3;
  });
  const j4a7 = actifs.filter((a) => {
    const j = joursEntre(toDate(a.dateFin), maintenant);
    return j >= 4 && j <= 7;
  });

  const inactifsRecents = abonnes.filter((a) => {
    if (a.statut !== "Inactif") return false;
    const j = joursEntre(maintenant, toDate(a.dateFin));
    return j >= 0 && j <= 30;
  });

  const retardsCritiques = inactifsRecents.filter((a) => joursEntre(maintenant, toDate(a.dateFin)) > 7);

  async function renouveler(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const mois = Number(form.get("mois"));
    const prix = Number(form.get("prix"));
    const net = Math.max(0, prix);

    const nouvelleDateFin = new Date(toDate(cible.dateFin) < maintenant ? maintenant : toDate(cible.dateFin));
    nouvelleDateFin.setMonth(nouvelleDateFin.getMonth() + mois);

    try {
      await updateDoc(doc(db, "subscribers", cible.id), {
        statut: "Actif",
        mois,
        prix,
        net,
        dateFin: nouvelleDateFin,
        renewalMissedCount: 0,
      });
      await addDoc(collection(db, "transactions"), {
        abonneId: cible.id,
        nom: cible.nom,
        service: cible.service,
        montant: net,
        datePaiement: serverTimestamp(),
        type: "renouvellement",
      });
      await logAction(`Renouvellement: ${cible.nom} (${cible.service}) +${mois} mois`);
      showToast("Abonnement renouvelé", "success");
      setModalRenouv(false);
    } catch (err) {
      showToast("Erreur: " + err.message, "error");
    }
  }

  async function supprimerEtLibererSlot(abonne) {
    if (!confirm(`Supprimer ${abonne.nom} et libérer le slot ?`)) return;
    await remplacerAbonne(abonne.id, abonne.emailId);
    showToast("Abonné supprimé, slot libéré", "success");
  }

  function Section({ titre, liste, urgence }) {
    return (
      <div className="card">
        <h3 className={`font-semibold mb-3 ${urgence ? "text-techno-danger" : "text-techno-warn"}`}>
          {titre} ({liste.length})
        </h3>
        <div className="space-y-2">
          {liste.length === 0 && <p className="text-white/30 text-sm">Rien ici.</p>}
          {liste.map((a) => (
            <div key={a.id} className="flex justify-between items-center bg-black/20 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">{a.nom}</p>
                <p className="text-xs text-white/40">{a.service}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge statut={a.statut} />
                <button
                  className="btn-primary text-xs py-1"
                  onClick={() => {
                    setCible(a);
                    setModalRenouv(true);
                  }}
                >
                  Renouveler
                </button>
                <button
                  className="btn-danger text-xs py-1"
                  onClick={() => supprimerEtLibererSlot(a)}
                >
                  Suppr.
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Rappels</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Section titre="Expire aujourd'hui (J-0)" liste={j0} urgence />
        <Section titre="Expire dans 1 à 3 jours" liste={j1a3} urgence />
        <Section titre="Expire dans 4 à 7 jours" liste={j4a7} />
        <Section titre="Retard > 7 jours (slot à libérer)" liste={retardsCritiques} urgence />
      </div>

      <h2 className="text-lg font-semibold mt-6 mb-3">Inactifs récents (J+0 à J+30)</h2>
      <div className="space-y-2">
        {inactifsRecents.map((a) => (
          <div key={a.id} className="card flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{a.nom} — {a.service}</p>
              <p className="text-xs text-white/40">
                Expiré depuis {joursEntre(maintenant, toDate(a.dateFin))} jour(s)
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-xs py-1" onClick={() => { setCible(a); setModalRenouv(true); }}>
                Renouveler
              </button>
              <button className="btn-danger text-xs py-1" onClick={() => supprimerEtLibererSlot(a)}>
                Remplacer / Suppr.
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalRenouv} onClose={() => setModalRenouv(false)} title={`Renouveler — ${cible?.nom || ""}`}>
        <form onSubmit={renouveler} className="space-y-3">
          <input name="mois" type="number" placeholder="Nombre de mois" className="input" defaultValue={1} required />
          <input name="prix" type="number" placeholder="Prix (F)" className="input" defaultValue={cible?.prix} required />
          <button type="submit" className="btn-primary w-full">Confirmer le renouvellement</button>
        </form>
      </Modal>
    </div>
  );
}
