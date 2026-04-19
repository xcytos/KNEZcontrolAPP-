import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mcpOrchestrator } from "../../mcp/McpOrchestrator";
import type { McpToolDefinition } from "../../services/McpTypes";
import { logger } from "../../services/LogService";
import { Badge } from "../../components/ui/core/Badge";
import { Button } from "../../components/ui/core/Button";
import { Input } from "../../components/ui/core/Input";

type ToolRef = { serverId: string; tool: McpToolDefinition };

type ExecutionRecord = {
  id: string;
  serverId: string;
  toolName: string;
  args: any;
  result?: any;
  error?: string;
  durationMs?: number;
  startedAt: number;
  status: "pending" | "running" | "done" | "error";
};

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function buildDefaultArgs(schema: any): string {
  try {
    const props = schema?.properties ?? {};
    const required: string[] = schema?.required ?? [];
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(props)) {
      const s = val as any;
      if (required.includes(key) || Object.keys(props).length <= 4) {
        out[key] = s.type === "string" ? "" : s.type === "number" ? 0 : s.type === "boolean" ? false : s.type === "array" ? [] : {};
      }
    }
    return prettyJson(out);
  } catch {
    return "{}";
  }
}

const ServerBadge: React.FC<{ state: string }> = ({ state }) => {
  const variant =
    state === "READY" || state === "INITIALIZED"
      ? "success"
      : state === "STARTING" || state === "LISTING_TOOLS"
      ? "warning"
      : state === "ERROR"
      ? "error"
      : "default";
  return <Badge variant={variant} className="w-1.5 h-1.5 p-0"><span className="block w-1.5 h-1.5 rounded-full bg-current" /></Badge>;
};

