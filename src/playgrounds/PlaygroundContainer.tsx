import React, { useState, useCallback, useRef } from 'react';
import { Code, Plus, X, Eye, EyeOff, RefreshCw, ChevronUp, ChevronDown, Link2 } from 'lucide-react';
import { PlaygroundType } from '../domain/PlaygroundTypes';
import AgentManagerPanel from './AgentManagerPanel';
import { ViewManager } from '../features/viewer/ViewManager';
import { CreateViewDialog } from '../features/viewer/CreateViewDialog';
import { usePlaygroundState } from './PlaygroundContext';

export const PlaygroundContainer: React.FC = () => {
  const {
    tabs, viewState, refreshTab,
    addTerminal, addOpenCode, launchAgent, closeTab, selectTab,
    registerViewport, showTerminalHeader, setShowTerminalHeader,
  } = usePlaygroundState();

  // Stable ID for this container instance — survives renders, unique per mount
  const containerIdRef = useRef(`pc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const handleViewportRef = useCallback((el: HTMLDivElement | null) => {
    registerViewport(containerIdRef.current, el);
  }, [registerViewport]);

  const [showSlidePanel, setShowSlidePanel] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showAssignSession, setShowAssignSession] = useState(false);

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
            {/* Viewport for shared terminal panels — rendered by PlaygroundProvider */}
            <div className="flex-1 relative bg-gray-900 min-h-0">
              <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold z-20">⬤CONTENT</span>
              {/* Always render viewport div so overlay has a positioning reference */}
              <div ref={handleViewportRef} className="absolute inset-0" />
              {/* Overlay AgentManagerPanel on top when that tab is active */}
              {activeTab?.type === PlaygroundType.AGENT_MANAGER && (
                <div className="absolute inset-0 z-10">
                  <AgentManagerPanel sdk={undefined as any} onLaunch={launchAgent} />
                </div>
              )}
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
            onClick={() => setPanelCollapsed(v => !v)}
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
