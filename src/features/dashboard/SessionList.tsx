import React from 'react';
import { Activity, Clock, CheckCircle, Pause, Loader, GitBranch, Eye, EyeOff } from 'lucide-react';
import { SessionListItem } from '../../services/data/TaqwinDataService';

interface SessionListProps {
  currentSessionId?: string;
  sessions: SessionListItem[];
  loading?: boolean;
  error?: string | null;
  filterStatus?: 'all' | 'active' | 'paused';
  monitoredSessions: Set<string>;
  onFilterChange: (status: 'all' | 'active' | 'paused') => void;
  onToggleMonitor: (sessionId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  compact?: boolean;
  showStats?: boolean;
}

export const SessionList: React.FC<SessionListProps> = ({
  currentSessionId,
  sessions,
  loading = false,
  error = null,
  filterStatus = 'active',
  monitoredSessions,
  onFilterChange,
  onToggleMonitor,
  onSessionClick,
  compact = false,
  showStats = true,
}) => {
  const filteredSessions = sessions.filter(session => {
    const status = (session as any).status || 'active';
    if (filterStatus === 'all') return true;
    return status === filterStatus;
  }).filter(Boolean);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4 text-green-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-green-700 bg-green-900/10';
      case 'paused':
        return 'border-yellow-700 bg-yellow-900/10';
      case 'completed':
        return 'border-blue-700 bg-blue-900/10';
      default:
        return 'border-zinc-700 bg-zinc-900/10';
    }
  };

  const getTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Buttons */}
      {!compact && (
        <div className="flex gap-1.5 mb-3">
          {(['all', 'active', 'paused'] as const).map((status) => (
            <button
              key={status}
              onClick={() => onFilterChange(status)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1 px-1 py-0.5 rounded bg-zinc-900/50 text-[9px]">
                {status === 'all'
                  ? sessions.length
                  : sessions.filter(s => (s as any).status === status).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-zinc-400">
          <Loader className="w-5 h-5 animate-spin mr-2" />
          Loading sessions...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Sessions List */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No {filterStatus !== 'all' && filterStatus} sessions found
            </div>
          ) : (
            filteredSessions.map((session) => {
              const sessionId = session.session_id || session.id;
              const status = (session as any).status || 'active';
              const isCurrent = sessionId === currentSessionId;
              const isMonitored = monitoredSessions.has(sessionId);

              return (
                <div
                  key={sessionId}
                  onClick={() => onSessionClick?.(sessionId)}
                  className={`p-2.5 rounded border transition-all cursor-pointer ${getStatusColor(status)} ${
                    isCurrent ? 'ring-1 ring-blue-500' : ''
                  } ${isMonitored ? 'ring-1 ring-green-500' : ''} ${onSessionClick ? 'hover:bg-zinc-800/50' : ''}`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      {getStatusIcon(status)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-zinc-100 truncate">
                          {session.name || 'Unnamed Session'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {session.display_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 text-[9px] rounded-full">
                          Current
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleMonitor(sessionId); }}
                        className={`p-1 rounded transition-all ${
                          isMonitored
                            ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                            : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                        }`}
                        title={isMonitored ? 'Stop monitoring' : 'Start monitoring'}
                      >
                        {isMonitored ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Project Info */}
                  {session.project_id && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1.5">
                      <GitBranch className="w-2.5 h-2.5" />
                      <span className="truncate">{session.project_id}</span>
                    </div>
                  )}

                  {/* Tags */}
                  {(() => {
                    const tags = (session as any).tags;
                    let tagsArray: string[] = [];
                    if (typeof tags === 'string') {
                      try { tagsArray = JSON.parse(tags); } catch { tagsArray = []; }
                    } else if (Array.isArray(tags)) {
                      tagsArray = tags;
                    }
                    if (tagsArray.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {tagsArray.slice(0, compact ? 1 : 2).map((tag: string, idx: number) => (
                          <span key={idx} className="px-1 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] rounded">
                            {tag}
                          </span>
                        ))}
                        {tagsArray.length > (compact ? 1 : 2) && (
                          <span className="px-1 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] rounded">
                            +{tagsArray.length - (compact ? 1 : 2)}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Timestamps */}
                  <div className="flex items-center justify-between text-[9px] text-zinc-600">
                    <span>{getTimeAgo((session as any).updated_at || (session as any).created_at || '')}</span>
                    {session.checkpoint_count !== undefined && (
                      <span>{session.checkpoint_count} cp</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Stats Footer */}
      {showStats && !loading && !error && sessions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 bg-zinc-900/50 rounded">
              <div className="text-[9px] text-zinc-500">Total</div>
              <div className="text-sm font-bold text-zinc-100">{sessions.length}</div>
            </div>
            <div className="p-1.5 bg-green-900/20 rounded">
              <div className="text-[9px] text-green-400">Active</div>
              <div className="text-sm font-bold text-green-300">
                {sessions.filter(s => (s as any).status === 'active').length}
              </div>
            </div>
            <div className="p-1.5 bg-purple-900/20 rounded">
              <div className="text-[9px] text-purple-400">Monitored</div>
              <div className="text-sm font-bold text-purple-300">
                {monitoredSessions.size}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
