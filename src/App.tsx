import { useEffect, useRef, useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { View } from './components/layout/Sidebar';
import { ChatPane } from './features/chat/ChatPane';
import { LineagePanel } from './features/chat/LineagePanel';
import { MemoryExplorer } from './features/memory/MemoryExplorer';
import { SessionTimeline } from './features/timeline/SessionTimeline';
import { ReflectionPane } from './features/reflection/ReflectionPane';
import { MistakeLedger } from './features/mistakes/MistakeLedger';
import { DriftVisualizer } from './features/drift/DriftVisualizer';
import { ConnectionSettings } from './features/settings/ConnectionSettings';
import { KnezEventsPanel } from './features/events/KnezEventsPanel';
import { InfrastructurePanel } from './features/infrastructure/InfrastructurePanel';
import { McpRegistryView } from './features/mcp/McpRegistryView';
import { AgentPane } from './features/agent/AgentPane';
import { CognitivePanel } from './features/cognitive/CognitivePanel';
import { GovernancePanel } from './features/governance/GovernancePanel';
import { LogsPanel } from './features/logs/LogsPanel';
import { ReplayPane } from './features/replay/ReplayPane';
import { UpdatesPanel } from './features/updates/UpdatesPanel';
import { ExtractionPanel } from './features/extraction/ExtractionPanel';
import { TestPanel } from './features/diagnostics/TestPanel';
import { SkillsView } from './features/skills/SkillsView';
import { PresenceEngine, PresenceConfig } from './presence/PresenceEngine';
import { PresenceState, McpRegistrySnapshot } from './domain/DataContracts';
import { knezClient } from './services/KnezClient';
import { useSystemOrchestrator } from './features/system/useSystemOrchestrator';
import { ToastProvider } from './components/ui/Toast';
import { StatusProvider, useStatus } from './contexts/StatusProvider';
import { setObserverState } from './utils/observer';
import './App.css';

const PRESENCE_CONFIG: PresenceConfig = {
  debounceMillis: 1000,
};

import { CommandPalette } from './components/ui/CommandPalette';

// ...

function AppContent() {
  const [activeView, setActiveView] = useState<View>('chat');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [presenceState, setPresenceState] = useState<PresenceState>('SILENT');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(knezClient.getSessionId());
  const [readOnly, setReadOnly] = useState(true);
  
  const { isConnected, isDegraded, lastCheck, health, forceCheck } = useStatus();
  const engineRef = useRef<PresenceEngine>(null);

  // CP9-6: Global Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        // Resume last session quick action
        import('./services/PersistenceService').then(async ({ persistenceService }) => {
          const sessions = await persistenceService.listSessions()
          const last = sessions[0]
          if (last) {
            await knezClient.resumeSession(last)
            window.location.reload()
          }
        })
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync StatusProvider state to App logic
  useEffect(() => {
    if (health) {
      setReadOnly(false);
      if (!sessionId) {
        knezClient.ensureSession().then(setSessionId);
      }
      knezClient.tryGetMcpRegistry(); // Background fetch
    } else {
      setReadOnly(true);
    }
  }, [health]);

  // Orchestrator
  const { status: systemStatus, output: systemOutput, launchAndConnect, stopKnez } = useSystemOrchestrator(() => {
    forceCheck();
  });

  const autoConnectRef = useRef(0);
  useEffect(() => {
    const endpoint = knezClient.getProfile().endpoint;
    const isLocal =
      endpoint.includes("localhost:8000") ||
      endpoint.includes("127.0.0.1:8000");
    const isTauri = !!(window as any).__TAURI__ || !!(window as any).__TAURI_IPC__;
    if (health) return;
    if (!isLocal) return;
    if (!isTauri) return;
    if (systemStatus === "starting" || systemStatus === "running") return;
    const now = Date.now();
    if (now - autoConnectRef.current < 15000) return;
    autoConnectRef.current = now;
    launchAndConnect();
  }, [health, systemStatus, launchAndConnect]);

  useEffect(() => {
    setObserverState({
      connected: !!health && (isConnected || isDegraded),
      endpoint: knezClient.getProfile().endpoint,
      sessionId,
      readOnly,
      systemStatus,
    });
  }, [health, isConnected, isDegraded, sessionId, readOnly, systemStatus]);

  // Bootstrap
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new PresenceEngine(PRESENCE_CONFIG);
      setPresenceState(engineRef.current.getSnapshot().state);
    }
    const opened = engineRef.current.apply({ kind: 'app_opened', at: Date.now() });
    setPresenceState(opened.state);
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'chat':
        return (
          <div className="flex h-full">
            <div className="flex-1">
              <ChatPane 
                sessionId={sessionId} 
                readOnly={readOnly} 
                systemStatus={systemStatus}
              />
            </div>
            {sessionId && (
              <div className="w-64 border-l border-zinc-800 hidden lg:block overflow-y-auto">
                <LineagePanel 
                  sessionId={sessionId} 
                  onResume={async (sid) => {
                    await knezClient.resumeSession(sid);
                    window.location.reload();
                  }} 
                />
              </div>
            )}
          </div>
        );
      case 'agent':
        return <AgentPane />;
      case 'memory':
        return (
          <div className="flex h-full">
            <div className="w-2/3 border-r border-zinc-800 overflow-y-auto">
              <MemoryExplorer sessionId={sessionId} readOnly={readOnly} />
            </div>
            <div className="w-1/3 p-4 flex flex-col space-y-4 overflow-y-auto bg-zinc-900/20">
              <CognitivePanel /> 
              <DriftVisualizer />
              <div className="flex-1">
                 <MistakeLedger />
              </div>
              <KnezEventsPanel sessionId={sessionId} readOnly={readOnly} />
            </div>
          </div>
        );
      case 'timeline':
        return <SessionTimeline />;
      case 'reflection':
        return <ReflectionPane sessionId={sessionId} readOnly={readOnly} />;
      case 'governance':
        return <GovernancePanel />;
      case 'infrastructure':
        return (
          <InfrastructurePanel 
             isConnected={isConnected} 
             status={health} 
             systemStatus={systemStatus}
             systemOutput={systemOutput}
             onStopSystem={stopKnez}
          />
        );
      case 'mcp':
        // CP5-6: Needs snapshot data, we'll fetch fresh here or use context if we added it
        return (
          <McpLoader />
        );
      case 'logs':
        return <LogsPanel />;
      case 'replay':
        return <ReplayPane sessionId={sessionId} />;
      case 'updates':
        return <UpdatesPanel />;
      case 'extraction':
        return <ExtractionPanel />;
      case 'diagnostics':
        return <TestPanel />;
      case 'skills':
        return <SkillsView />;
        
      default:
        return <ChatPane sessionId={sessionId} readOnly={readOnly} systemStatus={systemStatus} />;
    }
  };

  return (
    <MainLayout
      activeView={activeView}
      onViewChange={setActiveView}
      presenceState={presenceState}
      connectionStatus={{
        connected: isConnected || isDegraded,
        endpoint: knezClient.getProfile().endpoint,
        lastCheck: lastCheck
      }}
      headerSubtitle={
        sessionId ? (
          <div className="text-xs text-zinc-500 font-mono">
            session {sessionId.slice(0, 8)}
          </div>
        ) : null
      }
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => launchAndConnect()}
            disabled={systemStatus === "starting" || systemStatus === "running"}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 px-3 py-1 rounded"
          >
            {systemStatus === "starting" ? "Starting" : (isConnected || isDegraded) ? "Reconnect" : "Start"}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1 rounded"
          >
            Settings
          </button>
        </div>
      }
    >
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(view) => { setActiveView(view); setCommandPaletteOpen(false); }}
      />
      
      {renderContent()}
      
       {showSettings && <ConnectionSettings 
         onClose={() => {
           setShowSettings(false);
           forceCheck();
         }}
         systemStatus={systemStatus}
         systemOutput={systemOutput}
       />}
    </MainLayout>
  );
}

const McpLoader = () => {
  const [snapshot, setSnapshot] = useState<McpRegistrySnapshot | null>(null);
  const load = () => knezClient.tryGetMcpRegistry().then(setSnapshot);
  useEffect(() => { load(); }, []);
  return <McpRegistryView snapshot={snapshot} onRefresh={load} />;
}

import { ThemeProvider } from './contexts/ThemeContext';
import { analytics } from './services/AnalyticsService';

import { ErrorBoundary } from './components/ui/ErrorBoundary';

function App() {
  // Track open session
  useEffect(() => {
    analytics.trackSession();
  }, []);

  return (
    <ThemeProvider>
      <StatusProvider>
        <ToastProvider>
          <ErrorBoundary>
             <AppContent />
          </ErrorBoundary>
        </ToastProvider>
      </StatusProvider>
    </ThemeProvider>
  );
}

export default App;
