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
    connected: boolean;
    endpoint: string;
    lastCheck: number | null;
  };
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeView,
  onViewChange,
  presenceState,
  children,
  connectionStatus,
}) => {
  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar activeView={activeView} onViewChange={onViewChange} />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
              KNEZ Control Surface <span className="text-zinc-600 mx-2">/</span> {activeView}
            </h1>
            {connectionStatus && (
              <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${
                connectionStatus.connected 
                  ? "bg-emerald-950/30 border-emerald-900 text-emerald-400" 
                  : "bg-red-950/30 border-red-900 text-red-400"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus.connected ? "bg-emerald-500" : "bg-red-500"
                }`} />
                <span className="font-mono">{connectionStatus.endpoint}</span>
              </div>
            )}
          </div>
          <PresenceIndicator state={presenceState} />
        </header>
        
        <main className="flex-1 overflow-auto p-0 relative">
          {children}
        </main>
      </div>
    </div>
  );
};
