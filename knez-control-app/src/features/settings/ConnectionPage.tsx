import React, { useEffect, useMemo, useState } from "react";
import { ChatService } from '../../services/ChatService';
import { knezClient } from '../../services/knez/KnezClient';
import {
  KnezConnectionProfile,
  KnezEvent,
  KnezHealthResponse,
  McpRegistrySnapshot,
} from "../../domain/DataContracts";
import { SystemPanel } from "../system/SystemPanel";
import { HealthProbeStatus, SystemStatus } from "../system/useSystemOrchestrator";
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

export const ConnectionPage: React.FC<{
  systemStatus: SystemStatus;
  systemOutput: string;
  systemHealthProbe: HealthProbeStatus;
  onForceStart?: (force?: boolean) => void;
}> = ({ systemStatus, systemOutput, systemHealthProbe, onForceStart }) => {
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:8000");
  const [status, setStatus] = useState<"idle" | "checking" | "healthy" | "failed">("idle");
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [events, setEvents] = useState<KnezEvent[] | null>(null);
  const [mcp, setMcp] = useState<McpRegistrySnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [modelState, setModelState] = useState<"unloaded" | "loading" | "loaded">("unloaded");
  const w = window as any;
  const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;

  useEffect(() => {
    const profile = knezClient.getProfile();
    setEndpoint(profile.endpoint);
    if (profile.trustLevel === "verified") setMessage("Trusted KNEZ instance configured.");
    checkModelState();
  }, []);

  const checkModelState = async () => {
    try {
      const resp = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json() as any;
        const models = data?.models ?? [];
        if (models.length > 0) {
          setModelState("loaded");
        } else {
          setModelState("unloaded");
        }
      } else {
        setModelState("unloaded");
      }
    } catch (e) {
      // Connection refused or timeout means Ollama not running
      setModelState("unloaded");
    }
  };

  const handleLoadModel = async () => {
    // First check if Ollama is running
    try {
      const healthCheck = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
      if (!healthCheck.ok) {
        setMessage("Ollama is not running. Start the local stack first.");
        return;
      }
    } catch {
      setMessage("Ollama is not running. Start the local stack first.");
      return;
    }

    setModelState("loading");
    setMessage("Loading model into memory...");
    try {
      const resp = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5:7b-instruct-q4_K_M",
          prompt: "hello",
          stream: false
        }),
        signal: AbortSignal.timeout(60000)
      });
      if (resp.ok) {
        setModelState("loaded");
        setMessage("Model loaded successfully.");
      } else {
        setModelState("unloaded");
        setMessage("Failed to load model.");
      }
    } catch (e) {
      setModelState("unloaded");
      setMessage("Failed to load model.");
    }
  };

  const profile = useMemo(() => {
    return knezClient.getProfile();
  }, [endpoint, status]);

  const handleCheck = async () => {
    setStatus("checking");
    setMessage("Checking /health…");
    setHealth(null);
    setEvents(null);
    setMcp(null);

    const nextProfile: KnezConnectionProfile = {
      id: "custom",
      type: endpoint.includes("localhost") || endpoint.includes("127.0.0.1") ? "local" : "remote",
      transport: "http",
      endpoint,
      trustLevel: "untrusted",
    };
    knezClient.setProfile(nextProfile);
    knezClient.setTrusted(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const h = await knezClient.health({ timeoutMs: 4500 });
      setHealth(h);
      setStatus(isOverallHealthyStatus(h.status) ? "healthy" : "failed");

      if (isOverallHealthyStatus(h.status)) {
        knezClient.setTrusted(true);
        setMessage("KNEZ is healthy and trusted.");
      } else {
        knezClient.setTrusted(false);
        setMessage(`KNEZ responded but is not healthy (status=${String(h.status)}).`);
      }

      try {
        const recent = await knezClient.listEvents("", 50);
        setEvents(recent);
      } catch {
        setEvents([]);
      }
      const reg = await knezClient.tryGetMcpRegistry();
      setMcp(reg);
      return true;
    } catch (err: any) {
      setStatus("failed");
      setMessage(`Health check failed: ${err.message || "Unknown error"}. Ensure KNEZ is running.`);
      return false;
    }
  };

  const localBackendDetected = useMemo(() => {
    if (!events) return false;
    return events.some((e: any) => {
      const tags: string[] = Array.isArray(e?.tags) ? e.tags.map(String) : [];
      return tags.includes("local");
    });
  }, [events]);

  return (
    <div className="space-y-4">
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

      {message && (
        <div
          className={`text-xs p-2 rounded ${
            status === "healthy"
              ? "bg-green-900/20 text-green-400"
              : status === "failed"
                ? "bg-red-900/20 text-red-400"
                : "text-zinc-500"
          }`}
        >
          {message}
        </div>
      )}

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
            <span className="text-zinc-500">model</span>
            <span className={`font-mono ${modelState === "loaded" ? "text-green-400" : modelState === "loading" ? "text-yellow-400" : "text-orange-400"}`}>
              {modelState === "loading" ? "loading..." : modelState === "loaded" ? "loaded" : "unloaded"}
            </span>
          </div>
        </div>
      </div>

      <SystemPanel status={systemStatus} output={systemOutput} healthProbe={systemHealthProbe} />

      {health && (
        <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
          <div className="font-mono text-zinc-500 mb-2">Backend Discovery (read-only via /health)</div>
          {health.backends.length === 0 ? (
            <div className="text-zinc-500">No backends reported.</div>
          ) : (
            <div className="space-y-2">
              {health.backends.slice(0, 8).map((b) => (
                <div key={b.model_id} className="flex items-center justify-between">
                  <span className="font-mono">{b.model_id}</span>
                  <span className="text-zinc-500">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            if (!onForceStart) return;
            if (!isTauri) {
              setMessage("Web mode cannot start the local stack. Use the desktop app to launch KNEZ.");
              setStatus("failed");
              return;
            }
            onForceStart(true);
          }}
          className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
        >
          Force Start
        </button>
        <button
          onClick={handleCheck}
          disabled={status === "checking"}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50 transition-colors"
        >
          {status === "checking" ? "Checking..." : "Check Health"}
        </button>
        {modelState === "unloaded" && (
          <button
            onClick={handleLoadModel}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
          >
            Load Model
          </button>
        )}
      </div>

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

      <McpToggle />

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
  );
};
