import { useEffect, useRef, useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { View } from './components/layout/Sidebar';
import { ChatPane } from './features/chat/ChatPane';
import { MemoryExplorer } from './features/memory/MemoryExplorer';
import { SessionTimeline } from './features/timeline/SessionTimeline';
import { ReflectionPane } from './features/reflection/ReflectionPane';
import { MistakeLedger } from './features/mistakes/MistakeLedger';
import { DriftVisualizer } from './features/drift/DriftVisualizer';
import { ConnectionSettings } from './features/settings/ConnectionSettings';
import { KnezEventsPanel } from './features/events/KnezEventsPanel';
import { InfrastructurePanel } from './features/infrastructure/InfrastructurePanel';
import { McpRegistryView } from './features/mcp/McpRegistryView';
import { ApprovalPanel } from './features/governance/ApprovalPanel';
import { PresenceEngine, PresenceConfig } from './presence/PresenceEngine';
import { PresenceState, KnezHealthResponse, McpRegistrySnapshot } from './domain/DataContracts';
import { knezClient } from './services/KnezClient';
import './App.css';

const PRESENCE_CONFIG: PresenceConfig = {
  debounceMillis: 1000,
};

function App() {
  const [activeView, setActiveView] = useState<View>('chat');
  const [presenceState, setPresenceState] = useState<PresenceState>('SILENT');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(knezClient.getSessionId());
  const [knezTrusted, setKnezTrusted] = useState(knezClient.getProfile().trustLevel === 'verified');
  const [readOnly, setReadOnly] = useState(true);
  
  // Checkpoint 1.5 State
  const [healthData, setHealthData] = useState<KnezHealthResponse | null>(null);
  const [mcpData, setMcpData] = useState<McpRegistrySnapshot | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const engineRef = useRef<PresenceEngine>(null);

  const checkConnection = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const profile = knezClient.getProfile();
    const trusted = profile.trustLevel === 'verified';
    setKnezTrusted(trusted);

    if (!trusted) {
      setReadOnly(true);
      setIsConnected(false);
      setHealthData(null);
      setMcpData(null);
      return;
    }

    try {
      const health = await knezClient.health();
      setHealthData(health);
      setLastCheck(Date.now());
      setIsConnected(true);
      setReadOnly(false);

      const connected = engine.apply({ kind: 'connection_restored', at: Date.now() });
      setPresenceState(connected.state);

      const sid = await knezClient.ensureSession();
      setSessionId(sid);

      // Opportunistic MCP fetch (don't block if it fails, handled by view)
      const mcp = await knezClient.tryGetMcpRegistry();
      setMcpData(mcp);

    } catch (error) {
      console.error("Connection check failed:", error);
      setIsConnected(false);
      setReadOnly(true);
      const lost = engine.apply({ kind: 'connection_lost', at: Date.now() });
      setPresenceState(lost.state);
    }
  };

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new PresenceEngine(PRESENCE_CONFIG);
      setPresenceState(engineRef.current.getSnapshot().state);
    }

    const bootstrap = async () => {
       const engine = engineRef.current;
       if (!engine) return;

       const opened = engine.apply({ kind: 'app_opened', at: Date.now() });
       setPresenceState(opened.state);

       await checkConnection();
    };

    bootstrap();
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'chat':
        return <ChatPane sessionId={sessionId} readOnly={readOnly} />;
      case 'memory':
        return (
          <div className="flex h-full">
            <div className="w-2/3 border-r border-zinc-800 overflow-y-auto">
              <MemoryExplorer sessionId={sessionId} readOnly={readOnly} />
            </div>
            <div className="w-1/3 p-4 flex flex-col space-y-4 overflow-y-auto bg-zinc-900/20">
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
        return <ApprovalPanel />;
      case 'infrastructure':
        return (
          <InfrastructurePanel 
            backends={healthData?.backends ?? []} 
            lastCheck={lastCheck}
            onRefresh={checkConnection}
          />
        );
      case 'mcp':
        return (
          <McpRegistryView 
            snapshot={mcpData}
            onRefresh={async () => {
              const mcp = await knezClient.tryGetMcpRegistry();
              setMcpData(mcp);
            }}
          />
        );
      default:
        return <ChatPane sessionId={sessionId} readOnly={readOnly} />;
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
            {knezTrusted
              ? 'KNEZ unreachable — read-only mode.'
              : 'KNEZ not trusted — read-only mode. Open settings to trust an instance.'}
            {sessionId ? ` Session: ${sessionId}` : ''}
          </span>
          {!isConnected && knezTrusted && (
            <button 
              onClick={checkConnection}
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
      
      {showSettings && <ConnectionSettings onClose={() => {
        setShowSettings(false);
        checkConnection(); // Re-check when settings close in case endpoint changed
      }} />}
    </MainLayout>
  );
}

export default App;
