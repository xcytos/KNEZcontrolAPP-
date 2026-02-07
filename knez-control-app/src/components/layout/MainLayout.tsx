import React from 'react';
import { Sidebar, View } from './Sidebar';
import { PresenceIndicator } from '../../features/presence/PresenceIndicator';
import { PresenceState } from '../../domain/DataContracts';

interface MainLayoutProps {
  activeView: View;
  onViewChange: (view: View) => void;
  presenceState: PresenceState;
  children: React.ReactNode;
  connectionStatus?: {
    state: "running" | "starting" | "degraded" | "error" | "down";
    connected: boolean;
    endpoint: string;
    lastCheck: number | null;
  };
  headerActions?: React.ReactNode;
  headerSubtitle?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeView,
  onViewChange,
  presenceState,
  children,
  connectionStatus,
  headerActions,
  headerSubtitle,
}) => {
  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar activeView={activeView} onViewChange={onViewChange} />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
              KNEZ Control <span className="text-zinc-600 mx-2">/</span> {activeView}
            </h1>
            {connectionStatus && (
              <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${
                connectionStatus.state === "running"
                  ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
                  : connectionStatus.state === "starting" || connectionStatus.state === "degraded"
                    ? "bg-orange-950/30 border-orange-900 text-orange-400"
                    : connectionStatus.state === "error"
                      ? "bg-red-950/30 border-red-900 text-red-400"
                      : "bg-zinc-900/30 border-zinc-800 text-zinc-400"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus.state === "running"
                    ? "bg-emerald-500"
                    : connectionStatus.state === "starting" || connectionStatus.state === "degraded"
                      ? "bg-orange-500"
                      : connectionStatus.state === "error"
                        ? "bg-red-500"
                        : "bg-zinc-500"
                }`} />
                <span className="font-mono">{connectionStatus.endpoint}</span>
              </div>
            )}
            {headerSubtitle}
          </div>
          <div className="flex items-center gap-3">
            {headerActions}
            <PresenceIndicator state={presenceState} />
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-0 relative">
          {children}
        </main>
      </div>
    </div>
  );
};
