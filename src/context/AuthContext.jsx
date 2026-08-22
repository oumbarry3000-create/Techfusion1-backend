import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // doc admins/{uid} ou users/{uid}
  const [role, setRole] = useState(null); // "admin" | "client"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      try {
      if (!u) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      // On vérifie d'abord si c'est un admin, sinon on cherche côté client
      const adminSnap = await getDoc(doc(db, "admins", u.uid));
      if (adminSnap.exists()) {
        setProfile({ uid: u.uid, ...adminSnap.data() });
        setRole("admin");
      } else {
        const clientSnap = await getDoc(doc(db, "users", u.uid));
        if (clientSnap.exists()) {
          setProfile({ uid: u.uid, ...clientSnap.data() });
          setRole("client");
        }
      }
      } catch (error) {
        console.error("Impossible de charger le profil utilisateur :", error);
        setProfile(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Inscription abonné final (auto-service)
  async function signupClient({ email, password, nom, telephone }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      nom,
      telephone,
      email,
      createdAt: serverTimestamp(),
    });
    return cred.user;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    return signOut(auth);
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        role,
        loading,
        signupClient,
        login,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
