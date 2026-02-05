import React, { useEffect, useMemo, useState } from "react";
import { knezClient } from "../../services/KnezClient";
import { KnezConnectionProfile, KnezEvent, KnezHealthResponse, McpRegistrySnapshot } from "../../domain/DataContracts";

import { SystemPanel } from "../system/SystemPanel";

export const ConnectionSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [endpoint, setEndpoint] = useState("http://localhost:8000");
  const [status, setStatus] = useState<"idle" | "checking" | "healthy" | "failed">("idle");
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [events, setEvents] = useState<KnezEvent[] | null>(null);
  const [mcp, setMcp] = useState<McpRegistrySnapshot | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const profile = knezClient.getProfile();
    setEndpoint(profile.endpoint);
    if (profile.trustLevel === "verified") setMessage("Trusted KNEZ instance configured.");
  }, []);

  const profile = useMemo(() => {
    return knezClient.getProfile();
  }, [endpoint, status]);

  const handleCheck = async () => {
    setStatus("checking");
    setMessage("Checking /health…");
    setHealth(null);
    setEvents(null);
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
      // Small delay to allow stack to fully bind ports if this was triggered immediately after "STACK READY"
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const h = await knezClient.health();
      setHealth(h);
      setStatus("healthy");
      setMessage("KNEZ responded to /health. Review runtime and trust if correct.");
      try {
        const recent = await knezClient.listEvents("", 50);
        setEvents(recent);
      } catch {
        setEvents([]);
      }
      const reg = await knezClient.tryGetMcpRegistry();
      setMcp(reg);
    } catch (err: any) {
      setStatus("failed");
      setMessage(`Health check failed: ${err.message || "Unknown error"}. Ensure KNEZ is running.`);
    }
  };

  const handleTrust = () => {
    knezClient.setTrusted(true);
    setMessage("Trusted KNEZ instance saved.");
    window.location.reload();
  };

  const localBackendDetected = useMemo(() => {
    if (!events) return false;
    return events.some((e: any) => {
      const tags: string[] = Array.isArray(e?.tags) ? e.tags.map(String) : [];
      return tags.includes("local");
    });
  }, [events]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[600px] shadow-xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 pb-4 flex-none border-b border-zinc-800/50">
          <h2 className="text-lg font-light text-zinc-200">KNEZ Connection (Observability)</h2>
        </div>
        
        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Endpoint Input */}
          <div>
            <label className="block text-xs font-mono text-zinc-500 mb-1">ENDPOINT URL</label>
            <input 
              type="text" 
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-300 text-sm focus:border-blue-500 outline-none"
              placeholder="http://localhost:8000"
            />
          </div>

          {/* Status Message */}
          {message && (
             <div className={`text-xs p-2 rounded ${
               status === "healthy" ? "bg-green-900/20 text-green-400" :
               status === "failed" ? "bg-red-900/20 text-red-400" : "text-zinc-500"
             }`}>
               {message}
             </div>
          )}

          {/* Runtime Info */}
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">Runtime</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">connected</span>
                <span className="font-mono">{status === "healthy" ? "true" : "false"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">endpoint</span>
                <span className="font-mono">{endpoint}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">trust</span>
                <span className="font-mono">{profile.trustLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">storage_path</span>
                <span className="font-mono text-zinc-500">not exposed by /health</span>
              </div>
            </div>
          </div>

          {/* System Panel (Stack Orchestration) */}
          <SystemPanel />

          {/* Backend Discovery */}
          {health && (
            <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
              <div className="font-mono text-zinc-500 mb-2">Backend Discovery (read-only via /health)</div>
              {health.backends.length === 0 ? (
                <div className="text-zinc-500">No backends reported.</div>
              ) : (
                <div className="space-y-2">
                  {health.backends.map((b) => {
                    const degradation = b.status === "healthy" ? "none" : b.status;
                    return (
                      <div key={b.model_id} className="border border-zinc-800 rounded p-2 bg-zinc-950/30">
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{b.model_id}</span>
                          <span className="text-zinc-500">{b.status}</span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-600">backend_id</span>
                            <span className="font-mono">{b.model_id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-600">type</span>
                            <span className="font-mono text-zinc-500">unknown</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-600">degradation</span>
                            <span className="font-mono">{degradation}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-600">latency_ms</span>
                            <span className="font-mono">{typeof b.latency_ms === "number" ? b.latency_ms.toFixed(1) : "n/a"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ollama Awareness */}
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">Ollama Awareness (indirect)</div>
            {status !== "healthy" ? (
              <div className="text-zinc-500">Unavailable while disconnected.</div>
            ) : events === null ? (
              <div className="text-zinc-500">Not checked yet.</div>
            ) : localBackendDetected ? (
              <div className="text-zinc-300">
                Local backend activity detected in KNEZ events (tag: local). Control App does not manage local runtime.
              </div>
            ) : (
              <div className="text-zinc-500">No local backend activity observed in recent events.</div>
            )}
          </div>

          {/* MCP Registry */}
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">MCP Registry (inspection only)</div>
            {status !== "healthy" ? (
              <div className="text-zinc-500">Unavailable while disconnected.</div>
            ) : mcp === null ? (
              <div className="text-zinc-500">Not checked yet.</div>
            ) : mcp.supported ? (
              mcp.items.length === 0 ? (
                <div className="text-zinc-500">No MCPs reported.</div>
              ) : (
                <div className="space-y-1">
                  {mcp.items.slice(0, 12).map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <span className="font-mono">{it.id}</span>
                      <span className="text-zinc-500">{it.status ?? "unknown"}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-zinc-500">{mcp.reason}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex-none border-t border-zinc-800/50 bg-zinc-900 rounded-b-lg">
          <div className="flex justify-end space-x-2">
             <button 
               onClick={onClose}
               className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
             >
               Close
             </button>
             <button 
               onClick={handleCheck}
               disabled={status === "checking"}
               className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50 transition-colors"
             >
               {status === "checking" ? "Checking..." : "Check Health"}
             </button>
             <button
               onClick={handleTrust}
               disabled={status !== "healthy"}
               className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded disabled:opacity-50 transition-colors"
             >
               Trust
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};
