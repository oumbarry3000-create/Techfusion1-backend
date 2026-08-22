import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// ⚠️ IMPORTANT SÉCURITÉ ⚠️
// Cet appel se fait directement depuis le navigateur (comme demandé : pas de backend).
// Cela veut dire que ta clé API Claude est visible dans le code source de l'app
// (n'importe qui peut l'extraire et l'utiliser à tes frais).
// Solution recommandée avant mise en prod : passer par une seule petite fonction
// serverless (ex: /api/chat sur Vercel, gratuit) qui cache la clé. Voir /server/chat-proxy.js
// fourni dans ce projet à titre d'exemple optionnel.

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export async function poserQuestionIA({ userId, question, contexteAbonnements }) {
  const systemPrompt = `Tu es l'assistant support de Techno, une app d'abonnements digitaux partagés (Netflix, Spotify, ChatGPT Plus, Claude, CapCut, etc).
Tu réponds UNIQUEMENT aux questions sur :
- le statut et les dates des abonnements du client
- comment se connecter avec le compte partagé
- la procédure de renouvellement
- les problèmes de connexion basiques (mot de passe, écran de connexion)
Réponds en français, de façon brève et claire. Si la question sort de ce cadre, redirige poliment vers le support humain.

Voici les abonnements actuels de ce client :
${JSON.stringify(contexteAbonnements, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });

  if (!res.ok) {
    throw new Error("Erreur IA: " + (await res.text()));
  }

  const data = await res.json();
  const reponse = data.content?.find((b) => b.type === "text")?.text || "Désolé, je n'ai pas pu répondre.";

  await addDoc(collection(db, "chatMessages"), {
    userId,
    question,
    reponse,
    date: serverTimestamp(),
  });

  return reponse;
}

export async function getHistoriqueChat(userId) {
  const q = query(
    collection(db, "chatMessages"),
    where("userId", "==", userId),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
