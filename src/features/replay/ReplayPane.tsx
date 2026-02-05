import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { ReplayTimeline } from '../../domain/DataContracts';

export const ReplayPane: React.FC<{ sessionId: string | null }> = ({ sessionId }) => {
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    knezClient.getReplayTimeline(sessionId)
      .then(setTimeline)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading replay data...</div>;
  if (!timeline) return <div className="p-8 text-center text-zinc-500">No replay data available.</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">Session Replay</h2>
      
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg mb-6">
        <div className="flex gap-8 text-sm text-zinc-400">
           <div>Duration: <span className="text-white font-mono">{timeline.duration_seconds.toFixed(1)}s</span></div>
           <div>Events: <span className="text-white font-mono">{timeline.total_events}</span></div>
           <div>Phases: <span className="text-white font-mono">{timeline.phases.length}</span></div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 relative overflow-y-auto">
        <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-zinc-800" />
        
        <div className="space-y-6">
          {timeline.phases.map((phase, idx) => (
            <div key={idx} className="relative pl-12">
              <div className="absolute left-[29px] top-1 w-2 h-2 rounded-full bg-blue-600 border border-zinc-950" />
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-center mb-1">
                   <div className="text-sm font-bold text-zinc-200">{phase.phase_name}</div>
                   <div className="text-xs font-mono text-zinc-500">
                     {new Date(phase.start_time).toLocaleTimeString()} - {new Date(phase.end_time).toLocaleTimeString()}
                   </div>
                </div>
                <div className="text-xs text-zinc-400">
                   {phase.event_count} events recorded
                </div>
                {/* Visual density bar */}
                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-blue-500/50" 
                     style={{ width: `${Math.min(100, (phase.event_count / 20) * 100)}%` }}
                   />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
