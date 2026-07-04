import React, { useState, useCallback } from 'react';
import { ActivityBar } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { DashboardLens } from './lenses/DashboardLens';
import { EvolutionLens } from './lenses/EvolutionLens';
import { ExplorerLens } from './lenses/ExplorerLens';
import { GraphLens } from './lenses/GraphLens';
import { RepositoryLens } from './lenses/RepositoryLens';
import { TerminalLens } from './lenses/TerminalLens';
import { ChatLens } from './lenses/ChatLens';
import { SessionContextPanel } from './panels/SessionContextPanel';
import { AgentChatPanel } from './panels/AgentChatPanel';
import type { LensType, LayoutMode, RightPanelContent, SessionContext } from './types';

export const FullViewer: React.FC<{
  initialLens?: LensType;
  connectionStatus: {
    online: boolean;
    isConnected: boolean;
    isModelReady: boolean;
    isDegraded: boolean;
  };
}> = ({ initialLens = 'dashboard', connectionStatus }) => {
  const [activeLens, setActiveLens] = useState<LensType>(initialLens);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('full');
  const [showActivityBar, setShowActivityBar] = useState(true);
  const [rightPanel, setRightPanel] = useState<RightPanelContent>('agent');
  const [sessionContext, setSessionContext] = useState<SessionContext>({});
  const [stats] = useState<{ checkpoints: number; events: number; memories: number; decisions: number; files: number; documents: number } | undefined>();

  const handleSessionContextChange = useCallback((ctx: SessionContext) => {
    setSessionContext(ctx);
  }, []);

  const cycleLayoutMode = useCallback(() => {
    const modes: LayoutMode[] = ['full', 'compact', 'split', 'focus'];
    const idx = modes.indexOf(layoutMode);
    setLayoutMode(modes[(idx + 1) % modes.length]);
  }, [layoutMode]);

  const toggleRightPanel = useCallback(() => {
    setRightPanel(prev => prev === 'none' ? 'agent' : 'none');
  }, []);

  const renderLens = () => {
    switch (activeLens) {
      case 'dashboard': return <DashboardLens sessionContext={sessionContext} onSessionContextChange={handleSessionContextChange} />;
      case 'evolution': return <EvolutionLens sessionContext={sessionContext} />;
      case 'explorer': return <ExplorerLens />;
      case 'graph': return (
        <GraphLens
          onClose={() => setActiveLens('dashboard')}
          onNavigateToSession={(sessionId, projectId) => {
            setSessionContext(prev => ({ ...prev, sessionId, projectId }));
            setActiveLens('evolution');
          }}
          onNavigateToProject={(projectId) => {
            setSessionContext(prev => ({ ...prev, projectId }));
            setActiveLens('dashboard');
          }}
        />
      );
      case 'repository': return <RepositoryLens sessionContext={sessionContext} />;
      case 'terminal': return <TerminalLens />;
      case 'chat': return <ChatLens sessionContext={sessionContext} />;
      default: return <DashboardLens sessionContext={sessionContext} onSessionContextChange={handleSessionContextChange} />;
    }
  };

  const renderRightPanel = () => {
    if (rightPanel === 'none') return null;
    if (layoutMode === 'compact' || layoutMode === 'focus') return null;

    switch (rightPanel) {
      case 'agent':
        return (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
            <AgentChatPanel sessionContext={sessionContext} onClose={() => setRightPanel('none')} />
          </div>
        );
      case 'metadata':
        return (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
            <SessionContextPanel sessionContext={sessionContext} stats={stats} onClose={() => setRightPanel('none')} />
          </div>
        );
      default:
        return null;
    }
  };

  const mainContentClass = layoutMode === 'compact' ? 'flex-1 overflow-hidden' : 'flex-1 flex flex-col overflow-hidden';

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      <ActivityBar
        activeLens={activeLens}
        onLensChange={setActiveLens}
        showActivityBar={showActivityBar}
        onToggle={() => setShowActivityBar(v => !v)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {layoutMode !== 'compact' && layoutMode !== 'focus' && (
          <Toolbar
            activeLens={activeLens}
            layoutMode={layoutMode}
            rightPanel={rightPanel}
            onCycleLayout={cycleLayoutMode}
            onToggleRightPanel={toggleRightPanel}
            sessionContextName={sessionContext.sessionName}
          />
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className={`${mainContentClass} ${layoutMode === 'full' && rightPanel !== 'none' ? '' : ''}`}>
            {renderLens()}
          </div>
          {renderRightPanel()}
        </div>

        <StatusBar
          sessionContext={sessionContext}
          connectionStatus={connectionStatus}
        />
      </div>
    </div>
  );
};
