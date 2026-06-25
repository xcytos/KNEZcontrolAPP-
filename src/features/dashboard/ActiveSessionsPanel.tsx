import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, Pause, GitBranch, Loader, RefreshCw, Bell, BellOff, FileText, Bookmark, Database, Eye, EyeOff } from 'lucide-react';
import { taqwinDataService, SessionListItem } from '../../services/data/TaqwinDataService';

interface ActiveSessionsPanelProps {
  currentSessionId?: string;
  currentProjectId?: string; // eslint-disable-line @typescript-eslint/no-unused-vars
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
}) => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('active');
  
  // Monitoring state
  const [monitoredSessions, setMonitoredSessions] = useState<Set<string>>(new Set());
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    loadSessions();
    // Auto-monitor active sessions initially
    const interval = setInterval(() => {
      loadSessions();
      if (monitoredSessions.size > 0) {
        loadActivityFeed();
      }
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, [monitoredSessions]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
      
      const allSessions = await taqwinDataService.listSessions(1000);
      console.log('[ActiveSessionsPanel] Loaded sessions:', allSessions.length);
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
    } finally {
      setLoading(false);
    }
  };

  const loadActivityFeed = async () => {
    if (monitoredSessions.size === 0) return;
    
    try {
      setLoadingActivity(true);
      const allEvents: ActivityEvent[] = [];
      
      for (const sessionId of Array.from(monitoredSessions)) {
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
              const eventData = typeof evt.event_data === 'string' 
                ? JSON.parse(evt.event_data) 
                : evt.event_data;
              
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
    
    // Reload activity feed after toggle
    setTimeout(() => loadActivityFeed(), 100);
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
    <div className="flex h-full bg-zinc-950 gap-2 p-4">
      {/* Left Side: Sessions List (40%) */}
      <div className="w-2/5 flex flex-col border-r border-zinc-800 pr-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              Sessions
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Click eye icon to monitor
            </p>
          </div>
          <button
            onClick={loadSessions}
            disabled={loading}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-xs text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1.5">
          {(['all', 'active', 'paused'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
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
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-zinc-400">
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

      {/* Sessions Grid */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
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
                  className={`p-2.5 rounded border transition-all ${getStatusColor(status)} ${
                    isCurrent ? 'ring-1 ring-blue-500' : ''
                  } ${isMonitored ? 'ring-1 ring-green-500' : ''}`}
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
                    <div className="flex items-center gap-1">
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 text-[9px] rounded-full">
                          Current
                        </span>
                      )}
                      <button
                        onClick={() => toggleMonitor(sessionId)}
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
                    // Parse tags if it's a JSON string
                    let tagsArray: string[] = [];
                    if (typeof tags === 'string') {
                      try {
                        tagsArray = JSON.parse(tags);
                      } catch {
                        tagsArray = [];
                      }
                    } else if (Array.isArray(tags)) {
                      tagsArray = tags;
                    }
                    
                    if (tagsArray.length === 0) return null;
                    
                    return (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {tagsArray.slice(0, 2).map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-1 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {tagsArray.length > 2 && (
                          <span className="px-1 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] rounded">
                            +{tagsArray.length - 2}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Timestamps */}
                  <div className="flex items-center justify-between text-[9px] text-zinc-600">
                    <span>{getTimeAgo((session as any).updated_at || (session as any).created_at || '')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Summary Footer */}
      {!loading && !error && sessions.length > 0 && (
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

    {/* Right Side: Activity Feed (60%) */}
    <div className="flex-1 flex flex-col pl-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              Activity Feed
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time events from monitored sessions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {monitoredSessions.size > 0 && (
              <span className="px-2 py-1 bg-purple-900/30 text-purple-300 text-[10px] rounded-full">
                {monitoredSessions.size} monitored
              </span>
            )}
            <button
              onClick={loadActivityFeed}
              disabled={loadingActivity || monitoredSessions.size === 0}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-xs text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingActivity ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Activity Feed Content */}
      {monitoredSessions.size === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No sessions monitored</p>
            <p className="text-xs mt-1">Click the eye icon on sessions to start monitoring</p>
          </div>
        </div>
      ) : loadingActivity ? (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <Loader className="w-5 h-5 animate-spin mr-2" />
          Loading activity...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {activityFeed.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No activity in monitored sessions
            </div>
          ) : (
            activityFeed.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded border ${getActivityColor(event.type)} hover:bg-zinc-900/30 transition-all cursor-pointer`}
              >
                {/* Event Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {getActivityIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-zinc-100 truncate">
                        {event.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {event.sessionName}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] rounded-full ${
                    event.type === 'checkpoint' ? 'bg-blue-900/40 text-blue-300' :
                    event.type === 'event' ? 'bg-purple-900/40 text-purple-300' :
                    'bg-cyan-900/40 text-cyan-300'
                  }`}>
                    {event.type}
                  </span>
                </div>

                {/* Event Description */}
                {event.description && (
                  <p className="text-xs text-zinc-400 mb-2">
                    {event.description}
                  </p>
                )}

                {/* Event Metadata */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    {event.type === 'checkpoint' && event.metadata && (
                      <>
                        {event.metadata.learned_memories > 0 && (
                          <span className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {event.metadata.learned_memories} memories
                          </span>
                        )}
                        {event.metadata.decisions > 0 && (
                          <span>{event.metadata.decisions} decisions</span>
                        )}
                      </>
                    )}
                    {event.type === 'event' && event.metadata?.files && (
                      <span>{event.metadata.files.length} files</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {getTimeAgo(event.timestamp)}
                  </span>
                </div>

                {/* Files List for Events */}
                {event.type === 'event' && event.metadata?.files && event.metadata.files.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-800">
                    <div className="text-[10px] text-zinc-500 space-y-0.5">
                      {event.metadata.files.slice(0, 3).map((file: string, idx: number) => (
                        <div key={idx} className="font-mono truncate">{file}</div>
                      ))}
                      {event.metadata.files.length > 3 && (
                        <div className="text-zinc-600">+{event.metadata.files.length - 3} more</div>
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
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 bg-blue-900/20 rounded">
              <div className="text-[9px] text-blue-400">Checkpoints</div>
              <div className="text-sm font-bold text-blue-300">
                {activityFeed.filter(e => e.type === 'checkpoint').length}
              </div>
            </div>
            <div className="p-1.5 bg-purple-900/20 rounded">
              <div className="text-[9px] text-purple-400">Events</div>
              <div className="text-sm font-bold text-purple-300">
                {activityFeed.filter(e => e.type === 'event').length}
              </div>
            </div>
            <div className="p-1.5 bg-cyan-900/20 rounded">
              <div className="text-[9px] text-cyan-400">Documents</div>
              <div className="text-sm font-bold text-cyan-300">
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
