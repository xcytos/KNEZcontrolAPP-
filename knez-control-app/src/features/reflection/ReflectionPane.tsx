import React, { useState } from "react";
import { knezClient, KnezInsight } from "../../services/KnezClient";
import { Sparkles } from "lucide-react";
import { persistenceService } from "../../services/PersistenceService";
import { sessionController } from "../../services/SessionController";

type Props = {
  sessionId: string | null;
  readOnly: boolean;
};

export const ReflectionPane: React.FC<Props> = ({ sessionId, readOnly }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<KnezInsight[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  React.useEffect(() => {
    persistenceService.listSessions().then((ids) => {
      setSessions(ids);
      if (!selected && sessionId) setSelected(sessionId);
    });
  }, [sessionId]);

  const handleAnalyze = async () => {
    if (readOnly) return;
    const sid = selected || sessionId;
    if (!sid) return;
    setAnalyzing(true);
    setError(null);
    try {
      const [ins, sum] = await Promise.all([
        knezClient.getInsights(sid),
        knezClient.getSummary(sid),
      ]);
      setInsights(ins);
      setSummary(sum);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("Failed to fetch")) {
        setError("KNEZ is unreachable. Start KNEZ and retry.");
      } else if (msg.includes("404")) {
        setError("Session not found on KNEZ. Switch to a session that has events.");
      } else {
        setError("KNEZ reflection unavailable for this session.");
      }
      setInsights([]);
      setSummary(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-light text-zinc-200">Reflection Mode</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Delegated to KNEZ replay and insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Chat
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "memory" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Memory
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "replay" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Replay
          </button>
        </div>
      </div>

      {!readOnly && sessions.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <select
            value={selected ?? ""}
            onChange={(e) => {
              const sid = e.target.value;
              setSelected(sid);
              sessionController.useSession(sid);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-zinc-200 outline-none focus:border-purple-700"
          >
            {sessions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || readOnly || !(selected || sessionId)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              analyzing
                ? "bg-zinc-800 text-zinc-500 cursor-wait"
                : "bg-purple-900/30 text-purple-300 border border-purple-800 hover:bg-purple-900/50"
            }`}
          >
            {analyzing ? "Analyzing..." : "Analyze Session"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4">
        {readOnly && (
          <div className="p-6 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
            Reflection is unavailable in read-only mode.
          </div>
        )}
        {!readOnly && error && (
          <div className="p-6 text-center border border-dashed border-red-900/40 rounded-lg text-red-400">
            {error}
          </div>
        )}
        {!readOnly && !error && insights.length === 0 && !analyzing && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
            <Sparkles size={48} className="mb-4 opacity-20" />
            <p>No active reflection analysis.</p>
            <p className="text-xs mt-2">Trigger an analysis to view observations.</p>
          </div>
        )}

        {summary && (
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Session Summary
            </div>
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
              {JSON.stringify(summary, null, 2)}
            </pre>
          </div>
        )}

        {insights.map((i) => (
          <div key={i.insight_id} className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-md font-medium text-zinc-200">{i.message}</h3>
              <span className="text-xs text-zinc-500 font-mono">{i.severity}</span>
            </div>
            <div className="mt-3 text-xs text-zinc-500 font-mono">
              evidence: {typeof i.evidence === "string" ? i.evidence : JSON.stringify(i.evidence)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
