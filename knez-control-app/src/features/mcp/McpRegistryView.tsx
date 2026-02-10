import React, { useEffect, useMemo, useState } from 'react';
import { McpRegistrySnapshot } from '../../domain/DataContracts';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { logger } from '../../services/LogService';
import { runTaqwinMcpSelfTest } from '../../mcp/registry/runTaqwinMcpSelfTest';
import { McpInspectorPanel } from './inspector/McpInspectorPanel';
import { mcpInspectorService } from '../../mcp/inspector/McpInspectorService';

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
      setJson('{\n  "my-server": {\n    "command": "node",\n    "args": ["path/to/server.js"],\n    "enabled": true\n  }\n}');
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
  const [testing, setTesting] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    void mcpInspectorService.loadConfig();
    return mcpInspectorService.subscribe(() => setTick((v) => (v + 1) % 1000000));
  }, []);

  const localServerIds = useMemo(() => new Set(mcpInspectorService.getServers().map((s) => s.id)), [tick]);
  const inspectorStatusById = useMemo(() => mcpInspectorService.getStatusById(), [tick]);
  const items = useMemo(() => {
    const knezItems = (snapshot as any)?.supported ? ((snapshot as any).items ?? []) : [];
    const byId = new Map<string, any>();
    for (const it of knezItems) {
      if (!it?.id) continue;
      byId.set(it.id, { ...it });
    }
    const localServers = mcpInspectorService.getServers();
    for (const s of localServers) {
      if (!s?.id) continue;
      if (byId.has(s.id)) continue;
      const st = inspectorStatusById[s.id];
      byId.set(s.id, {
        id: s.id,
        provider: "local_config",
        status: "inactive",
        capabilities: [],
        enabled: s.enabled,
        last_error: st?.lastError ?? null,
        last_ok: st?.lastOkAt ? Math.floor(st.lastOkAt / 1000) : null,
      });
    }
    const out = Array.from(byId.values());
    out.sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
    return out;
  }, [snapshot, tick, inspectorStatusById]);

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
      const isEnabled = currentStatus === 'active';
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
            try {
              await mcpInspectorService.start(id);
              showToast(`Started ${id}`, 'success');
            } catch (e: any) {
              showToast(`Enabled ${id} but failed to start: ${e.message}`, 'error');
            }
          } else {
             await mcpInspectorService.stop(id);
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
  
  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const w = window as any;
      const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
      if (!isTauri) throw new Error("MCP test requires the desktop app (Tauri).");
      const res = await runTaqwinMcpSelfTest();
      if (!res.ok) throw new Error(String(res?.steps?.slice(-1)?.[0]?.detail ?? "self_test_failed"));
      const toolsStep = (res.steps ?? []).find((s: any) => s.step === "tools/list");
      const toolCount = Number((toolsStep as any)?.detail?.tools ?? 0);
      logger.info("mcp", "MCP connectivity test ok", { id, toolCount, durationMs: res.durationMs });
      showToast(`MCP test OK (${toolCount} tools)`, "success");
      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      logger.error("mcp", "MCP connectivity test failed", { id, error: msg });
      showToast(`MCP test failed: ${msg}`, "error");
      window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "mcp" } }));
    } finally {
      setTesting(null);
    }
  };

  const handleAddServer = async (jsonStr: string) => {
    try {
      let newServers = JSON.parse(jsonStr);
      if (typeof newServers !== 'object' || newServers === null) throw new Error("Invalid JSON object");
      
      // Handle single server object (if it has 'type' or 'command' and 'id'?)
      // Or just if it has properties that are NOT server objects.
      // A server object has 'command' or 'url'.
      // A map has keys pointing to server objects.
      // If the root object has 'command' or 'url', it's a single server.
      if (newServers.command || newServers.url || newServers.type) {
         const id = newServers.id || `server_${Date.now()}`;
         newServers = { [id]: newServers };
      }

      const currentServers = mcpInspectorService.getServers();
      const inputs = mcpInspectorService.getInputs();
      const serverMap: Record<string, any> = {};
      
      // Keep existing
      for (const s of currentServers) {
        serverMap[s.id] = s;
      }
      
      // Merge new
      for (const [key, val] of Object.entries(newServers)) {
        serverMap[key] = { ...(val as any), id: key };
      }
      
      const payload = {
        schema_version: "1",
        inputs,
        servers: serverMap
      };
      
      await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
      showToast("MCP Server configuration updated", "success");
      onRefresh();
    } catch (e: any) {
      throw new Error(`Failed to add server: ${e.message}`);
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
              <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'active' ? 'bg-green-500' : 'bg-zinc-700'}`} />
              
              <div className="pl-3">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-mono text-sm text-zinc-200 break-all">{item.id}</div>
                    <div className="text-xs text-zinc-500">{item.provider}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        localServerIds.has(item.id) ? "bg-blue-900/20 text-blue-300 border-blue-900/50" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                      }`}>
                        local_config={String(localServerIds.has(item.id))}
                      </span>
                      {inspectorStatusById[item.id]?.pid ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800">
                          pid={String(inspectorStatusById[item.id]?.pid)}
                        </span>
                      ) : null}
                      {inspectorStatusById[item.id]?.state ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800">
                          inspector={String(inspectorStatusById[item.id]?.state)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    item.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'
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
                     Health: {item.status === 'active' ? 'Operational' : 'Offline'}
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
                    <button
                      onClick={() => handleTest(item.id)}
                      disabled={testing === item.id}
                      className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      {testing === item.id ? "..." : "Test"}
                    </button>
                    <button
                      onClick={() => setExpanded((prev) => (prev === item.id ? null : item.id))}
                      className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {expanded === item.id ? "Hide" : "Details"}
                    </button>
                    <button
                      onClick={() => handleToggle(item.id, item.status || 'inactive')}
                      disabled={toggling === item.id}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                         item.status === 'active' 
                         ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700' 
                         : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {toggling === item.id ? (
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : item.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {expanded === item.id && (
                  <div className="mt-3 text-xs text-zinc-400 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">enabled</span>
                      <span className="font-mono text-zinc-200">{String((item as any).enabled ?? (item.status === "active"))}</span>
                    </div>
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
                    {inspectorStatusById[item.id]?.lastOkAt ? (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">inspector_last_ok</span>
                        <span className="font-mono text-zinc-200">
                          {new Date(Number(inspectorStatusById[item.id]?.lastOkAt)).toLocaleString()}
                        </span>
                      </div>
                    ) : null}
                    {inspectorStatusById[item.id]?.lastError ? (
                      <div className="border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 whitespace-pre-wrap break-words">
                        {String(inspectorStatusById[item.id]?.lastError)}
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
    </div>
  );
};
