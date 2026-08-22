import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getNotificationsPour, marquerCommeLue } from "../lib/notifications";

function toDate(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

const ICONS = {
  renouvellement: "⏰",
  expiration: "⚠️",
  retard: "🔴",
  bienvenue: "🎉",
  info: "ℹ️",
};

export default function NotificationsPage() {
  const { firebaseUser } = useAuth();
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!firebaseUser) return;
    getNotificationsPour(firebaseUser.uid).then(setNotifs);
  }, [firebaseUser]);

  async function lire(n) {
    if (n.lu) return;
    await marquerCommeLue(n.id);
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Notifications</h1>
      <div className="space-y-2">
        {notifs.length === 0 && <p className="text-white/40 text-sm">Aucune notification.</p>}
        {notifs.map((n) => (
          <div
            key={n.id}
            onClick={() => lire(n)}
            className={`card cursor-pointer flex gap-3 ${!n.lu ? "border-techno-accent" : ""}`}
          >
            <span className="text-xl">{ICONS[n.type] || "ℹ️"}</span>
            <div>
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-white/30 mt-1">{toDate(n.date)?.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
