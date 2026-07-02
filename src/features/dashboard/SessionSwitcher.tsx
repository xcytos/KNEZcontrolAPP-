import React, { useState, useEffect, useRef } from 'react';
import { Activity, ChevronDown, Loader } from 'lucide-react';
import { taqwinDataService, SessionListItem } from '../../services/data/TaqwinDataService';
import { SessionList } from './SessionList';

interface SessionSwitcherProps {
  currentSessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export const SessionSwitcher: React.FC<SessionSwitcherProps> = ({
  currentSessionId,
  onSessionChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [monitoredSessions, setMonitoredSessions] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('active');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => (s.session_id || s.id) === currentSessionId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
      const allSessions = await taqwinDataService.listSessions(1000);
      setSessions(allSessions);
    } catch (err) {
      console.error('[SessionSwitcher] Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen && sessions.length === 0) {
      loadSessions();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    onSessionChange?.(sessionId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-all text-left"
        title="Switch session"
      >
        <Activity className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="flex-1 min-w-0 text-xs font-medium text-zinc-200 truncate">
          {currentSession?.name || 'Select Session'}
        </span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden" style={{ width: '280px', maxHeight: '400px' }}>
            <div className="p-3 border-b border-zinc-800">
              <div className="text-xs font-semibold text-zinc-400">Switch Session</div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
              {loading ? (
                <div className="flex items-center justify-center py-6 text-zinc-400">
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <SessionList
                  currentSessionId={currentSessionId}
                  sessions={sessions}
                  loading={false}
                  filterStatus={filterStatus}
                  monitoredSessions={monitoredSessions}
                  onFilterChange={setFilterStatus}
                  onToggleMonitor={(id) => {
                    setMonitoredSessions(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onSessionClick={handleSessionClick}
                  compact={true}
                  showStats={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
