import React, { useState, useEffect } from 'react';
import {
  Database,
  Activity,
  Clock,
  Zap,
  HardDrive,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { taqwinDataService } from '../../services/data/TaqwinDataService';

interface DashboardStatusBarProps {
  activityContext: {
    sessionId?: string;
    sessionName?: string;
    projectId?: string;
  };
  connectionStatus: {
    online: boolean;
    isConnected: boolean;
    isModelReady: boolean;
    isDegraded: boolean;
  };
}

export const DashboardStatusBar: React.FC<DashboardStatusBarProps> = ({
  activityContext,
  connectionStatus,
}) => {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSessions: 0,
    activeCount: 0,
    lastSync: new Date(),
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadStats();
    // Only load stats once on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
    try {
      taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
      const sessions = await taqwinDataService.listSessions(1000);
      const projects = await taqwinDataService.getProjectHierarchy();
      
      const activeCount = sessions.filter((s: any) => s.status === 'active').length;
      
      setStats({
        totalProjects: projects.length,
        totalSessions: sessions.length,
        activeCount,
        lastSync: new Date(),
      });
    } catch (err) {
      console.error('[DashboardStatusBar] Error loading stats:', err);
      // Set default stats on error to prevent infinite loops
      setStats({
        totalProjects: 0,
        totalSessions: 0,
        activeCount: 0,
        lastSync: new Date(),
      });
    }
  };

  const getConnectionIcon = () => {
    if (!connectionStatus.online) {
      return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
    }
    if (connectionStatus.isDegraded) {
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    }
    return <Wifi className="w-3.5 h-3.5 text-green-400" />;
  };

  const getConnectionText = () => {
    if (!connectionStatus.online) return 'Offline';
    if (connectionStatus.isDegraded) return 'Degraded';
    return 'Online';
  };

  return (
    <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-4 text-xs text-zinc-400">
      {/* Left Section: Context */}
      <div className="flex items-center gap-4">
        {activityContext.projectId && (
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span className="font-mono">{activityContext.projectId}</span>
          </div>
        )}
        
        {activityContext.sessionId && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-mono">{activityContext.sessionId.slice(0, 8)}</span>
          </div>
        )}
        
        {!activityContext.projectId && !activityContext.sessionId && (
          <div className="text-zinc-600">No context selected</div>
        )}
      </div>

      {/* Center Section: Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5" />
          <span>{stats.totalProjects} projects</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" />
          <span>{stats.totalSessions} sessions</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-green-400" />
          <span>{stats.activeCount} active</span>
        </div>
      </div>

      {/* Right Section: Connection & Time */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {getConnectionIcon()}
          <span>{getConnectionText()}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
