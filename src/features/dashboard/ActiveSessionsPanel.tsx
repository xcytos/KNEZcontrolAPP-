import React, { useState, useEffect, useRef } from 'react';
import { Activity, Clock, CheckCircle, Pause, GitBranch, Loader, RefreshCw, Bell, BellOff, FileText, Bookmark, Database, Eye, EyeOff } from 'lucide-react';
import { taqwinDataService, SessionListItem } from '../../services/data/TaqwinDataService';

interface ActiveSessionsPanelProps {
  currentSessionId?: string;
  currentProjectId?: string;
  onSessionClick?: (sessionId: string, projectId?: string) => void;
}

interface ActivityEvent {
  id: string;
  sessionId: string;
  sessionName: string;
  type: 'checkpoint' | 'event' | 'document';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const ActiveSessionsPanel: React.FC<ActiveSessionsPanelProps> = ({
  currentSessionId,
  onSessionClick,
}) => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('active');
  
  // Monitoring state
  const [monitoredSessions, setMonitoredSessions] = useState<Set<string>>(new Set());
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const monitoredRef = useRef(monitoredSessions);
  monitoredRef.current = monitoredSessions;
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [activityScope, setActivityScope] = useState<'all' | 'selected'>('all');

  useEffect(() => {
    loadSessions();
    const interval = setInterval(() => {
      loadSessions();
      if (monitoredRef.current.size > 0 || (activityScope === 'selected' && currentSessionId)) {
        loadActivityFeed();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      setError(null);
      taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
      
      const allSessions = await taqwinDataService.listSessions(1000);
      setSessions(allSessions);
      
      // Auto-monitor active sessions if none are monitored yet
      if (monitoredSessions.size === 0) {
        const activeSessions = allSessions
          .filter(s => (s as any).status === 'active')
          .slice(0, 3)
          .map(s => s.session_id || s.id);
        setMonitoredSessions(new Set(activeSessions));
      }
    } catch (err) {
      console.error('[ActiveSessionsPanel] Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  };

  const loadActivityFeed = async () => {
    const sessionIds = activityScope === 'selected' && currentSessionId
      ? [currentSessionId]
      : Array.from(monitoredSessions);
    if (sessionIds.length === 0) return;
    
    try {
      setLoadingActivity(true);
      const allEvents: ActivityEvent[] = [];
      
      for (const sessionId of sessionIds) {
        const session = sessions.find(s => (s.session_id || s.id) === sessionId);
        if (!session) continue;
        
        try {
          const hierarchy = await taqwinDataService.getSessionHierarchy(sessionId);
          
          // Add checkpoint events
          if (hierarchy.checkpoints) {
            hierarchy.checkpoints.forEach((cp: any) => {
              allEvents.push({
                id: `cp-${cp.checkpoint_id}`,
                sessionId,
                sessionName: session.name || session.display_id,
                type: 'checkpoint',
                title: cp.title || 'Checkpoint',
                description: cp.summary || cp.context?.summary,
                timestamp: cp.created_at,
                metadata: {
                  checkpoint_id: cp.checkpoint_id,
                  learned_memories: cp.learned_memories?.length || 0,
                  decisions: cp.decisions?.length || 0,
                },
              });
            });
          }
          
          // Add dev events
          if (hierarchy.events) {
            hierarchy.events.forEach((evt: any) => {
              const rawData = typeof evt.event_data === 'string'
                ? (() => { try { return JSON.parse(evt.event_data); } catch { return null; } })()
                : evt.event_data;
              const eventData = rawData || {};
              
              allEvents.push({
                id: `evt-${evt.event_id}`,
                sessionId,
                sessionName: session.name || session.display_id,
                type: 'event',
                title: eventData.trigger || 'Dev Event',
                description: `${eventData.files?.length || 0} files modified`,
                timestamp: evt.created_at,
                metadata: {
                  event_id: evt.event_id,
                  files: eventData.files?.map((f: any) => f.file) || [],
                },
              });
            });
          }
          
          // Add document events
          if (hierarchy.documents) {
            hierarchy.documents.forEach((doc: any) => {
              allEvents.push({
                id: `doc-${doc.document_id}`,
                sessionId,
                sessionName: session.name || session.display_id,
                type: 'document',
                title: doc.title,
                description: doc.doc_type,
                timestamp: doc.created_at,
                metadata: {
                  document_id: doc.document_id,
                  doc_type: doc.doc_type,
                },
              });
            });
          }
        } catch (err) {
          console.error(`[ActiveSessionsPanel] Error loading activity for ${sessionId}:`, err);
        }
      }
      
      // Sort by timestamp descending (newest first)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivityFeed(allEvents.slice(0, 50)); // Keep last 50 events
    } catch (err) {
      console.error('[ActiveSessionsPanel] Error loading activity feed:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const toggleMonitor = (sessionId: string) => {
    setMonitoredSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const filteredSessions = sessions.filter(session => {
    const status = (session as any).status || 'active';
    if (filterStatus === 'all') return true;
    return status === filterStatus;
  }).filter(Boolean); // Remove any null/undefined entries

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

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'checkpoint':
        return <Bookmark className="w-4 h-4 text-blue-400" />;
      case 'event':
        return <Activity className="w-4 h-4 text-purple-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getActivityColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'checkpoint':
        return 'border-blue-700 bg-blue-900/10';
      case 'event':
        return 'border-purple-700 bg-purple-900/10';
      case 'document':
        return 'border-cyan-700 bg-cyan-900/10';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 gap-1 p-2">
      {/* Top: Sessions List */}
      <div className="flex flex-col border-b border-zinc-800 pb-2 max-h-[50%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-green-400" />
            Sessions
          </h3>
          <button
            onClick={loadSessions}
            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-zinc-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1 mb-2">
          {(['all', 'active', 'paused'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1 px-1 py-0.5 rounded bg-zinc-900/50 text-[8px]">
                {status === 'all'
                  ? sessions.length
                  : sessions.filter(s => (s as any).status === status).length}
              </span>
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-2 bg-red-900/20 border border-red-800 rounded text-red-300 text-[10px]">
            {error}
          </div>
        )}

        {/* Sessions Grid */}
        {!error && (
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-[10px]">
                No {filterStatus !== 'all' && filterStatus} sessions
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
                    onClick={() => {
                      console.log('[ActiveSessionsPanel] Session clicked:', sessionId, session.project_id);
                      setClickedId(sessionId);
                      onSessionClick?.(sessionId, session.project_id);
                    }}
                    className={`p-1.5 rounded border transition-all cursor-pointer ${getStatusColor(status)} ${
                      isCurrent || clickedId === sessionId ? 'ring-2 ring-blue-500 bg-blue-950/20' : ''
                    } ${isMonitored ? 'ring-1 ring-green-500' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {getStatusIcon(status)}
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-zinc-100 truncate leading-tight">
                            {session.name || 'Unnamed Session'}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono leading-tight">
                            {session.display_id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isCurrent && (
                          <span className="px-1 py-0.5 bg-amber-900/40 text-amber-300 text-[8px] rounded-full">
                            Selected
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleMonitor(sessionId); }}
                          className={`p-0.5 rounded transition-all ${
                            isMonitored
                              ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                          }`}
                          title={isMonitored ? 'Stop monitoring' : 'Start monitoring'}
                        >
                          {isMonitored ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      {session.project_id && (
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500 truncate">
                          <GitBranch className="w-2 h-2 flex-shrink-0" />
                          <span className="truncate">{session.project_id}</span>
                        </div>
                      )}
                      <span className="text-[8px] text-zinc-600 ml-auto">
                        {getTimeAgo((session as any).updated_at || (session as any).created_at || '')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Summary */}
        {!error && sessions.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-zinc-800">
            <div className="flex gap-1 text-center text-[9px]">
              <div className="flex-1 p-1 bg-zinc-900/50 rounded">
                <div className="text-zinc-500">Total</div>
                <div className="font-semibold text-zinc-100">{sessions.length}</div>
              </div>
              <div className="flex-1 p-1 bg-green-900/20 rounded">
                <div className="text-green-400">Active</div>
                <div className="font-semibold text-green-300">
                  {sessions.filter(s => (s as any).status === 'active').length}
                </div>
              </div>
              <div className="flex-1 p-1 bg-purple-900/20 rounded">
                <div className="text-purple-400">Monitored</div>
                <div className="font-semibold text-purple-300">{monitoredSessions.size}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Activity Feed */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Bell className="w-3 h-3 text-purple-400" />
            Activity
          </h3>
          <div className="flex items-center gap-1.5">
            {currentSessionId && (
              <div className="flex gap-0.5 bg-zinc-800 rounded p-0.5">
                <button
                  onClick={() => { setActivityScope('all'); loadActivityFeed(); }}
                  className={`px-1.5 py-0.5 text-[9px] rounded transition-all ${
                    activityScope === 'all' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => { setActivityScope('selected'); loadActivityFeed(); }}
                  className={`px-1.5 py-0.5 text-[9px] rounded transition-all ${
                    activityScope === 'selected' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Selected
                </button>
              </div>
            )}
            {monitoredSessions.size > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-300 text-[8px] rounded-full">
                {monitoredSessions.size} monitored
              </span>
            )}
            <button
              onClick={loadActivityFeed}
              disabled={loadingActivity || (activityScope === 'selected' ? !currentSessionId : monitoredSessions.size === 0)}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-[10px] text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingActivity ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Activity Feed Content */}
        {monitoredSessions.size === 0 && !(activityScope === 'selected' && currentSessionId) ? (
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="text-center text-zinc-500">
              <BellOff className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
              <p className="text-[10px]">{currentSessionId ? 'No activity for this session' : 'No sessions monitored'}</p>
              <p className="text-[9px] mt-0.5 text-zinc-600">Click eye icon to monitor</p>
            </div>
          </div>
        ) : loadingActivity ? (
          <div className="flex items-center justify-center py-4 text-zinc-400 text-[10px]">
            <Loader className="w-3 h-3 animate-spin mr-1.5" />
            Loading...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {activityFeed.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-[10px]">
                No activity
              </div>
            ) : (
              activityFeed.map((event) => (
                <div
                  key={event.id}
                  className={`p-1.5 rounded border ${getActivityColor(event.type)} hover:bg-zinc-900/30 transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      {getActivityIcon(event.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-zinc-100 truncate leading-tight">
                          {event.title}
                        </div>
                        <div className="text-[9px] text-zinc-500 truncate leading-tight">
                          {event.sessionName}
                        </div>
                      </div>
                    </div>
                    <span className={`px-1 py-0.5 text-[8px] rounded-full flex-shrink-0 ${
                      event.type === 'checkpoint' ? 'bg-blue-900/40 text-blue-300' :
                      event.type === 'event' ? 'bg-purple-900/40 text-purple-300' :
                      'bg-cyan-900/40 text-cyan-300'
                    }`}>
                      {event.type}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-[10px] text-zinc-400 mt-1 truncate">{event.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                      {event.type === 'checkpoint' && event.metadata && (
                        <>
                          {event.metadata.learned_memories > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Database className="w-2 h-2" />
                              {event.metadata.learned_memories}
                            </span>
                          )}
                          {event.metadata.decisions > 0 && (
                            <span>{event.metadata.decisions} dec</span>
                          )}
                        </>
                      )}
                      {event.type === 'event' && event.metadata?.files && (
                        <span>{event.metadata.files.length} files</span>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-600">{getTimeAgo(event.timestamp)}</span>
                  </div>

                  {event.type === 'event' && event.metadata?.files && event.metadata.files.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-zinc-800">
                      <div className="text-[9px] text-zinc-500 space-y-0.5">
                        {event.metadata.files.slice(0, 2).map((file: string, idx: number) => (
                          <div key={idx} className="font-mono truncate">{file}</div>
                        ))}
                        {event.metadata.files.length > 2 && (
                          <div className="text-zinc-600">+{event.metadata.files.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Activity Stats Footer */}
        {monitoredSessions.size > 0 && activityFeed.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-zinc-800">
            <div className="flex gap-1 text-center text-[9px]">
              <div className="flex-1 p-1 bg-blue-900/20 rounded">
                <div className="text-blue-400">Check</div>
                <div className="font-semibold text-blue-300">
                  {activityFeed.filter(e => e.type === 'checkpoint').length}
                </div>
              </div>
              <div className="flex-1 p-1 bg-purple-900/20 rounded">
                <div className="text-purple-400">Events</div>
                <div className="font-semibold text-purple-300">
                  {activityFeed.filter(e => e.type === 'event').length}
                </div>
              </div>
              <div className="flex-1 p-1 bg-cyan-900/20 rounded">
                <div className="text-cyan-400">Docs</div>
                <div className="font-semibold text-cyan-300">
                  {activityFeed.filter(e => e.type === 'document').length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
