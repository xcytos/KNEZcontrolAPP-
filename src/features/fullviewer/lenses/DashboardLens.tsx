import React, { useState, useCallback } from 'react';
import { LayoutDashboard, BarChart3, Activity } from 'lucide-react';
import { TaqwinHierarchicalView } from '../../data/TaqwinHierarchicalView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import type { SessionContext } from '../types';

interface DashboardLensProps {
  sessionContext: SessionContext;
  onSessionContextChange: (ctx: SessionContext) => void;
}

type DashboardTab = 'hierarchy' | 'evolution' | 'sessions';

export const DashboardLens: React.FC<DashboardLensProps> = ({ sessionContext, onSessionContextChange }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('hierarchy');

  const handleActivityContextChange = useCallback((ctx: SessionContext) => {
    onSessionContextChange(ctx);
  }, [onSessionContextChange]);

  const tabs = [
    { id: 'hierarchy' as DashboardTab, label: 'Hierarchy', icon: LayoutDashboard },
    { id: 'evolution' as DashboardTab, label: 'Evolution', icon: BarChart3 },
    { id: 'sessions' as DashboardTab, label: 'Sessions', icon: Activity },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeTab === tab.id
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'hierarchy' && (
          <TaqwinHierarchicalView
            onNavigateToSqlite={() => {}}
            onActivityContextChange={handleActivityContextChange}
          />
        )}
        {activeTab === 'evolution' && (
          <div className="h-full bg-zinc-950 p-4 flex items-center justify-center">
            <div className="text-center text-zinc-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Knowledge Evolution</p>
              <p className="text-xs text-zinc-600 mt-1">Select a session from Hierarchy to view evolution data</p>
            </div>
          </div>
        )}
        {activeTab === 'sessions' && (
          <ActiveSessionsPanel
            currentSessionId={sessionContext.sessionId}
            currentProjectId={sessionContext.projectId}
          />
        )}
      </div>
    </div>
  );
};
