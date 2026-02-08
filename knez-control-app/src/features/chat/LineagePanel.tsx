import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { ResumeSnapshot } from '../../domain/DataContracts';
import { sessionController } from '../../services/SessionController';

export const LineagePanel: React.FC<{ sessionId: string; onResume: (sid: string) => void }> = ({ sessionId, onResume }) => {
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null);
  const [chain, setChain] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    Promise.allSettled([
      knezClient.getResumeSnapshot(sessionId),
      knezClient.getSessionLineageChain(sessionId),
    ])
      .then(([snap, lin]) => {
        setSnapshot(snap.status === "fulfilled" ? snap.value : null);
        setChain(lin.status === "fulfilled" ? (lin.value?.chain ?? null) : null);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="p-4 text-xs text-zinc-500">Tracing lineage...</div>;
  if (!snapshot && !chain) return <div className="p-4 text-xs text-zinc-500">No lineage data available for this session.</div>;
  const headId = sessionId;
  const acceptedFacts = Array.isArray((snapshot as any).accepted_facts) ? (snapshot as any).accepted_facts : [];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-bold text-zinc-300">Session Lineage</h3>
      
      <div className="relative pl-4 border-l-2 border-zinc-700">
         <div className="absolute -left-[5px] top-0 w-2 h-2 bg-blue-500 rounded-full" />
         <div className="text-xs text-zinc-400 mb-1">Current Head</div>
         <div className="text-xs font-mono text-white bg-zinc-800 p-2 rounded mb-2">
           {headId.substring(0, 8)}...
         </div>
      </div>

      {Array.isArray(chain) && chain.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded p-3">
          <div className="text-[10px] uppercase text-zinc-500 mb-2">Chain</div>
          <div className="space-y-2">
            {chain.map((c: any, idx: number) => (
              <div key={idx} className="text-[10px] font-mono text-zinc-300 flex items-center justify-between">
                <button
                  onClick={() => {
                    const sid = String(c.session_id ?? "");
                    if (sid) sessionController.useSession(sid);
                  }}
                  className="hover:text-blue-300"
                >
                  {String(c.session_id ?? "").slice(0, 8)}...
                </button>
                <span className="text-zinc-500">{String(c.resume_mode ?? "fresh")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded p-3">
        <div className="text-[10px] uppercase text-zinc-500 mb-2">Resume Snapshot State</div>
        <div className="text-xs text-zinc-300 mb-2">
          <span className="font-bold">Task:</span> {(snapshot as any).high_level_task_state || "None"}
        </div>
        
        {acceptedFacts.length > 0 && (
          <div className="mb-2">
             <div className="text-[10px] text-zinc-500">Facts</div>
             <ul className="list-disc pl-3 text-[10px] text-zinc-400">
               {acceptedFacts.map((f: any, i: number) => <li key={i}>{String(f)}</li>)}
             </ul>
          </div>
        )}
        
        <button 
          onClick={() => onResume(sessionId)}
          className="w-full mt-2 py-1 text-xs bg-blue-900/30 text-blue-300 border border-blue-800 rounded hover:bg-blue-900/50"
        >
          Resume from here
        </button>
      </div>
    </div>
  );
};
