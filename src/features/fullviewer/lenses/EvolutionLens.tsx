import React from 'react';
import { SessionEvolutionFullView } from '../../data/components/SessionEvolutionFullView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import { useFullViewer } from '../FullViewerContext';
import type { SessionContext } from '../types';

interface EvolutionLensProps {
  sessionContext: SessionContext;
}

export const EvolutionLens: React.FC<EvolutionLensProps> = ({ sessionContext }) => {
  const { setSessionContext, setSelectedSessionId, setSelectedProjectId, setViewLevel } = useFullViewer();

  const handleSessionSelect = (sessionId: string, projectId?: string) => {
    setSessionContext({ sessionId, projectId });
    setSelectedSessionId(sessionId);
    if (projectId) {
      setSelectedProjectId(projectId);
      setViewLevel('session-detail');
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden flex-shrink-0">
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/50">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ActiveSessionsPanel
            currentSessionId={sessionContext.sessionId}
            currentProjectId={sessionContext.projectId}
            onSessionClick={handleSessionSelect}
          />
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {sessionContext.sessionId ? (
          <SessionEvolutionFullView
            sessionId={sessionContext.sessionId}
            onClose={() => {}}
            embedded
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <div className="text-sm">Select a session from the sidebar to view details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
