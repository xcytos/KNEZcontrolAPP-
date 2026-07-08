import React, { useState, useCallback } from 'react';
import { SessionEvolutionFullView } from '../../data/components/SessionEvolutionFullView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import { useFullViewer } from '../FullViewerContext';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import { ResizableSplitPane } from '../../../components/layout/ResizableSplitPane';
import type { SessionContext } from '../types';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-500' },
  { value: 'archived', label: 'Archived', color: 'bg-zinc-500' },
];

interface EvolutionLensProps {
  sessionContext: SessionContext;
}

export const EvolutionLens: React.FC<EvolutionLensProps> = ({ sessionContext }) => {
  const { setSessionContext, setSelectedSessionId, setSelectedProjectId, setViewLevel } = useFullViewer();
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handleSessionSelect = (sessionId: string, projectId?: string) => {
    console.log('[EvolutionLens] Session selected:', sessionId, projectId);
    setSessionContext({ sessionId, projectId });
    setSelectedSessionId(sessionId);
    if (projectId) {
      setSelectedProjectId(projectId);
      setViewLevel('session-detail');
    }
  };

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!sessionContext.sessionId) return;
    setStatusUpdating(true);
    try {
      await taqwinDataService.updateSessionStatus(sessionContext.sessionId, newStatus);
    } catch (e) {
      console.error('[EvolutionLens] Failed to update status:', e);
    } finally {
      setStatusUpdating(false);
    }
  }, [sessionContext.sessionId]);

  return (
    <ResizableSplitPane
      defaultLeftWidth={288}
      minLeftWidth={160}
      maxLeftWidth={500}
      left={
        <>
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
        </>
      }
      right={sessionContext.sessionId ? (
        <>
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <span className="text-xs text-zinc-400 font-medium truncate flex-1">
              {sessionContext.sessionName || sessionContext.sessionId}
            </span>
            <div className="flex items-center gap-1">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={statusUpdating}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    statusUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                  } ${opt.color} text-white`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <SessionEvolutionFullView
            sessionId={sessionContext.sessionId}
            onClose={() => {}}
            embedded
          />
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-zinc-500">
          <div className="text-center">
            <div className="text-sm">Select a session from the sidebar to view details</div>
          </div>
        </div>
      )}
    />
  );
};
