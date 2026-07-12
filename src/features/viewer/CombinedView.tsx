import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EvolutionLens } from '../fullviewer/lenses/EvolutionLens';
import { PlaygroundContainer } from '../../playgrounds/PlaygroundContainer';
import { playgroundSDK } from '../../services/playground/PlaygroundSDK';
import type { SessionContext } from '../fullviewer/types';
import { ViewManager } from './ViewManager';
import { SavedViewSelector } from './SavedViewSelector';
import { CreateViewDialog } from './CreateViewDialog';
import { Maximize2, Minimize2 } from 'lucide-react';

interface PanelState {
  sessions: boolean;
  evolution: boolean;
  playground: boolean;
}

interface CombinedViewProps {
  sessionContext: SessionContext;
}

type PanelId = keyof PanelState;

export const CombinedView: React.FC<CombinedViewProps> = ({ sessionContext }) => {
  const [splitPercent, setSplitPercent] = useState(65);
  const [isDragging, setIsDragging] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [panels, setPanels] = useState<PanelState>({ sessions: true, evolution: true, playground: true });
  const containerRef = useRef<HTMLDivElement>(null);

  const activeView = ViewManager.getActive();
  const visibleCount = Object.values(panels).filter(Boolean).length;

  const togglePanel = useCallback((panel: PanelId) => {
    setPanels(prev => {
      if (prev[panel]) {
        if (visibleCount <= 1) return prev;
        return { ...prev, [panel]: false };
      }
      return { ...prev, [panel]: true };
    });
  }, [visibleCount]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.max(20, Math.min(80, pct));
    setSplitPercent(pct);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSaveView = useCallback((name: string) => {
    const tabs = activeView?.playgroundTabs ?? [];
    ViewManager.create(name, sessionContext.sessionId || '', sessionContext.projectId, tabs);
    setShowSaveDialog(false);
  }, [sessionContext, activeView]);

  const handleRestoreView = useCallback((viewId: string) => {
    ViewManager.setActive(viewId);
  }, []);

  const showPlaygroundDivider = panels.playground && panels.evolution;

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 w-full overflow-hidden bg-zinc-950">
      {/* Left: Sessions + Evolution */}
      {panels.playground && !panels.evolution && !panels.sessions ? null : (
        <div
          className="flex flex-col overflow-hidden min-h-0 relative"
          style={{ width: panels.playground ? `${splitPercent}%` : '100%' }}
        >
          <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold z-20">⬤EVOL</span>
          <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Evolution</span>
              {sessionContext.sessionId && (
                <span className="text-[10px] text-zinc-600 font-mono">{sessionContext.sessionId}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {panels.playground && (
                <button
                  onClick={() => togglePanel('playground')}
                  className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title={panels.playground ? 'Hide playground' : 'Show playground'}
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
              )}
              {!panels.playground && (
                <button
                  onClick={() => togglePanel('playground')}
                  className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Show playground"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => setShowSaveDialog(true)}
                className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Save as View"
              >
                Create View
              </button>
              <SavedViewSelector
                activeViewId={activeView?.id ?? null}
                onSelect={handleRestoreView}
              />
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden min-h-0">
            <EvolutionLens
              sessionContext={sessionContext}
              showSessions={panels.sessions}
              showEvolution={panels.evolution}
              onToggleSessions={() => togglePanel('sessions')}
              onToggleEvolution={() => togglePanel('evolution')}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      {showPlaygroundDivider && (
        <div
          onMouseDown={handleMouseDown}
          className={`w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize transition-colors group ${
            isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-500/10'
          }`}
        >
          <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
            isDragging ? 'bg-blue-400' : 'bg-zinc-700 group-hover:bg-zinc-500'
          }`} />
        </div>
      )}

      {/* Right: Playground */}
      {panels.playground && (
        <div
          className="flex flex-col overflow-hidden min-h-0 relative"
          style={{ width: panels.evolution || panels.sessions ? `${100 - splitPercent}%` : '100%' }}
        >
          <span className="absolute top-0 right-1 text-[8px] text-red-500 font-bold z-20">⬤PLAY</span>
          <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playground</span>
            <button
              onClick={() => togglePanel('playground')}
              className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Collapse playground"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden min-h-0">
            <PlaygroundContainer sdk={playgroundSDK} />
          </div>
        </div>
      )}

      {showSaveDialog && (
        <CreateViewDialog
          defaultName={`View - ${sessionContext.sessionId || 'new'}`}
          onSave={handleSaveView}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
};
