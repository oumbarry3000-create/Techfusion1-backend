import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { verifierExpirations } from "../lib/expirationChecker";
import { archiverMoisPrecedentSiNecessaire } from "../lib/monthlyReport";

const TABS = [
  { to: "/admin", label: "Accueil", end: true },
  { to: "/admin/services", label: "Services" },
  { to: "/admin/rappels", label: "Rappels" },
  { to: "/admin/paiements", label: "Paiements" },
  { to: "/admin/depenses", label: "Dépenses" },
  { to: "/admin/historique", label: "Historique" },
  { to: "/admin/journal", label: "Journal" },
];

export default function AdminLayout() {
  const { profile, logout } = useAuth();

  useEffect(() => {
    verifierExpirations();
    archiverMoisPrecedentSiNecessaire();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-techno-accent">Techno</span>
          <span className="text-xs text-white/40">Admin</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{profile?.name || profile?.nom}</span>
          <button onClick={logout} className="btn-secondary text-xs">
            Déconnexion
          </button>
        </div>
      </header>

      <nav className="flex gap-1 px-5 py-2 border-b border-white/5 overflow-x-auto">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                isActive ? "bg-techno-accent text-black font-medium" : "text-white/60 hover:bg-white/5"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-5">
        <Outlet />
      </main>
    </div>
  );
}
