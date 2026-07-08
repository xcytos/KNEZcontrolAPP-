import React, { useCallback } from 'react';
import { LayoutDashboard, Activity } from 'lucide-react';
import { TaqwinHierarchicalView } from '../../data/TaqwinHierarchicalView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import { useFullViewer } from '../FullViewerContext';
import type { DashboardSubTab, SessionContext } from '../types';

export const DashboardLens: React.FC = () => {
  const {
    sessionContext, setSessionContext,
    navigation, setActiveSubTab,
    setSelectedSessionId, setSelectedProjectId, setViewLevel,
  } = useFullViewer();
  const { selectedSessionId, selectedProjectId, viewLevel } = navigation;

  const handleActivityContextChange = useCallback((ctx: SessionContext) => {
    setSessionContext(ctx);
    if (ctx.sessionId) setSelectedSessionId(ctx.sessionId);
    if (ctx.projectId) setSelectedProjectId(ctx.projectId);
    if (ctx.sessionId && ctx.projectId) setViewLevel('session-detail');
    else if (ctx.projectId) setViewLevel('sessions');
    else setViewLevel('projects');
  }, [setSessionContext, setSelectedSessionId, setSelectedProjectId, setViewLevel]);

  const tabs = [
    { id: 'hierarchy' as DashboardSubTab, label: 'Hierarchy', icon: LayoutDashboard },
    { id: 'sessions' as DashboardSubTab, label: 'Sessions', icon: Activity },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 flex-shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                navigation.activeSubTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden" style={{ display: navigation.activeSubTab === 'hierarchy' ? 'flex' : 'none' }}>
          <TaqwinHierarchicalView
            onNavigateToSqlite={() => {}}
            onActivityContextChange={handleActivityContextChange}
            controlledNavigation={{
              viewLevel,
              selectedProjectId,
              selectedSessionId,
              onViewLevelChange: setViewLevel,
              onSelectedProjectIdChange: setSelectedProjectId,
              onSelectedSessionIdChange: setSelectedSessionId,
            }}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden" style={{ display: navigation.activeSubTab === 'sessions' ? 'flex' : 'none' }}>
          <ActiveSessionsPanel
            currentSessionId={sessionContext.sessionId}
            currentProjectId={sessionContext.projectId}
            onSessionClick={(sessionId, projectId) => {
              handleActivityContextChange({ sessionId, projectId });
              setActiveSubTab('hierarchy');
            }}
          />
        </div>
      </div>
    </div>
  );
};
