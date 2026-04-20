import { useEffect, useState, useRef } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { View } from './components/layout/Sidebar';
import { ChatPane } from './features/chat/ChatPane';
import { LineagePanel } from './features/chat/LineagePanel';
import { MemoryExplorer } from './features/memory/MemoryExplorer';
import { SessionTimeline } from './features/timeline/SessionTimeline';
import { ReflectionPane } from './features/reflection/ReflectionPane';
import { MistakeLedger } from './features/mistakes/MistakeLedger';
import { DriftVisualizer } from './features/drift/DriftVisualizer';
import { SettingsModal } from './features/settings/SettingsModal';
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
import { PresenceState, McpRegistrySnapshot } from './domain/DataContracts';
import { knezClient } from './services/KnezClient';
import { chatService } from './services/ChatService';
import { sessionController } from './services/SessionController';
import { getKeepAliveEnabled } from './services/Preferences';
import { useSystemOrchestrator } from './features/system/useSystemOrchestrator';
import { ToastProvider } from './components/ui/Toast';
import { StatusProvider } from './contexts/StatusProvider';
import { useStatus } from './contexts/useStatus';
import { setObserverState } from './utils/observer';
import { tabErrorStore } from './services/TabErrorStore';
import './App.css';

import { CommandPalette } from './components/ui/CommandPalette';
import { FloatingConsole } from './components/ui/FloatingConsole';
import { E2EBanner } from './components/ui/E2EBanner';
import { taqwinActivationService } from './services/TaqwinActivationService';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { analytics } from './services/AnalyticsService';
import { logger } from './services/LogService';
import { features } from './config/features';
import { initMcpBoot } from './mcp/mcpBoot';
import { getStaticMemoryLoader } from './services/StaticMemoryLoader';

// ...

