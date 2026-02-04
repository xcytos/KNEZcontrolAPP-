import React, { useEffect, useState } from "react";
import { knezClient, KnezMemoryRecord } from "../../services/KnezClient";

type Props = {
  sessionId: string | null;
  readOnly: boolean;
};

export const MemoryExplorer: React.FC<Props> = ({ sessionId, readOnly }) => {
  const [records, setRecords] = useState<KnezMemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = async () => {
    if (!sessionId) return;
    if (readOnly) return;
    setLoading(true);
    setError(null);
    try {
      const data = await knezClient.listMemory(sessionId, 200);
      setRecords(data);
    } catch (e) {
      setError("Failed to fetch memory from KNEZ.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [sessionId, readOnly]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4 bg-orange-900/20 border border-orange-900/50 p-3 rounded-lg flex items-center gap-3">
        <div className="text-xl">⚠️</div>
        <div>
          <h4 className="text-sm font-semibold text-orange-200">Validation Mode Active</h4>
          <p className="text-xs text-orange-300/80">Memory captured during this phase is untrusted and should be considered temporary.</p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-light text-zinc-200">Memory Index</h2>
        <div className="flex space-x-2">
           <button 
             onClick={fetchMemories}
             disabled={readOnly || !sessionId}
             className="text-xs px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50"
           >
             Refresh
           </button>
           <span className="text-xs px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-zinc-400">
             {records.length} Items
           </span>
        </div>
      </div>

      <div className="space-y-4">
        {readOnly ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
            <p className="text-sm">Read-only mode.</p>
            <p className="text-xs mt-2 opacity-50">Trust and connect to KNEZ to load memory.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-zinc-500">Loading memory...</div>
        ) : error ? (
          <div className="p-8 text-center border border-dashed border-red-900/40 rounded-lg text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
             <p className="text-sm">No memory entries found.</p>
             <p className="text-xs mt-2 opacity-50">KNEZ returned zero memory records for this session.</p>
          </div>
        ) : (
        records.map((mem) => (
          <div key={mem.memory_id} className="group p-4 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-900/50 uppercase tracking-wide font-bold">UNTRUSTED</span>
                <h3 className="text-sm font-medium text-zinc-200 group-hover:text-blue-400 transition-colors">
                  {mem.summary}
                </h3>
              </div>
              {mem.confidence > 0.8 && (
                <span className="w-2 h-2 rounded-full bg-orange-500" />
              )}
            </div>
            <div className="mt-3 flex items-center space-x-4 text-xs text-zinc-600 font-mono">
              <span>ID: {mem.memory_id}</span>
              <span>{new Date(mem.created_at).toLocaleDateString()}</span>
              <span>type={mem.memory_type}</span>
              <span>conf={mem.confidence.toFixed(2)}</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              <div>retention: {mem.retention_policy}</div>
              <div>evidence events: {mem.evidence_event_ids.join(", ") || "none"}</div>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
};
