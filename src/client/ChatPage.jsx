import { useEffect, useRef, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { poserQuestionIA, getHistoriqueChat } from "../lib/claudeChat";
import { useToast } from "../components/Toast";

export default function ChatPage() {
  const { firebaseUser } = useAuth();
  const [abonnements, setAbonnements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "subscribers"), where("userId", "==", firebaseUser.uid));
    const unsub = onSnapshot(q, (snap) => setAbonnements(snap.docs.map((d) => d.data())));
    getHistoriqueChat(firebaseUser.uid).then(setMessages);
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function envoyer(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setMessages((prev) => [...prev, { question: q, reponse: null }]);
    setLoading(true);
    try {
      const contexte = abonnements.map((a) => ({
        service: a.service,
        statut: a.statut,
        dateFin: a.dateFin,
      }));
      const reponse = await poserQuestionIA({ userId: firebaseUser.uid, question: q, contexteAbonnements: contexte });
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { question: q, reponse };
        return copy;
      });
    } catch (err) {
      showToast("Erreur assistant: " + err.message, "error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <h1 className="text-2xl font-bold mb-3">Assistant Techno</h1>
      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <p className="text-white/40 text-sm">
            Pose-moi une question sur tes abonnements, dates d'expiration, ou comment te connecter.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <div className="bg-techno-accent/10 rounded-xl rounded-br-sm px-3 py-2 text-sm ml-auto max-w-[85%] w-fit">
              {m.question}
            </div>
            <div className="bg-white/5 rounded-xl rounded-bl-sm px-3 py-2 text-sm max-w-[85%] w-fit">
              {m.reponse || "..."}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={envoyer} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Écris ta question..."
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "..." : "Envoyer"}
        </button>
      </form>
    </div>
  );
}
