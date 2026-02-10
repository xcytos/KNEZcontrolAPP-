import React, { useEffect, useMemo, useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { taqwinMcpService } from "../../mcp/taqwin/TaqwinMcpService";
import { getTaqwinToolPermissions, isTaqwinToolAllowed, setTaqwinToolEnabled } from "../../services/TaqwinToolPermissions";
import { McpToolDefinition } from "../../services/McpTypes";
import { sessionController } from "../../services/SessionController";
import { chatService } from "../../services/ChatService";
import { sessionDatabase } from "../../services/SessionDatabase";
import { ChatMessage, ToolCallMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";
import { logger } from "../../services/LogService";
import { mcpHostConfigService } from "../../mcp/config/McpHostConfigService";
import { normalizeTaqwinMcpServer, parseMcpHostConfigJson, validateTaqwinMcpServer } from "../../mcp/config/McpHostConfig";
import { useTaqwinMcpStatus } from "../../hooks/useTaqwinMcpStatus";

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
  if (/mcp_unavailable_non_tauri/i.test(raw)) {
    return "TAQWIN tools require the desktop app (Tauri).";
  }
  if (/mcp_config_missing/i.test(raw)) {
    return "TAQWIN MCP is not configured. Click MCP Config and paste a servers JSON config.";
  }
  if (/mcp_config_invalid/i.test(raw)) {
    return "Invalid MCP config. Open MCP Logs for details, then fix MCP Config and retry.";
  }
  if (/mcp_custom_config_windows_only/i.test(raw)) {
    return "Custom MCP configs are currently supported on Windows only.";
  }
  if (/ModuleNotFoundError:\s*No module named 'config'|No module named 'config'/i.test(raw)) {
    return "TAQWIN MCP failed to start (Python module path/config issue).";
  }
  if (/mcp_request_timeout/i.test(raw)) {
    if (/TAQWIN MCP request timed out/i.test(raw) || raw.length > 80) return raw;
    return "TAQWIN MCP request timed out. Open MCP Logs for details, then retry.";
  }
  if (/mcp_process_closed_/i.test(raw)) {
    return "TAQWIN MCP closed unexpectedly. Please retry.";
  }
  if (/taqwin_activate_tool_missing/i.test(raw)) {
    return "TAQWIN activation tool is missing on the server. Refresh tools, or update TAQWIN.";
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
  const [loadingTools, setLoadingTools] = useState(false);
  const [startingMcp, setStartingMcp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [errorRaw, setErrorRaw] = useState<string>("");
  const mcpStatus = useTaqwinMcpStatus();
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

  const [showConfig, setShowConfig] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [traceText, setTraceText] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chatTrail, setChatTrail] = useState(() => {
    try {
      return localStorage.getItem("taqwin_chat_audit") === "1";
    } catch {
      return false;
    }
  });
  const [configText, setConfigText] = useState("");
  const [configIssues, setConfigIssues] = useState<Record<string, ReturnType<typeof validateTaqwinMcpServer>>>({});
  const [configError, setConfigError] = useState("");
  const [selfTest, setSelfTest] = useState<any>(null);

  const e2eMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("e2e") === "1";
    } catch {
      return false;
    }
  }, []);

  const detectTauri = () => {
    const w = window as any;
    return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
  };
  const [isTauri, setIsTauri] = useState<boolean>(() => detectTauri());

  useEffect(() => {
    if (!isOpen) return;
    if (isTauri) return;
    let tries = 0;
    const t = window.setInterval(() => {
      tries++;
      const ok = detectTauri();
      if (ok) {
        setIsTauri(true);
        clearInterval(t);
      } else if (tries >= 15) {
        clearInterval(t);
      }
    }, 200);
    return () => clearInterval(t);
  }, [isOpen, isTauri]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isTauri) return;
    void (async () => {
      try {
        const loaded = await mcpHostConfigService.load();
        const effective = loaded ?? mcpHostConfigService.getDefault();
        setConfigText(effective.raw);
        const issues: Record<string, ReturnType<typeof validateTaqwinMcpServer>> = {};
        for (const [name, server] of Object.entries(effective.config.servers)) {
          issues[name] = validateTaqwinMcpServer(server);
        }
        setConfigIssues(issues);
      } catch {}
    })();
  }, [isOpen, isTauri]);

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
    if (!isTauri) {
      setLoadingTools(false);
      setTools([]);
      setSelectedTool("");
      setError(formatMcpUiError("mcp_unavailable_non_tauri"));
      setErrorRaw("mcp_unavailable_non_tauri");
      return;
    }
    setLoadingTools(false);
  }, [isOpen, e2eMode, isTauri, (mcpStatus as any)?.running, (mcpStatus as any)?.initialized]);

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
  const autoDetectTaqwinConfig = async () => {
    setConfigError("");
    try {
      const w = window as any;
      const isTauri = !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
      if (!isTauri) throw new Error("mcp_unavailable_non_tauri");
      const script =
        "$ErrorActionPreference='SilentlyContinue';" +
        "$py='python';" +
        "$c=@(" +
        "\"$env:USERPROFILE\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1\"," +
        "\"$env:USERPROFILE\\\\Downloads\\\\TAQWIN_V1\"," +
        "\"$env:USERPROFILE\\\\Desktop\\\\TAQWIN_V1\"," +
        "\"$env:USERPROFILE\\\\Documents\\\\TAQWIN_V1\"" +
        ");" +
        "$t=$c | Where-Object { Test-Path (Join-Path $_ 'main.py') } | Select-Object -First 1;" +
        "@{ python=$py; taqwin=$t } | ConvertTo-Json -Compress";
      const proc = await Command.create("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        encoding: "utf-8"
      }).execute();
      const stdout = String((proc as any)?.stdout ?? "").trim();
      const detected = stdout ? JSON.parse(stdout) : {};
      const python = typeof detected?.python === "string" && detected.python ? detected.python : null;
      const taqwin = typeof detected?.taqwin === "string" && detected.taqwin ? detected.taqwin : null;

      const next = {
        schema_version: "1",
        servers: {
          taqwin: {
            command: python ?? "python",
            args: ["-u", "main.py", "mcp"],
            working_directory: taqwin ?? "",
            env: { PYTHONUNBUFFERED: "1" },
            enabled: true,
            tags: ["taqwin", "mcp"]
          }
        }
      };
      setConfigText(JSON.stringify(next, null, 2));
    } catch (e: any) {
      setConfigError(formatMcpUiError(String(e?.message ?? e)));
    }
  };
  const selectedDef = toolByName.get(selectedTool);
  const stderrTail = (mcpStatus as any)?.debug?.stderrTail ?? null;

  const buildTraceText = () => {
    const dbg = (mcpStatus as any)?.debug ?? null;
    const lastTimeout = dbg?.lastTimeout ?? null;
    const lastWrite = dbg?.lastWrite ?? null;
    const startedWith = dbg?.startedWith ?? null;
    const diagnosis = (() => {
      if (!isTauri) return "web_mode: MCP requires desktop app (Tauri).";
      if ((mcpStatus as any)?.state === "READY") {
        const toolsCached = Number((mcpStatus as any)?.toolsCached ?? 0);
        const toolsPending = Boolean((mcpStatus as any)?.toolsPending);
        if (toolsCached === 0 && toolsPending) return "ready: MCP initialized, tools pending (tools/list may be lazy or slow).";
        return "ready: MCP initialized and tools registry is cached.";
      }
      if ((mcpStatus as any)?.state === "INITIALIZED") return "initialized: MCP handshake completed (tools may not be listed yet).";
      if ((mcpStatus as any)?.state === "STARTING" || (mcpStatus as any)?.state === "DISCOVERING") {
        if (lastTimeout?.method === "initialize" && (lastTimeout?.stdoutBytes ?? 0) === 0) {
          return "initialize_stall: server did not produce stdout. Check stderrTail/lastCloseTail and TAQWIN entrypoint.";
        }
        return "starting: waiting for initialize/tools/list (non-blocking). Use MCP Logs for stderrTail.";
      }
      if ((mcpStatus as any)?.state === "ERROR") return `error: ${(mcpStatus as any)?.lastError ?? "unknown"}`;
      return "idle: MCP not started.";
    })();
    const snap: any = {
      when: new Date().toISOString(),
      mode: isTauri ? "tauri" : "web",
      handshake: [
        "initialize (client -> server)",
        "initialize result (server -> client)",
        "notifications/initialized (client -> server, no response expected)",
        "tools/list, tools/call..."
      ],
      diagnosis,
      mcpStatus: {
        state: (mcpStatus as any)?.state,
        running: (mcpStatus as any)?.running,
        initialized: (mcpStatus as any)?.initialized,
        framing: (mcpStatus as any)?.framing,
        toolsCached: (mcpStatus as any)?.toolsCached,
        toolsCacheAt: (mcpStatus as any)?.toolsCacheAt,
        consecutiveFailures: (mcpStatus as any)?.consecutiveFailures,
        mcpTrust: (mcpStatus as any)?.mcpTrust ?? (mcpStatus as any)?.trust ?? "unknown",
        capabilityTrust: (mcpStatus as any)?.capabilityTrust ?? "unknown",
        toolsPending: (mcpStatus as any)?.toolsPending ?? false,
        lastError: (mcpStatus as any)?.lastError,
        lastRawError: (mcpStatus as any)?.lastRawError,
        lastNormalizedError: (mcpStatus as any)?.lastNormalizedError,
      },
      startedWith,
      lastWrite,
      lastTimeout,
      debugTails: {
        stdoutTail: dbg?.stdoutTail ?? null,
        stderrTail: dbg?.stderrTail ?? null,
        lastCloseTail: dbg?.lastCloseTail ?? null,
        lastExitCode: dbg?.lastExitCode ?? null,
        lastError: dbg?.lastError ?? null,
        requestFraming: dbg?.requestFraming ?? null,
        pid: dbg?.pid ?? null
      }
    };
    const logTail = (() => {
      try {
        const lines = logger
          .getLogs()
          .slice(0, 800)
          .filter((l: any) => l.category === "mcp" || l.category === "knez_client" || l.category === "mcp_server_log")
          .slice(0, 250)
          .map((l: any) => {
            const ts = String(l.timestamp ?? "");
            const level = String(l.level ?? "");
            const cat = String(l.category ?? "");
            const msg = String(l.message ?? "");
            const meta = l.meta ? JSON.stringify(l.meta) : "";
            return `${ts} [${level}] [${cat}] ${msg}${meta ? ` ${meta}` : ""}`;
          });
        return lines.reverse().join("\n");
      } catch {
        return "";
      }
    })();
    return `${JSON.stringify(snap, null, 2)}\n\n--- recent mcp/knez_client logs ---\n${logTail || "(no logs)"}`;
  };

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
                onClick={() => setShowConfig((v) => !v)}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                MCP Config
              </button>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Advanced
              </button>
              <button
                onClick={() => {
                  void (async () => {
                    setSelfTest(null);
                    try {
                      const res = await taqwinMcpService.selfTest();
                      setSelfTest(res);
                    } catch (e: any) {
                      setSelfTest({ ok: false, steps: [{ step: "error", ok: false, detail: String(e?.message ?? e) }] });
                    }
                  })();
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Self-Test
              </button>
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
                      setStartingMcp(true);
                      await taqwinMcpService.start(true);
                      setTools([]);
                      setSelectedTool("");
                    } catch (e: any) {
                      const raw = String(e?.message ?? e);
                      setError(formatMcpUiError(raw));
                      setErrorRaw(raw);
                      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
                    } finally {
                      setStartingMcp(false);
                    }
                  })();
                }}
                disabled={!isTauri || startingMcp}
                aria-label="TAQWIN MCP"
                data-testid="mcp-control"
                className={`text-xs px-2 py-1 rounded text-white transition-colors ${
                  !isTauri
                    ? "bg-zinc-700/50 cursor-not-allowed"
                    : startingMcp || mcpStatus.state === "STARTING" || mcpStatus.state === "DISCOVERING"
                      ? "bg-blue-600/60 cursor-not-allowed"
                      : mcpStatus.state === "READY" || mcpStatus.state === "INITIALIZED"
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : mcpStatus.state === "ERROR"
                          ? "bg-red-600 hover:bg-red-500"
                          : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {!isTauri
                  ? "Start TAQWIN MCP"
                  : startingMcp || mcpStatus.state === "STARTING" || mcpStatus.state === "DISCOVERING"
                    ? "Starting..."
                    : mcpStatus.state === "READY" || mcpStatus.state === "INITIALIZED"
                      ? "Restart TAQWIN MCP"
                      : mcpStatus.state === "ERROR"
                        ? "Retry TAQWIN MCP"
                        : "Start TAQWIN MCP"}
              </button>
              <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors">
                Close
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center justify-between gap-3" data-testid="mcp-status">
            <div>
              mcp_state={mcpStatus.state} mcp_trust={(mcpStatus as any).mcpTrust ?? (mcpStatus as any).trust ?? "unknown"} capability_trust={(mcpStatus as any).capabilityTrust ?? "unknown"} tools_pending={String((mcpStatus as any).toolsPending ?? false)} pid={(mcpStatus as any)?.debug?.pid ?? "null"} tools={(mcpStatus as any)?.toolsCached ?? 0} failures={mcpStatus.consecutiveFailures}
            </div>
            {mcpStatus.lastRawError && (
              <div className="truncate text-red-300 max-w-[520px]">{mcpStatus.lastRawError}</div>
            )}
          </div>
          {showAdvanced && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (!isTauri) return;
                  setError("");
                  setErrorRaw("");
                  setLoadingTools(true);
                  void (async () => {
                    try {
                      const list = await taqwinMcpService.listTools(true, { waitForResult: true, timeoutMs: 20000 });
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
                      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
                    } finally {
                      setLoadingTools(false);
                    }
                  })();
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isTauri || startingMcp || loadingTools}
              >
                Refresh Tools
              </button>
              <button
                onClick={() => setShowHealth((v) => !v)}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Health
              </button>
              <button
                onClick={() => {
                  const next = !showTrace;
                  setShowTrace(next);
                  if (next) setTraceText(buildTraceText());
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Trace
              </button>
              <button
                onClick={() => {
                  const next = !chatTrail;
                  setChatTrail(next);
                  try {
                    localStorage.setItem("taqwin_chat_audit", next ? "1" : "0");
                  } catch {}
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Chat Trail: {chatTrail ? "On" : "Off"}
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("taqwin-activate"));
                  window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Activate TAQWIN
              </button>
            </div>
          )}
          {showHealth && (
            <div className="mt-3 border border-zinc-800 rounded bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-xs font-mono text-zinc-400">MCP Health</div>
                <button
                  type="button"
                  onClick={() => {
                    const snap = {
                      state: mcpStatus.state,
                      processAlive: mcpStatus.processAlive,
                      initialized: mcpStatus.initialized,
                      framing: mcpStatus.framing,
                      lastStartAt: mcpStatus.lastStartAt,
                      lastOkAt: mcpStatus.lastOkAt,
                      consecutiveFailures: mcpStatus.consecutiveFailures,
                      lastError: mcpStatus.lastError,
                      debug: mcpStatus.debug
                    };
                    void navigator.clipboard?.writeText(JSON.stringify(snap, null, 2));
                  }}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  Copy Diagnostics
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-300">
                <div>process_alive={String(mcpStatus.processAlive)}</div>
                <div>initialized={String(mcpStatus.initialized)}</div>
                <div>framing={String(mcpStatus.framing ?? "")}</div>
                <div>last_start={mcpStatus.lastStartAt ? new Date(mcpStatus.lastStartAt).toISOString() : ""}</div>
                <div>last_ok={mcpStatus.lastOkAt ? new Date(mcpStatus.lastOkAt).toISOString() : ""}</div>
                <div>failures={String(mcpStatus.consecutiveFailures)}</div>
              </div>
              {mcpStatus.lastError && (
                <div className="mt-2 text-[10px] font-mono text-red-300 whitespace-pre-wrap break-words">{mcpStatus.lastError}</div>
              )}
            </div>
          )}
          {showTrace && (
            <div className="mt-3 border border-zinc-800 rounded bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-xs font-mono text-zinc-400">MCP Trace</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTraceText(buildTraceText())}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(traceText)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                className="w-full h-56 bg-zinc-950 border border-zinc-800 rounded p-3 text-zinc-200 text-xs font-mono focus:border-blue-500 outline-none"
                value={traceText}
                readOnly
              />
              {stderrTail && (
                <div className="mt-2 text-[10px] text-red-300 font-mono">
                  stderr_tail={String(stderrTail).slice(-220)}
                </div>
              )}
            </div>
          )}
          {showConfig && (
            <div className="mt-4 border border-zinc-800 rounded bg-zinc-950/40 p-3 space-y-2">
              {!isTauri ? (
                <div className="text-xs text-zinc-400">MCP config editing requires the desktop app (Tauri).</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-mono text-zinc-500">mcp.config.json (AppLocalData)</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void autoDetectTaqwinConfig()}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                      >
                        Auto-detect
                      </button>
                      <button
                        onClick={() => {
                          void (async () => {
                            setConfigError("");
                            try {
                              const cfg = parseMcpHostConfigJson(configText);
                              const normalized: any = { schema_version: "1", servers: {} as Record<string, any> };
                              for (const [name, server] of Object.entries(cfg.servers)) {
                                const next = normalizeTaqwinMcpServer(server);
                                normalized.servers[name] = {
                                  command: next.command,
                                  args: next.args,
                                  env: next.env,
                                  working_directory: next.cwd,
                                  enabled: next.enabled ?? true,
                                  tags: next.tags
                                };
                              }
                              setConfigText(JSON.stringify(normalized, null, 2));
                            } catch (e: any) {
                              setConfigError(String(e?.message ?? e));
                            }
                          })();
                        }}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                      >
                        Auto-fix
                      </button>
                      <button
                        onClick={() => {
                          void (async () => {
                            setConfigError("");
                            try {
                              const res = await mcpHostConfigService.save(configText);
                              setConfigIssues(res.issues);
                              await taqwinMcpService.stop();
                            } catch (e: any) {
                              setConfigError(String(e?.message ?? e));
                            }
                          })();
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                    placeholder={`{\n  \"schema_version\": \"1\",\n  \"servers\": {\n    \"taqwin\": {\n      \"command\": \"C:\\\\path\\\\to\\\\python.exe\",\n      \"args\": [\"-u\", \"C:\\\\path\\\\to\\\\TAQWIN_V1\\\\main.py\"],\n      \"working_directory\": \"C:\\\\path\\\\to\\\\TAQWIN_V1\",\n      \"env\": {\"PYTHONUNBUFFERED\": \"1\"},\n      \"enabled\": true\n    }\n  }\n}`}
                    className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-300 text-xs font-mono focus:border-blue-500 outline-none"
                  />
                  {configError && <div className="text-xs text-red-300">{configError}</div>}
                  {Object.keys(configIssues).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(configIssues).map(([name, issues]) => (
                        <div key={name} className="text-[10px] font-mono">
                          <div className="text-zinc-400">{name}</div>
                          {issues.length === 0 ? (
                            <div className="text-green-300">ok</div>
                          ) : (
                            issues.map((iss, idx) => (
                              <div key={`${name}-${idx}`} className={iss.level === "error" ? "text-red-300" : "text-yellow-300"}>
                                {iss.level}: {iss.message}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {selfTest && (
            <div className="mt-3 border border-zinc-800 rounded bg-zinc-950/40 p-3 space-y-2">
              <div className="text-xs font-mono text-zinc-500">mcp self-test</div>
              <div className={selfTest.ok ? "text-xs text-green-300" : "text-xs text-red-300"}>
                {selfTest.ok ? "PASS" : "FAIL"} {typeof selfTest.durationMs === "number" ? `(${selfTest.durationMs}ms)` : ""}
              </div>
              {Array.isArray(selfTest.steps) && (
                <div className="text-[10px] font-mono space-y-1">
                  {selfTest.steps.map((s: any, idx: number) => (
                    <div key={idx} className={s.ok ? "text-zinc-300" : "text-red-300"}>
                      {s.ok ? "ok" : "fail"} {s.step}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            {loadingTools ? (
                <div className="p-3 text-xs text-zinc-500">Loading tools...</div>
              ) : tools.length === 0 ? (
                <div className="p-3 space-y-2">
                  <div className="text-xs text-zinc-500">
                    {mcpStatus.state === "READY" && (mcpStatus as any).toolsPending
                      ? "TAQWIN MCP is ready, but tools are still pending. Click Refresh Tools or open MCP Logs."
                      : (mcpStatus as any).capabilityTrust === "failed"
                        ? "Tools failed to load. Open MCP Logs, fix the issue, then refresh tools."
                        : "No tools loaded."}
                  </div>
                  {error && <div className="text-xs text-red-300">{error}</div>}
                  {stderrTail && (
                    <div className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-words">
                      {String(stderrTail)}
                    </div>
                  )}
                  {errorRaw && (
                    <div className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-words">
                      {errorRaw}
                    </div>
                  )}
                </div>
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
                  <div className="text-sm font-mono text-zinc-200">{selectedTool || "Select a tool"}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {selectedDef?.description ?? (selectedTool ? "No description." : "Pick a tool from the registry to see details.")}
                  </div>
                </div>
                <button
                  onClick={() => void runTool()}
                  disabled={busy || !selectedTool}
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
              {error && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-red-300">{error}</div>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }))}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    Open MCP Logs
                  </button>
                </div>
              )}
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