const ExecutionRecordRow: React.FC<{
  rec: ExecutionRecord;
  onSelect: (rec: ExecutionRecord) => void;
  selected: boolean;
}> = ({ rec, onSelect, selected }) => {
  const statusColor =
    rec.status === "running"
      ? "text-amber-400"
      : rec.status === "done"
      ? "text-emerald-400"
      : rec.status === "error"
      ? "text-red-400"
      : "text-zinc-500";
  const ts = new Date(rec.startedAt).toLocaleTimeString();
  return (
    <button
      onClick={() => onSelect(rec)}
      className={`w-full text-left px-3 py-2 rounded border transition-colors ${
        selected ? "border-blue-700 bg-blue-900/20" : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-zinc-200 truncate">{rec.toolName}</span>
        <span className={`text-[10px] font-mono flex-none ${statusColor}`}>
          {rec.status === "running" ? "…" : rec.status === "done" ? `${rec.durationMs}ms` : rec.status === "error" ? "ERR" : "—"}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-zinc-600">{rec.serverId}</span>
        <span className="text-[10px] text-zinc-600">{ts}</span>
      </div>
    </button>
  );
};

export const McpToolExecutorPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [selectedTool, setSelectedTool] = useState<ToolRef | null>(null);
  const [argsText, setArgsText] = useState("{}");
  const [argsError, setArgsError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [activeExecTab, setActiveExecTab] = useState<"request" | "response">("response");
  const [filter, setFilter] = useState("");
  const [executing, setExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const execIdRef = useRef(0);

  useEffect(() => {
    return mcpOrchestrator.subscribe(() => setTick((v) => (v + 1) % 1_000_000));
  }, []);

  const servers = useMemo(() => mcpOrchestrator.getServers(), [tick]);

  const allTools = useMemo((): ToolRef[] => {
    const out: ToolRef[] = [];
    for (const s of servers) {
      for (const t of s.tools ?? []) {
        out.push({ serverId: s.serverId, tool: t });
      }
    }
    return out;
  }, [servers]);

  const filteredByServer = useMemo(() => {
    const q = filter.toLowerCase();
    const grouped = new Map<string, ToolRef[]>();
    for (const ref of allTools) {
      if (q && !ref.tool.name.toLowerCase().includes(q) && !ref.serverId.toLowerCase().includes(q)) continue;
      const arr = grouped.get(ref.serverId) ?? [];
      arr.push(ref);
      grouped.set(ref.serverId, arr);
    }
    return grouped;
  }, [allTools, filter]);

  const selectedExec = useMemo(
    () => executions.find((e) => e.id === selectedExecId) ?? null,
    [executions, selectedExecId]
  );

  const handleSelectTool = useCallback((ref: ToolRef) => {
    setSelectedTool(ref);
    const schema = ref.tool.inputSchema;
    setArgsText(buildDefaultArgs(schema));
    setArgsError(null);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { serverId, toolName } = (e as CustomEvent).detail ?? {};
      if (!serverId || !toolName) return;
      const tools = mcpOrchestrator.getServerTools(String(serverId));
      const tool = tools.find((t) => t.name === String(toolName));
      if (tool) handleSelectTool({ serverId: String(serverId), tool });
    };
    window.addEventListener("mcp-executor-open-tool", handler);
    return () => window.removeEventListener("mcp-executor-open-tool", handler);
  }, [handleSelectTool]);

  const handleArgsChange = (v: string) => {
    setArgsText(v);
    try {
      JSON.parse(v);
      setArgsError(null);
    } catch (e: any) {
      setArgsError(String(e?.message ?? e));
    }
  };

  const handleExecute = useCallback(async () => {
    if (!selectedTool || executing) return;
    let args: any;
    try {
      args = JSON.parse(argsText);
    } catch (e: any) {
      setArgsError(String(e?.message ?? e));
      return;
    }
    const recId = String(++execIdRef.current);
    const rec: ExecutionRecord = {
      id: recId,
      serverId: selectedTool.serverId,
      toolName: selectedTool.tool.name,
      args,
      startedAt: Date.now(),
      status: "running",
    };
    setExecutions((prev) => [rec, ...prev.slice(0, 49)]);
    setSelectedExecId(recId);
    setActiveExecTab("response");
    setExecuting(true);
    try {
      const { result, durationMs } = await mcpOrchestrator.callTool(
        selectedTool.serverId,
        selectedTool.tool.name,
        args,
        { timeoutMs: 60000 }
      );
      setExecutions((prev) =>
        prev.map((e) => (e.id === recId ? { ...e, result, durationMs, status: "done" } : e))
      );
      logger.info("mcp_executor", "tool_executed", { serverId: selectedTool.serverId, tool: selectedTool.tool.name, durationMs });
    } catch (err: any) {
      const errorMsg = String(err?.message ?? err);
      setExecutions((prev) =>
        prev.map((e) =>
          e.id === recId ? { ...e, error: errorMsg, durationMs: Date.now() - rec.startedAt, status: "error" } : e
        )
      );
      logger.warn("mcp_executor", "tool_failed", { serverId: selectedTool.serverId, tool: selectedTool.tool.name, error: errorMsg });
    } finally {
      setExecuting(false);
    }
  }, [selectedTool, argsText, executing]);

  const serverStateMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of servers) m.set(s.serverId, s.state);
    return m;
  }, [servers]);

  const readyServerCount = useMemo(() => servers.filter((s) => s.state === "READY" || s.state === "INITIALIZED").length, [servers]);
  const totalToolCount = useMemo(() => allTools.length, [allTools]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-zinc-950 text-zinc-300">
      {/* Left: Tool Browser */}
      <div
        className={`flex-none border-r border-zinc-800 flex flex-col transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Tools</span>
          <span className="text-[10px] text-zinc-600 font-mono">{totalToolCount} across {readyServerCount} srv</span>
        </div>
        <div className="px-2 py-2 border-b border-zinc-800">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tools…"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredByServer.size === 0 ? (
            <div className="p-4 text-center text-zinc-600 text-xs">
              {allTools.length === 0 ? "No tools available. Start MCP servers first." : "No match."}
            </div>
          ) : (
            Array.from(filteredByServer.entries()).map(([serverId, refs]) => (
              <div key={serverId} className="border-b border-zinc-900">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60">
                  <ServerBadge state={serverStateMap.get(serverId) ?? "IDLE"} />
                  <span className="text-[10px] font-mono text-zinc-400 truncate">{serverId}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">{refs.length}</span>
                </div>
                {refs.map((ref) => (
                  <button
                    key={ref.tool.name}
                    onClick={() => handleSelectTool(ref)}
                    className={`w-full text-left px-3 py-2 hover:bg-zinc-800/60 transition-colors border-l-2 ${
                      selectedTool?.serverId === ref.serverId && selectedTool?.tool.name === ref.tool.name
                        ? "border-blue-500 bg-blue-900/10"
                        : "border-transparent"
                    }`}
                  >
                    <div className="font-mono text-[11px] text-zinc-200">{ref.tool.name}</div>
                    {ref.tool.description && (
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5">{ref.tool.description}</div>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center: Execution Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-950/80 flex-none">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
            title="Toggle tool browser"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="1" width="14" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="0" y="6.25" width="14" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="0" y="11.5" width="14" height="1.5" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {selectedTool ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-zinc-100">{selectedTool.tool.name}</span>
                <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                  {selectedTool.serverId}
                </span>
              </div>
            ) : (
              <span className="text-sm text-zinc-600">Select a tool from the left panel</span>
            )}
          </div>
          <Button
            onClick={handleExecute}
            disabled={!selectedTool || executing || !!argsError}
            loading={executing}
            size="xs"
          >
            Execute
          </Button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedTool ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Tool description */}
              {selectedTool.tool.description && (
                <div className="px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500 bg-zinc-950/60">
                  {selectedTool.tool.description}
                </div>
              )}

              {/* Args editor */}
              <div className="flex-none px-4 pt-3 pb-2 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Arguments (JSON)</span>
                  {argsError && (
                    <span className="text-[10px] text-red-400 bg-red-900/20 border border-red-900/40 px-2 py-0.5 rounded">
                      {argsError}
                    </span>
                  )}
                </div>
                <textarea
                  className={`w-full h-28 bg-zinc-900 border rounded px-3 py-2 font-mono text-xs text-zinc-200 outline-none resize-none transition-colors ${
                    argsError ? "border-red-700 focus:border-red-500" : "border-zinc-800 focus:border-blue-600"
                  }`}
                  value={argsText}
                  onChange={(e) => handleArgsChange(e.target.value)}
                  spellCheck={false}
                />
                {selectedTool.tool.inputSchema && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">Schema</summary>
                    <pre className="mt-1 text-[10px] text-zinc-500 font-mono overflow-auto max-h-32 bg-zinc-900/50 rounded p-2 border border-zinc-800">
                      {prettyJson(selectedTool.tool.inputSchema)}
                    </pre>
                  </details>
                )}
              </div>

              {/* Response area */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pt-3 pb-4">
                {selectedExec ? (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex border border-zinc-800 rounded overflow-hidden">
                        {(["request", "response"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setActiveExecTab(t)}
                            className={`px-3 py-1 text-xs capitalize transition-colors ${
                              activeExecTab === t ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                          selectedExec.status === "done"
                            ? "text-emerald-400 border-emerald-900/50 bg-emerald-900/20"
                            : selectedExec.status === "error"
                            ? "text-red-400 border-red-900/50 bg-red-900/20"
                            : "text-amber-400 border-amber-900/50 bg-amber-900/20"
                        }`}
                      >
                        {selectedExec.status === "running"
                          ? "running…"
                          : selectedExec.status === "done"
                          ? `✓ ${selectedExec.durationMs}ms`
                          : `✗ ${selectedExec.durationMs}ms`}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(selectedExec.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="flex-1 min-h-0 overflow-auto bg-zinc-900 border border-zinc-800 rounded p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
                      {activeExecTab === "request"
                        ? prettyJson({ tool: selectedExec.toolName, server: selectedExec.serverId, args: selectedExec.args })
                        : selectedExec.status === "running"
                        ? "Waiting for response…"
                        : selectedExec.status === "error"
                        ? `Error:\n${selectedExec.error}`
                        : prettyJson(selectedExec.result)}
                    </pre>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                    Press ▶ Execute to run the tool
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 text-center px-8">
              <div className="text-zinc-600 text-sm">
                {allTools.length === 0
                  ? "No MCP tools available. Start a server from the Registry tab first."
                  : `${totalToolCount} tools available across ${readyServerCount} server${readyServerCount !== 1 ? "s" : ""}. Select one from the left panel.`}
              </div>
              {allTools.length === 0 && (
                <div className="text-zinc-700 text-xs mt-2 font-mono bg-zinc-900 border border-zinc-800 px-3 py-2 rounded">
                  Registry → Enable Server → Start
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: History */}
      <div
        className={`flex-none border-l border-zinc-800 flex flex-col transition-all duration-200 ${
          historyOpen ? "w-56" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">History</span>
          {executions.length > 0 && (
            <button
              onClick={() => setExecutions([])}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {executions.length === 0 ? (
            <div className="text-center text-zinc-700 text-xs pt-4">No executions yet</div>
          ) : (
            executions.map((rec) => (
              <ExecutionRecordRow
                key={rec.id}
                rec={rec}
                onSelect={(r) => { setSelectedExecId(r.id); setActiveExecTab("response"); }}
                selected={rec.id === selectedExecId}
              />
            ))
          )}
        </div>
      </div>

      {/* History toggle */}
      <button
        onClick={() => setHistoryOpen((v) => !v)}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-l px-0.5 py-3 text-[10px] z-10"
        title="Toggle history"
        style={{ right: historyOpen ? "224px" : "0" }}
      >
        {historyOpen ? "›" : "‹"}
      </button>
    </div>
  );
};
