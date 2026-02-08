import React, { useEffect, useMemo, useState } from "react";
import { Cpu, Database, Link2, Settings, WifiOff } from "lucide-react";
import { ConnectionPage } from "./ConnectionPage";
import { SystemStatus } from "../system/useSystemOrchestrator";
import { useStatus } from "../../contexts/useStatus";
import { sessionDatabase } from "../../services/SessionDatabase";
import { getKeepAliveEnabled, setKeepAliveEnabled } from "../../services/Preferences";

type PageId = "overview" | "connection";

function statusTone(input: { systemStatus: SystemStatus; isConnected: boolean; isDegraded: boolean }) {
  if (input.systemStatus === "starting") return { label: "Starting", color: "bg-orange-500" };
  if (input.isConnected) return { label: "Running", color: "bg-emerald-500" };
  if (input.isDegraded) return { label: "Degraded", color: "bg-orange-500" };
  if (input.systemStatus === "failed") return { label: "Error", color: "bg-red-500" };
  return { label: "Down", color: "bg-zinc-500" };
}

export const SettingsModal: React.FC<{
  onClose: () => void;
  systemStatus: SystemStatus;
  systemOutput: string;
  onForceStart?: (force?: boolean) => void;
}> = ({ onClose, systemStatus, systemOutput, onForceStart }) => {
  const { online, isConnected, isDegraded, health, healthFresh, cognitiveState } = useStatus();
  const [page, setPage] = useState<PageId>("overview");
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [keepAlive, setKeepAlive] = useState(getKeepAliveEnabled());

  useEffect(() => {
    sessionDatabase
      .getSessions()
      .then(() => setDbOk(true))
      .catch(() => setDbOk(false));
  }, []);

  const tone = useMemo(() => statusTone({ systemStatus, isConnected, isDegraded }), [systemStatus, isConnected, isDegraded]);
  const backend = health?.backends?.[0];
  const modelOk = backend ? String(backend.status).toLowerCase() === "ok" : false;

  const pages: { id: PageId; label: string; icon: React.FC<any> }[] = [
    { id: "overview", label: "Overview", icon: Settings },
    { id: "connection", label: "Connection", icon: Link2 },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[980px] shadow-xl max-h-[90vh] flex overflow-hidden">
        <div className="w-56 border-r border-zinc-800 bg-zinc-950/30 p-3 flex flex-col">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="text-sm font-semibold text-zinc-200">Settings</div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          <div className="px-2 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <div className={`w-2 h-2 rounded-full ${tone.color}`} />
              <span>{tone.label}</span>
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {online ? "Connected to KNEZ endpoint" : health ? "Disconnected (stale snapshot)" : "Not connected"}
            </div>
          </div>

          <div className="mt-2 space-y-1">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => setPage(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  page === p.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <p.icon size={16} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-lg font-light text-zinc-200">
                {page === "overview" ? "Connection Overview" : "KNEZ Connection"}
              </div>
              <div className="text-xs text-zinc-500">
                {page === "overview" ? "Runtime status, models, and storage" : "Endpoint, health checks, and orchestration"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onForceStart?.(true)}
                className="px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
              >
                Force Start
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {page === "overview" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      {online ? <Cpu size={16} /> : <WifiOff size={16} />}
                      <span>KNEZ</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${online ? "bg-emerald-900/30 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                      {online ? "connected" : health ? "stale" : "disconnected"}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    System: <span className="font-mono">{systemStatus}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Health: <span className="font-mono">{health?.status ?? "n/a"}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Fresh: <span className="font-mono">{healthFresh ? "yes" : "no"}</span>
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/30">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-200">Keep KNEZ Running</div>
                    <button
                      onClick={() => {
                        const next = !keepAlive;
                        setKeepAlive(next);
                        setKeepAliveEnabled(next);
                      }}
                      className={`w-12 h-6 rounded-full border transition-colors relative ${
                        keepAlive ? "bg-emerald-900/30 border-emerald-800" : "bg-zinc-900 border-zinc-700"
                      }`}
                      title="Auto-start and auto-restart local stack while app is open"
                    >
                      <div
                        className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${
                          keepAlive ? "left-6 bg-emerald-400" : "left-1 bg-zinc-400"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    When enabled, the desktop app will auto-start and re-attempt connection to the local stack.
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      <Database size={16} />
                      <span>Database</span>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        dbOk === true ? "bg-emerald-900/30 text-emerald-400" : dbOk === false ? "bg-red-900/30 text-red-400" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {dbOk === true ? "ok" : dbOk === false ? "error" : "checking"}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">IndexedDB / Dexie storage</div>
                </div>

                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      <Cpu size={16} />
                      <span>Model</span>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        backend ? (modelOk ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400") : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {online ? (backend ? backend.status : "n/a") : "stale"}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    {backend ? (
                      <>
                        id: <span className="font-mono">{backend.model_id}</span>
                      </>
                    ) : (
                      "No backend reported"
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    backends: <span className="font-mono">{health?.backends?.length ?? 0}</span>
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-200">
                      <Cpu size={16} />
                      <span>Cognition</span>
                    </div>
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400">
                      {cognitiveState ? "available" : "n/a"}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    focus: <span className="font-mono">{cognitiveState?.focus_level ?? "-"}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    stability: <span className="font-mono">{cognitiveState?.stability_score ?? "-"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <ConnectionPage systemStatus={systemStatus} systemOutput={systemOutput} onForceStart={onForceStart} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
