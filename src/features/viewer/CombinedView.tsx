import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EvolutionLens } from '../fullviewer/lenses/EvolutionLens';
import { PlaygroundContainer } from '../../playgrounds/PlaygroundContainer';
import { playgroundSDK } from '../../services/playground/PlaygroundSDK';
import type { SessionContext } from '../fullviewer/types';
import { ViewManager } from './ViewManager';
import { SavedViewSelector } from './SavedViewSelector';
import { CreateViewDialog } from './CreateViewDialog';

type ViewMode = 'split' | 'evolution-full' | 'playground-full';

interface CombinedViewProps {
  sessionContext: SessionContext;
}

export const CombinedView: React.FC<CombinedViewProps> = ({ sessionContext }) => {
  const [splitPercent, setSplitPercent] = useState(65);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isDragging, setIsDragging] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeView = ViewManager.getActive();

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

  const cycleMode = useCallback(() => {
    setViewMode(prev => {
      if (prev === 'split') return 'evolution-full';
      if (prev === 'evolution-full') return 'playground-full';
      return 'split';
    });
  }, []);

  const handleSaveView = useCallback((name: string) => {
    const tabs = activeView?.playgroundTabs ?? [];
    ViewManager.create(name, sessionContext.sessionId || '', sessionContext.projectId, tabs);
    setShowSaveDialog(false);
  }, [sessionContext, activeView]);

  const handleRestoreView = useCallback((viewId: string) => {
    ViewManager.setActive(viewId);
  }, []);

  const isEvolutionFull = viewMode === 'evolution-full';
  const isPlaygroundFull = viewMode === 'playground-full';

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-zinc-950">
      {isPlaygroundFull ? null : (
        <div
          className="flex flex-col overflow-hidden min-h-0 relative"
          style={{ width: isEvolutionFull ? '100%' : `${splitPercent}%` }}
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
          <div className="flex-1 overflow-hidden min-h-0">
            <EvolutionLens sessionContext={sessionContext} />
          </div>
        </div>
      )}

      <div
        onMouseDown={handleMouseDown}
        className={`w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize transition-colors group relative ${
          isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-500/10'
        } ${isEvolutionFull || isPlaygroundFull ? 'w-6 cursor-pointer' : ''}`}
        onClick={isEvolutionFull || isPlaygroundFull ? cycleMode : undefined}
      >
        <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
          isDragging ? 'bg-blue-400' : 'bg-zinc-700 group-hover:bg-zinc-500'
        }`} />
        <button
          onClick={(e) => { e.stopPropagation(); cycleMode(); }}
          className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 z-10 p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Toggle view mode"
        >
          <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
          </svg>
        </button>
      </div>

      {isEvolutionFull ? null : (
        <div
          className="flex flex-col overflow-hidden min-h-0 relative"
          style={{ width: isPlaygroundFull ? '100%' : `${100 - splitPercent}%` }}
        >
          <span className="absolute top-0 right-1 text-[8px] text-red-500 font-bold z-20">⬤PLAY</span>
          <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playground</span>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <PlaygroundContainer sdk={playgroundSDK} mode="normal" instanceId="combined" />
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
