import React, { useEffect, useMemo, useState } from 'react';
import { McpRegistrySnapshot } from '../../domain/DataContracts';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { logger } from '../../services/LogService';
import { McpInspectorPanel } from './inspector/McpInspectorPanel';
import { mcpInspectorService } from '../../mcp/inspector/McpInspectorService';
import { mcpOrchestrator } from '../../mcp/McpOrchestrator';
import { extractImportedMcpConfig } from '../../mcp/config/importMcpServers';

const AddServerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (json: string) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setJson(
        '{\n  "servers": {\n    "taqwin": {\n      "command": "C:/path/to/python.exe",\n      "args": ["-u", "C:/path/to/main.py"],\n      "env": { "PYTHONUNBUFFERED": "1" },\n      "enabled": true\n    },\n    "Chrome DevTools MCP": {\n      "command": "npx",\n      "args": ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"],\n      "env": {},\n      "enabled": true\n    }\n  }\n}'
      );
      setError(null);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!json.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(json);
      onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg shadow-xl flex flex-col max-h-[90vh] mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-100">Add MCP Server</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <p className="text-sm text-zinc-400 mb-2">
            Paste a JSON configuration object. Keys are server IDs.
          </p>
          <textarea
            className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded p-3 text-sm font-mono text-zinc-300 focus:border-blue-500 outline-none resize-none"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
          {error && (
            <div className="mt-2 text-red-400 text-sm bg-red-900/10 border border-red-900/30 p-2 rounded">
              {error}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-500 rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Server"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const McpRegistryView: React.FC<{ 
  snapshot: McpRegistrySnapshot | null;
  onRefresh: () => void; 
}> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"registry" | "inspector">("registry");
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [refreshingTools, setRefreshingTools] = useState<string | null>(null);
  const [toolDetails, setToolDetails] = useState<{ serverId: string; tool: any } | null>(null);
  const [tick, setTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    void mcpInspectorService.loadConfig();
    return mcpOrchestrator.subscribe(() => setTick((v) => (v + 1) % 1000000));
  }, []);

  const runtimeById = useMemo(() => mcpOrchestrator.getSnapshot().servers, [tick]);
  const localServerIds = useMemo(() => new Set(Object.keys(runtimeById)), [runtimeById]);
  const items = useMemo(() => {
    const knezItems = (snapshot as any)?.supported ? ((snapshot as any).items ?? []) : [];
    const byId = new Map<string, any>();
    for (const it of knezItems) {
      if (!it?.id) continue;
      byId.set(it.id, { ...it });
    }
    for (const s of Object.values(runtimeById)) {
      if (!s?.serverId) continue;
      if (byId.has(s.serverId)) continue;
      const status = (() => {
        const state = s?.state ?? "IDLE";
        if (state === "READY" || state === "INITIALIZED") return "active";
        if (state === "STARTING" || state === "LISTING_TOOLS") return "starting";
        if (state === "ERROR") return "error";
        return "inactive";
      })();
      byId.set(s.serverId, {
        id: s.serverId,
        provider: "local_config",
        status,
        capabilities: [
          `authority:${s.authority}`,
          `type:${s.type}`,
          `framing:${s.framing}`,
          `tools:${String(s.tools?.length ?? 0)}`
        ],
        enabled: s.enabled,
        last_error: s.lastError ?? null,
        last_ok: s.lastOkAt ? Math.floor(s.lastOkAt / 1000) : null,
      });
    }
    const out = Array.from(byId.values());
    out.sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
    return out;
  }, [snapshot, runtimeById]);

  if (!snapshot) return <div className="p-8 text-center text-zinc-500">Loading MCP Registry...</div>;
  if (!snapshot.supported) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-2">MCP Not Available</div>
        <div className="text-zinc-500 text-sm">{snapshot.reason}</div>
      </div>
    );
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    setToggling(id);
    try {
      const isEnabled = currentStatus === 'active' || currentStatus === 'starting' || currentStatus === 'error';
      const targetState = !isEnabled;
      
      if (localServerIds.has(id)) {
        mcpInspectorService.patchServer(id, { enabled: targetState });
        // We need to persist this change
        const currentCfg = mcpInspectorService.getConfig();
        if (currentCfg.raw) {
          // Re-serialize with update - actually saveConfig expects the full JSON
          // mcpInspectorService.saveConfig parses raw, but patchServer updates internal state
          // To persist properly, we should update the 'normalized' view and verify save.
          // Or easier: update the raw string? No, raw string is stale if we used patchServer.
          // Let's rely on the fact that patchServer updates the internal model,
          // so we should regenerate JSON from internal model.
          const servers = mcpInspectorService.getServers();
          const inputs = mcpInspectorService.getInputs();
          const serverMap: Record<string, any> = {};
          for (const s of servers) {
            // Use the updated state for the toggled server
            if (s.id === id) {
              serverMap[s.id] = { ...s, enabled: targetState };
            } else {
              serverMap[s.id] = s;
            }
          }
          const payload = {
            schema_version: currentCfg.normalized?.schema_version ?? "1",
            inputs,
            servers: serverMap
          };
          await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
          
          // If enabling, try to start it immediately
          if (targetState) {
            const issues = (mcpInspectorService.getConfig().issuesByServerId?.[id] ?? []).filter((it: any) => it?.level === "error");
            if (issues.length) {
              showToast(`Enabled ${id} but config is invalid: ${issues[0]?.message ?? "invalid_config"}`, "error");
              return;
            }
            try {
              await mcpOrchestrator.ensureStarted(id);
              showToast(`Started ${id}`, 'success');
            } catch (e: any) {
              showToast(`Enabled ${id} but failed to start: ${String(e?.message ?? e)}`, 'error');
            }
          } else {
             await mcpOrchestrator.stopServer(id);
          }
        }
      } else {
        await knezClient.toggleMcpItem(id, targetState);
        showToast(`MCP Server ${isEnabled ? 'disabled' : 'enabled'}`, 'success');
        onRefresh();
      }
    } catch (e) {
      showToast("Failed to toggle MCP server", 'error');
      logger.error("mcp", "Toggle failed", e);
    } finally {
      setToggling(null);
    }
  };
  
  const handleRestart = async (id: string) => {
    if (!localServerIds.has(id)) return;
    setRestarting(id);
    try {
      await mcpOrchestrator.restartServer(id);
      showToast(`Restarted ${id}`, "success");
    } catch (e: any) {
      showToast(`Restart failed: ${String(e?.message ?? e)}`, "error");
    } finally {
      setRestarting(null);
    }
  };

  const persistLocalServerPatch = async (id: string, patch: Record<string, any>) => {
    const currentCfg = mcpInspectorService.getConfig();
    const inputs = mcpInspectorService.getInputs();
    const servers = mcpInspectorService.getServers();
    const serverMap: Record<string, any> = {};
    for (const s of servers) {
      if (s.id === id) {
        serverMap[s.id] = { ...s, ...patch, id };
      } else {
        serverMap[s.id] = s;
      }
    }
    const payload = {
      schema_version: currentCfg.normalized?.schema_version ?? "1",
      inputs,
      servers: serverMap
    };
    await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
  };

  const handleToggleStartOnBoot = async (id: string, next: boolean) => {
    if (!localServerIds.has(id)) return;
    try {
      await persistLocalServerPatch(id, { start_on_boot: next });
      showToast(`start_on_boot=${next ? "true" : "false"} for ${id}`, "success");
    } catch (e: any) {
      showToast(`Failed to update start_on_boot: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleRefreshTools = async (id: string) => {
    if (!localServerIds.has(id)) return;
    setRefreshingTools(id);
    try {
      await mcpOrchestrator.refreshTools(id, { waitForResult: true, timeoutMs: 60000 });
      showToast(`Refreshed tools for ${id}`, "success");
    } catch (e: any) {
      showToast(`Refresh tools failed: ${String(e?.message ?? e)}`, "error");
    } finally {
      setRefreshingTools(null);
    }
  };

  const handleStartNow = async (id: string) => {
    if (!localServerIds.has(id)) return;
    try {
      const issues = (mcpInspectorService.getConfig().issuesByServerId?.[id] ?? []).filter((it: any) => it?.level === "error");
      if (issues.length) {
        showToast(`Cannot start ${id}: ${issues[0]?.message ?? "invalid_config"}`, "error");
        return;
      }
      await mcpOrchestrator.ensureStarted(id);
      showToast(`Started ${id}`, "success");
    } catch (e: any) {
      showToast(`Start failed: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleStopNow = async (id: string) => {
    if (!localServerIds.has(id)) return;
    try {
      await mcpOrchestrator.stopServer(id);
      showToast(`Stopped ${id}`, "success");
    } catch (e: any) {
      showToast(`Stop failed: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleAddServer = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const extracted = extractImportedMcpConfig(parsed);

      const validateServer = (id: string, server: any): string[] => {
        const s = typeof server === "object" && server !== null ? server : {};
        const isHttp = String(s.type ?? "").toLowerCase() === "http" || typeof s.url === "string";
        if (isHttp) {
          if (!String(s.url ?? "").trim()) return [`${id}: url is required`];
          return [];
        }
        const errs: string[] = [];
        if (!String(s.command ?? "").trim()) errs.push(`${id}: command is required`);
        if (s.args !== undefined && !Array.isArray(s.args)) errs.push(`${id}: args must be an array`);
        return errs;
      };

      const mergedInputs = (() => {
        const current = mcpInspectorService.getInputs();
        const byId = new Map<string, any>();
        for (const it of current) {
          if (!it?.id) continue;
          byId.set(String(it.id), it);
        }
        for (const it of extracted.inputs ?? []) {
          const id = String((it as any)?.id ?? "").trim();
          if (!id) continue;
          if (byId.has(id)) continue;
          byId.set(id, it);
        }
        return Array.from(byId.values());
      })();

      const currentServers = mcpInspectorService.getServers();
      const serverMap: Record<string, any> = {};
      for (const s of currentServers) serverMap[s.id] = s;
      for (const [key, val] of Object.entries(extracted.servers ?? {})) {
        const id = String(key ?? "").trim();
        if (!id) continue;
        serverMap[id] = { ...(val as any), id };
      }

      const validationErrors: string[] = [];
      for (const [id, s] of Object.entries(extracted.servers ?? {})) {
        validationErrors.push(...validateServer(String(id), s));
      }
      if (validationErrors.length) throw new Error(validationErrors.slice(0, 8).join("\n"));

      await mcpInspectorService.saveConfig(
        JSON.stringify(
          {
            schema_version: extracted.schema_version ?? "1",
            inputs: mergedInputs,
            servers: serverMap
          },
          null,
          2
        )
      );
      showToast("MCP Server configuration updated", "success");
      onRefresh();
    } catch (e: any) {
      throw new Error(`Failed to add server: ${String(e?.message ?? e)}`);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-zinc-100">MCP Registry</h2>
          <button
            onClick={() => setTab("registry")}
            className={`text-xs px-2 py-1 rounded ${tab === "registry" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            Registry
          </button>
          <button
            onClick={() => setTab("inspector")}
            className={`text-xs px-2 py-1 rounded ${tab === "inspector" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            Inspector
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 transition-colors"
          >
            + Add Server
          </button>
          <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
        </div>
      </div>

      {tab === "registry" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items?.map((item) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${
                item.status === 'active' ? 'bg-green-500' : item.status === 'starting' ? 'bg-amber-500' : item.status === 'error' ? 'bg-red-500' : 'bg-zinc-700'
              }`} />
              
              <div className="pl-3">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-mono text-sm text-zinc-200 break-all">{item.id}</div>
                      {runtimeById[item.id]?.tools ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800 flex-none">
                          tools={String(runtimeById[item.id]?.tools?.length ?? 0)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">{item.provider}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        localServerIds.has(item.id) ? "bg-blue-900/20 text-blue-300 border-blue-900/50" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                      }`}>
                        local_config={String(localServerIds.has(item.id))}
                      </span>
                      {runtimeById[item.id]?.pid ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800">
                          pid={String(runtimeById[item.id]?.pid)}
                        </span>
                      ) : null}
                      {runtimeById[item.id]?.state ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800">
                          state={String(runtimeById[item.id]?.state)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    item.status === 'active'
                      ? 'bg-green-900/30 text-green-400'
                      : item.status === 'starting'
                        ? 'bg-amber-900/30 text-amber-300'
                        : item.status === 'error'
                          ? 'bg-red-900/30 text-red-300'
                          : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {item.status}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {item.capabilities?.map((cap: string) => (
                      <span key={cap} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
                  <div className="text-[10px] text-zinc-600">
                     Health: {item.status === 'active' ? 'Operational' : item.status === 'starting' ? 'Connecting' : item.status === 'error' ? 'Error' : 'Offline'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        mcpInspectorService.setSelectedId(item.id);
                        setTab("inspector");
                      }}
                      className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Inspect
                    </button>
                    {localServerIds.has(item.id) ? (
                      <button
                        onClick={() => {
                          mcpInspectorService.setSelectedId(item.id);
                          setTab("inspector");
                          window.dispatchEvent(new CustomEvent("mcp-inspector-open-config"));
                        }}
                        className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        Edit
                      </button>
                    ) : null}
                    {localServerIds.has(item.id) ? (
                      <button
                        onClick={() => handleRestart(item.id)}
                        disabled={restarting === item.id}
                        className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      >
                        {restarting === item.id ? "..." : "Restart"}
                      </button>
                    ) : null}
                    <button
                      onClick={() => setExpanded((prev) => (prev === item.id ? null : item.id))}
                      className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {expanded === item.id ? "▾" : "▸"} Tools
                    </button>
                    <button
                      onClick={() => handleToggle(item.id, item.status || 'inactive')}
                      disabled={toggling === item.id}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                         item.status === 'active' || item.status === 'starting' || item.status === 'error'
                         ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700' 
                         : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {toggling === item.id ? (
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : item.status === 'active' || item.status === 'starting' || item.status === 'error' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {expanded === item.id && (
                  <div className="mt-3 text-xs text-zinc-400 space-y-2">
                    {localServerIds.has(item.id) ? (
                      <div className="flex items-center justify-between gap-3 border border-zinc-800 bg-zinc-950/40 rounded p-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartNow(item.id)}
                            className="text-[11px] px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => handleStopNow(item.id)}
                            className="text-[11px] px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          >
                            Stop
                          </button>
                          <button
                            onClick={() => handleRefreshTools(item.id)}
                            disabled={refreshingTools === item.id}
                            className="text-[11px] px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            {refreshingTools === item.id ? "..." : "Refresh tools"}
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-zinc-300 select-none">
                          <span className="text-zinc-500">start_on_boot</span>
                          <input
                            type="checkbox"
                            checked={Boolean(runtimeById[item.id]?.start_on_boot)}
                            onChange={(e) => void handleToggleStartOnBoot(item.id, e.target.checked)}
                          />
                        </label>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-zinc-500">enabled</span>
                      <span className="font-mono text-zinc-200">{String((item as any).enabled ?? (item.status === "active"))}</span>
                    </div>
                    {runtimeById[item.id] ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">state</span>
                          <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.state ?? "unknown")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">type</span>
                          <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.type ?? "unknown")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">framing</span>
                          <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.framing ?? "unknown")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">generation</span>
                          <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.generation ?? 0)}</span>
                        </div>
                        {runtimeById[item.id]?.lastOkAt ? (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">last_ok</span>
                            <span className="font-mono text-zinc-200">{new Date(Number(runtimeById[item.id]?.lastOkAt)).toLocaleString()}</span>
                          </div>
                        ) : null}
                        {runtimeById[item.id]?.initializeDurationMs !== null && runtimeById[item.id]?.initializeDurationMs !== undefined ? (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">init_ms</span>
                            <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.initializeDurationMs)}</span>
                          </div>
                        ) : null}
                        {runtimeById[item.id]?.toolsListDurationMs !== null && runtimeById[item.id]?.toolsListDurationMs !== undefined ? (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">tools_list_ms</span>
                            <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.toolsListDurationMs)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span className="text-zinc-500">tools_cached</span>
                          <span className="font-mono text-zinc-200">{String(runtimeById[item.id]?.tools?.length ?? 0)}</span>
                        </div>
                        {runtimeById[item.id]?.toolsCacheAt ? (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">tools_cache_age_s</span>
                            <span className="font-mono text-zinc-200">
                              {Math.max(0, Math.round((Date.now() - Number(runtimeById[item.id]?.toolsCacheAt ?? 0)) / 1000))}
                            </span>
                          </div>
                        ) : null}
                        {(runtimeById[item.id]?.tools?.length ?? 0) > 0 ? (
                          <div className="border border-zinc-800 bg-zinc-950/40 rounded p-2">
                            <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Tools</div>
                            <div className="space-y-1">
                              {runtimeById[item.id]?.tools?.slice(0, 30).map((t: any) => (
                                <button
                                  key={String(t?.name ?? "")}
                                  type="button"
                                  onClick={() => setToolDetails({ serverId: String(item.id), tool: t })}
                                  className={`w-full text-left rounded border px-2 py-1 ${
                                    runtimeById[item.id]?.state === "READY"
                                      ? "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/60"
                                      : "border-zinc-900 bg-zinc-950/20 opacity-60"
                                  }`}
                                >
                                  <div className="font-mono text-[11px] text-zinc-200 break-all">{String(t?.name ?? "")}</div>
                                  {t?.description ? <div className="text-[11px] text-zinc-500 break-words">{String(t.description)}</div> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {!!(item as any).updated_at && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">updated_at</span>
                        <span className="font-mono text-zinc-200">
                          {new Date(Number((item as any).updated_at) * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {!!(item as any).last_error && (
                      <div className="border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 whitespace-pre-wrap break-words">
                        {String((item as any).last_error)}
                      </div>
                    )}
                    {String(item.id ?? "")
                      .toLowerCase()
                      .includes("chrome") &&
                    String(item.id ?? "")
                      .toLowerCase()
                      .includes("devtools") ? (
                      <div className="border border-zinc-800 bg-zinc-950/40 rounded p-2 text-zinc-300 whitespace-pre-wrap break-words">
                        Requires Node.js 20.19+ and Chrome stable. Add --no-usage-statistics (and optionally --no-performance-crux) to disable telemetry.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <McpInspectorPanel />
      )}
      
      <AddServerModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onSave={handleAddServer}
      />
      {toolDetails ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] mx-4">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">Tool Details</div>
                <div className="font-mono text-sm text-zinc-100 break-all">{String(toolDetails.tool?.name ?? "")}</div>
                <div className="text-xs text-zinc-500 mt-1">server={String(toolDetails.serverId)}</div>
              </div>
              <button onClick={() => setToolDetails(null)} className="text-zinc-400 hover:text-white" aria-label="Close">✕</button>
            </div>
            <div className="p-4 overflow-auto space-y-3">
              {toolDetails.tool?.description ? (
                <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{String(toolDetails.tool.description)}</div>
              ) : (
                <div className="text-sm text-zinc-500">No description.</div>
              )}
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Input Schema</div>
              <pre className="text-xs bg-zinc-950 border border-zinc-800 rounded p-3 overflow-auto text-zinc-300">
                {JSON.stringify(toolDetails.tool?.inputSchema ?? { type: "object", properties: {} }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
