import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Code, Plus, X, Bot, Eye, EyeOff, RefreshCw, ChevronUp, ChevronDown, Link2 } from 'lucide-react';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundType, PlaygroundConfig, PanelPosition, ViewState, PlaygroundMode } from '../domain/PlaygroundTypes';
import { AgentDefinition } from '../domain/AgentTypes';
import { getAgentById } from './AgentRegistry';
import OpenCodePlayground from './OpenCodePlayground';
import { TerminalPlayground } from './TerminalPlayground';
import AgentPlayground from './AgentPlayground';
import AgentManagerPanel from './AgentManagerPanel';
import { ViewManager } from '../features/viewer/ViewManager';
import { CreateViewDialog } from '../features/viewer/CreateViewDialog';
import { getSessionHistory } from './terminalStorage';

const STORAGE_KEY = 'knez_playground_viewstate';
const TABS_KEY = 'knez_tabs';
const NEXT_TERMINAL_KEY = 'knez_playground_next_terminal_num';
const NEXT_OPENCODE_KEY = 'knez_next_opencode_num';
const DEFAULT_PANEL_HEIGHT = 300;

function scopedKey(base: string, instanceId?: string) {
  return instanceId ? `${base}_${instanceId}` : base;
}

interface PlaygroundContainerProps {
  sdk: PlaygroundSDK;
  mode?: PlaygroundMode;
  /** Isolate localStorage state from other PlaygroundContainer instances. */
  instanceId?: string;
}

interface TabInstance {
  id: string;
  type: PlaygroundType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<{ sdk: PlaygroundSDK; headerVisible?: boolean; isActive?: boolean }>;
  closable: boolean;
  agentId?: string;
  agentSessionId?: string;
}

interface TabSerialized {
  id: string;
  type: PlaygroundType;
  label: string;
  closable: boolean;
  agentId?: string;
  agentSessionId?: string;
}

const defaultTerminalConfig: PlaygroundConfig = {
  name: 'Terminal Playground',
  description: 'Real PTY terminal with shell integration',
  version: '1.0.0',
  author: 'KNEZ Team',
  capabilities: { supportsMultiSession: true, supportsBackgroundAgents: false, supportsFileAccess: true, supportsTerminalAccess: true, supportsNetworkAccess: false, supportsMCPTools: false },
  resourceRequirements: { minMemory: 256, maxMemory: 512, minCpuCores: 1, requiredPermissions: ['terminal', 'filesystem'], optionalPermissions: ['network'] },
  ui: { theme: 'dark', layout: 'terminal-focused', compactMode: false, advancedMode: false },
  session: { type: PlaygroundType.TERMINAL, autoSave: false, persistence: false, sharing: false, isolation: 'session' },
  features: { multiSession: true, backgroundAgents: false, sessionSharing: false, darkMode: true, compactMode: false, advancedMode: false, debugMode: true, experimentalFeatures: false, betaFeatures: false, hardwareAcceleration: false, virtualization: false, caching: false },
};

const defaultOpenCodeConfig: PlaygroundConfig = {
  name: 'OpenCode Playground',
  description: 'Terminal-native AI coding agent',
  version: '1.0.0',
  author: 'KNEZ Team',
  capabilities: { supportsMultiSession: true, supportsBackgroundAgents: true, supportsFileAccess: true, supportsTerminalAccess: true, supportsNetworkAccess: true, supportsMCPTools: true },
  resourceRequirements: { minMemory: 512, maxMemory: 2048, minCpuCores: 2, requiredPermissions: ['network', 'filesystem', 'terminal'], optionalPermissions: ['camera', 'microphone', 'system'] },
  ui: { theme: 'dark', layout: 'terminal-focused', compactMode: false, advancedMode: true },
  session: { type: PlaygroundType.OPENCODE, autoSave: true, persistence: true, sharing: false, isolation: 'shared_workspace' as const },
  features: { multiSession: true, backgroundAgents: true, sessionSharing: true, darkMode: true, compactMode: false, advancedMode: true, debugMode: true, experimentalFeatures: true, betaFeatures: true, hardwareAcceleration: true, virtualization: true, caching: true },
};

