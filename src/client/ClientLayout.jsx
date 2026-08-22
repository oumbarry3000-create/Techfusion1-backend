import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { verifierExpirations } from "../lib/expirationChecker";

const TABS = [
  { to: "/app", label: "Services", end: true },
  { to: "/app/profil", label: "Mon profil" },
  { to: "/app/notifications", label: "Notifs" },
  { to: "/app/chat", label: "Assistant" },
];

export default function ClientLayout() {
  const { profile, logout } = useAuth();

  useEffect(() => {
    verifierExpirations();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 px-5 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-techno-accent">Techno</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{profile?.nom}</span>
          <button onClick={logout} className="btn-secondary text-xs">Déconnexion</button>
        </div>
      </header>

      <main className="flex-1 p-5 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-techno-panel border-t border-white/10 flex justify-around py-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `text-xs px-3 py-1.5 rounded-lg ${isActive ? "text-techno-accent font-semibold" : "text-white/50"}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
