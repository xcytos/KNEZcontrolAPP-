import React from 'react';
import { Activity, Calendar, Folder, Brain } from 'lucide-react';
import type { SessionContext } from '../types';
import { SessionMetricsGrid } from '../components/SessionMetricsGrid';

interface SessionContextPanelProps {
  sessionContext: SessionContext;
  stats?: {
    checkpoints: number;
    events: number;
    memories: number;
    decisions: number;
    files: number;
    documents: number;
  };
  onClose?: () => void;
}

export const SessionContextPanel: React.FC<SessionContextPanelProps> = ({ sessionContext, stats, onClose }) => {
  if (!sessionContext.sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-xs p-4 text-center">
        Select a session to view context
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-3 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Session Context</h3>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">Close</button>
        )}
      </div>

      <div className="space-y-2">
        {sessionContext.projectName && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Folder className="w-3 h-3" />
            {sessionContext.projectName}
          </div>
        )}
        {sessionContext.sessionName && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Brain className="w-3 h-3" />
            {sessionContext.sessionName}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Calendar className="w-3 h-3" />
          <span className="font-mono">{sessionContext.sessionId?.slice(0, 8)}</span>
        </div>
      </div>

      {stats && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Metrics</h4>
          <SessionMetricsGrid {...stats} />
        </div>
      )}

      <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
        <p className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Live updates every 10s
        </p>
      </div>
    </div>
  );
};
