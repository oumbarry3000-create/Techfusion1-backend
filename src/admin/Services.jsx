import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";
import { uploadToCloudinary, cloudinaryThumb } from "../lib/cloudinary";
import { logAction } from "../lib/journal";
import { CAPACITE_MAX_EMAIL } from "../lib/slotManager";

export default function Services() {
  const [services, setServices] = useState([]);
  const [serviceOuvert, setServiceOuvert] = useState(null); // service dont on voit les emails
  const [emails, setEmails] = useState([]);
  const [modalService, setModalService] = useState(false);
  const [modalEmail, setModalEmail] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // IMPORTANT : on écoute la collection en temps réel (onSnapshot)
    // -> si l'inscription "ne marche pas", vérifie que ce listener est bien
    // monté AVANT le addDoc, et que les règles Firestore autorisent la lecture.
    const unsub = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!serviceOuvert) {
      setEmails([]);
      return;
    }
    const q = query(collection(db, "emails"), where("serviceId", "==", serviceOuvert.id));
    const unsub = onSnapshot(q, (snap) => {
      setEmails(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [serviceOuvert]);

  async function creerService(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const nom = form.get("nom")?.trim();
    const prixDefaut = Number(form.get("prixDefaut") || 0);
    const fichier = form.get("logo");

    if (!nom) {
      showToast("Le nom du service est obligatoire", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("Session expirée, reconnecte-toi", "error");
      return;
    }

    try {
      let logoUrl = null;
      if (fichier && fichier.size > 0) {
        const up = await uploadToCloudinary(fichier, "services");
        logoUrl = up.url;
      }
      await addDoc(collection(db, "services"), {
        nom,
        prixDefaut,
        logoUrl,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      await logAction(`Service créé: ${nom}`);
      showToast("Service créé", "success");
      setModalService(false);
      e.target.reset();
    } catch (err) {
      showToast("Erreur création service: " + err.message, "error");
    }
  }

  async function creerEmail(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const adresse = form.get("adresse")?.trim();
    const motDePasse = form.get("motDePasse")?.trim();

    if (!adresse) {
      showToast("Adresse email obligatoire", "error");
      return;
    }
    if (!serviceOuvert) {
      showToast("Aucun service sélectionné", "error");
      return;
    }

    try {
      await addDoc(collection(db, "emails"), {
        serviceId: serviceOuvert.id,
        adresse,
        motDePasse,
        capaciteMax: CAPACITE_MAX_EMAIL,
        slotsOccupes: 0,
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      await logAction(`Email ajouté: ${adresse} (${serviceOuvert.nom})`);
      showToast("Email ajouté", "success");
      setModalEmail(false);
      e.target.reset();
    } catch (err) {
      showToast("Erreur ajout email: " + err.message, "error");
    }
  }

  async function supprimerService(id) {
    if (!confirm("Supprimer ce service et tous ses emails ?")) return;
    await deleteDoc(doc(db, "services", id));
    await logAction(`Service supprimé: ${id}`);
    setServiceOuvert(null);
  }

  async function supprimerEmail(id) {
    if (!confirm("Supprimer cet email ?")) return;
    await deleteDoc(doc(db, "emails", id));
    await logAction(`Email supprimé: ${id}`);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Services</h1>
        <button className="btn-primary" onClick={() => setModalService(true)}>
          + Nouveau service
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Liste des services */}
        <div className="space-y-3">
          {services.length === 0 && (
            <p className="text-white/40 text-sm">Aucun service. Crée le premier service ci-dessus.</p>
          )}
          {services.map((s) => (
            <div
              key={s.id}
              onClick={() => setServiceOuvert(s)}
              className={`card cursor-pointer flex items-center gap-3 ${
                serviceOuvert?.id === s.id ? "border-techno-accent" : ""
              }`}
            >
              {s.logoUrl ? (
                <img src={cloudinaryThumb(s.logoUrl, { width: 48, height: 48 })} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                  {s.nom?.[0]}
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{s.nom}</p>
                <p className="text-xs text-white/40">{s.prixDefaut} F / mois par défaut</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  supprimerService(s.id);
                }}
                className="text-white/30 hover:text-techno-danger text-sm"
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>

        {/* Emails du service ouvert */}
        <div>
          {serviceOuvert ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold">Emails — {serviceOuvert.nom}</h2>
                <button className="btn-secondary text-sm" onClick={() => setModalEmail(true)}>
                  + Ajouter email
                </button>
              </div>
              <div className="space-y-2">
                {emails.length === 0 && (
                  <p className="text-white/40 text-sm">
                    Aucun email pour ce service. Les clients ne pourront pas s'abonner tant qu'il
                    n'y a pas d'email disponible.
                  </p>
                )}
                {emails.map((em) => (
                  <div key={em.id} className="card flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{em.adresse}</p>
                      <p className="text-xs text-white/40">
                        {em.slotsOccupes || 0} / {em.capaciteMax || CAPACITE_MAX_EMAIL} places occupées
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          (em.slotsOccupes || 0) >= (em.capaciteMax || CAPACITE_MAX_EMAIL)
                            ? "bg-techno-danger/20 text-techno-danger"
                            : "bg-techno-accent/20 text-techno-accent"
                        }`}
                      >
                        {(em.slotsOccupes || 0) >= (em.capaciteMax || CAPACITE_MAX_EMAIL)
                          ? "Complet"
                          : "Disponible"}
                      </span>
                      <button onClick={() => supprimerEmail(em.id)} className="text-white/30 hover:text-techno-danger text-sm">
                        Suppr.
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-white/40 text-sm">Sélectionne un service pour voir ses emails.</p>
          )}
        </div>
      </div>

      <Modal open={modalService} onClose={() => setModalService(false)} title="Nouveau service">
        <form onSubmit={creerService} className="space-y-3">
          <input name="nom" placeholder="Nom (ex: Netflix)" className="input" required />
          <input name="prixDefaut" type="number" placeholder="Prix par défaut (F)" className="input" />
          <div>
            <label className="text-xs text-white/50">Logo (optionnel)</label>
            <input name="logo" type="file" accept="image/*" className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">Créer</button>
        </form>
      </Modal>

      <Modal open={modalEmail} onClose={() => setModalEmail(false)} title={`Ajouter un email — ${serviceOuvert?.nom || ""}`}>
        <form onSubmit={creerEmail} className="space-y-3">
          <input name="adresse" type="email" placeholder="adresse@email.com" className="input" required />
          <input name="motDePasse" placeholder="Mot de passe du compte" className="input" required />
          <p className="text-xs text-white/40">Ce compte pourra accueillir jusqu'à {CAPACITE_MAX_EMAIL} abonnés.</p>
          <button type="submit" className="btn-primary w-full">Ajouter</button>
        </form>
      </Modal>
    </div>
  );
}
