import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { cloudinaryThumb } from "../lib/cloudinary";
import { trouverEmailDisponible } from "../lib/slotManager";
import { initPayment } from "../api/payment";

export default function Catalogue() {
  const [services, setServices] = useState([]);
  const [cible, setCible] = useState(null);
  const [disponibilite, setDisponibilite] = useState(null);
  const [loading, setLoading] = useState(false);  // <-- nouveau
  const { showToast } = useToast();
  const { profile, firebaseUser } = useAuth();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Vérification de disponibilité (inchangée)
  async function ouvrirAbonnement(service) {
    setCible(service);
    setDisponibilite(null);
    // On pourrait garder la vérification de slot, mais elle sera faite au moment de l'activation
    // après paiement. Ici, on peut soit la conserver (pour afficher "complet" rapidement)
    // soit la supprimer car on vérifiera au moment de la création.
    // Je la garde mais elle deviendra indicative.
    const email = await trouverEmailDisponible(service.id);
    setDisponibilite(!!email);
  }

  async function confirmerAbonnement(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const mois = Number(form.get("mois"));
    const prix = Number(form.get("prix"));

    // Vérifier que l'utilisateur est connecté
    if (!firebaseUser) {
      showToast("Vous devez être connecté", "error");
      return;
    }

    setLoading(true);
    try {
      // 1. Initier le paiement auprès de notre serveur
      const { paymentUrl, transactionId } = await initPayment(
        firebaseUser.uid,
        cible.id,
        prix
      );
      // 2. Rediriger l'utilisateur vers la page de paiement CinetPay
      window.location.href = paymentUrl;
      // (la page de confirmation se chargera du suivi)
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'initiation du paiement : " + err.message, "error");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Nos services</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {services.map((s) => (
          <div key={s.id} className="card cursor-pointer" onClick={() => ouvrirAbonnement(s)}>
            {s.logoUrl ? (
              <img src={cloudinaryThumb(s.logoUrl, { width: 100, height: 100 })} className="w-16 h-16 rounded-xl object-cover mb-2" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-xl mb-2">
                {s.nom?.[0]}
              </div>
            )}
            <p className="font-medium">{s.nom}</p>
            <p className="text-xs text-white/40">{s.prixDefaut} F / mois</p>
          </div>
        ))}
        {services.length === 0 && <p className="text-white/40 text-sm">Aucun service disponible pour le moment.</p>}
      </div>

      <Modal open={!!cible} onClose={() => setCible(null)} title={`S'abonner — ${cible?.nom || ""}`}>
        {disponibilite === null && <p className="text-white/50 text-sm">Vérification de la disponibilité...</p>}
        {disponibilite === false && (
          <p className="text-techno-danger text-sm">
            Ce service est complet actuellement. Reviens plus tard ou contacte le support.
          </p>
        )}
        {disponibilite === true && (
          <form onSubmit={confirmerAbonnement} className="space-y-3">
            <input name="mois" type="number" placeholder="Nombre de mois" defaultValue={1} className="input" required />
            <input
              name="prix"
              type="number"
              placeholder="Prix total (F)"
              defaultValue={cible?.prixDefaut}
              className="input"
              required
            />
            <p className="text-xs text-white/40">
              Paiement sécurisé via CinetPay (mobile money / carte)
            </p>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Initialisation..." : "Payer maintenant"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
