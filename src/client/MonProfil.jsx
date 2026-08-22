import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

function toDate(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

export default function MonProfil() {
  const { firebaseUser, profile } = useAuth();
  const [abonnements, setAbonnements] = useState([]);
  const [emails, setEmails] = useState({});

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "subscribers"), where("userId", "==", firebaseUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAbonnements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    // Charge l'adresse email attribuée pour chaque abonnement actif
    const unsubs = abonnements
      .filter((a) => a.statut === "Actif" && a.emailId)
      .map((a) => {
        return import("firebase/firestore").then(({ doc, onSnapshot: onSnap }) =>
          onSnap(doc(db, "emails", a.emailId), (snap) => {
            if (snap.exists()) {
              setEmails((prev) => ({ ...prev, [a.id]: snap.data() }));
            }
          })
        );
      });
    return () => unsubs.forEach((p) => p.then((u) => u && u()));
  }, [abonnements]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Mon profil</h1>
      <p className="text-white/40 text-sm mb-5">{profile?.nom} • {profile?.telephone}</p>

      <h2 className="font-semibold mb-3">Mes abonnements</h2>
      <div className="space-y-3">
        {abonnements.length === 0 && (
          <p className="text-white/40 text-sm">Tu n'as aucun abonnement. Va dans l'onglet Services pour t'abonner.</p>
        )}
        {abonnements.map((a) => (
          <div key={a.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <p className="font-medium">{a.service}</p>
              <StatusBadge statut={a.statut} />
            </div>
            <p className="text-xs text-white/40">
              Du {toDate(a.dateAbonnement)?.toLocaleDateString()} au {toDate(a.dateFin)?.toLocaleDateString()}
            </p>
            {a.statut === "Actif" && emails[a.id] && (
              <div className="mt-3 bg-black/30 rounded-lg p-3 text-sm">
                <p className="text-white/50 text-xs mb-1">Identifiants de connexion :</p>
                <p>Email : <span className="font-mono">{emails[a.id].adresse}</span></p>
                <p>Mot de passe : <span className="font-mono">{emails[a.id].motDePasse}</span></p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