let nextAgentNum = 1;

function makeTerminalTab(num: number): TabInstance {
  const TerminalWrapper: React.FC<{ sdk: PlaygroundSDK; headerVisible?: boolean; isActive?: boolean }> = ({ sdk, headerVisible = true, isActive }) => (
    <TerminalPlayground sdk={sdk} config={defaultTerminalConfig} isActive={!!isActive} headerVisible={headerVisible} />
  );
  return {
    id: `terminal-${num}-${Date.now()}`,
    type: PlaygroundType.TERMINAL,
    label: `Terminal ${num}`,
    icon: Monitor,
    component: TerminalWrapper,
    closable: true,
  };
}

function makeOpenCodeTab(num: number): TabInstance {
  const OpenCodeWrapper: React.FC<{ sdk: PlaygroundSDK; headerVisible?: boolean; isActive?: boolean }> = ({ sdk, isActive }) => (
    <OpenCodePlayground sdk={sdk} config={defaultOpenCodeConfig} isActive={!!isActive} />
  );
  return {
    id: `opencode-${num}-${Date.now()}`,
    type: PlaygroundType.OPENCODE,
    label: `OpenCode ${num}`,
    icon: Code,
    component: OpenCodeWrapper,
    closable: true,
  };
}

function makeAgentManagerTab(): TabInstance {
  const AgentManagerWrapper: React.FC<{ sdk: PlaygroundSDK; headerVisible?: boolean }> = () => null;
  return {
    id: 'agent-manager',
    type: PlaygroundType.AGENT_MANAGER,
    label: 'Agents',
    icon: Bot,
    component: AgentManagerWrapper,
    closable: false,
  };
}

function makeAgentTab(agent: AgentDefinition, existingSessionId?: string): TabInstance {
  const agentLabel = `${agent.icon || ''} ${agent.name}`.trim();
  const num = nextAgentNum++;
    const AgentWrapper: React.FC<{ sdk: PlaygroundSDK; headerVisible?: boolean; isActive?: boolean }> = ({ sdk, headerVisible = true, isActive }) => (
      <AgentPlayground sdk={sdk} agent={agent} isActive={!!isActive} headerVisible={headerVisible} />
    );
  return {
    id: `agent-${agent.id}-${num}-${Date.now()}`,
    type: PlaygroundType.AGENT,
    label: agentLabel,
    icon: Bot,
    component: AgentWrapper,
    closable: true,
    agentId: agent.id,
    agentSessionId: existingSessionId,
  };
}

function loadPersistentSessions() {
  const history = getSessionHistory();
  return history.map(s => ({
    id: s.tabId,
    type: s.type as any,
    name: s.label,
    lastActivity: s.timestamp,
    scrollPosition: 0,
    isPinned: false,
  }));
}

function loadViewState(viewStateKey: string): ViewState {
  try {
    const raw = localStorage.getItem(viewStateKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.savedSessions || parsed.savedSessions.length === 0) {
        parsed.savedSessions = loadPersistentSessions();
      }
      return parsed;
    }
  } catch {}
  return {
    panel: {
      position: PanelPosition.BOTTOM,
      isVisible: false,
      height: DEFAULT_PANEL_HEIGHT,
      activeTabId: null,
      lastScrollPositions: {},
    },
    savedSessions: loadPersistentSessions(),
  };
}

function saveViewState(viewStateKey: string, state: ViewState) {
  try {
    localStorage.setItem(viewStateKey, JSON.stringify(state));
  } catch {}
}

