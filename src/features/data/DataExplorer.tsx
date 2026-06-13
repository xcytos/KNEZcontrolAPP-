import React, { useState } from 'react';
import { HardDrive, Server, Search, GitBranch } from 'lucide-react';
import { ControlAppDataView } from './ControlAppDataView';
import { PostgresDataView } from './PostgresDataView';
import { GenericSqliteView } from './GenericSqliteView';
import { TaqwinHierarchicalView } from './TaqwinHierarchicalView';
import { GitStatisticsView } from './GitStatisticsView';

type DataSource = 'control-app' | 'postgres' | 'sqlite-browser' | 'taqwin-hierarchy' | 'git-stats';

export const DataExplorer: React.FC = () => {
  const [activeSource, setActiveSource] = useState<DataSource>('taqwin-hierarchy');

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
      description: 'Supabase • Document Manager via MCP',
      color: 'emerald'
    },
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors = {
      blue: isActive 
        ? 'bg-blue-900/40 border-blue-600 text-blue-200' 
        : 'bg-blue-900/20 border-blue-800/50 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700',
      emerald: isActive 
        ? 'bg-emerald-900/40 border-emerald-600 text-emerald-200' 
        : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-700',
      purple: isActive 
        ? 'bg-purple-900/40 border-purple-600 text-purple-200' 
        : 'bg-purple-900/20 border-purple-800/50 text-purple-400 hover:bg-purple-900/30 hover:border-purple-700',
      orange: isActive 
        ? 'bg-orange-900/40 border-orange-600 text-orange-200' 
        : 'bg-orange-900/20 border-orange-800/50 text-orange-400 hover:bg-orange-900/30 hover:border-orange-700',
      indigo: isActive 
        ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200' 
        : 'bg-indigo-900/20 border-indigo-800/50 text-indigo-400 hover:bg-indigo-900/30 hover:border-indigo-700',
    };
    return colors[color as keyof typeof colors];
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <HardDrive className="w-6 h-6" />
              Data Explorer
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Browse and inspect data across all storage systems
            </p>
          </div>
        </div>
      </div>

      {/* Source Selector */}
      <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sources.map((source) => {
            const Icon = source.icon;
            const isActive = activeSource === source.id;
            return (
              <button
                key={source.id}
                onClick={() => setActiveSource(source.id)}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 transition-all duration-200
                  ${getColorClasses(source.color, isActive)}
                  ${isActive ? 'ring-2 ring-offset-2 ring-offset-zinc-950' : ''}
                `}
              >
                <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-base mb-0.5">
                    {source.label}
                  </div>
                  <div className={`text-xs leading-relaxed ${isActive ? 'opacity-90' : 'opacity-75'}`}>
                    {source.description}
                  </div>
                </div>
                {isActive && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSource === 'taqwin-hierarchy' && <TaqwinHierarchicalView />}
        {activeSource === 'git-stats' && <GitStatisticsView />}
        {activeSource === 'control-app' && <ControlAppDataView />}
        {activeSource === 'postgres' && <PostgresDataView />}
        {activeSource === 'sqlite-browser' && <GenericSqliteView />}
      </div>
    </div>
  );
};
