import React, { useState, useEffect, useRef } from 'react';
import { Activity, CheckCircle, FileText, Calendar, AlertCircle, X, Bell, BellOff } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'checkpoint' | 'event' | 'document' | 'dev_event';
  action: 'added' | 'updated' | 'deleted';
  entityName: string;
  sessionId?: string;
  sessionName?: string;
  timestamp: Date;
}

interface LiveActivityNotifierProps {
  sessionId?: string;  // Currently selected session
  sessionName?: string;
  projectId?: string;
  pollingInterval?: number;  // Milliseconds, default 5000 (5 seconds)
}

/**
 * Live Activity Notifier
 * Shows real-time updates for the selected session/project
 * Polls database every N seconds to detect changes
 */
export const LiveActivityNotifier: React.FC<LiveActivityNotifierProps> = ({
  sessionId,
  sessionName,
  projectId,
  pollingInterval = 5000,
}) => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastCheckRef = useRef<Date>(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track counts
  const [counts, setCounts] = useState({
    checkpoints: 0,
    events: 0,
    documents: 0,
    devEvents: 0,
  });

  useEffect(() => {
    if (!isEnabled || (!sessionId && !projectId)) {
      return;
    }

    // Start polling
    const poll = () => {
      checkForUpdates();
    };

    // Initial check
    poll();

    // Set up polling interval
    timerRef.current = setInterval(poll, pollingInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionId, projectId, isEnabled, pollingInterval]);

  const checkForUpdates = async () => {
    if (!sessionId && !projectId) return;

    try {
      const now = new Date();

      // Simulate checking for new data
      // In production, this would query the database/MCP for changes since lastCheckRef.current
      // For now, we'll detect changes by comparing counts

      // TODO: Replace with actual database queries
      // const newCheckpoints = await queryCheckpointsSince(lastCheckRef.current);
      // const newEvents = await queryEventsSince(lastCheckRef.current);
      // const newDocuments = await queryDocumentsSince(lastCheckRef.current);

      // Mock detection (replace with real queries)
      const randomChange = Math.random();
      
      if (randomChange > 0.95) {  // 5% chance per poll
        const eventTypes: ActivityEvent['type'][] = ['checkpoint', 'event', 'document', 'dev_event'];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        const newActivity: ActivityEvent = {
          id: `activity-${Date.now()}`,
          type,
          action: 'added',
          entityName: type === 'checkpoint' ? 'CP-001' : type === 'document' ? 'Implementation Guide' : 'File changes',
          sessionId,
          sessionName,
          timestamp: now,
        };

        setActivities(prev => [newActivity, ...prev].slice(0, 10)); // Keep last 10
        
        // Update counts
        setCounts(prev => ({
          ...prev,
          checkpoints: type === 'checkpoint' ? prev.checkpoints + 1 : prev.checkpoints,
          events: type === 'event' ? prev.events + 1 : prev.events,
          documents: type === 'document' ? prev.documents + 1 : prev.documents,
          devEvents: type === 'dev_event' ? prev.devEvents + 1 : prev.devEvents,
        }));
      }

      lastCheckRef.current = now;
    } catch (err) {
      console.error('[LiveActivityNotifier] Error checking for updates:', err);
    }
  };

  const clearActivities = () => {
    setActivities([]);
    setCounts({ checkpoints: 0, events: 0, documents: 0, devEvents: 0 });
  };

  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'checkpoint':
        return <CheckCircle className="w-3 h-3 text-blue-400" />;
      case 'event':
        return <Calendar className="w-3 h-3 text-purple-400" />;
      case 'document':
        return <FileText className="w-3 h-3 text-pink-400" />;
      case 'dev_event':
        return <Activity className="w-3 h-3 text-cyan-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-zinc-400" />;
    }
  };

  const getTypeLabel = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'checkpoint':
        return 'Checkpoint';
      case 'event':
        return 'Event';
      case 'document':
        return 'Document';
      case 'dev_event':
        return 'Dev Event';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!sessionId && !projectId) {
    return null;  // Don't show if no context
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${isEnabled ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`} />
          <h4 className="text-xs font-semibold text-zinc-300">Live Activity</h4>
          {sessionName && (
            <span className="text-[10px] text-zinc-500 truncate max-w-[100px]" title={sessionName}>
              {sessionName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className="p-1 hover:bg-zinc-700 rounded transition-colors"
            title={isEnabled ? 'Pause updates' : 'Resume updates'}
          >
            {isEnabled ? (
              <Bell className="w-3 h-3 text-zinc-400" />
            ) : (
              <BellOff className="w-3 h-3 text-zinc-500" />
            )}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-zinc-700 rounded transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Activity Summary */}
          <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-700">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center justify-between px-2 py-1 bg-blue-900/20 rounded">
                <span className="text-zinc-400">Checkpoints:</span>
                <span className="font-semibold text-blue-400">{counts.checkpoints}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-purple-900/20 rounded">
                <span className="text-zinc-400">Events:</span>
                <span className="font-semibold text-purple-400">{counts.events}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-pink-900/20 rounded">
                <span className="text-zinc-400">Documents:</span>
                <span className="font-semibold text-pink-400">{counts.documents}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-cyan-900/20 rounded">
                <span className="text-zinc-400">Dev Events:</span>
                <span className="font-semibold text-cyan-400">{counts.devEvents}</span>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="max-h-48 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="px-3 py-4 text-center text-zinc-500">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <div className="text-[10px]">
                  {isEnabled ? 'No recent activity' : 'Updates paused'}
                </div>
                <div className="text-[9px] mt-1 text-zinc-600">
                  Monitoring for changes...
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-2 p-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded transition-colors animate-fade-in"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-zinc-300 truncate">
                            {activity.action === 'added' && '+'} {getTypeLabel(activity.type)}
                          </div>
                          <div className="text-[9px] text-zinc-500 truncate mt-0.5">
                            {activity.entityName}
                          </div>
                        </div>
                        <div className="text-[9px] text-zinc-600 whitespace-nowrap">
                          {formatTime(activity.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {activities.length > 0 && (
            <div className="px-3 py-2 bg-zinc-800/30 border-t border-zinc-700 flex items-center justify-between">
              <div className="text-[10px] text-zinc-500">
                {activities.length} recent {activities.length === 1 ? 'update' : 'updates'}
              </div>
              <button
                onClick={clearActivities}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