function AppContent() {
  const [activeView, setActiveView] = useState<View>('chat');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [presenceState, setPresenceState] = useState<PresenceState>('SILENT');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(sessionController.getSessionId());
  const [readOnly, setReadOnly] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [tabErrors, setTabErrors] = useState<Partial<Record<View, boolean>>>({});
  
  const { online, isConnected, isDegraded, lastCheck, health, forceCheck } = useStatus();

  // CP9-6: Global Command Palette Listener
  useEffect(() => {
    const unsub = sessionController.subscribe(({ sessionId }) => setSessionId(sessionId));
    return unsub;
  }, []);

  useEffect(() => {
    void initMcpBoot();
  }, []);

  // Load static memories on startup
  useEffect(() => {
    const loadMemories = async () => {
      try {
        const loader = getStaticMemoryLoader();
        const status = await loader.loadMemories();
        console.log('[App] Static memories loaded:', status);
      } catch (error) {
        console.error('[App] Failed to load static memories:', error);
      }
    };
    void loadMemories();
  }, []);

  useEffect(() => {
    return tabErrorStore.subscribe(setTabErrors);
  }, []);

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
            sessionController.useSession(last)
          }
        })
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync StatusProvider state to App logic
  useEffect(() => {
    if (online) {
      setReadOnly(false);
      if (!sessionId) sessionController.ensureLocalSession();
      knezClient.tryGetMcpRegistry(); // Background fetch
    } else {
      setReadOnly(true);
      if (!sessionId) sessionController.ensureLocalSession();
    }
  }, [online]);

  // Orchestrator
  const { status: systemStatus, output: systemOutput, healthProbe: systemHealthProbe, launchAndConnect, stopKnez } = useSystemOrchestrator(() => {
    forceCheck();
  });

  // T9: Auto-launch with attempt tracking and error handling
  const autoLaunchAttemptRef = useRef(0);
  const autoLaunchMaxAttempts = 3;

  useEffect(() => {
    const endpoint = knezClient.getProfile().endpoint;
    const isLocal =
      endpoint.includes("localhost:8000") ||
      endpoint.includes("127.0.0.1:8000") ||
      endpoint.includes("localhost:8001") ||
      endpoint.includes("127.0.0.1:8001");
    const w = window as any;
    const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
    const keepAlive = getKeepAliveEnabled();
    if (online) {
      // Reset attempt counter on successful connection
      autoLaunchAttemptRef.current = 0;
      return;
    }
    if (!isLocal) return;
    if (!isTauri) return;
    if (!keepAlive) return;
    if (systemStatus === "starting" || systemStatus === "running") return;
    if (autoLaunchAttemptRef.current >= autoLaunchMaxAttempts) return;

    autoLaunchAttemptRef.current++;
    launchAndConnect();
  }, [online, systemStatus, launchAndConnect]);

  useEffect(() => {
    setObserverState({
      connected: online,
      endpoint: knezClient.getProfile().endpoint,
      sessionId,
      readOnly,
      systemStatus,
    });
  }, [online, isConnected, isDegraded, sessionId, readOnly, systemStatus]);

  useEffect(() => {
    const unsub = chatService.subscribe((s) => setChatSending(s.phase === "streaming" || s.phase === "tool_running"));
    return unsub;
  }, []);

  useEffect(() => {
    if (!online) {
      setPresenceState("SILENT");
      return;
    }
    if (systemStatus === "starting") {
      setPresenceState("OBSERVING");
      return;
    }
    if (activeView === "reflection") {
      setPresenceState("REFLECTING");
      return;
    }
    if (chatSending) {
      setPresenceState("RESPONDING");
      return;
    }
    setPresenceState("OBSERVING");
  }, [online, systemStatus, activeView, chatSending]);

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
                    await sessionController.resumeSession(sid);
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
             systemHealthProbe={systemHealthProbe}
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

  const handleViewChange = (view: View) => {
    setActiveView(view);
    tabErrorStore.clear(view);
  };

  const runTaqwinActivate = async () => {
    try {
      const w = window as any;
      const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
      if (!isTauri) throw new Error("TAQWIN ACTIVATE requires the desktop app (Tauri).");
      const sid = sessionController.getSessionId() ?? sessionId ?? "";
      const endpoint = knezClient.getProfile().endpoint;
      const cp = "CP01_MCP_REGISTRY";
      const result = await taqwinActivationService.activate({ sessionId: sid, knezEndpoint: endpoint, checkpoint: cp });
      logger.info("mcp", "TAQWIN ACTIVATE completed", result);
      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
    } catch (e: any) {
      logger.error("mcp", "TAQWIN ACTIVATE failed", { error: String(e?.message ?? e) });
      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
    }
  };
  
  useEffect(() => {
    const onNavigate = (e: any) => {
      const view = e?.detail?.view as View | undefined;
      if (!view) return;
      setActiveView(view);
      tabErrorStore.clear(view);
    };
    window.addEventListener("knez-navigate", onNavigate);
    return () => window.removeEventListener("knez-navigate", onNavigate);
  }, []);

  useEffect(() => {
    const onActivate = () => { void runTaqwinActivate(); };
    window.addEventListener("taqwin-activate", onActivate as any);
    return () => window.removeEventListener("taqwin-activate", onActivate as any);
  }, [sessionId]);

  return (
    <MainLayout
      activeView={activeView}
      onViewChange={handleViewChange}
      presenceState={presenceState}
      tabErrors={tabErrors}
      connectionStatus={{
        state:
          systemStatus === "starting"
            ? "starting"
            : systemStatus === "failed"
              ? "error"
              : isDegraded
                ? "degraded"
                : isConnected
                  ? "running"
                  : "down",
        connected: online,
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
            onClick={() => {
              if (isConnected || isDegraded) {
                forceCheck();
                return;
              }
              launchAndConnect(systemStatus === "failed");
            }}
            disabled={systemStatus === "starting"}
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
        onNavigate={(view) => { handleViewChange(view); setCommandPaletteOpen(false); }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenTaqwinTools={features.taqwinTools ? () => {
          handleViewChange("chat");
          window.dispatchEvent(new CustomEvent("taqwin-tools-open"));
        } : undefined}
        onTaqwinActivate={features.taqwinTools ? () => void runTaqwinActivate() : undefined}
      />
      {features.floatingConsole ? <FloatingConsole /> : null}
      <E2EBanner />
      
      <div className="h-full min-h-0 min-w-0 relative">
        {renderContent()}
        {lastCheck === null && (
          <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3 text-zinc-300">
              <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-zinc-200 animate-spin" />
              <div className="text-sm">Starting…</div>
            </div>
          </div>
        )}
      </div>
      
       {showSettings && <SettingsModal 
         onClose={() => {
           setShowSettings(false);
           forceCheck();
         }}
         systemStatus={systemStatus}
         systemOutput={systemOutput}
         systemHealthProbe={systemHealthProbe}
         onForceStart={launchAndConnect}
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

function App() {
  // Track open session
  useEffect(() => {
    analytics.trackSession();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("boot-splash")?.remove();
      });
    });
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
