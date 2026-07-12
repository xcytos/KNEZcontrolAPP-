import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Monitor, Code, Bot } from 'lucide-react';
import { PlaygroundType, PanelPosition, PlaygroundMode, ViewState, PlaygroundConfig } from '../domain/PlaygroundTypes';
import { getAgentById } from './AgentRegistry';
import { getSessionHistory } from './terminalStorage';
import { playgroundSDK, PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { TerminalPlayground } from './TerminalPlayground';
import OpenCodePlayground from './OpenCodePlayground';
import AgentPlayground from './AgentPlayground';
import { AgentDefinition } from '../domain/AgentTypes';

const STORAGE_KEY = 'knez_playground_viewstate';
const TABS_KEY = 'knez_tabs';
const NEXT_TERMINAL_KEY = 'knez_playground_next_terminal_num';
const NEXT_OPENCODE_KEY = 'knez_next_opencode_num';
const DEFAULT_PANEL_HEIGHT = 300;

export interface TabInstance {
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

function loadViewState(): ViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveViewState(state: ViewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadTabs(mode: PlaygroundMode): TabInstance[] {
  const saved = localStorage.getItem(TABS_KEY);
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

interface PlaygroundContextType {
  tabs: TabInstance[];
  setTabs: React.Dispatch<React.SetStateAction<TabInstance[]>>;
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  nextTerminalNum: number;
  setNextTerminalNum: React.Dispatch<React.SetStateAction<number>>;
  nextOpenCodeNum: number;
  setNextOpenCodeNum: React.Dispatch<React.SetStateAction<number>>;
  refreshKeys: Record<string, number>;
  refreshTab: (tabId: string, e: React.MouseEvent) => void;
  addTerminal: () => void;
  addOpenCode: () => void;
  launchAgent: (agent: AgentDefinition) => void;
  closeTab: (tabId: string, e: React.MouseEvent) => void;
  selectTab: (tabId: string) => void;
  /** Register a viewport element by instance ID. Pass null to unregister (component unmount). */
  registerViewport: (id: string, el: HTMLDivElement | null) => void;
  showTerminalHeader: boolean;
  setShowTerminalHeader: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlaygroundContext = createContext<PlaygroundContextType | null>(null);

export function usePlaygroundState() {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) throw new Error('usePlaygroundState must be inside PlaygroundProvider');
  return ctx;
}

export function PlaygroundProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabInstance[]>(() => {
    const loaded = loadTabs('normal');
    const hasManager = loaded.some(t => t.type === PlaygroundType.AGENT_MANAGER);
    if (!hasManager) loaded.splice(1, 0, makeAgentManagerTab());
    const hasOpenCode = loaded.some(t => t.type === PlaygroundType.OPENCODE);
    if (!hasOpenCode) loaded.splice(2, 0, makeOpenCodeTab(1));
    return loaded;
  });
  const [viewState, setViewState] = useState<ViewState>(() => loadViewState());
  const [nextTerminalNum, setNextTerminalNum] = useState(() => {
    const saved = localStorage.getItem(NEXT_TERMINAL_KEY);
    return saved ? parseInt(saved, 10) : 2;
  });
  const [nextOpenCodeNum, setNextOpenCodeNum] = useState(() => {
    const saved = localStorage.getItem(NEXT_OPENCODE_KEY);
    return saved ? parseInt(saved, 10) : 1;
  });
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  const [showTerminalHeader, setShowTerminalHeader] = useState(true);

  // Map-based viewport registry — both PlaygroundLens and CombinedView register their viewport divs.
  // The visible one (offsetParent !== null) provides coordinates for the shared terminal overlay.
  const viewportMapRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => { saveViewState(viewState); }, [viewState]);
  useEffect(() => { localStorage.setItem(TABS_KEY, JSON.stringify(serializeTabs(tabs))); }, [tabs]);
  useEffect(() => { localStorage.setItem(NEXT_TERMINAL_KEY, String(nextTerminalNum)); }, [nextTerminalNum]);
  useEffect(() => { localStorage.setItem(NEXT_OPENCODE_KEY, String(nextOpenCodeNum)); }, [nextOpenCodeNum]);

  const sandboxAutoInit = React.useRef(false);
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
  }, [tabs, viewState.panel.activeTabId]);

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

  const refreshTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshKeys(prev => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
  }, []);

  const selectTab = useCallback((tabId: string) => {
    setViewState(prev => ({ ...prev, panel: { ...prev.panel, activeTabId: tabId } }));
  }, []);

  const addTerminal = useCallback(() => {
    const newTab = makeTerminalTab(nextTerminalNum);
    setNextTerminalNum(n => n + 1);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({ ...prev, panel: { ...prev.panel, activeTabId: newTab.id } }));
  }, [nextTerminalNum]);

  const addOpenCode = useCallback(() => {
    const newTab = makeOpenCodeTab(nextOpenCodeNum);
    setNextOpenCodeNum(n => n + 1);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({ ...prev, panel: { ...prev.panel, activeTabId: newTab.id } }));
  }, [nextOpenCodeNum]);

  const launchAgent = useCallback((agent: AgentDefinition) => {
    const newTab = makeAgentTab(agent);
    setTabs(prev => [...prev, newTab]);
    setViewState(prev => ({ ...prev, panel: { ...prev.panel, activeTabId: newTab.id } }));
  }, []);

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

  // Shared terminal panels — rendered ONCE at provider level, always mounted
  const sharedTerminals = useMemo(() => tabs.filter(t => t.type !== PlaygroundType.AGENT_MANAGER), [tabs]);

  // Position state for the shared terminal overlay
  const [overlayRect, setOverlayRect] = useState({ top: 0, left: 0, width: 0, height: 0 });

  // Find the visible viewport element and update overlay position
  const updateOverlayFromVisible = useCallback(() => {
    for (const el of viewportMapRef.current.values()) {
      if (el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        setOverlayRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        return;
      }
    }
    setOverlayRect({ top: 0, left: 0, width: 0, height: 0 });
  }, []);

  // Single ResizeObserver observes all registered viewports
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(updateOverlayFromVisible);
    resizeObserverRef.current = ro;
    // Observe viewports that registered before this effect ran (callback refs fire before effects)
    for (const el of viewportMapRef.current.values()) {
      ro.observe(el);
    }
    // Re-evaluate in case a viewport registered before the ResizeObserver existed
    updateOverlayFromVisible();
    window.addEventListener('scroll', updateOverlayFromVisible, true);
    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('scroll', updateOverlayFromVisible, true);
    };
  }, [updateOverlayFromVisible]);

  const registerViewport = useCallback((id: string, el: HTMLDivElement | null) => {
    const ro = resizeObserverRef.current;
    if (el) {
      viewportMapRef.current.set(id, el);
      ro?.observe(el);
      if (el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        setOverlayRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }
    } else {
      const existing = viewportMapRef.current.get(id);
      if (existing) ro?.unobserve(existing);
      viewportMapRef.current.delete(id);
      updateOverlayFromVisible();
    }
  }, [updateOverlayFromVisible]);

  return (
    <PlaygroundContext.Provider value={{
      tabs, setTabs, viewState, setViewState,
      nextTerminalNum, setNextTerminalNum,
      nextOpenCodeNum, setNextOpenCodeNum,
      refreshKeys, refreshTab,
      addTerminal, addOpenCode, launchAgent, closeTab, selectTab,
      registerViewport,
      showTerminalHeader, setShowTerminalHeader,
    }}>
      {children}

      {/* Shared terminal panels — single instance, always mounted, overlaid via fixed positioning */}
      <div
        style={{
          position: 'fixed',
          top: overlayRect.top,
          left: overlayRect.left,
          width: overlayRect.width,
          height: overlayRect.height,
          zIndex: 50,
          pointerEvents: overlayRect.width > 0 ? 'auto' : 'none',
          overflow: 'hidden',
          backgroundColor: '#111827',
        }}
      >
        {sharedTerminals.map(tab => {
          const TabComponent = tab.component;
          const isActive = viewState.panel.activeTabId === tab.id;
          const tabKey = `${tab.id}-${refreshKeys[tab.id] || 0}`;
          return (
            <div
              key={tabKey}
              style={{
                position: 'absolute',
                inset: 0,
                visibility: isActive ? 'visible' : 'hidden',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isActive ? 1 : 0,
                overflow: 'auto',
              }}
            >
              <TabComponent sdk={playgroundSDK} headerVisible={showTerminalHeader} isActive={isActive} />
            </div>
          );
        })}
      </div>
    </PlaygroundContext.Provider>
  );
}
