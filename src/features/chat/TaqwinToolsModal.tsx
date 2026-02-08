import React, { useEffect, useMemo, useState } from "react";
import { taqwinMcpService } from "../../services/TaqwinMcpService";
import { getTaqwinToolPermissions, isTaqwinToolAllowed, setTaqwinToolEnabled } from "../../services/TaqwinToolPermissions";
import { McpToolDefinition } from "../../services/McpTypes";
import { sessionController } from "../../services/SessionController";
import { chatService } from "../../services/ChatService";
import { sessionDatabase } from "../../services/SessionDatabase";
import { ChatMessage, ToolCallMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";
import { logger } from "../../services/LogService";

function newLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}-${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function formatMcpUiError(raw: string): string {
  if (/mcp_stdin_write_denied/i.test(raw)) {
    return "MCP blocked: stdin_write permission denied. Enable shell:allow-stdin-write in Tauri capabilities.";
  }
  if (/ModuleNotFoundError:\s*No module named 'config'|No module named 'config'/i.test(raw)) {
    return "TAQWIN MCP failed to start (Python module path/config issue).";
  }
  if (/mcp_request_timeout/i.test(raw)) {
    return "TAQWIN MCP request timed out. Please retry.";
  }
  if (/mcp_process_closed_/i.test(raw)) {
    return "TAQWIN MCP closed unexpectedly. Please retry.";
  }
  return raw;
}

export const TaqwinToolsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [tools, setTools] = useState<McpToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [argsText, setArgsText] = useState<string>("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [errorRaw, setErrorRaw] = useState<string>("");
  const [mcpStatus, setMcpStatus] = useState(() => taqwinMcpService.getStatus());
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => getTaqwinToolPermissions());
  const [query, setQuery] = useState<string>("");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("taqwin_favorite_tools");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("taqwin_recent_tools");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const toolByName = useMemo(() => new Map(tools.map(t => [t.name, t])), [tools]);
  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tools.filter((t) => `${t.name} ${t.description ?? ""}`.toLowerCase().includes(q))
      : tools.slice();
    filtered.sort((a, b) => {
      const af = favorites.has(a.name) ? 0 : 1;
      const bf = favorites.has(b.name) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [tools, query, favorites]);

  const persistFavorites = (next: Set<string>) => {
    setFavorites(next);
    try {
      localStorage.setItem("taqwin_favorite_tools", JSON.stringify(Array.from(next)));
    } catch {}
  };

  const markRecent = (tool: string) => {
    const next = [tool, ...recent.filter((t) => t !== tool)].slice(0, 10);
    setRecent(next);
    try {
      localStorage.setItem("taqwin_recent_tools", JSON.stringify(next));
    } catch {}
  };

  const defaultArgsForTool = (tool: string) => {
    const sessionId = sessionController.getSessionId();
    if (tool === "activate_taqwin_unified_consciousness") {
      return { level: "superintelligence", query: "Hello TAQWIN.", context: { session_id: sessionId } };
    }
    if (tool === "taqwin_activate") {
      return { session_id: sessionId, knez_endpoint: knezClient.getProfile().endpoint, checkpoint: "CP01_MCP_REGISTRY" };
    }
    if (tool === "get_server_status") {
      return { force_refresh: true, include_db_analysis: true };
    }
    if (tool === "deploy_real_taqwin_council") {
      return { action: "status", session_id: sessionId };
    }
    if (tool === "session") {
      return { action: "session_start", session_id: sessionId, name: `control_app_${sessionId.substring(0, 8)}` };
    }
    if (tool === "session_v2") {
      return { action: "get_llm_context", session_id: sessionId };
    }
    if (tool === "connection_info") {
      return {};
    }
    return {};
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async (force = false) => {
      try {
        setMcpStatus(taqwinMcpService.getStatus());
        const list = await taqwinMcpService.listTools(force);
        if (!cancelled) {
          setTools(list);
          setSelectedTool((prev) => {
            const next = prev && list.some((t) => t.name === prev) ? prev : (list[0]?.name ?? "");
            if (next && next !== prev) setArgsText(JSON.stringify(defaultArgsForTool(next), null, 2));
            return next;
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          const raw = String(e?.message ?? e);
          logger.error("mcp", "Failed to load TAQWIN tools", { error: raw });
          setError(formatMcpUiError(raw));
          setErrorRaw(raw);
          setMcpStatus(taqwinMcpService.getStatus());
        }
      }
    };
    void load(true);
    const t = window.setInterval(() => void load(false), 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPermissions(getTaqwinToolPermissions());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runTool = async () => {
    setError("");
    setErrorRaw("");
    const sessionId = sessionController.getSessionId();
    const tool = selectedTool;
    if (!tool) {
      setError("Select a tool");
      return;
    }
    if (!isTaqwinToolAllowed(tool)) {
      setError(`Tool not allowed: ${tool}`);
      return;
    }
    let args: any;
    try {
      args = JSON.parse(argsText);
    } catch {
      setError("Arguments must be valid JSON");
      return;
    }

    const now = new Date().toISOString();
    const messageId = newLocalId("tool");

    const toolCall: ToolCallMessage = {
      tool,
      args,
      status: "calling",
      startedAt: now
    };

    const msg: ChatMessage = {
      id: messageId,
      sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      toolCall,
      deliveryStatus: "delivered"
    };

    setBusy(true);
    await sessionDatabase.saveMessages(sessionId, [msg]);
    await chatService.load(sessionId);

    try {
      const result = await taqwinMcpService.callTool(tool, args);
      markRecent(tool);
      const finishedAt = new Date().toISOString();
      await sessionDatabase.updateMessage(messageId, {
        toolCall: { ...toolCall, status: "succeeded", result, finishedAt }
      });
      await chatService.load(sessionId);
    } catch (e: any) {
      const finishedAt = new Date().toISOString();
      const raw = String(e?.message ?? e);
      logger.error("mcp", "TAQWIN tool call failed", { tool, error: raw });
      markRecent(tool);
      setError(formatMcpUiError(raw));
      setErrorRaw(raw);
      await sessionDatabase.updateMessage(messageId, {
        toolCall: { ...toolCall, status: "failed", error: formatMcpUiError(raw), finishedAt }
      });
      await chatService.load(sessionId);
    } finally {
      setBusy(false);
      setMcpStatus(taqwinMcpService.getStatus());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[900px] shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 flex-none border-b border-zinc-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-zinc-200">TAQWIN Tools</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Open MCP Logs
              </button>
              <button
                onClick={() => {
                  void (async () => {
                    setError("");
                    setErrorRaw("");
                    try {
                      const status = await taqwinMcpService.start(true);
                      setMcpStatus(status);
                      const list = await taqwinMcpService.listTools(true);
                      setTools(list);
                      setSelectedTool((prev) => {
                        const next = prev && list.some((t) => t.name === prev) ? prev : (list[0]?.name ?? "");
                        if (next && next !== prev) setArgsText(JSON.stringify(defaultArgsForTool(next), null, 2));
                        return next;
                      });
                    } catch (e: any) {
                      const raw = String(e?.message ?? e);
                      setError(formatMcpUiError(raw));
                      setErrorRaw(raw);
                      setMcpStatus(taqwinMcpService.getStatus());
                      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
                    }
                  })();
                }}
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                {mcpStatus.running ? "Restart TAQWIN MCP" : "Start TAQWIN MCP"}
              </button>
              <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors">
                Close
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center justify-between gap-3">
            <div>
              mcp={mcpStatus.running ? "running" : "down"} failures={mcpStatus.consecutiveFailures}
            </div>
            {mcpStatus.lastRawError && (
              <div className="truncate text-red-300 max-w-[520px]">{mcpStatus.lastRawError}</div>
            )}
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-2">
            <div className="text-xs font-mono text-zinc-500 mb-2">registry</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search tools..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-300 text-xs font-mono focus:border-blue-500 outline-none"
            />
            {recent.length > 0 && (
              <div className="text-[10px] text-zinc-500 font-mono">
                recent: {recent.join(", ")}
              </div>
            )}
            <div className="border border-zinc-800 rounded bg-zinc-950/40 overflow-hidden">
              {tools.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500">No tools loaded.</div>
              ) : (
                visibleTools.map((t) => {
                  const enabled = permissions[t.name] !== false;
                  const allowed = isTaqwinToolAllowed(t.name);
                  return (
                    <div
                      key={t.name}
                      className={`px-3 py-2 border-b border-zinc-900 flex items-center justify-between gap-3 ${
                        selectedTool === t.name ? "bg-zinc-900/60" : "bg-transparent"
                      }`}
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => {
                          setSelectedTool(t.name);
                          setArgsText(JSON.stringify(defaultArgsForTool(t.name), null, 2));
                        }}
                      >
                        <div className="text-xs font-mono text-zinc-200">{t.name}</div>
                        {t.description && <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{t.description}</div>}
                      </button>
                      <button
                        onClick={() => {
                          const next = new Set(favorites);
                          if (next.has(t.name)) next.delete(t.name);
                          else next.add(t.name);
                          persistFavorites(next);
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded border bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                        title="favorite"
                      >
                        {favorites.has(t.name) ? "★" : "☆"}
                      </button>
                      <button
                        onClick={() => {
                          const next = !enabled;
                          setTaqwinToolEnabled(t.name, next);
                          setPermissions(getTaqwinToolPermissions());
                        }}
                        className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                          enabled ? "bg-blue-900/20 text-blue-200 border-blue-900/40" : "bg-zinc-950/50 text-zinc-500 border-zinc-800"
                        }`}
                        title={allowed ? "enabled" : "blocked by trust policy (visible, not callable)"}
                      >
                        {allowed ? (enabled ? "on" : "off") : "policy"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="col-span-2 space-y-3">
            <div className="border border-zinc-800 rounded bg-zinc-950/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-mono text-zinc-200">{selectedTool}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {toolByName.get(selectedTool)?.description ?? "No description."}
                  </div>
                </div>
                <button
                  onClick={() => void runTool()}
                  disabled={busy}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Running..." : "Run Tool"}
                </button>
              </div>
              <div className="mt-4">
                <div className="text-xs font-mono text-zinc-500 mb-2">arguments (json)</div>
                <textarea
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  className="w-full h-56 bg-zinc-950 border border-zinc-800 rounded p-3 text-zinc-200 text-xs font-mono focus:border-blue-500 outline-none"
                />
              </div>
              {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
              {errorRaw && (
                <div className="mt-2 border border-zinc-800 bg-zinc-950/40 rounded p-3 text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-words">
                  {errorRaw}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-zinc-800/50 flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>session={sessionController.getSessionId().substring(0, 8)}...</span>
          <span>trust={knezClient.getProfile().trustLevel}</span>
        </div>
      </div>
    </div>
  );
};