function loadTabs(tabsKey: string, mode: PlaygroundMode): TabInstance[] {
  const saved = localStorage.getItem(tabsKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as TabSerialized[];
      if (parsed.length > 0) {
        return parsed.map(t => {
          if (mode === 'sandbox' && (t.type === PlaygroundType.OPENCODE || t.type === PlaygroundType.AGENT)) {
            return null;
          }
          if (t.type === PlaygroundType.OPENCODE) {
            const match = t.label.match(/\d+$/);
            const num = match ? parseInt(match[0], 10) : 1;
            return makeOpenCodeTab(num);
          }
          if (t.type === PlaygroundType.AGENT_MANAGER) return makeAgentManagerTab();
          if (t.type === PlaygroundType.AGENT && t.agentId) {
            const agent = getAgentById(t.agentId);
            if (agent) return makeAgentTab(agent, t.agentSessionId);
          }
          const TerminalWrapper: React.FC<{ sdk: PlaygroundSDK; isActive?: boolean }> = ({ sdk, isActive }) => (
            <TerminalPlayground sdk={sdk} config={defaultTerminalConfig} isActive={!!isActive} />
          );
          return { ...t, icon: Monitor, component: TerminalWrapper };
        }).filter(Boolean) as TabInstance[];
      }
    } catch {}
  }
  return [makeTerminalTab(1)];
}

function serializeTabs(tabs: TabInstance[]): TabSerialized[] {
  return tabs.map(t => ({
    id: t.id,
    type: t.type,
    label: t.label,
    closable: t.closable,
    agentId: t.agentId,
    agentSessionId: t.agentSessionId,
  }));
}

