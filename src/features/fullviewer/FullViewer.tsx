import React from 'react';
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
import { FileDetailPanel } from './panels/FileDetailPanel';
import { useFullViewer, FullViewerProvider } from './FullViewerContext';
import { useFullViewerStats } from './hooks/useFullViewerStats';
import type { LensType, SessionContext } from './types';

const FullViewerInner: React.FC<{
  connectionStatus: { online: boolean; isConnected: boolean; isModelReady: boolean; isDegraded: boolean };
}> = ({ connectionStatus }) => {
  const {
    activeLens, setActiveLens, layoutMode,
    showActivityBar, toggleActivityBar, rightPanel, setRightPanel,
    sessionContext, setSessionContext, cycleLayoutMode,
    secondaryLens, setSecondaryLens,
  } = useFullViewer();

  const { sessionMetrics: stats, statusBarMetrics: statusBarStats } = useFullViewerStats(sessionContext.sessionId);

  const handleSessionContextChange = (ctx: SessionContext) => setSessionContext(ctx);

  const renderLens = () => {
    switch (activeLens) {
      case 'dashboard': return <DashboardLens sessionContext={sessionContext} onSessionContextChange={handleSessionContextChange} />;
      case 'evolution': return <EvolutionLens sessionContext={sessionContext} />;
      case 'explorer': return <ExplorerLens />;
      case 'graph': return (
        <GraphLens
          onClose={() => setActiveLens('dashboard')}
          onNavigateToSession={(sessionId, projectId) => {
            setSessionContext({ ...sessionContext, sessionId, projectId });
            setActiveLens('evolution');
          }}
          onNavigateToProject={(projectId) => {
            setSessionContext({ ...sessionContext, projectId });
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

  const renderSecondaryLens = () => {
    if (!secondaryLens) return null;

    const lensComponents: Record<string, React.ReactNode> = {
      dashboard: <DashboardLens sessionContext={sessionContext} onSessionContextChange={handleSessionContextChange} />,
      evolution: <EvolutionLens sessionContext={sessionContext} />,
      explorer: <ExplorerLens />,
      graph: <GraphLens onClose={() => setSecondaryLens(undefined)} />,
      repository: <RepositoryLens sessionContext={sessionContext} />,
      terminal: <TerminalLens />,
      chat: <ChatLens sessionContext={sessionContext} />,
    };

    return (
      <div className="w-1/2 border-l border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {secondaryLens}
          </span>
          <button
            onClick={() => setSecondaryLens(undefined)}
            className="text-zinc-500 hover:text-zinc-300 text-xs"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {lensComponents[secondaryLens] || lensComponents.dashboard}
        </div>
      </div>
    );
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
      case 'filedetail':
        return (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
            <FileDetailPanel onClose={() => setRightPanel('none')} />
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
        onToggle={toggleActivityBar}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {layoutMode !== 'compact' && layoutMode !== 'focus' && (
          <Toolbar
            activeLens={activeLens}
            layoutMode={layoutMode}
            rightPanel={rightPanel}
            onCycleLayout={cycleLayoutMode}
            onToggleRightPanel={() => setRightPanel(rightPanel === 'none' ? 'agent' : 'none')}
            sessionContextName={sessionContext.sessionName}
          />
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className={`${mainContentClass}`}>
            {renderLens()}
          </div>
          {renderSecondaryLens()}
          {renderRightPanel()}
        </div>

        <StatusBar
          sessionContext={sessionContext}
          connectionStatus={connectionStatus}
          stats={statusBarStats}
        />
      </div>
    </div>
  );
};

export const FullViewer: React.FC<{
  initialLens?: LensType;
  connectionStatus: { online: boolean; isConnected: boolean; isModelReady: boolean; isDegraded: boolean };
}> = ({ initialLens = 'dashboard', connectionStatus }) => {
  return (
    <FullViewerProvider initialState={{ activeLens: initialLens }}>
      <FullViewerInner connectionStatus={connectionStatus} />
    </FullViewerProvider>
  );
};
