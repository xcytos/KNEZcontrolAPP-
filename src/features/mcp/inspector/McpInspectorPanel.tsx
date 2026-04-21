import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMcpInspector } from "./useMcpInspector";
import type { McpTrafficEvent } from "../../../mcp/inspector/McpTraffic";
import { mcpOrchestrator } from "../../../mcp/McpOrchestrator";

type LogTab = "lifecycle" | "tool_exec" | "traffic" | "stdout" | "stderr" | "parse" | "app_logs" | "errors";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

function asText(evt: McpTrafficEvent): string {
  if (evt.kind === "raw_stdout") return evt.text;
  if (evt.kind === "raw_stderr") return evt.text;
  if (evt.kind === "parse_error") return `${evt.detail}\n${evt.preview}`;
  if (evt.kind === "request") return JSON.stringify(evt.json, null, 2);
  if (evt.kind === "response") return JSON.stringify(evt.json, null, 2);
  if (evt.kind === "unsolicited") return JSON.stringify(evt.json, null, 2);
  if (evt.kind === "process_closed") return `[process_closed] code=${String(evt.code)}`;
  if (evt.kind === "spawn_error") return `[spawn_error] ${evt.message}`;
  return "";
}

export const McpInspectorPanel: React.FC = () => {
  const svc = useMcpInspector();
  const cfg = svc.getConfig();
  const servers = svc.getServers();
  const statusById = svc.getStatusById();
  const selectedId = svc.getSelectedId();
  const selected = selectedId ? statusById[selectedId] : null;
  const isTauri = isTauriRuntime();
  const knez = svc.getKnezHealth();
  const knezNeeded =
    !!selected &&
    (selected.id === "taqwin" ||
      (selected.type === "stdio" &&
        (!!(selected.env as any)?.TAQWIN_GOVERNANCE_SNAPSHOT_URL || !!(selected.env as any)?.KNEZ_ENDPOINT)));

  // Include runtime servers from mcpOrchestrator to show all servers, not just local config
  const runtimeServers = useMemo(() => {
    const runtimeById = mcpOrchestrator.getSnapshot().servers;
    const localServerIds = new Set(servers.map(s => s.id));
    const allServers = [...servers];
    
    for (const [id, runtime] of Object.entries(runtimeById)) {
      if (!localServerIds.has(id)) {
        const rt = runtime as any;
        // Add runtime server that's not in local config
        allServers.push({
          id,
          type: runtime.type as "stdio" | "http",
          enabled: runtime.enabled,
          command: rt.command,
          args: rt.args,
          cwd: rt.cwd,
          env: rt.env,
          url: rt.url,
          headers: rt.headers,
          tags: runtime.tags,
          start_on_boot: runtime.start_on_boot,
          allowed_tools: rt.allowed_tools,
          blocked_tools: rt.blocked_tools,
        } as any);
      }
    }
    
    return allServers.sort((a, b) => a.id.localeCompare(b.id));
  }, [servers]);

  // Combine status from both inspector service and mcpOrchestrator
  const allStatusById = useMemo(() => {
    const runtimeById = mcpOrchestrator.getSnapshot().servers;
    const combined = { ...statusById };
    
    for (const [id, runtime] of Object.entries(runtimeById)) {
      if (!combined[id]) {
        const rt = runtime as any;
        // Add status for runtime server that's not in inspector service
        combined[id] = {
          id,
          enabled: runtime.enabled,
          tags: runtime.tags,
          type: runtime.type as "stdio" | "http",
          command: rt.command,
          args: rt.args,
          cwd: rt.cwd,
          env: rt.env,
          url: rt.url,
          headers: rt.headers,
          state: runtime.state,
          pid: runtime.pid ?? null,
          running: runtime.running ?? false,
          framing: runtime.framing ?? "content-length",
          lastOkAt: runtime.lastOkAt ?? null,
          initializedAt: null,
          initializeDurationMs: null,
          toolsListDurationMs: null,
          lastError: runtime.lastError ?? null,
          toolsCached: runtime.tools?.length ?? 0,
          toolsCacheAt: runtime.toolsCacheAt ?? null,
          toolsPending: runtime.toolsPending ?? false,
          stdoutTail: null,
          stderrTail: null,
        };
      }
    }
    
    return combined;
  }, [statusById]);

  const [rawDraft, setRawDraft] = useState(cfg.raw);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolSearch, setToolSearch] = useState("");
  const [logTab, setLogTab] = useState<LogTab>("lifecycle");
  const [trafficLimit] = useState(300);
  const [checkingKnez, setCheckingKnez] = useState(false);
  const [toolsListTimeoutMs] = useState(60000);
  const [logSearch, setLogSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const logsSectionRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<HTMLTextAreaElement | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [addServerText, setAddServerText] = useState("");
  const [addServerError, setAddServerError] = useState<string>("");
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({});
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    void svc.loadConfig();
  }, []);

  useEffect(() => {
    setRawDraft(cfg.raw);
  }, [cfg.raw]);

  useEffect(() => {
    const onOpenConfig = () => {
      try {
        configRef.current?.focus();
        configRef.current?.scrollIntoView({ block: "center" });
      } catch {}
    };
    window.addEventListener("mcp-inspector-open-config", onOpenConfig);
    return () => window.removeEventListener("mcp-inspector-open-config", onOpenConfig);
  }, []);

  useEffect(() => {
    const onFocusLogs = () => {
      try {
        setLogTab("lifecycle");
        setTimeout(() => {
          logsSectionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 100);
      } catch {}
    };
    window.addEventListener("mcp-inspector-focus-logs", onFocusLogs);
    return () => window.removeEventListener("mcp-inspector-focus-logs", onFocusLogs);
  }, []);

  const tools = useMemo(() => {
    if (!selectedId) return [];
    const list = mcpOrchestrator.getServerTools(selectedId);
    const q = toolSearch.trim().toLowerCase();
    const filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q) || String(t.description ?? "").toLowerCase().includes(q)) : list;
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [selectedId, toolSearch, servers.length, Object.keys(statusById).join("|"), selected?.toolsCached]);

  useEffect(() => {
    if (!selectedId) return;
    const list = mcpOrchestrator.getServerTools(selectedId);
    if (!selectedTool || !list.some((t) => t.name === selectedTool)) {
      setSelectedTool(list[0]?.name ?? "");
    }
  }, [selectedId, tools.length]);

  // TODO: Implement server logs display when UI component is ready
  // useEffect(() => {
  //   if (logTab === "app_logs" && selectedId) {
  //     const logs = logger.getServerLogs(selectedId);
  //     setServerLogs(logs);
  //   }
  // }, [logTab, selectedId]);

  const traffic = useMemo(() => {
    if (!selectedId) return [];
    const all = svc.getTraffic(selectedId);
    const selectedKinds: McpTrafficEvent["kind"][] =
      logTab === "stdout"
        ? ["raw_stdout"]
        : logTab === "stderr"
          ? ["raw_stderr"]
          : logTab === "parse"
            ? ["parse_error"]
        : logTab === "errors"
          ? ["spawn_error", "parse_error", "process_closed"]
        : ["request", "response", "unsolicited", "process_closed", "spawn_error", "parse_error"];
    const filtered = all.filter((e) => selectedKinds.includes(e.kind));
    const q = logSearch.trim().toLowerCase();
    const searched = q ? filtered.filter((e) => asText(e).toLowerCase().includes(q)) : filtered;
    return searched.slice(Math.max(0, searched.length - trafficLimit));
  }, [selectedId, logTab, trafficLimit, logSearch, servers.length]);

  // D1: Structured logs with event types
  type LogEventType = "INFO" | "WARN" | "ERROR" | "TOOL_CALL" | "SYSTEM";
  type LogEntry = { at: number; level: "info" | "warn" | "error"; eventType: LogEventType; text: string; toolName?: string };

  const [logFilterEventType, setLogFilterEventType] = useState<LogEventType | "ALL">("ALL");

  const lifecycleLogs = useMemo(() => {
    if (!selectedId) return [];
    const all = svc.getTraffic(selectedId);
    const st = allStatusById[selectedId];
    const entries: LogEntry[] = [];
    let hasConnected = false;
    let toolNames: string[] = [];
    for (const evt of all) {
      if (evt.kind === "spawn_error") {
        entries.push({ at: evt.at, level: "error", eventType: "ERROR", text: `[${selectedId}] Spawn failed: ${evt.message}` });
      } else if (evt.kind === "process_closed") {
        entries.push({ at: evt.at, level: evt.code === 0 ? "info" : "error", eventType: "SYSTEM", text: `[${selectedId}] Process exited (code=${String(evt.code ?? "null")})` });
      } else if (evt.kind === "request" && (evt as any).method === "initialize") {
        if (!hasConnected) {
          const cmd = st?.command ? `${st.command} ${(st.args ?? []).join(" ")}`.trim() : selectedId;
          entries.push({ at: evt.at, level: "info", eventType: "SYSTEM", text: `[${selectedId}] Connecting: ${cmd}` });
        }
      } else if (evt.kind === "response" && !hasConnected) {
        const json = (evt as any).json;
        if (json?.result?.serverInfo || json?.result?.capabilities) {
          hasConnected = true;
          const pid = st?.pid ? ` PID=${st.pid}` : "";
          entries.push({ at: evt.at, level: "info", eventType: "SYSTEM", text: `[${selectedId}] Connected.${pid}` });
        }
      } else if (evt.kind === "request" && (evt as any).method === "tools/list") {
        entries.push({ at: evt.at, level: "info", eventType: "SYSTEM", text: `[${selectedId}] Listing tools...` });
      } else if (evt.kind === "response" && toolNames.length === 0) {
        const json = (evt as any).json;
        if (json?.result?.tools && Array.isArray(json.result.tools)) {
          toolNames = (json.result.tools as any[]).map((t: any) => String(t.name ?? "")).filter(Boolean);
          if (toolNames.length > 0) {
            entries.push({ at: evt.at, level: "info", eventType: "SYSTEM", text: `[${selectedId}] Got ${toolNames.length} tools: ${toolNames.join(", ")}` });
          }
        }
      } else if (evt.kind === "request" && (evt as any).method?.startsWith("tools/")) {
        const toolName = (evt as any).params?.name ?? "unknown";
        entries.push({ at: evt.at, level: "info", eventType: "TOOL_CALL", text: `[${selectedId}] Tool call: ${toolName}`, toolName });
      } else if (evt.kind === "response" && (evt as any).method?.startsWith("tools/")) {
        const toolName = (evt as any).params?.name ?? "unknown";
        entries.push({ at: evt.at, level: "info", eventType: "TOOL_CALL", text: `[${selectedId}] Tool response: ${toolName}`, toolName });
      } else if (evt.kind === "raw_stderr") {
        const text = evt.text.trim();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.message) {
              const level = String(parsed.level ?? "INFO").toLowerCase();
              entries.push({ at: evt.at, level: level === "warning" || level === "warn" ? "warn" : level === "error" ? "error" : "info", eventType: "INFO", text: `[${selectedId}] [${parsed.logger ?? "server"}] ${parsed.message}` });
            }
          } catch {
            entries.push({ at: evt.at, level: "info", eventType: "INFO", text: `[${selectedId}] ${text}` });
          }
        }
      }
    }
    if (st?.lastError && entries.length === 0) {
      entries.push({ at: Date.now(), level: "error", eventType: "ERROR", text: st.lastError });
    }
    
    // D2: Filter by event type
    let filtered = entries;
    if (logFilterEventType !== "ALL") {
      filtered = entries.filter(e => e.eventType === logFilterEventType);
    }
    
    // D3: Search filter
    const q = logSearch.trim().toLowerCase();
    const searched = q ? filtered.filter((e) => e.text.toLowerCase().includes(q)) : filtered;
    return searched.slice(Math.max(0, searched.length - trafficLimit));
  }, [selectedId, logTab, trafficLimit, logSearch, servers.length, allStatusById, logFilterEventType]);

  // H1/H2: Group tool calls into execution blocks with multi-step session grouping
  const toolExecutions = useMemo(() => {
    if (!selectedId) return [];
    const all = svc.getTraffic(selectedId);
    const toolCalls: { request: McpTrafficEvent; response?: McpTrafficEvent; toolName: string; status: "pending" | "success" | "error"; duration?: number; sessionId: string }[] = [];
    
    const requests = all.filter(e => e.kind === "request" && (e as any).method?.startsWith("tools/"));
    const responses = all.filter(e => e.kind === "response" && (e as any).method?.startsWith("tools/"));
    
    // Group into sessions (sequential calls within 30 seconds)
    let currentSessionId = 0;
    let lastTimestamp = 0;
    
    for (const req of requests) {
      const method = (req as any).method;
      const response = responses.find(r => (r as any).method === method && r.at > req.at && r.at < req.at + 60000);
      const toolName = (req as any).params?.name ?? "unknown";
      
      // Create session ID based on timing
      if (req.at - lastTimestamp > 30000) {
        currentSessionId++;
      }
      lastTimestamp = req.at;
      const sessionId = `session-${currentSessionId}`;
      
      if (response) {
        const json = (response as any).json;
        const isError = json?.error !== undefined;
        toolCalls.push({
          request: req,
          response,
          toolName,
          status: isError ? "error" : "success",
          duration: response.at - req.at,
          sessionId
        });
      } else {
        toolCalls.push({
          request: req,
          toolName,
          status: "pending",
          sessionId
        });
      }
    }
    
    // Group by session for multi-step view
    const sessions = new Map<string, typeof toolCalls>();
    toolCalls.forEach(call => {
      if (!sessions.has(call.sessionId)) {
        sessions.set(call.sessionId, []);
      }
      sessions.get(call.sessionId)!.push(call);
    });
    
    return Array.from(sessions.entries()).map(([sessionId, calls]) => ({
      sessionId,
      calls,
      status: calls.every(c => c.status === "success") ? "success" : calls.some(c => c.status === "error") ? "error" : "pending",
      totalDuration: calls.reduce((sum, c) => sum + (c.duration ?? 0), 0)
    })).slice(Math.max(0, Math.min(10, toolCalls.length)));
  }, [selectedId, trafficLimit]);

  // C1: Tool usage metrics
  const toolMetrics = useMemo(() => {
    if (!selectedId) return new Map<string, { count: number; lastUsed: number; errorCount: number }>();
    const all = svc.getTraffic(selectedId);
    const metrics = new Map<string, { count: number; lastUsed: number; errorCount: number }>();
    
    const requests = all.filter(e => e.kind === "request" && (e as any).method?.startsWith("tools/"));
    const responses = all.filter(e => e.kind === "response" && (e as any).method?.startsWith("tools/"));
    
    for (const req of requests) {
      const toolName = (req as any).params?.name;
      if (!toolName) continue;
      
      const response = responses.find(r => (r as any).method === (req as any).method && r.at > req.at && r.at < req.at + 60000);
      const isError = response && (response as any).json?.error !== undefined;
      
      const existing = metrics.get(toolName) ?? { count: 0, lastUsed: 0, errorCount: 0 };
      metrics.set(toolName, {
        count: existing.count + 1,
        lastUsed: Math.max(existing.lastUsed, req.at),
        errorCount: existing.errorCount + (isError ? 1 : 0)
      });
    }
    
    return metrics;
  }, [selectedId]);

  // E1: Lifecycle timeline extraction
  const lifecycleTimeline = useMemo(() => {
    if (!selectedId) return [];
    const all = svc.getTraffic(selectedId);
    const timeline: { state: string; at: number; duration?: number }[] = [];
    
    // Extract key lifecycle events
    for (const evt of all) {
      if (evt.kind === "spawn_error") {
        timeline.push({ state: "ERROR", at: evt.at });
      } else if (evt.kind === "process_closed") {
        timeline.push({ state: "CLOSED", at: evt.at });
      } else if (evt.kind === "request" && (evt as any).method === "initialize") {
        timeline.push({ state: "START", at: evt.at });
      } else if (evt.kind === "response" && (evt as any).json?.result?.serverInfo) {
        timeline.push({ state: "READY", at: evt.at });
      } else if (evt.kind === "request" && (evt as any).method === "tools/list") {
        timeline.push({ state: "LOADING_TOOLS", at: evt.at });
      } else if (evt.kind === "response" && (evt as any).json?.result?.tools) {
        timeline.push({ state: "TOOLS_LOADED", at: evt.at });
      }
    }
    
    // Calculate durations between states
    for (let i = 0; i < timeline.length - 1; i++) {
      timeline[i].duration = timeline[i + 1].at - timeline[i].at;
    }
    
    return timeline.slice(-20); // Show last 20 events
  }, [selectedId]);

  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = logsRef.current;
    if (!el) return;
    try {
      el.scrollTop = el.scrollHeight;
    } catch {}
  }, [autoScroll, traffic.length, logTab, expandedLogId]);

  const getStateBadgeColor = (state: string): string => {
    switch (state) {
      case "IDLE": return "bg-zinc-700 text-zinc-200";
      case "STARTING": return "bg-yellow-700 text-yellow-100";
      case "INITIALIZED": return "bg-blue-700 text-blue-100";
      case "LISTING_TOOLS": return "bg-purple-700 text-purple-100";
      case "READY": return "bg-green-700 text-green-100";
      case "ERROR": return "bg-red-700 text-red-100";
      default: return "bg-zinc-700 text-zinc-200";
    }
  };

  const mergeServerConfigIntoDraft = (draftRaw: string, insertRaw: string): string => {
    const parsedDraft = JSON.parse(draftRaw);
    const insert = JSON.parse(insertRaw);
    const hasServers = insert && typeof insert === "object" && !Array.isArray(insert) && ((insert as any).servers || (insert as any).mcpServers);
    if (hasServers) {
      const next = insert as any;
      if (!next.schema_version) next.schema_version = "1";
      if (!Array.isArray(next.inputs)) next.inputs = [];
      
      // Merge servers instead of replacing
      const insertServers = next.servers || next.mcpServers || {};
      const draftObj: any = parsedDraft && typeof parsedDraft === "object" && !Array.isArray(parsedDraft) ? parsedDraft : { schema_version: "1", mcpServers: {} };
      if (!draftObj.schema_version) draftObj.schema_version = "1";
      if (!draftObj.mcpServers && draftObj.servers) {
        draftObj.mcpServers = draftObj.servers;
        delete draftObj.servers;
      }
      if (!draftObj.mcpServers || typeof draftObj.mcpServers !== "object" || Array.isArray(draftObj.mcpServers)) {
        draftObj.mcpServers = {};
      }
      if (!Array.isArray(draftObj.inputs)) draftObj.inputs = [];
      
      // Merge inputs
      if (Array.isArray(next.inputs)) {
        const inputMap = new Map<string, any>();
        for (const it of draftObj.inputs) {
          if (it?.id) inputMap.set(it.id, it);
        }
        for (const it of next.inputs) {
          if (it?.id) inputMap.set(it.id, it);
        }
        draftObj.inputs = Array.from(inputMap.values());
      }
      
      // Merge servers
      for (const [key, val] of Object.entries(insertServers)) {
        if (key && val && typeof val === "object" && !Array.isArray(val)) {
          draftObj.mcpServers[key] = val;
        }
      }
      
      return JSON.stringify(draftObj, null, 2);
    }

    const draftObj: any = parsedDraft && typeof parsedDraft === "object" && !Array.isArray(parsedDraft) ? parsedDraft : { schema_version: "1", mcpServers: {} };
    if (!draftObj.schema_version) draftObj.schema_version = "1";
    if (!draftObj.mcpServers && draftObj.servers) {
      draftObj.mcpServers = draftObj.servers;
      delete draftObj.servers;
    }
    if (!draftObj.mcpServers || typeof draftObj.mcpServers !== "object" || Array.isArray(draftObj.mcpServers)) {
      draftObj.mcpServers = {};
    }
    if (!Array.isArray(draftObj.inputs)) draftObj.inputs = [];

    if (insert && typeof insert === "object" && !Array.isArray(insert) && typeof (insert as any).id === "string" && (insert as any).id.trim()) {
      const id = String((insert as any).id).trim();
      const entry = { ...(insert as any) };
      delete entry.id;
      draftObj.mcpServers[id] = entry;
      return JSON.stringify(draftObj, null, 2);
    }

    if (insert && typeof insert === "object" && !Array.isArray(insert)) {
      const keys = Object.keys(insert);
      const looksLikeServerEntry =
        typeof (insert as any).command === "string" ||
        typeof (insert as any).url === "string" ||
        typeof (insert as any).type === "string";
      if (!looksLikeServerEntry && keys.length > 0) {
        for (const k of keys) {
          if (!k) continue;
          const v = (insert as any)[k];
          if (!v || typeof v !== "object" || Array.isArray(v)) continue;
          draftObj.mcpServers[k] = v;
        }
        return JSON.stringify(draftObj, null, 2);
      }
    }

    throw new Error("add_server_invalid_json");
  };

  const githubRemoteTemplate = () =>
    JSON.stringify(
      {
        mcpServers: {
          github_remote: {
            type: "http",
            url: "https://api.githubcopilot.com/mcp/",
            headers: {
              Authorization: "Bearer ${input:github_mcp_pat}",
              "X-MCP-Toolsets": "repos,issues,pull_requests",
              "X-MCP-Readonly": "true"
            },
            enabled: true,
            tags: ["github", "mcp", "remote"]
          }
        }
      },
      null,
      2
    );

  const githubLocalTemplate = () =>
    JSON.stringify(
      {
        id: "github_local",
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_READ_ONLY", "ghcr.io/github/github-mcp-server"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_mcp_pat}", GITHUB_READ_ONLY: "1" },
        enabled: true,
        tags: ["github", "mcp", "local", "docker"]
      },
      null,
      2
    );

  // B1: Layout restructure state - tab for right panel
  const [rightTab, setRightTab] = useState<"tools" | "logs" | "config">("tools");

  return (
    <div className="p-4">
      {!isTauri && (
        <div className="mb-3 border border-yellow-900/40 bg-yellow-900/10 rounded p-2 text-yellow-200 text-sm">
          Inspector actions require the desktop app (Tauri). You can still edit config and view stored state.
        </div>
      )}
      {knezNeeded && (
        <div className="mb-3 border border-zinc-800 bg-zinc-950 rounded p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-300">
              <span className="font-semibold">KNEZ</span>{" "}
              <span className="text-zinc-400">{knez.endpoint}</span>{" "}
              <span className={`ml-2 ${knez.ok === true ? "text-emerald-300" : knez.ok === false ? "text-red-300" : "text-zinc-500"}`}>
                {knez.ok === true ? "healthy" : knez.ok === false ? "unreachable" : "unknown"}
              </span>
            </div>
            <button
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
              disabled={checkingKnez}
              onClick={() => {
                setCheckingKnez(true);
                void svc.refreshKnezHealth().finally(() => setCheckingKnez(false));
              }}
            >
              {checkingKnez ? "Checking…" : "Check"}
            </button>
          </div>
          {knez.ok === false && knez.error && (
            <div className="mt-2 text-[11px] text-red-300 whitespace-pre-wrap break-words">{knez.error}</div>
          )}
        </div>
      )}

      {/* B1: Restructured layout - LEFT (server list), CENTER (status+ops), RIGHT (tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT: Server list */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-400 mb-2 flex items-center justify-between gap-2">
            <div className="font-semibold text-zinc-200">Servers</div>
            <button
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              onClick={() => {
                setAddServerError("");
                setShowAddServer(true);
                if (!addServerText.trim()) setAddServerText(githubRemoteTemplate());
              }}
            >
              +
            </button>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-auto pr-1">
            {runtimeServers.map((s) => {
              const st = allStatusById[s.id];
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => svc.setSelectedId(s.id)}
                  className={`w-full text-left rounded border px-2 py-2 transition-colors ${
                    active ? "border-blue-700 bg-blue-900/20" : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[11px] text-zinc-200 truncate">{s.id}</div>
                    <div
                      className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${getStateBadgeColor(st?.state ?? "IDLE")}`}
                      title={st?.lastError ? `Error: ${st.lastError}` : `State: ${st?.state ?? "IDLE"}`}
                    >
                      {st?.state ?? "IDLE"}
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{s.type === "http" ? s.url : s.command}</div>
                </button>
              );
            })}
            {runtimeServers.length === 0 && <div className="text-xs text-zinc-500">No servers configured.</div>}
          </div>
        </div>

        {/* CENTER: Status + Operations */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          {!selectedId || !selected ? (
            <div className="text-sm text-zinc-500">Select a server.</div>
          ) : (
            <>
              {/* B2: Server Status Block */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-zinc-200">{selectedId}</div>
                  <div
                    className={`text-[10px] px-2 py-0.5 rounded ${getStateBadgeColor(selected?.state ?? "IDLE")}`}
                  >
                    {selected?.state ?? "IDLE"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Type: <span className="text-zinc-200">{selected.type}</span></div>
                  <div>Tools: <span className="text-zinc-200">{selected.toolsCached}</span></div>
                  {selected.lastOkAt && (
                    <div>Last OK: <span className="text-zinc-200">{new Date(selected.lastOkAt).toLocaleTimeString()}</span></div>
                  )}
                  {selected.initializeDurationMs && (
                    <div>Init: <span className="text-zinc-200">{selected.initializeDurationMs}ms</span></div>
                  )}
                </div>
                
                {/* K1: Server Down State */}
                {(selected.state === "ERROR" || selected.lastError) && (
                  <div className="mt-3 border border-red-900/50 bg-red-900/10 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-red-300 font-semibold">Server Disconnected</div>
                      <button
                        className="text-[10px] px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                        disabled={selected.type === "stdio" ? !isTauri : false}
                        onClick={() => {
                          void svc.restart(selectedId).catch(() => {});
                          setRightTab("logs");
                          setLogTab("lifecycle");
                        }}
                      >
                        Retry
                      </button>
                    </div>
                    {selected.lastError && (
                      <div className="text-[10px] text-red-200 whitespace-pre-wrap break-words">{selected.lastError}</div>
                    )}
                  </div>
                )}
                
                {selected.lastError && !selected.state && (
                  <div className="mt-2 border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                    {selected.lastError}
                  </div>
                )}
              </div>

              {/* B3: Operations Block - only Start/Stop/Restart */}
              <div className="mb-4">
                <div className="text-xs text-zinc-400 mb-2">Operations</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                    disabled={selected.type === "stdio" ? !isTauri : false}
                    onClick={() => {
                      void svc.handshake(selectedId, { toolsListTimeoutMs }).catch(() => {});
                      setRightTab("logs");
                      setLogTab("lifecycle");
                    }}
                  >
                    Start
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                    disabled={selected.type === "stdio" ? !isTauri : false}
                    onClick={() => {
                      void svc.stop(selectedId).catch(() => {});
                    }}
                  >
                    Stop
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                    disabled={selected.type === "stdio" ? !isTauri : false}
                    onClick={() => {
                      void svc.restart(selectedId).catch(() => {});
                      setRightTab("logs");
                      setLogTab("lifecycle");
                    }}
                  >
                    Restart
                  </button>
                </div>
              </div>

              {/* B4: Advanced Details Collapsible */}
              <details className="mb-4">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">Advanced Details</summary>
                <div className="mt-2 text-[11px] text-zinc-400 font-mono space-y-1 pl-2 border-l-2 border-zinc-800">
                  <div>pid={String(selected?.pid ?? "null")}</div>
                  <div>framing={selected?.framing ?? "content-length"}</div>
                  <div>running={String(selected.running)}</div>
                  <div>enabled={String(selected.enabled)}</div>
                  {selected.type === "http" ? (
                    <div className="break-all">url={selected.url ?? ""}</div>
                  ) : (
                    <>
                      <div className="break-all">command={selected.command ?? ""}</div>
                      <div className="break-all">cwd={selected.cwd ?? ""}</div>
                    </>
                  )}
                  {selected.toolsCacheAt !== null && (
                    <div>tools_cache_age_s={Math.max(0, Math.round((Date.now() - selected.toolsCacheAt) / 1000))}</div>
                  )}
                  {selected.toolsListDurationMs !== null && <div>tools_list_ms={selected.toolsListDurationMs}</div>}
                </div>
              </details>

              {/* Inputs Vault */}
              {(() => {
                const required = svc.getRequiredInputsForServer(selectedId);
                if (!required.length) return null;
                const resolved = new Set(svc.getResolvedInputIds());
                const metaById = new Map((svc.getInputs() ?? []).map((m: any) => [String(m.id), m]));
                return (
                  <details className="mb-4">
                    <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">Inputs Vault</summary>
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-zinc-400">
                          <button
                            className="text-zinc-400 hover:text-zinc-200"
                            onClick={() => {
                              svc.clearAllInputValues();
                              setInputDrafts({});
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      {required.map((id) => {
                        const meta: any = metaById.get(id) ?? null;
                        const isSet = resolved.has(id);
                        const draft = inputDrafts[id] ?? "";
                        const label = meta?.description ? `${id} (${meta.description})` : id;
                        return (
                          <div key={id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <div className={`text-[11px] font-mono ${isSet ? "text-emerald-300" : "text-yellow-200"}`}>{label}</div>
                            <input
                              value={draft}
                              onChange={(e) => setInputDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                              placeholder={isSet ? "set" : "required"}
                              type={meta?.password ? "password" : "text"}
                              className="md:col-span-1 text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-full"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                                onClick={() => {
                                  svc.setInputValue(id, draft);
                                  setInputDrafts((prev) => ({ ...prev, [id]: "" }));
                                }}
                              >
                                Set
                              </button>
                              <button
                                className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                                onClick={() => {
                                  svc.clearInputValue(id);
                                  setInputDrafts((prev) => ({ ...prev, [id]: "" }));
                                }}
                              >
                                Unset
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })()}

              {/* Crash History */}
              <details>
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">Crash History</summary>
                <div className="mt-2 space-y-1 max-h-32 overflow-auto pl-2 border-l-2 border-zinc-800">
                  {(() => {
                    const crashHistory = mcpOrchestrator.getCrashHistory(selectedId);
                    if (crashHistory.length === 0) {
                      return <div className="text-xs text-zinc-500">No crashes recorded.</div>;
                    }
                    return crashHistory.map((crash, idx) => (
                      <div key={idx} className="text-[11px] text-zinc-400">
                        <span className="text-zinc-500">{new Date(crash.timestamp).toLocaleTimeString()}</span>
                        <span className="ml-2 text-red-400">{crash.reason}</span>
                      </div>
                    ));
                  })()}
                </div>
              </details>
            </>
          )}
        </div>

        {/* RIGHT: Tabs (tools, logs, config) */}
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setRightTab("tools")}
              className={`text-xs px-2 py-1 rounded ${rightTab === "tools" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Tools
            </button>
            <button
              onClick={() => setRightTab("logs")}
              className={`text-xs px-2 py-1 rounded ${rightTab === "logs" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Logs
            </button>
            <button
              onClick={() => setRightTab("config")}
              className={`text-xs px-2 py-1 rounded ${rightTab === "config" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Config
            </button>
          </div>

          {rightTab === "tools" && (
            <div className="border border-zinc-800 rounded p-2 bg-zinc-950">
              {/* I1: Collapsible tools list */}
              <details open>
                <summary className="text-xs text-zinc-300 font-semibold cursor-pointer hover:text-zinc-200 mb-2 flex items-center justify-between">
                  <span>Tools ({tools.length})</span>
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="search…"
                    className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[140px]"
                  />
                </div>
                <div className="mt-2 max-h-[calc(100vh-420px)] overflow-auto pr-1 space-y-1">
                  {tools.map((t) => {
                    const metrics = toolMetrics.get(t.name);
                    const errorRate = metrics && metrics.count > 0 ? Math.round((metrics.errorCount / metrics.count) * 100) : 0;
                    return (
                      <button
                        key={t.name}
                        className={`w-full text-left px-2 py-1.5 rounded border text-[11px] font-mono ${
                          selectedTool === t.name ? "border-blue-700 bg-blue-900/20 text-zinc-100" : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                        }`}
                        onClick={() => {
                          setSelectedTool(t.name);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{t.name}</span>
                          {metrics && (
                            <div className="flex items-center gap-2 text-[9px] text-zinc-500 shrink-0 ml-2">
                              <span title={`Used ${metrics.count} times`}>{metrics.count}x</span>
                              {errorRate > 0 && <span className="text-red-400" title={`${errorRate}% error rate`}>{errorRate}% err</span>}
                            </div>
                          )}
                        </div>
                        {metrics && metrics.lastUsed > 0 && (
                          <div className="text-[9px] text-zinc-600 mt-0.5">Last: {formatTime(metrics.lastUsed)}</div>
                        )}
                      </button>
                    );
                  })}
                  {tools.length === 0 && <div className="text-xs text-zinc-500">No tools cached. Start the server to load tools.</div>}
                </div>
              </details>
              
              {/* I1: Collapsible tool detail view */}
              {selectedTool && (
                <details className="mt-3 border-t border-zinc-800 pt-3" open>
                  <summary className="text-xs text-zinc-300 font-semibold cursor-pointer hover:text-zinc-200 mb-2">Tool Details</summary>
                  {(() => {
                    const tool = tools.find(t => t.name === selectedTool);
                    const metrics = toolMetrics.get(selectedTool);
                    if (!tool) return <div className="text-xs text-zinc-500">Tool not found.</div>;
                    return (
                      <div className="space-y-2">
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">NAME</div>
                          <div className="text-[11px] font-mono text-zinc-200">{tool.name}</div>
                        </div>
                        {tool.description && (
                          <div>
                            <div className="text-[10px] text-zinc-500 mb-1">DESCRIPTION</div>
                            <div className="text-[10px] text-zinc-400">{tool.description}</div>
                          </div>
                        )}
                        {metrics && metrics.count > 0 && (
                          <div>
                            <div className="text-[10px] text-zinc-500 mb-1">LAST EXECUTION</div>
                            <div className="text-[10px] text-zinc-400">{formatTime(metrics.lastUsed)}</div>
                            <div className="text-[10px] text-zinc-500">{metrics.count} total calls</div>
                          </div>
                        )}
                        {tool.inputSchema && (
                          <details className="group">
                            <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300">Input Schema</summary>
                            <pre className="mt-1 text-[9px] font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-auto max-h-[200px]">
                              {JSON.stringify(tool.inputSchema, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                </details>
              )}
            </div>
          )}

          {rightTab === "logs" && (
            <div ref={logsSectionRef} className="border border-zinc-800 rounded p-2 bg-zinc-950">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button onClick={() => setLogTab("lifecycle")} className={`text-xs px-2 py-1 rounded ${logTab === "lifecycle" ? "bg-emerald-800 text-white" : "text-zinc-400 hover:text-white"}`}>Lifecycle</button>
                <button onClick={() => setLogTab("tool_exec")} className={`text-xs px-2 py-1 rounded ${logTab === "tool_exec" ? "bg-blue-800 text-white" : "text-zinc-400 hover:text-white"}`}>Tool Exec</button>
                <button onClick={() => setLogTab("traffic")} className={`text-xs px-2 py-1 rounded ${logTab === "traffic" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Traffic</button>
                <button onClick={() => setLogTab("stdout")} className={`text-xs px-2 py-1 rounded ${logTab === "stdout" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Stdout</button>
                <button onClick={() => setLogTab("stderr")} className={`text-xs px-2 py-1 rounded ${logTab === "stderr" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Stderr</button>
                <button onClick={() => setLogTab("errors")} className={`text-xs px-2 py-1 rounded ${logTab === "errors" ? "bg-red-800 text-white" : "text-zinc-400 hover:text-white"}`}>Errors{traffic.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-600 rounded-full text-[10px]">{traffic.length}</span>}</button>
                {logTab === "lifecycle" && (
                  <select
                    value={logFilterEventType}
                    onChange={(e) => setLogFilterEventType(e.target.value as LogEventType | "ALL")}
                    className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                  >
                    <option value="ALL">All Events</option>
                    <option value="INFO">Info</option>
                    <option value="WARN">Warn</option>
                    <option value="ERROR">Error</option>
                    <option value="TOOL_CALL">Tool Calls</option>
                    <option value="SYSTEM">System</option>
                  </select>
                )}
                <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => {
                      setDebugMode(e.target.checked);
                      if (selectedId) {
                        const session = (svc as any).sessions?.get(selectedId);
                        if (session?.client?.setDebugMode) {
                          session.client.setDebugMode(e.target.checked);
                        }
                      }
                    }}
                    className="w-3 h-3"
                  />
                  Debug
                </label>
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="search…"
                  className="ml-1 text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[100px]"
                />
                <button
                  onClick={() => setAutoScroll((v) => !v)}
                  className={`text-xs px-2 py-1 rounded ${autoScroll ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                  title="Auto-scroll logs"
                >
                  Auto
                </button>
              </div>
              <div ref={logsRef} className="max-h-[calc(100vh-420px)] overflow-auto pr-1">
                {logTab === "lifecycle" ? (
                  <>
                    {/* E1: Lifecycle Timeline */}
                    {lifecycleTimeline.length > 0 && (
                      <div className="mb-4 border border-zinc-800 rounded p-2 bg-zinc-950">
                        <div className="text-xs text-zinc-300 font-semibold mb-2">Lifecycle Timeline</div>
                        <div className="flex items-center gap-1 overflow-x-auto pb-2">
                          {lifecycleTimeline.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1 shrink-0">
                              <div className={`px-2 py-1 rounded text-[9px] font-mono ${
                                step.state === "ERROR" ? "bg-red-900/30 text-red-300" :
                                step.state === "CLOSED" ? "bg-zinc-800 text-zinc-400" :
                                "bg-blue-900/30 text-blue-300"
                              }`}>
                                {step.state}
                              </div>
                              {step.duration !== undefined && (
                                <span className="text-[8px] text-zinc-500">{step.duration}ms</span>
                              )}
                              {idx < lifecycleTimeline.length - 1 && (
                                <div className="w-2 h-0.5 bg-zinc-700" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      {lifecycleLogs.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] font-mono">
                          <span className="text-zinc-600 shrink-0">{formatTime(entry.at)}</span>
                          <span className={entry.level === "error" ? "text-red-300" : entry.level === "warn" ? "text-yellow-300" : "text-emerald-300"}>
                            {entry.level === "error" ? "✗" : entry.level === "warn" ? "⚠" : "✓"}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] shrink-0 ${
                            entry.eventType === "ERROR" ? "bg-red-900/30 text-red-300" :
                            entry.eventType === "WARN" ? "bg-yellow-900/30 text-yellow-300" :
                            entry.eventType === "TOOL_CALL" ? "bg-blue-900/30 text-blue-300" :
                            entry.eventType === "SYSTEM" ? "bg-purple-900/30 text-purple-300" :
                            "bg-zinc-800 text-zinc-300"
                          }`}>
                            {entry.eventType}
                          </span>
                          <span className={entry.level === "error" ? "text-red-200" : entry.level === "warn" ? "text-yellow-200" : "text-zinc-200"}>
                            {entry.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : logTab === "tool_exec" ? (
                  toolExecutions.length === 0 ? (
                    <div className="text-xs text-zinc-500">No tool executions yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {toolExecutions.map((session, sessionIdx) => (
                        <div key={session.sessionId} className={`border rounded p-2 bg-zinc-950 ${
                          session.status === "error" ? "border-red-900/50" :
                          session.status === "success" ? "border-green-900/50" :
                          "border-zinc-800"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                session.status === "error" ? "bg-red-900/30 text-red-300" :
                                session.status === "success" ? "bg-green-900/30 text-green-300" :
                                "bg-yellow-900/30 text-yellow-300"
                              }`}>
                                {session.status}
                              </span>
                              <span className="text-[10px] text-zinc-400">{session.calls.length} steps</span>
                              <span className="text-[10px] text-zinc-400">{session.totalDuration}ms total</span>
                            </div>
                            <button 
                              onClick={() => setExpandedLogId(expandedLogId === sessionIdx ? null : sessionIdx)}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              {expandedLogId === sessionIdx ? "▼" : "▶"}
                            </button>
                          </div>
                          {/* H2: Multi-step progress visualization */}
                          <div className="flex items-center gap-1 mb-2">
                            {session.calls.map((call, callIdx) => (
                              <div key={callIdx} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  call.status === "success" ? "bg-green-500" :
                                  call.status === "error" ? "bg-red-500" :
                                  "bg-yellow-500"
                                }`} title={call.toolName} />
                                {callIdx < session.calls.length - 1 && (
                                  <div className={`w-4 h-0.5 ${
                                    call.status === "success" ? "bg-green-500" :
                                    "bg-zinc-700"
                                  }`} />
                                )}
                              </div>
                            ))}
                          </div>
                          {expandedLogId === sessionIdx && (
                            <div className="mt-2 space-y-2">
                              {session.calls.map((call, callIdx) => (
                                <div key={callIdx} className="border-l-2 border-zinc-800 pl-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${
                                      call.status === "success" ? "bg-green-500" :
                                      call.status === "error" ? "bg-red-500" :
                                      "bg-yellow-500"
                                    }`} />
                                    <span className="font-mono text-[10px] text-zinc-200">{call.toolName}</span>
                                    {call.duration !== undefined && <span className="text-[9px] text-zinc-500">{call.duration}ms</span>}
                                  </div>
                                  {call.status === "error" && call.response && (
                                    <div className="border border-red-900/40 bg-red-900/10 rounded p-2 mb-1">
                                      <div className="text-[9px] text-red-300 mb-1">ERROR</div>
                                      <pre className="text-[9px] font-mono text-red-200 whitespace-pre-wrap break-words">
                                        {JSON.stringify((call.response as any).json?.error, null, 2)}
                                      </pre>
                                      <button
                                        className="mt-2 text-[10px] px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white transition-colors"
                                        onClick={() => {
                                          const params = (call.request as any).params;
                                          if (selectedId && params) {
                                            void mcpOrchestrator.callTool(selectedId, params.name, params.arguments ?? {}).catch(() => {});
                                          }
                                        }}
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  )}
                                  <details className="group">
                                    <summary className="text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-300">Details</summary>
                                    <div className="mt-1 space-y-1">
                                      <div>
                                        <div className="text-[8px] text-zinc-600 mb-0.5">INPUT</div>
                                        <pre className="text-[8px] font-mono text-zinc-500 bg-zinc-900 rounded p-1 overflow-auto">
                                          {JSON.stringify((call.request as any).json, null, 2)}
                                        </pre>
                                      </div>
                                      {call.response && (
                                        <div>
                                          <div className="text-[8px] text-zinc-600 mb-0.5">OUTPUT</div>
                                          <pre className="text-[8px] font-mono text-zinc-500 bg-zinc-900 rounded p-1 overflow-auto">
                                            {JSON.stringify((call.response as any).json, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : traffic.length === 0 ? (
                  <div className="text-xs text-zinc-500">No events.</div>
                ) : (
                  <div className="space-y-2">
                    {traffic.map((evt, idx) => (
                      <div key={idx} className="border border-zinc-800 rounded p-2 bg-zinc-950">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setExpandedLogId(expandedLogId === idx ? null : idx)}
                              className="hover:text-zinc-300"
                              title="Toggle details"
                            >
                              ⠇
                            </button>
                            <span className={evt.kind.includes("error") ? "text-red-400 font-bold" : "text-zinc-400"}>
                              {evt.kind}
                            </span>
                            {(evt as any).id && <span className="font-mono text-zinc-600">#{(evt as any).id}</span>}
                          </div>
                          <div>{formatTime(evt.at)}</div>
                        </div>
                        <div className={`text-[10px] text-zinc-200 whitespace-pre-wrap break-words ${expandedLogId === idx ? "" : "max-h-[60px] overflow-hidden"}`}>
                           {asText(evt)}
                        </div>
                        {expandedLogId === idx && (evt as any).json && (
                          <div className="mt-2 pt-2 border-t border-zinc-800">
                            <div className="text-[9px] text-zinc-500 mb-1">RAW JSON PAYLOAD</div>
                            <pre className="text-[9px] font-mono text-zinc-400 overflow-auto">
                              {JSON.stringify((evt as any).json, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {rightTab === "config" && (
            <div className="border border-zinc-800 rounded p-2 bg-zinc-950">
              {/* I1: Collapsible config editor */}
              <details open>
                <summary className="text-xs text-zinc-300 font-semibold cursor-pointer hover:text-zinc-200 mb-2">MCP Config</summary>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                    onClick={() => {
                      setRawDraft(cfg.raw);
                      setSaveError("");
                    }}
                    disabled={saving}
                  >
                    Reset
                  </button>
                  <button
                    className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                    onClick={() => {
                      setSaveError("");
                      svc.applyConfig(rawDraft);
                    }}
                    disabled={saving}
                  >
                    Apply
                  </button>
                  <button
                    className="text-[10px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                    onClick={() => {
                      setSaving(true);
                      setSaveError("");
                      void (async () => {
                        try {
                          svc.applyConfig(rawDraft);
                          const nextCfg = svc.getConfig();
                          const hasErrors =
                            (nextCfg.issues ?? []).some((it) => it.level === "error") ||
                            Object.values(nextCfg.issuesByServerId ?? {}).some((list: any) => (list ?? []).some((it: any) => it?.level === "error"));
                          if (hasErrors) {
                            setSaveError("Fix config errors before saving.");
                            return;
                          }
                          await svc.saveConfig(rawDraft);
                          setSaveError("");
                        } catch (e: any) {
                          setSaveError(String(e?.message ?? e));
                        } finally {
                          setSaving(false);
                        }
                      })();
                    }}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
                <textarea
                  className="mt-2 w-full h-[calc(100vh-420px)] bg-zinc-950 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200"
                  value={rawDraft}
                  onChange={(e) => setRawDraft(e.target.value)}
                  spellCheck={false}
                  ref={configRef}
                />
                {saveError && (
                  <div className="mt-2 border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                    {saveError}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-zinc-500">
                  schema={cfg.normalized?.sourceSchema ?? "unknown"} servers={servers.length}
                </div>
                {(cfg.issues.length > 0 || Object.keys(cfg.issuesByServerId).some((k) => (cfg.issuesByServerId as any)[k]?.length)) && (
                  <details className="mt-2 border border-zinc-800 rounded p-2 bg-zinc-950">
                    <summary className="text-xs text-zinc-300 font-semibold cursor-pointer hover:text-zinc-200 mb-1">Issues</summary>
                    <div className="mt-1">
                      {cfg.issues.map((it, idx) => (
                        <div key={`g-${idx}`} className={`text-[11px] ${it.level === "error" ? "text-red-300" : "text-yellow-200"}`}>
                          {it.message}
                        </div>
                      ))}
                      {Object.entries(cfg.issuesByServerId).map(([sid, list]) =>
                        (list ?? []).length ? (
                          <div key={sid} className="mt-2">
                            <div className="text-[11px] text-zinc-400 mb-1">{sid}</div>
                            {(list ?? []).map((it, idx) => (
                              <div key={`${sid}-${idx}`} className={`text-[11px] ${it.level === "error" ? "text-red-300" : "text-yellow-200"}`}>
                                {it.field ? `${it.field}: ` : ""}{it.message}
                              </div>
                            ))}
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                )}
              </details>
            </div>
          )}
        </div>
      </div>

      {showAddServer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 p-3 border-b border-zinc-800">
              <div className="text-sm font-semibold text-zinc-200">Add MCP Server (JSON)</div>
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                onClick={() => {
                  setShowAddServer(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    setAddServerText(githubRemoteTemplate());
                  }}
                >
                  GitHub Remote
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    setAddServerText(githubLocalTemplate());
                  }}
                >
                  GitHub Local
                </button>
              </div>
              <textarea
                value={addServerText}
                onChange={(e) => setAddServerText(e.target.value)}
                className="w-full h-[240px] bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200"
                spellCheck={false}
              />
              {addServerError && (
                <div className="border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                  {addServerError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    try {
                      const nextRaw = mergeServerConfigIntoDraft(rawDraft, addServerText);
                      setRawDraft(nextRaw);
                      svc.applyConfig(nextRaw);
                      setShowAddServer(false);
                    } catch (e: any) {
                      const msg = String(e?.message ?? e);
                      setAddServerError(msg === "add_server_invalid_json" ? "Invalid JSON. Paste a full config or a server object with id." : msg);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
