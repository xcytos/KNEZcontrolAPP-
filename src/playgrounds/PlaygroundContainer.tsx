import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Code, Maximize2, Minimize2, PanelBottom, PanelBottomClose, GripHorizontal } from 'lucide-react';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundType, PlaygroundConfig, PanelPosition, ViewState } from '../domain/PlaygroundTypes';
import OpenCodePlayground from './OpenCodePlayground';
import { TerminalPlayground } from './TerminalPlayground';

const STORAGE_KEY = 'knez_playground_viewstate';
const DEFAULT_PANEL_HEIGHT = 300;
const MIN_PANEL_HEIGHT = 100;

interface PlaygroundContainerProps {
  sdk: PlaygroundSDK;
}

interface TabConfig {
  id: PlaygroundType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<{ sdk: PlaygroundSDK }>;
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

// Wrappers that supply default config for components that need it
const TerminalPlaygroundWrapper: React.FC<{ sdk: PlaygroundSDK }> = ({ sdk }) => (
  <TerminalPlayground sdk={sdk} config={defaultTerminalConfig} isActive />
);

const OpenCodePlaygroundWrapper: React.FC<{ sdk: PlaygroundSDK }> = ({ sdk }) => (
  <OpenCodePlayground sdk={sdk} config={defaultOpenCodeConfig} isActive />
);

const TABS: TabConfig[] = [
  { id: PlaygroundType.TERMINAL, label: 'Terminal', icon: Monitor, component: TerminalPlaygroundWrapper },
  { id: PlaygroundType.OPENCODE, label: 'OpenCode', icon: Code, component: OpenCodePlaygroundWrapper },
];

function loadViewState(): ViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    panel: {
      position: PanelPosition.BOTTOM,
      isVisible: false,
      height: DEFAULT_PANEL_HEIGHT,
      activeTabId: null,
      lastScrollPositions: {},
    },
    expandedPlayground: null,
    savedSessions: [],
  };
}

function saveViewState(state: ViewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export const PlaygroundContainer: React.FC<PlaygroundContainerProps> = ({ sdk }) => {
  const [viewState, setViewState] = useState<ViewState>(loadViewState);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const scrollPositions = useRef<Record<string, number>>(viewState.panel.lastScrollPositions);

  useEffect(() => {
    saveViewState(viewState);
  }, [viewState]);

  // Restore scroll when active tab changes
  useEffect(() => {
    if (viewState.panel.activeTabId) {
      restoreScroll(viewState.panel.activeTabId);
    }
  }, [viewState.panel.activeTabId]);

  // Sync scroll positions into viewState so they survive unmount
  const syncScrollPositions = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      panel: { ...prev.panel, lastScrollPositions: { ...scrollPositions.current } },
    }));
  }, []);

  // Sync on unmount
  useEffect(() => {
    return () => { syncScrollPositions(); };
  }, [syncScrollPositions]);

  // Save scroll position when switching tabs
  const saveCurrentScroll = useCallback(() => {
    if (contentRef.current) {
      const activeId = viewState.panel.activeTabId;
      if (activeId) {
        scrollPositions.current[activeId] = contentRef.current.scrollTop;
        syncScrollPositions();
      }
    }
  }, [viewState.panel.activeTabId, syncScrollPositions]);

  // Restore scroll position when switching to a tab
  const restoreScroll = useCallback((tabId: string) => {
    requestAnimationFrame(() => {
      if (contentRef.current) {
        const pos = scrollPositions.current[tabId] ?? 0;
        contentRef.current.scrollTop = pos;
      }
    });
  }, []);

  const togglePanel = useCallback(() => {
    setViewState(prev => {
      const next = { ...prev, panel: { ...prev.panel, isVisible: !prev.panel.isVisible } };
      return next;
    });
  }, []);

  const selectTab = useCallback((tabId: PlaygroundType) => {
    setViewState(prev => {
      if (prev.panel.activeTabId === tabId && prev.panel.isVisible) {
        // Toggle off if clicking the same tab
        return { ...prev, panel: { ...prev.panel, isVisible: false, activeTabId: null } };
      }
      // Show panel and switch tab
      return { ...prev, panel: { ...prev.panel, isVisible: true, activeTabId: tabId } };
    });
  }, []);

  // Resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = viewState.panel.height ?? DEFAULT_PANEL_HEIGHT;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(MIN_PANEL_HEIGHT, startHeight.current + delta);
      setViewState(prev => ({ ...prev, panel: { ...prev.panel, height: newHeight } }));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [viewState.panel.height]);

  const activeTab = TABS.find(t => t.id === viewState.panel.activeTabId);
  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Tab Bar */}
      <div className="flex items-center justify-between bg-gray-800 border-b border-gray-700 select-none flex-shrink-0">
        <div className="flex items-center overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = viewState.panel.activeTabId === tab.id && viewState.panel.isVisible;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-gray-700 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-inner'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
                }`}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={togglePanel}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={viewState.panel.isVisible ? 'Close Panel' : 'Open Panel'}
          >
            {viewState.panel.isVisible ? <PanelBottomClose className="w-3.5 h-3.5" /> : <PanelBottom className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setViewState(prev => ({
              ...prev,
              expandedPlayground: prev.expandedPlayground ? null : prev.panel.activeTabId,
            }))}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={viewState.expandedPlayground ? 'Minimize' : 'Maximize'}
          >
            {viewState.expandedPlayground ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel Content - Resizable */}
      {viewState.panel.isVisible ? (
        <div
          ref={panelRef}
          className="flex flex-col overflow-hidden relative"
          style={{ height: viewState.expandedPlayground ? '100%' : (viewState.panel.height ?? DEFAULT_PANEL_HEIGHT) }}
        >
          {/* Drag Handle */}
          {!viewState.expandedPlayground && (
            <div
              onMouseDown={handleMouseDown}
              className="flex-shrink-0 h-2 bg-gray-800 hover:bg-blue-600 cursor-row-resize flex items-center justify-center group transition-colors"
            >
              <GripHorizontal className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
            </div>
          )}

          {/* All tabs rendered but only active one visible - preserves scroll/state per tab */}
          <div className="flex-1 relative bg-gray-900">
            {TABS.map(tab => {
              const TabComponent = tab.component;
              const isActive = viewState.panel.activeTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  className="absolute inset-0 overflow-auto"
                  style={{
                    visibility: isActive ? 'visible' : 'hidden',
                    pointerEvents: isActive ? 'auto' : 'none',
                    zIndex: isActive ? 1 : 0,
                  }}
                  ref={isActive ? contentRef : undefined}
                  onScroll={isActive ? saveCurrentScroll : undefined}
                >
                  <TabComponent sdk={sdk} />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Collapsed state - no panel visible */
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-500">
            <PanelBottom className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Panel Hidden</p>
            <p className="text-xs mt-1 text-gray-600">Click a tab above or the toggle button to show</p>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePanel}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            {viewState.panel.isVisible ? (
              <PanelBottomClose className="w-3 h-3" />
            ) : (
              <PanelBottom className="w-3 h-3" />
            )}
            <span>{viewState.panel.isVisible ? 'Hide Panel' : 'Show Panel'}</span>
          </button>
          {activeTab && viewState.panel.isVisible && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-300">{activeTab.label}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewState.savedSessions.length > 0 && (
            <span>{viewState.savedSessions.length} session{viewState.savedSessions.length !== 1 ? 's' : ''} saved</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaygroundContainer;