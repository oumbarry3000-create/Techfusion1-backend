import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import AuthPage from "./client/AuthPage";
import ClientLayout from "./client/ClientLayout";
import Catalogue from "./client/Catalogue";
import MonProfil from "./client/MonProfil";
import NotificationsPage from "./client/NotificationsPage";
import ChatPage from "./client/ChatPage";
import PaymentConfirmation from "./client/PaymentConfirmation"; // <-- Nouvel import

import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import Services from "./admin/Services";
import Rappels from "./admin/Rappels";
import Paiements from "./admin/Paiements";
import Depenses from "./admin/Depenses";
import Historique from "./admin/Historique";
import Journal from "./admin/Journal";

function Chargement() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/40">Chargement...</p>
    </div>
  );
}

export default function App() {
  const { firebaseUser, role, loading } = useAuth();

  if (loading) return <Chargement />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Si non authentifié */}
        {!firebaseUser && (
          <>
            <Route path="/" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}

        {/* Routes communes à tout utilisateur connecté */}
        {firebaseUser && (
          <Route path="/payment-confirmation" element={<PaymentConfirmation />} />
        )}

        {/* Routes admin */}
        {firebaseUser && role === "admin" && (
          <>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="services" element={<Services />} />
              <Route path="rappels" element={<Rappels />} />
              <Route path="paiements" element={<Paiements />} />
              <Route path="depenses" element={<Depenses />} />
              <Route path="historique" element={<Historique />} />
              <Route path="journal" element={<Journal />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" />} />
          </>
        )}

        {/* Routes client */}
        {firebaseUser && role === "client" && (
          <>
            <Route path="/app" element={<ClientLayout />}>
              <Route index element={<Catalogue />} />
              <Route path="profil" element={<MonProfil />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" />} />
          </>
        )}

        {/* Cas où l'utilisateur est connecté mais sans rôle */}
        {firebaseUser && !role && (
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center text-white/50">
                Compte sans rôle assigné. Contacte l'administrateur.
              </div>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}