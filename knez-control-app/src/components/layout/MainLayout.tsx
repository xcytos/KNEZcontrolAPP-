import React from 'react';
import { Sidebar, View } from './Sidebar';
import { PresenceIndicator } from '../../features/presence/PresenceIndicator';
import { PresenceState } from '../../domain/DataContracts';

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

interface MainLayoutProps {
  activeView: View;
  onViewChange: (view: View) => void;
  presenceState: PresenceState;
  children: React.ReactNode;
  tabErrors?: Partial<Record<View, boolean>>;
  connectionStatus?: {
    state: "running" | "starting" | "degraded" | "error" | "down";
    connected: boolean;
    isModelReady: boolean;
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
  tabErrors,
  connectionStatus,
  headerActions,
  headerSubtitle,
}) => {
  const tauriInset = isTauriRuntime();
  return (
    <div className="flex flex-col h-full w-full min-h-0 min-w-0 bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {tauriInset && <div className="h-2 shrink-0 bg-zinc-950" />}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <Sidebar activeView={activeView} onViewChange={onViewChange} tabErrors={tabErrors} />
        
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
          <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
                KNEZ Control <span className="text-zinc-600 mx-2">/</span> {activeView}
              </h1>
              {connectionStatus && (
                <div className="flex items-center gap-3">
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
                  <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${
                    connectionStatus.isModelReady
                      ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
                      : "bg-amber-950/30 border-amber-900 text-amber-400"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus.isModelReady
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`} />
                    <span className="font-mono">{connectionStatus.isModelReady ? "Model Ready" : "Model Loading"}</span>
                  </div>
                </div>
              )}
              {headerSubtitle}
            </div>
            <div className="flex items-center gap-3">
              {headerActions}
              <PresenceIndicator state={presenceState} />
            </div>
          </header>
          
          <main className="flex-1 min-h-0 min-w-0 overflow-auto p-0 relative">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
