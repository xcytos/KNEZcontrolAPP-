import React from 'react';
import { SessionSegment } from '../../domain/DataContracts';

// NOTE: Currently using mock data for visualization.
// FUTURE: Integrate with session database to load real session segments
const MOCK_SEGMENTS: SessionSegment[] = [
  {
    id: 's1',
    sessionId: 'curr',
    kind: 'event',
    refId: 'e1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 's2',
    sessionId: 'curr',
    kind: 'message',
    refId: 'm1',
    createdAt: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 's3',
    sessionId: 'curr',
    kind: 'decision',
    refId: 'd1',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 's4',
    sessionId: 'curr',
    kind: 'message',
    refId: 'm2',
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
];

export const SessionTimeline: React.FC = () => {
  return (
    <div className="p-6 max-w-2xl mx-auto h-full overflow-hidden flex flex-col">
      <h2 className="text-xl font-light text-zinc-200 mb-6">Session Timeline</h2>
      
      <div className="relative border-l border-zinc-800 ml-4 space-y-8 pb-8">
        {MOCK_SEGMENTS.map((seg) => (
          <div key={seg.id} className="relative pl-8">
            <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
              seg.kind === 'decision' ? 'bg-purple-500' :
              seg.kind === 'message' ? 'bg-blue-500' :
              'bg-zinc-600'
            }`} />
            
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-500 mb-1">
                {new Date(seg.createdAt).toLocaleTimeString()}
              </span>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-md">
                <span className="text-sm font-medium text-zinc-300 uppercase tracking-wide text-xs">
                  {seg.kind}
                </span>
                <p className="text-zinc-400 text-sm mt-1">
                  {seg.kind === 'decision' ? 'User confirmed architectural choice.' :
                   seg.kind === 'message' ? 'Interaction recorded.' :
                   'System event logged.'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
