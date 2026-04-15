import React, { useEffect, useMemo, useState } from "react";
import { ChatService } from "../../services/ChatService";
import { knezClient } from "../../services/KnezClient";
import { KnezConnectionProfile, KnezEvent, KnezHealthResponse, McpRegistrySnapshot } from "../../domain/DataContracts";
import { deleteProfile, listProfiles, saveProfile, setActiveProfile } from "../../services/KnezProfiles";

import { SystemPanel } from "../system/SystemPanel";
import { SystemStatus } from "../system/useSystemOrchestrator";
import { isOverallHealthyStatus } from "../../utils/health";

const McpToggle: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("knez_mcp_enabled") === "1"; } catch { return false; }
  });
  const toggle = () => {
    const next = !enabled;
    ChatService.setMcpEnabled(next);
    setEnabled(next);
  };
  return (
    <div className="text-xs border border-zinc-800 rounded p-3 bg-zinc-950/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-zinc-500 mb-0.5">MCP Tool Execution</div>
          <div className="text-zinc-600">
            {enabled ? "Tools active — model may trigger MCP calls with your approval." : "Tools disabled — model responds in plain text only."}
          </div>
        </div>
        <button
          onClick={toggle}
          data-testid="mcp-toggle"
          className={`ml-4 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
            enabled ? "bg-blue-600 border-blue-600" : "bg-zinc-700 border-zinc-700"
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`} />
        </button>
      </div>
      {/* Manual approval removed - tools auto-approve */}
    </div>
  );
};

export const ConnectionSettings: React.FC<{ 
  onClose: () => void;
  systemStatus: SystemStatus;
  systemOutput: string;
  onForceStart?: () => void;
}> = ({ onClose, systemStatus, systemOutput, onForceStart }) => {
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:8000");
  const [status, setStatus] = useState<"idle" | "checking" | "healthy" | "failed">("idle");
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [mcp, setMcp] = useState<McpRegistrySnapshot | null>(null);
  const [message, setMessage] = useState("");
  const w = window as any;
  const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;

  useEffect(() => {
    const profile = knezClient.getProfile();
    setEndpoint(profile.endpoint);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (systemStatus === "running" && endpoint.includes("8001")) {
      const fixed = endpoint.replace("8001", "8000");
      setEndpoint(fixed);
      knezClient.setProfile({
        id: "custom",
        type: "local",
        transport: "http",
        endpoint: fixed,
        trustLevel: "untrusted",
      });
      setMessage("Auto-corrected endpoint from 8001 to 8000");
      setTimeout(() => handleCheck(), 500);
    }
  }, [systemStatus, endpoint]);

  const profile = useMemo(() => {
    return knezClient.getProfile();
  }, [endpoint, status]);

  const handleCheck = async () => {
    setStatus("checking");
    setMessage("Checking /health…");
    setHealth(null);
    setMcp(null);

    const profile: KnezConnectionProfile = {
      id: "custom",
      type: endpoint.includes("localhost") || endpoint.includes("127.0.0.1") ? "local" : "remote",
      transport: "http",
      endpoint,
      trustLevel: "untrusted",
    };
    knezClient.setProfile(profile);
    knezClient.setTrusted(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const h = await knezClient.health({ timeoutMs: 5000 });
      setHealth(h);
      const ok = isOverallHealthyStatus(h.status);
      setStatus(ok ? "healthy" : "failed");
      knezClient.setTrusted(ok);
      setMessage(ok ? "KNEZ is healthy and trusted." : `KNEZ responded but is not healthy (status=${String(h.status)}).`);
      const reg = await knezClient.tryGetMcpRegistry();
      setMcp(reg);
      return true;
    } catch (err: any) {
      setStatus("failed");
      setMessage(`Health check failed: ${err.message || "Unknown error"}. Ensure KNEZ is running.`);
      return false;
    }
  };

  const handleReset = () => {
    knezClient.resetToDefault();
    const profile = knezClient.getProfile();
    setEndpoint(profile.endpoint);
    setMessage("Reset to default endpoint: " + profile.endpoint);
    setStatus("idle");
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[700px] shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-4 pb-2 flex-none border-b border-zinc-800/50">
          <h2 className="text-sm font-mono text-zinc-200">KNEZ CONNECTION DEBUG</h2>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="text-zinc-500">ENDPOINT</label>
              <input 
                type="text" 
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-300 text-sm focus:border-blue-500 outline-none mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <button 
                onClick={handleCheck}
                disabled={status === "checking"}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50"
              >
                {status === "checking" ? "CHECKING..." : "CHECK"}
              </button>
              <button 
                onClick={handleReset}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm rounded"
              >
                RESET
              </button>
            </div>
          </div>

          {message && (
            <div className={
              status === "healthy" ? "text-green-400" :
              status === "failed" ? "text-red-400" : "text-zinc-500"
            }>{message}</div>
          )}

          <div className="grid grid-cols-3 gap-2 text-zinc-400">
            <div>STATUS: <span className={
              status === "healthy" ? "text-green-400" :
              status === "failed" ? "text-red-400" :
              "text-zinc-500"
            }>{status.toUpperCase()}</span></div>
            <div>CONNECTED: <span className="text-zinc-500">{status === "healthy" ? "true" : "false"}</span></div>
            <div>TRUST: <span className="text-zinc-500">{profile.trustLevel}</span></div>
          </div>

          <div>
            <div className="text-zinc-500 mb-2">SYSTEM ORCHESTRATION</div>
            <SystemPanel status={systemStatus} output={systemOutput} />
          </div>

          {health && health.backends.length > 0 && (
            <div>
              <div className="text-zinc-500 mb-2">BACKENDS ({health.backends.length})</div>
              <div className="space-y-1">
                {health.backends.map((b) => (
                  <div key={b.model_id} className="flex justify-between">
                    <span className={b.status === "healthy" ? "text-green-400" : "text-red-400"}>{b.model_id}</span>
                    <span className="text-zinc-500">{b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <McpToggle />

          {mcp && (
            <div>
              <div className="text-zinc-500 mb-2">MCP REGISTRY</div>
              {mcp.supported ? (
                mcp.items.length === 0 ? (
                  <div className="text-zinc-500">No MCPs reported</div>
                ) : (
                  <div className="space-y-1">
                    {mcp.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span className="text-zinc-300">{it.id}</span>
                        <span className="text-zinc-500">{it.status ?? "unknown"}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-red-400">{mcp.reason}</div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 pt-2 flex-none border-t border-zinc-800/50 flex justify-between">
          <button
            onClick={() => {
              if (!onForceStart) return;
              if (!isTauri) {
                setMessage("Web mode cannot start the local stack.");
                setStatus("failed");
                return;
              }
              onForceStart();
            }}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
          >
            FORCE START
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
