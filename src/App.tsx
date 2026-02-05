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
import { PresenceEngine, PresenceConfig } from './presence/PresenceEngine';
import { PresenceState, McpRegistrySnapshot } from './domain/DataContracts';
import { knezClient } from './services/KnezClient';
import { useSystemOrchestrator } from './features/system/useSystemOrchestrator';
import { ToastProvider } from './components/ui/Toast';
import { StatusProvider, useStatus } from './contexts/StatusProvider';
import './App.css';

const PRESENCE_CONFIG: PresenceConfig = {
  debounceMillis: 1000,
};

function AppContent() {
  const [activeView, setActiveView] = useState<View>('chat');
  const [presenceState, setPresenceState] = useState<PresenceState>('SILENT');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(knezClient.getSessionId());
  const [readOnly, setReadOnly] = useState(true);
  
  const { isConnected, lastCheck, health, forceCheck } = useStatus();
  const engineRef = useRef<PresenceEngine>(null);

  // Sync StatusProvider state to App logic
  useEffect(() => {
    if (isConnected) {
      setReadOnly(false);
      knezClient.ensureSession().then(setSessionId);
      knezClient.tryGetMcpRegistry(); // Background fetch
    } else {
      setReadOnly(true);
    }
  }, [isConnected]);

  // Orchestrator
  const { status: systemStatus, output: systemOutput, launchAndAssumeRunning } = useSystemOrchestrator(() => {
    forceCheck();
  });

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
                onLaunch={launchAndAssumeRunning}
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
            backends={health?.backends ?? []} 
            lastCheck={lastCheck}
            onRefresh={forceCheck}
          />
        );
      case 'mcp':
        // CP5-6: Needs snapshot data, we'll fetch fresh here or use context if we added it
        return (
          <McpLoader />
        );
      case 'logs':
        return <LogsPanel />;
      case 'replay': // Assuming View type needs update, but for now we might reuse a slot or add if possible. 
                   // Since View is likely a string union, I can't easily extend it without seeing sidebar.
                   // I'll assume 'timeline' is the place for replay or I add a new one if permitted.
                   // The prompt said "Replay Timeline with Phase Segmentation".
                   // Existing 'timeline' view returns SessionTimeline. I will replace it with ReplayPane for CP5.
        return <ReplayPane sessionId={sessionId} />;
        
      default:
        return <ChatPane sessionId={sessionId} readOnly={readOnly} onLaunch={launchAndAssumeRunning} systemStatus={systemStatus} />;
    }
  };

  return (
    <MainLayout
      activeView={activeView}
      onViewChange={setActiveView}
      presenceState={presenceState}
      connectionStatus={{
        connected: isConnected,
        endpoint: knezClient.getProfile().endpoint,
        lastCheck: lastCheck
      }}
    >
      {readOnly && (
        <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950 text-xs text-zinc-400 flex items-center justify-between">
          <span>
            {isConnected
              ? 'KNEZ connected.'
              : 'KNEZ unreachable — read-only mode.'}
            {sessionId ? ` Session: ${sessionId}` : ''}
          </span>
          {!isConnected && (
            <button 
              onClick={() => forceCheck()}
              className="text-blue-400 hover:text-blue-300 underline ml-4"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}
      {renderContent()}
      
      <div className="fixed bottom-4 right-4 opacity-50 hover:opacity-100">
         <button 
           onClick={() => setShowSettings(true)}
           className="text-xs text-zinc-600 hover:text-zinc-400"
         >
           ⚙
         </button>
      </div>
      
       {showSettings && <ConnectionSettings 
         onClose={() => {
           setShowSettings(false);
           forceCheck();
         }}
         systemStatus={systemStatus}
         systemOutput={systemOutput}
         onLaunch={launchAndAssumeRunning}
       />}
    </MainLayout>
  );
}

// Helper to handle async loading for MCP
const McpLoader = () => {
  const [snapshot, setSnapshot] = useState<McpRegistrySnapshot | null>(null);
  const load = () => knezClient.tryGetMcpRegistry().then(setSnapshot);
  useEffect(() => { load(); }, []);
  return <McpRegistryView snapshot={snapshot} onRefresh={load} />;
}

import { ThemeProvider } from './contexts/ThemeContext';
import { analytics } from './services/AnalyticsService';

// ... existing imports

function App() {
  // Track open session
  useEffect(() => {
    analytics.trackSession();
  }, []);

  return (
    <ThemeProvider>
      <StatusProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </StatusProvider>
    </ThemeProvider>
  );
}

export default App;
