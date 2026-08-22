import { useEffect, useState } from "react";
import { getJournal, effacerJournal } from "../lib/journal";
import { useToast } from "../components/Toast";

export default function Journal() {
  const [logs, setLogs] = useState([]);
  const { showToast } = useToast();

  async function charger() {
    setLogs(await getJournal());
  }

  useEffect(() => {
    charger();
  }, []);

  async function effacer() {
    if (!confirm("Effacer tout le journal ?")) return;
    await effacerJournal();
    showToast("Journal effacé", "success");
    charger();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Journal d'activité</h1>
        <button className="btn-danger" onClick={effacer}>Effacer le journal</button>
      </div>
      <div className="space-y-1">
        {logs.map((l) => (
          <div key={l.id} className="text-sm py-2 border-b border-white/5 flex justify-between">
            <span>{l.action}</span>
            <span className="text-white/30 text-xs">{l.admin}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