export const PlaygroundContainer: React.FC<PlaygroundContainerProps> = ({ sdk, mode = 'normal', instanceId }) => {
  const viewStateKey = scopedKey(STORAGE_KEY, instanceId);
  const tabsKey = scopedKey(TABS_KEY, instanceId);
  const nextTerminalKey = scopedKey(NEXT_TERMINAL_KEY, instanceId);
  const nextOpenCodeKey = scopedKey(NEXT_OPENCODE_KEY, instanceId);

  const [viewState, setViewState] = useState<ViewState>(() => loadViewState(viewStateKey));
  const [tabs, setTabs] = useState<TabInstance[]>(() => {
    const loaded = loadTabs(tabsKey, mode);
    const hasManager = loaded.some(t => t.type === PlaygroundType.AGENT_MANAGER);
    if (!hasManager) {
      loaded.splice(1, 0, makeAgentManagerTab());
    }
    const hasOpenCode = loaded.some(t => t.type === PlaygroundType.OPENCODE);
    if (!hasOpenCode && mode !== 'sandbox') {
      loaded.splice(2, 0, makeOpenCodeTab(1));
    }
    if (mode === 'sandbox') {
      return loaded.filter(t => t.type === PlaygroundType.TERMINAL || t.type === PlaygroundType.AGENT_MANAGER);
    }
    return loaded;
  });
  const [nextTerminalNum, setNextTerminalNum] = useState(() => {
    const saved = localStorage.getItem(nextTerminalKey);
    return saved ? parseInt(saved, 10) : 2;
  });
  const [nextOpenCodeNum, setNextOpenCodeNum] = useState(() => {
    const saved = localStorage.getItem(nextOpenCodeKey);
    return saved ? parseInt(saved, 10) : 1;
  });
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  const [showTerminalHeader, setShowTerminalHeader] = useState(true);
  const [showSlidePanel, setShowSlidePanel] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showAssignSession, setShowAssignSession] = useState(false);
  const panelHeightRef = useRef(viewState.panel.height ?? DEFAULT_PANEL_HEIGHT);
  const sandboxAutoInit = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>(viewState.panel.lastScrollPositions);

  useEffect(() => {
    saveViewState(viewStateKey, viewState);
  }, [viewState]);

  useEffect(() => {
    localStorage.setItem(tabsKey, JSON.stringify(serializeTabs(tabs)));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem(nextTerminalKey, String(nextTerminalNum));
  }, [nextTerminalNum]);

  useEffect(() => {
    const maxNum = tabs.reduce((max, t) => {
      if (t.type === PlaygroundType.OPENCODE) {
        const m = t.label.match(/\d+$/);
        return m ? Math.max(max, parseInt(m[0], 10)) : max;
      }
      return max;
    }, 0);
    setNextOpenCodeNum(prev => Math.max(prev, maxNum + 1));
  }, []);

  useEffect(() => {
    localStorage.setItem(nextOpenCodeKey, String(nextOpenCodeNum));
  }, [nextOpenCodeNum]);

  useEffect(() => {
    if (!sandboxAutoInit.current && tabs.length > 0) {
      sandboxAutoInit.current = true;
      const savedId = viewState.panel.activeTabId;
      const exists = savedId && tabs.some(t => t.id === savedId);
      if (!exists) {
        setViewState(prev => ({
          ...prev,
          panel: { ...prev.panel, activeTabId: tabs[0].id },
        }));
      }
    }
  }, [tabs]);

  const refreshTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshKeys(prev => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
  }, []);

  useEffect(() => {
    if (viewState.panel.activeTabId) {
      restoreScroll(viewState.panel.activeTabId);
    }
  }, [viewState.panel.activeTabId]);

  const syncScrollPositions = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      panel: { ...prev.panel, lastScrollPositions: { ...scrollPositions.current } },
    }));
  }, []);

  useEffect(() => {
    return () => { syncScrollPositions(); };
  }, [syncScrollPositions]);

  const saveCurrentScroll = useCallback(() => {
    if (contentRef.current) {
      const activeId = viewState.panel.activeTabId;
      if (activeId) {
        scrollPositions.current[activeId] = contentRef.current.scrollTop;
        syncScrollPositions();
      }
    }
  }, [viewState.panel.activeTabId, syncScrollPositions]);

  const restoreScroll = useCallback((tabId: string) => {
    requestAnimationFrame(() => {
      if (contentRef.current) {
        const pos = scrollPositions.current[tabId] ?? 0;
        contentRef.current.scrollTop = pos;
      }
    });
  }, []);

  const selectTab = useCallback((tabId: string) => {
    setViewState(prev => ({ ...prev, panel: { ...prev.panel, activeTabId: tabId } }));
  }, []);

  const addTerminal = useCallback(() => {
    const newTab = makeTerminalTab(nextTerminalNum);
    setNextTerminalNum(n => n + 1);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({
      ...prev,
      panel: { ...prev.panel, activeTabId: newTab.id },
    }));
  }, [nextTerminalNum]);

  const addOpenCode = useCallback(() => {
    const newTab = makeOpenCodeTab(nextOpenCodeNum);
    setNextOpenCodeNum(n => n + 1);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({
      ...prev,
      panel: { ...prev.panel, activeTabId: newTab.id },
    }));
  }, [nextOpenCodeNum]);

  const launchAgent = useCallback((agent: AgentDefinition) => {
    if (mode === 'sandbox') return;
    const newTab = makeAgentTab(agent);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({
      ...prev,
      panel: { ...prev.panel, activeTabId: newTab.id },
    }));
  }, [mode]);

  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) {
        const fallback = makeTerminalTab(1);
        setNextTerminalNum(n => Math.max(n, 2));
        return [fallback];
      }
      return filtered;
    });
    setViewState(prev => {
      if (prev.panel.activeTabId === tabId) {
        const remaining = tabs.filter(t => t.id !== tabId);
        const next = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        return { ...prev, panel: { ...prev.panel, activeTabId: next } };
      }
      return prev;
    });
  }, [tabs]);

  const handleAssignSession = useCallback((sessionId: string) => {
    const playgroundTabs = tabs.map(t => ({
      type: t.type as 'terminal' | 'opencode' | 'agent',
      label: t.label,
      agentId: t.agentId,
      agentSessionId: t.agentSessionId,
    }));
    ViewManager.create(`Playground - ${sessionId}`, sessionId, undefined, playgroundTabs);
    setShowAssignSession(false);
  }, [tabs]);

  const activeTab = tabs.find(t => t.id === viewState.panel.activeTabId);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-900">
      <div className="flex items-center justify-between bg-gray-800 border-b border-gray-700 select-none flex-shrink-0 relative">
        <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold z-20">⬤TAB-BAR</span>
        <div className="flex items-center overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = viewState.panel.activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-1 px-2.5 py-2 text-xs font-medium border-r border-gray-700 cursor-pointer transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                onClick={() => selectTab(tab.id)}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{tab.label}</span>
                {tab.closable && (
                  <>
                    {tab.type === PlaygroundType.TERMINAL && (
                      <button
                        onClick={(e) => refreshTab(tab.id, e)}
                        className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-opacity"
                        title="Restart Playground"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-opacity"
                      title="Close"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <button
            onClick={addTerminal}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border-r border-gray-700"
            title="New Playground"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={addOpenCode}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="New OpenCode"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          <button
            onClick={() => setShowTerminalHeader(v => !v)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={showTerminalHeader ? 'Hide Playground Header' : 'Show Playground Header'}
          >
            {showTerminalHeader ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div
              className="flex flex-col overflow-hidden flex-1 min-h-0"
              style={{ display: panelCollapsed ? 'none' : 'flex' }}
            >
            <div className="flex-1 relative bg-gray-900 min-h-0">
              <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold z-20">⬤CONTENT</span>
              {tabs.map(tab => {
                const TabComponent = tab.component;
                const isActive = viewState.panel.activeTabId === tab.id;
                const tabKey = `${tab.id}-${refreshKeys[tab.id] || 0}`;
                return (
                  <div
                    key={tabKey}
                    className="absolute inset-0 overflow-auto"
                    style={{
                      visibility: isActive ? 'visible' : 'hidden',
                      pointerEvents: isActive ? 'auto' : 'none',
                      zIndex: isActive ? 1 : 0,
                    }}
                    ref={isActive ? contentRef : undefined}
                    onScroll={isActive ? saveCurrentScroll : undefined}
                  >
                    {tab.type === PlaygroundType.AGENT_MANAGER ? (
                      <AgentManagerPanel sdk={sdk} onLaunch={launchAgent} />
                    ) : (
                      <TabComponent sdk={sdk} headerVisible={showTerminalHeader} isActive={isActive} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {showSlidePanel && (
          <div className="w-64 border-l border-gray-700 bg-gray-900 flex-shrink-0 flex flex-col min-h-0 relative">
            <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold z-20">⬤PANEL</span>
            <div className="p-3 text-xs text-gray-400 font-medium border-b border-gray-700">
              Active Tabs
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: '40%' }}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = viewState.panel.activeTabId === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer mb-0.5 ${
                      isActive
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-3 text-xs text-gray-400 font-medium border-t border-b border-gray-700">
              Past Sessions (persisted across restarts)
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {viewState.savedSessions.length === 0 ? (
                <div className="text-xs text-gray-600 px-2 py-1">
                  No previous sessions
                </div>
              ) : (
                viewState.savedSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-0.5 px-2 py-1.5 rounded text-xs mb-0.5 text-gray-400"
                  >
                    <span className="text-gray-300 truncate">{s.name}</span>
                    <span className="text-gray-600">
                      {new Date(s.lastActivity).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex-shrink-0 relative">
        <span className="absolute top-0 right-1 text-[8px] text-red-500 font-bold z-20">⬤BAR</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!panelCollapsed) {
                panelHeightRef.current = viewState.panel.height ?? DEFAULT_PANEL_HEIGHT;
              }
              setPanelCollapsed(v => !v);
            }}
            className="hover:text-white transition-colors p-0.5"
            title={panelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {panelCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span>{activeTab?.label || 'No tab'}</span>
          {viewState.savedSessions.length > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span>{viewState.savedSessions.length} session{viewState.savedSessions.length !== 1 ? 's' : ''} saved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAssignSession(true)}
            className="hover:text-white transition-colors flex items-center gap-1"
            title="Assign a TAQWIN session to create a View"
          >
            <Link2 size={12} />
            <span>Assign Session</span>
          </button>
          <button
            onClick={() => setShowSlidePanel(v => !v)}
            className="hover:text-white transition-colors"
          >
            {showSlidePanel ? 'Hide Sessions' : 'Sessions'}
          </button>
        </div>
      </div>

      {showAssignSession && (
        <CreateViewDialog
          defaultName={`Playground - ${activeTab?.label || 'session'}`}
          onSave={handleAssignSession}
          onClose={() => setShowAssignSession(false)}
        />
      )}
    </div>
  );
};

export default PlaygroundContainer;
