import React, { useState } from 'react';
import { HardDrive, Server, Search, GitBranch } from 'lucide-react';
import { ControlAppDataView } from './ControlAppDataView';
import { PostgresDataView } from './PostgresDataView';
import { GenericSqliteView } from './GenericSqliteView';
import { TaqwinHierarchicalView } from './TaqwinHierarchicalView';
import { GitStatisticsView } from './GitStatisticsView';
import { LiveActivityNotifier } from './components/LiveActivityNotifier';

type DataSource = 'control-app' | 'postgres' | 'sqlite-browser' | 'taqwin-hierarchy' | 'git-stats';

interface SqliteBrowserState {
  tableName?: string;
  filter?: string;
  issueType?: string;
}

interface LiveActivityContext {
  sessionId?: string;
  sessionName?: string;
  projectId?: string;
}

export const DataExplorer: React.FC = () => {
  const [activeSource, setActiveSource] = useState<DataSource>('taqwin-hierarchy');
  const [sqliteBrowserState, setSqliteBrowserState] = useState<SqliteBrowserState>({});
  const [liveActivityContext, setLiveActivityContext] = useState<LiveActivityContext>({});

  const sources = [
    { 
      id: 'taqwin-hierarchy' as DataSource, 
      label: 'TAQWIN Hierarchy', 
      icon: GitBranch,
      description: 'Session hierarchy • Timeline • Relationships',
      color: 'indigo'
    },
    { 
      id: 'git-stats' as DataSource, 
      label: 'Git Statistics', 
      icon: GitBranch,
      description: 'Commits • File changes • Push to remote',
      color: 'purple'
    },
    { 
      id: 'sqlite-browser' as DataSource, 
      label: 'SQLite Browser', 
      icon: Search,
      description: 'Generic SQLite viewer • Browse any .db file',
      color: 'orange'
    },
    { 
      id: 'control-app' as DataSource, 
      label: 'Control App', 
      icon: HardDrive,
      description: 'IndexedDB • Sessions, Messages, Queues',
      color: 'blue'
    },
    { 
      id: 'postgres' as DataSource, 
      label: 'PostgreSQL', 
      icon: Server,
      description: 'Documents • File changes • Tech stack • MCP',
      color: 'emerald'
    },
  ];

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Compact Left Sidebar for Data Sources */}
      <div className="w-48 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Data Sources</h2>
          </div>
          <p className="text-xs text-zinc-500">Browse storage systems</p>
        </div>

        {/* Source List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {sources.map((source) => {
              const Icon = source.icon;
              const isActive = activeSource === source.id;
              return (
                <button
                  key={source.id}
                  onClick={() => setActiveSource(source.id)}
                  className={`
                    w-full flex items-start gap-2 p-2 rounded text-left transition-all text-xs
                    ${isActive 
                      ? 'bg-blue-600/20 border border-blue-500/50 text-blue-200' 
                      : 'bg-zinc-800/30 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-600'
                    }
                  `}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium mb-0.5 truncate ${isActive ? 'text-blue-100' : 'text-zinc-300'}`}>
                      {source.label}
                    </div>
                    <div className={`text-[10px] leading-tight ${isActive ? 'text-blue-300/70' : 'text-zinc-500'}`}>
                      {source.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Live Activity Notifier - Below Data Sources */}
          {activeSource === 'taqwin-hierarchy' && (liveActivityContext.sessionId || liveActivityContext.projectId) && (
            <div className="mt-3">
              <LiveActivityNotifier
                sessionId={liveActivityContext.sessionId}
                sessionName={liveActivityContext.sessionName}
                projectId={liveActivityContext.projectId}
                pollingInterval={5000}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Maximized */}
      <div className="flex-1 overflow-hidden">
        {activeSource === 'taqwin-hierarchy' && (
          <TaqwinHierarchicalView 
            onNavigateToSqlite={(tableName, filter, issueType) => {
              setSqliteBrowserState({ tableName, filter, issueType });
              setActiveSource('sqlite-browser');
            }}
            onActivityContextChange={setLiveActivityContext}
          />
        )}
        {activeSource === 'git-stats' && <GitStatisticsView />}
        {activeSource === 'control-app' && <ControlAppDataView />}
        {activeSource === 'postgres' && <PostgresDataView />}
        {activeSource === 'sqlite-browser' && (
          <GenericSqliteView 
            initialState={sqliteBrowserState}
            onClearState={() => setSqliteBrowserState({})}
          />
        )}
      </div>
    </div>
  );
};
