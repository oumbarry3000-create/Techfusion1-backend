const STYLES = {
  Actif: "bg-techno-accent/20 text-techno-accent",
  Inactif: "bg-techno-danger/20 text-techno-danger",
  "En attente": "bg-techno-warn/20 text-techno-warn",
};

export default function StatusBadge({ statut }) {
  return (
    <span className={`badge ${STYLES[statut] || "bg-white/10 text-white"}`}>
      {statut}
    </span>
  );
}
