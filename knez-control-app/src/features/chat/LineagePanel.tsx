import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { ResumeSnapshot } from '../../domain/DataContracts';

export const LineagePanel: React.FC<{ sessionId: string; onResume: (sid: string) => void }> = ({ sessionId, onResume }) => {
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    knezClient.getResumeSnapshot(sessionId)
      .then(setSnapshot)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="p-4 text-xs text-zinc-500">Tracing lineage...</div>;
  if (!snapshot) return <div className="p-4 text-xs text-zinc-500">No lineage data available for this session.</div>;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-bold text-zinc-300">Session Lineage</h3>
      
      <div className="relative pl-4 border-l-2 border-zinc-700">
         <div className="absolute -left-[5px] top-0 w-2 h-2 bg-blue-500 rounded-full" />
         <div className="text-xs text-zinc-400 mb-1">Current Head</div>
         <div className="text-xs font-mono text-white bg-zinc-800 p-2 rounded mb-2">
           {snapshot.session_id.substring(0,8)}...
         </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded p-3">
        <div className="text-[10px] uppercase text-zinc-500 mb-2">Resume Snapshot State</div>
        <div className="text-xs text-zinc-300 mb-2">
          <span className="font-bold">Task:</span> {snapshot.high_level_task_state || "None"}
        </div>
        
        {snapshot.accepted_facts.length > 0 && (
          <div className="mb-2">
             <div className="text-[10px] text-zinc-500">Facts</div>
             <ul className="list-disc pl-3 text-[10px] text-zinc-400">
               {snapshot.accepted_facts.map((f, i) => <li key={i}>{f}</li>)}
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
