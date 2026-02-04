import React, { useState } from "react";
import { knezClient, KnezInsight } from "../../services/KnezClient";

type Props = {
  sessionId: string | null;
  readOnly: boolean;
};

export const ReflectionPane: React.FC<Props> = ({ sessionId, readOnly }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<KnezInsight[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (readOnly) return;
    if (!sessionId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const [ins, sum] = await Promise.all([
        knezClient.getInsights(sessionId),
        knezClient.getSummary(sessionId),
      ]);
      setInsights(ins);
      setSummary(sum);
    } catch {
      setError("KNEZ reflection unavailable for this session.");
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
        
        <button
          onClick={handleAnalyze}
          disabled={analyzing || readOnly || !sessionId}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            analyzing
              ? 'bg-zinc-800 text-zinc-500 cursor-wait'
              : 'bg-purple-900/30 text-purple-300 border border-purple-800 hover:bg-purple-900/50'
          }`}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Session'}
        </button>
      </div>

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
            <span className="text-4xl mb-4 opacity-20">🔮</span>
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
