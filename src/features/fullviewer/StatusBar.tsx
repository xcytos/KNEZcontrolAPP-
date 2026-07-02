import React, { useState, useEffect } from 'react';
import { Database, Activity, Clock, Zap, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { SessionContext } from './types';

interface StatusBarProps {
  sessionContext: SessionContext;
  connectionStatus: {
    online: boolean;
    isConnected: boolean;
    isModelReady: boolean;
    isDegraded: boolean;
  };
  stats?: {
    totalProjects: number;
    totalSessions: number;
    activeCount: number;
  };
}

export const StatusBar: React.FC<StatusBarProps> = ({ sessionContext, connectionStatus, stats }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { online, isConnected, isDegraded } = connectionStatus;

  return (
    <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 text-xs text-zinc-500">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {sessionContext.projectId || 'No project'}
        </span>
        {sessionContext.sessionName && (
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {sessionContext.sessionName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {stats && (
          <>
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {stats.totalProjects} projects
            </span>
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {stats.totalSessions} sessions
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {stats.activeCount} active
            </span>
          </>
        )}
        <span className="flex items-center gap-1">
          {online && isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : isDegraded ? (
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-500" />
          )}
          {online ? (isConnected ? 'Online' : isDegraded ? 'Degraded' : 'Offline') : 'Offline'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {currentTime.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
