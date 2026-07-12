import React, { useState, useCallback } from 'react';
import { SessionEvolutionFullView } from '../../data/components/SessionEvolutionFullView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import { useFullViewer } from '../FullViewerContext';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import { ResizableSplitPane } from '../../../components/layout/ResizableSplitPane';
import { ViewManager } from '../../viewer/ViewManager';
import { CreateViewDialog } from '../../viewer/CreateViewDialog';
import { SavedViewSelector } from '../../viewer/SavedViewSelector';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SessionContext } from '../types';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-500' },
  { value: 'archived', label: 'Archived', color: 'bg-zinc-500' },
];

interface EvolutionLensProps {
  sessionContext: SessionContext;
  showSessions?: boolean;
  showEvolution?: boolean;
  onToggleSessions?: () => void;
  onToggleEvolution?: () => void;
}

export const EvolutionLens: React.FC<EvolutionLensProps> = ({
  sessionContext,
  showSessions = true,
  showEvolution = true,
  onToggleSessions,
  onToggleEvolution,
}) => {
  const { setSessionContext, setSelectedSessionId, setSelectedProjectId, setViewLevel } = useFullViewer();
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(ViewManager.getActive()?.id ?? null);

  const handleSessionSelect = (sessionId: string, projectId?: string) => {
    console.log(`[EvolutionLens] Session selected at ${new Date().toISOString()}:`, { sessionId, projectId });
    console.log(`[EvolutionLens] Setting sessionContext to:`, { sessionId, projectId });
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

  const handleCreateView = useCallback((name: string) => {
    ViewManager.create(name, sessionContext.sessionId || '', sessionContext.projectId, []);
    setShowCreateView(false);
  }, [sessionContext]);

  const handleSelectSavedView = useCallback((viewId: string) => {
    const view = ViewManager.get(viewId);
    if (!view) return;
    ViewManager.setActive(viewId);
    setActiveViewId(viewId);
    if (view.sessionId) {
      setSessionContext({ sessionId: view.sessionId, projectId: view.projectId });
      setSelectedSessionId(view.sessionId);
      if (view.projectId) {
        setSelectedProjectId(view.projectId);
        setViewLevel('session-detail');
      }
    }
  }, [setSessionContext, setSelectedSessionId, setSelectedProjectId, setViewLevel]);

  const sessionsPanel = (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sessions</h2>
        {onToggleSessions && (
          <button
            onClick={onToggleSessions}
            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Collapse sessions"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <ActiveSessionsPanel
          currentSessionId={sessionContext.sessionId}
          currentProjectId={sessionContext.projectId}
          onSessionClick={handleSessionSelect}
        />
      </div>
      <div className="border-t border-zinc-800 bg-zinc-950/30 px-2 py-2 flex-shrink-0">
        <SavedViewSelector
          activeViewId={activeViewId}
          onSelect={handleSelectSavedView}
        />
      </div>
    </div>
  );

  const evolutionContent = sessionContext.sessionId ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        {onToggleEvolution && (
          <button
            onClick={onToggleEvolution}
            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Collapse evolution"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="text-xs text-zinc-400 font-medium truncate flex-1">
          {sessionContext.sessionName || sessionContext.sessionId}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreateView(true)}
            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Create View from this session"
          >
            Create View
          </button>
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
        onNavigateToSession={handleSessionSelect}
      />
    </div>
  ) : (
    <div className="h-full flex items-center justify-center text-zinc-500">
      <div className="text-center">
        <div className="text-sm">Select a session from the sidebar to view details</div>
      </div>
    </div>
  );

  return (
    <div className="relative h-full">
      {showSessions && showEvolution ? (
        <ResizableSplitPane
          defaultLeftWidth={288}
          minLeftWidth={160}
          maxLeftWidth={500}
          left={sessionsPanel}
          right={evolutionContent}
        />
      ) : showSessions ? (
        <div className="flex h-full">
          <div className="flex-1 min-w-0">{sessionsPanel}</div>
          {onToggleEvolution && (
            <button
              onClick={onToggleEvolution}
              className="w-6 flex-shrink-0 flex items-center justify-center bg-zinc-900 border-l border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Show evolution"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : showEvolution ? (
        <div className="flex h-full">
          {onToggleSessions && (
            <button
              onClick={onToggleSessions}
              className="w-6 flex-shrink-0 flex items-center justify-center bg-zinc-900 border-r border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Show sessions"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex-1 min-w-0">{evolutionContent}</div>
        </div>
      ) : null}
      {showCreateView && (
        <CreateViewDialog
          defaultName={`View - ${sessionContext.sessionId}`}
          onSave={handleCreateView}
          onClose={() => setShowCreateView(false)}
        />
      )}
    </div>
  );
};
