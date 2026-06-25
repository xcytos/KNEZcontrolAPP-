import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { TaqwinHierarchicalView } from '../data/TaqwinHierarchicalView';
import { TaqwinAgentPanel } from './TaqwinAgentPanel';
import { ActiveSessionsPanel } from './ActiveSessionsPanel';
import { DashboardStatusBar } from './DashboardStatusBar';
import { useStatus } from '../../contexts/useStatus';

type DashboardPanel = 'hierarchy' | 'evolution' | 'agent' | 'sessions';
type LayoutMode = 'default' | 'focus-hierarchy' | 'focus-evolution' | 'full-screen';

export const Dashboard: React.FC = () => {
  // Layout state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const [activePanel, setActivePanel] = useState<DashboardPanel>('hierarchy');
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [showActivityBar, setShowActivityBar] = useState(true);
  
  // Context state
  const [activityContext, setActivityContext] = useState<{
    sessionId?: string;
    sessionName?: string;
    projectId?: string;
  }>({});
  
  // Connection status
  const { online, isConnected, isModelReady, isDegraded } = useStatus();

  // Auto-collapse agent panel when in focus mode
  useEffect(() => {
    if (layoutMode.startsWith('focus-')) {
      setShowAgentPanel(false);
    }
  }, [layoutMode]);

  const toggleLayoutMode = () => {
    const modes: LayoutMode[] = ['default', 'focus-hierarchy', 'focus-evolution', 'full-screen'];
    const currentIndex = modes.indexOf(layoutMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setLayoutMode(modes[nextIndex]);
  };

  // Wrap callback in useCallback to prevent infinite loops
  const handleActivityContextChange = useCallback((context: {
    sessionId?: string;
    sessionName?: string;
    projectId?: string;
  }) => {
    setActivityContext(context);
  }, []);

  const renderMainPanel = () => {
    switch (activePanel) {
      case 'hierarchy':
        return (
          <TaqwinHierarchicalView
            onNavigateToSqlite={(tableName, filter, issueType) => {
              console.log('[Dashboard] Navigate to SQLite:', { tableName, filter, issueType });
            }}
            onActivityContextChange={handleActivityContextChange}
          />
        );
      
      case 'evolution':
        return (
          <div className="h-full bg-zinc-950 p-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Knowledge Evolution</h2>
              <p className="text-sm text-zinc-400">
                Track TAQWIN knowledge growth across sessions, checkpoints, and learned memories
              </p>
            </div>
            <div className="text-sm text-zinc-500 p-8 text-center">
              Evolution chart requires session context. Please select a session from the Hierarchy view.
            </div>
          </div>
        );
      
      case 'sessions':
        return (
          <ActiveSessionsPanel
            currentSessionId={activityContext.sessionId}
            currentProjectId={activityContext.projectId}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      {/* Activity Bar (Left) */}
      {showActivityBar && (
        <div className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => setActivePanel('hierarchy')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activePanel === 'hierarchy'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Hierarchy View"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setActivePanel('evolution')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activePanel === 'evolution'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Evolution Chart"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setActivePanel('sessions')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activePanel === 'sessions'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Active Sessions"
          >
            <Activity className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Layout Mode Toggle */}
          <button
            onClick={toggleLayoutMode}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            title={`Layout: ${layoutMode}`}
          >
            {layoutMode === 'full-screen' ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Toggle Activity Bar */}
          <button
            onClick={() => setShowActivityBar(false)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            title="Hide Activity Bar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Show Activity Bar Button (when hidden) */}
      {!showActivityBar && (
        <button
          onClick={() => setShowActivityBar(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-16 bg-zinc-900 border border-zinc-800 rounded-r-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all z-10"
          title="Show Activity Bar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold text-zinc-100">
              AI Operations Dashboard
            </h1>
            {activityContext.sessionName && (
              <span className="text-sm text-zinc-500">
                / {activityContext.sessionName}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : isDegraded ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-zinc-400">
                {isConnected ? 'Online' : isDegraded ? 'Degraded' : 'Offline'}
              </span>
            </div>

            {/* Agent Panel Toggle */}
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                showAgentPanel
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-1" />
              TAQWIN Agent
            </button>
          </div>
        </div>

        {/* Workspace Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Panel */}
          <div className={`flex-1 overflow-hidden ${
            layoutMode === 'focus-hierarchy' || layoutMode === 'focus-evolution'
              ? 'w-full'
              : showAgentPanel
                ? 'w-2/3'
                : 'w-full'
          }`}>
            {renderMainPanel()}
          </div>

          {/* TAQWIN Agent Panel (Right) */}
          {showAgentPanel && layoutMode !== 'full-screen' && (
            <div className="w-1/3 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
              <TaqwinAgentPanel
                sessionId={activityContext.sessionId}
                projectId={activityContext.projectId}
                onClose={() => setShowAgentPanel(false)}
              />
            </div>
          )}
        </div>

        {/* Status Bar (Bottom) */}
        <DashboardStatusBar
          activityContext={activityContext}
          connectionStatus={{
            online,
            isConnected,
            isModelReady,
            isDegraded,
          }}
        />
      </div>
    </div>
  );
};
