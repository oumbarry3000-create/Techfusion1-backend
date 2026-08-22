import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const { login, signupClient, resetPassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.target);
    const email = form.get("email")?.trim();
    const password = form.get("password");

    try {
      if (mode === "signup") {
        const nom = form.get("nom")?.trim();
        const telephone = form.get("telephone")?.trim();
        if (!nom || !email || !password) {
          showToast("Remplis tous les champs", "error");
          setLoading(false);
          return;
        }
        await signupClient({ email, password, nom, telephone });
        showToast("Compte créé, bienvenue !", "success");
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err) {
      showToast(traduireErreur(err.code) || err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const email = prompt("Ton adresse email :");
    if (!email) return;
    try {
      await resetPassword(email);
      showToast("Email de réinitialisation envoyé", "success");
    } catch (err) {
      showToast("Erreur: " + err.message, "error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold text-techno-accent mb-1">Techno</h1>
        <p className="text-white/40 text-sm mb-5">
          {mode === "login" ? "Connecte-toi à ton compte" : "Crée ton compte abonné"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <input name="nom" placeholder="Nom complet" className="input" required />
              <input name="telephone" placeholder="Téléphone" className="input" required />
            </>
          )}
          <input name="email" type="email" placeholder="Email" className="input" required />
          <input name="password" type="password" placeholder="Mot de passe" className="input" required minLength={6} />
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <div className="flex justify-between mt-4 text-xs text-white/50">
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="hover:text-white">
            {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
          </button>
          {mode === "login" && (
            <button onClick={handleReset} className="hover:text-white">
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function traduireErreur(code) {
  const map = {
    "auth/email-already-in-use": "Cet email est déjà utilisé.",
    "auth/invalid-email": "Email invalide.",
    "auth/weak-password": "Mot de passe trop court (6 caractères min).",
    "auth/user-not-found": "Aucun compte avec cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
  };
  return map[code];
}
