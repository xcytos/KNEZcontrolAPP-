import React, { useState } from 'react';
import {
  CheckCircle,
  Target,
  Brain,
  FileText,
  Activity,
  Calendar,
  Folder,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { SessionData, SessionStats } from '../types/SessionFullViewTypes';

interface SessionMetadataSidebarProps {
  session: SessionData | null;
  stats: SessionStats;
  loading?: boolean;
  allProjectSessions?: any[];
  onSwitchSession?: (sessionId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SessionMetadataSidebar: React.FC<SessionMetadataSidebarProps> = ({
  session,
  stats,
  loading,
  allProjectSessions = [],
  onSwitchSession,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);

  if (loading || !session) {
    return (
      <div className={`${collapsed ? 'w-12' : 'w-80'} border-r border-zinc-800 bg-zinc-900 flex flex-col transition-all duration-200`}>
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="p-3 hover:bg-zinc-800 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        ) : (
          <div className="p-4 space-y-4 animate-pulse">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-8 bg-zinc-800 rounded" />
            <div className="h-4 bg-zinc-800 rounded w-1/2" />
          </div>
        )}
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="w-12 border-r border-zinc-800 bg-zinc-900 flex flex-col transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-zinc-400" />
        </button>
        
        {/* Vertical metrics */}
        <div className="flex-1 flex flex-col items-center py-4 space-y-4">
          <div className="flex flex-col items-center gap-1" title="Checkpoints">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-400 font-semibold">{stats.checkpoints}</span>
          </div>
          <div className="flex flex-col items-center gap-1" title="Memories">
            <Brain className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-semibold">{stats.memories}</span>
          </div>
          <div className="flex flex-col items-center gap-1" title="Decisions">
            <Target className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-400 font-semibold">{stats.decisions}</span>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/30 text-green-400 border-green-800';
      case 'paused':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
      case 'completed':
        return 'bg-blue-900/30 text-blue-400 border-blue-800';
      case 'archived':
        return 'bg-zinc-800/30 text-zinc-400 border-zinc-700';
      default:
        return 'bg-zinc-800/30 text-zinc-400 border-zinc-700';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-80 border-r border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden transition-all duration-200">
      {/* Header with Collapse Button */}
      <div className="p-2 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-900/50">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Session View
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Session Switcher Dropdown */}
      {allProjectSessions.length > 0 && (
        <div className="p-2 border-b border-zinc-800 flex-shrink-0 relative">
          <button
            onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
            className="w-full flex items-center justify-between p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded transition-colors group"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Activity className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-300 truncate font-medium">
                  {session.name}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {session.display_id}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${sessionDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {sessionDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSessionDropdownOpen(false)}
              />
              <div className="absolute left-2 right-2 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {allProjectSessions.map((s) => {
                  const isActive = s.session_id === session.session_id || s.id === session.session_id;
                  return (
                    <button
                      key={s.session_id || s.id}
                      onClick={() => {
                        if (onSwitchSession && !isActive) {
                          onSwitchSession(s.session_id || s.id);
                        }
                        setSessionDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors flex items-center gap-2 ${
                        isActive ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <Activity className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs truncate ${isActive ? 'text-blue-300 font-medium' : 'text-zinc-300'}`}>
                          {s.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {s.display_id || s.session_id || s.id}
                        </div>
                      </div>
                      {isActive && (
                        <CheckCircle className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Compact Session Info */}
      <div className="p-2 border-b border-zinc-800 flex-shrink-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getStatusColor(session.status)}`}>
            {session.status.toUpperCase()}
          </span>
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(session.created_at)}
          </div>
        </div>
        {session.project_name && (
          <div className="flex items-center gap-1 text-[10px] text-purple-400">
            <Folder className="w-3 h-3" />
            <span className="truncate">{session.project_name}</span>
          </div>
        )}
      </div>

      {/* Compact Metrics Grid */}
      <div className="p-2 border-b border-zinc-800 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1">
          <CompactMetric icon={CheckCircle} value={stats.checkpoints} color="text-blue-400" label="CP" />
          <CompactMetric icon={Brain} value={stats.memories} color="text-green-400" label="Mem" />
          <CompactMetric icon={Target} value={stats.decisions} color="text-orange-400" label="Dec" />
          <CompactMetric icon={Activity} value={stats.events} color="text-purple-400" label="Evt" />
          <CompactMetric icon={FileText} value={stats.files} color="text-cyan-400" label="Files" />
          <CompactMetric icon={FileText} value={stats.documents} color="text-pink-400" label="Docs" />
        </div>
      </div>

      {/* Scrollable Info Area */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {allProjectSessions.length > 1 && (
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{allProjectSessions.length} sessions in project</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact Metric Component
interface CompactMetricProps {
  icon: React.ElementType;
  value: number;
  color: string;
  label: string;
}

const CompactMetric: React.FC<CompactMetricProps> = ({ icon: Icon, value, color, label }) => {
  return (
    <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors">
      <Icon className={`w-3 h-3 ${color} mb-0.5`} />
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
      <span className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</span>
    </div>
  );
};
