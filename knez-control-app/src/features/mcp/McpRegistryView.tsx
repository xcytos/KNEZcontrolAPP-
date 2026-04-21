import React, { useEffect, useMemo, useState } from 'react';
import { McpRegistrySnapshot } from '../../domain/DataContracts';
import { knezClient } from '../../services/knez/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { logger } from '../../services/utils/LogService';
import { McpInspectorPanel } from './inspector/McpInspectorPanel';
import { McpToolExecutorPanel } from './McpToolExecutorPanel';
import { mcpInspectorService } from '../../mcp/inspector/McpInspectorService';
import { mcpOrchestrator } from '../../mcp/McpOrchestrator';
import { extractImportedMcpConfig } from '../../mcp/config/importMcpServers';
import { Settings, Trash2, Activity, MoreVertical, Check, X, AlertCircle, Clock, Zap, ChevronDown, ChevronRight } from 'lucide-react';

const RawConfigModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (json: string) => Promise<void>;
  initialConfig: string;
}> = ({ isOpen, onClose, onSave, initialConfig }) => {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setJson(initialConfig);
      setError(null);
    }
  }, [isOpen, initialConfig]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh] mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500">Raw MCP Config</div>
            <div className="font-semibold text-zinc-100">Edit mcp.config.json</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            className="w-full h-96 bg-zinc-950 border border-zinc-800 rounded p-3 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-900"
            spellCheck={false}
          />
          {error && (
            <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-200">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-900 text-blue-100 rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditServerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (serverId: string, json: string) => Promise<void>;
  serverId: string;
  initialConfig: string;
}> = ({ isOpen, onClose, onSave, serverId, initialConfig }) => {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setJson(initialConfig);
      setError(null);
    }
  }, [isOpen, initialConfig]);

  const handleSave = async () => {
    if (!json.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(serverId, json);
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
          <h3 className="text-lg font-bold text-zinc-100">Edit Server: {serverId}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <p className="text-sm text-zinc-400 mb-2">
            Edit the configuration for this server.
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
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [tab, setTab] = useState<"registry" | "inspector" | "executor">("registry");
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRawConfigModal, setShowRawConfigModal] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string>("");
  const [editingServerConfig, setEditingServerConfig] = useState<string>("");
  const [rawConfig, setRawConfig] = useState<string>("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  if (!snapshot && Object.keys(runtimeById).length === 0) return <div className="p-8 text-center text-zinc-500">Loading MCP Registry...</div>;
  if (snapshot && !snapshot.supported && Object.keys(runtimeById).length === 0) {
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

  const handleForceStartAll = async () => {
    const snapshotItems: any[] = (snapshot as any)?.items ?? [];
    const localItems = Array.from(localServerIds).map((id) => ({ id, enabled: runtimeById[id]?.enabled ?? true }));
    const allItems = snapshotItems.length > 0 ? snapshotItems : localItems;
    const enabledServers = allItems.filter((item: any) =>
      localServerIds.has(item.id) && (item.enabled !== false)
    );
    if (enabledServers.length === 0) {
      showToast("No enabled servers to start", "info");
      return;
    }
    try {
      for (const server of enabledServers) {
        await mcpOrchestrator.ensureStarted(server.id);
      }
      showToast(`Started ${enabledServers.length} servers`, "success");
      onRefresh();
    } catch (e: any) {
      showToast(`Force start failed: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleEditServer = async (serverId: string, jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const currentCfg = mcpInspectorService.getConfig();
      
      // Handle both wrapped (mcpServers) and unwrapped structures
      const serverData = parsed.mcpServers?.[serverId] ?? parsed;
      
      // Validate required fields for stdio servers
      if (!serverData.type || serverData.type !== "http") {
        if (!serverData.command || !String(serverData.command).trim()) {
          throw new Error("command is required for stdio servers");
        }
        if (!Array.isArray(serverData.args)) {
          throw new Error("args must be an array");
        }
      }
      
      // Validate required fields for http servers
      if (serverData.type === "http") {
        if (!serverData.url || !String(serverData.url).trim()) {
          throw new Error("url is required for http servers");
        }
      }
      
      // Get current inputs and servers
      const inputs = mcpInspectorService.getInputs();
      const servers = mcpInspectorService.getServers();
      const serverMap: Record<string, any> = {};
      for (const s of servers) {
        serverMap[s.id] = s;
      }
      
      // Update the specific server with all fields
      serverMap[serverId] = { ...serverData, id: serverId };
      
      const payload = {
        schema_version: currentCfg.normalized?.schema_version ?? "1",
        inputs,
        mcpServers: serverMap
      };
      
      await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
      showToast(`Updated server config for ${serverId}`, "success");
      onRefresh();
    } catch (e: any) {
      showToast(`Failed to update server config: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleOpenRawConfigModal = async () => {
    try {
      const config = mcpInspectorService.getConfig();
      const rawConfigStr = JSON.stringify({ 
        schema_version: config.normalized?.schema_version ?? "1",
        inputs: config.normalized?.inputs ?? [],
        mcpServers: config.normalized?.servers ?? {}
      }, null, 2);
      setRawConfig(rawConfigStr);
      setShowRawConfigModal(true);
    } catch (e: any) {
      showToast(`Failed to load config: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleSaveRawConfig = async (jsonStr: string) => {
    try {
      await mcpInspectorService.saveConfig(jsonStr);
      showToast("Config saved successfully", "success");
      setShowRawConfigModal(false);
      onRefresh();
    } catch (e: any) {
      showToast(`Failed to save config: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm(`Are you sure you want to delete server "${serverId}"?`)) {
      return;
    }
    try {
      const currentCfg = mcpInspectorService.getConfig();
      const inputs = mcpInspectorService.getInputs();
      const servers = mcpInspectorService.getServers();
      const serverMap: Record<string, any> = {};
      
      // For non-local servers, we need to explicitly mark them as disabled in local config
      // For local servers, we just remove them
      const isLocal = localServerIds.has(serverId);
      
      for (const s of servers) {
        if (s.id !== serverId) {
          serverMap[s.id] = s;
        } else if (!isLocal) {
          // For non-local servers, add them with enabled: false to override
          serverMap[s.id] = { ...s, enabled: false };
        }
      }
      
      const payload = {
        schema_version: currentCfg.normalized?.schema_version ?? "1",
        inputs,
        mcpServers: serverMap
      };
      
      await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
      showToast(`Deleted server ${serverId}`, "success");
      onRefresh();
    } catch (e: any) {
      showToast(`Failed to delete server: ${String(e?.message ?? e)}`, "error");
    }
  };

  const handleOpenEditModal = (serverId: string) => {
    // Get the raw config to preserve command, args, env fields
    const currentCfg = mcpInspectorService.getConfig();
    let serverConfig: any = null;
    
    // Try to get the server config from the normalized config
    if (currentCfg.normalized?.servers?.[serverId]) {
      const normalizedServer = currentCfg.normalized.servers[serverId];
      serverConfig = {
        id: serverId,
        type: normalizedServer.type,
        enabled: normalizedServer.enabled,
        start_on_boot: normalizedServer.start_on_boot,
      };
      
      if (normalizedServer.type === "http") {
        serverConfig.url = normalizedServer.url;
        serverConfig.headers = normalizedServer.headers;
      } else {
        serverConfig.command = normalizedServer.command;
        serverConfig.args = normalizedServer.args;
        serverConfig.cwd = normalizedServer.cwd;
        serverConfig.env = normalizedServer.env;
      }
      
      serverConfig.tags = normalizedServer.tags;
      serverConfig.allowed_tools = normalizedServer.allowed_tools;
      serverConfig.blocked_tools = normalizedServer.blocked_tools;
    } else {
      // Fallback to runtime or inspector servers
      let server = runtimeById[serverId] as any;
      
      if (!server) {
        const inspectorServers = mcpInspectorService.getServers();
        server = inspectorServers.find((s: any) => s.id === serverId);
      }
      
      if (!server) {
        showToast("Server not found", "error");
        return;
      }
      
      serverConfig = {
        id: serverId,
        type: server.type,
        enabled: server.enabled,
        start_on_boot: server.start_on_boot,
      };
      
      if (server.type === "http") {
        serverConfig.url = server.url;
        serverConfig.headers = server.headers;
      } else {
        serverConfig.command = server.command;
        serverConfig.args = server.args;
        serverConfig.cwd = server.cwd;
        serverConfig.env = server.env;
      }
      
      serverConfig.tags = server.tags;
      serverConfig.allowed_tools = server.allowed_tools;
      serverConfig.blocked_tools = server.blocked_tools;
    }
    
    // Wrap in mcpServers structure for consistency with add server flow
    const wrappedConfig = {
      mcpServers: {
        [serverId]: serverConfig
      }
    };
    
    setEditingServerId(serverId);
    setEditingServerConfig(JSON.stringify(wrappedConfig, null, 2));
    setShowEditModal(true);
  };

  const handleAddToLocalConfig = async (serverId: string) => {
    try {
      let server = runtimeById[serverId] as any;
      
      // If not found in runtime, check inspector service config
      if (!server) {
        const inspectorServers = mcpInspectorService.getServers();
        server = inspectorServers.find((s: any) => s.id === serverId);
      }
      
      if (!server) {
        showToast("Server not found", "error");
        return;
      }
      
      // Extract server config
      const serverConfig: any = {
        id: serverId,
        type: server.type,
        enabled: server.enabled,
        start_on_boot: server.start_on_boot,
      };
      
      if (server.type === "http") {
        serverConfig.url = server.url;
        serverConfig.headers = server.headers;
      } else {
        serverConfig.command = server.command;
        serverConfig.args = server.args;
        serverConfig.cwd = server.cwd;
        serverConfig.env = server.env;
      }
      
      serverConfig.tags = server.tags;
      serverConfig.allowed_tools = server.allowed_tools;
      serverConfig.blocked_tools = server.blocked_tools;
      
      const currentCfg = mcpInspectorService.getConfig();
      const inputs = mcpInspectorService.getInputs();
      const servers = mcpInspectorService.getServers();
      const serverMap: Record<string, any> = {};
      for (const s of servers) {
        serverMap[s.id] = s;
      }
      
      // Add the server to local config
      serverMap[serverId] = serverConfig;
      
      const payload = {
        schema_version: currentCfg.normalized?.schema_version ?? "1",
        inputs,
        mcpServers: serverMap
      };
      
      await mcpInspectorService.saveConfig(JSON.stringify(payload, null, 2));
      showToast(`Added ${serverId} to local config`, "success");
      onRefresh();
    } catch (e: any) {
      showToast(`Failed to add to local config: ${String(e?.message ?? e)}`, "error");
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
        // Ensure enabled flag is set to true by default when adding servers
        serverMap[id] = { ...(val as any), id, enabled: (val as any).enabled !== false };
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
            mcpServers: serverMap
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

  // Calculate global health summary for A5
  const globalStats = useMemo(() => {
    const activeServers = items.filter((item: any) => item.status === 'active').length;
    const totalTools = items.reduce((sum: number, item: any) => {
      return sum + (runtimeById[item.id]?.tools?.length ?? 0);
    }, 0);
    const errorServers = items.filter((item: any) => item.status === 'error').length;
    const startingServers = items.filter((item: any) => item.status === 'starting').length;
    return { activeServers, totalTools, errorServers, startingServers };
  }, [items, runtimeById, tick]);

  // Format timestamp for A1
  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // A6: Group servers by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {
      local: [],
      remote: [],
      experimental: []
    };
    
    items.forEach((item: any) => {
      const isLocal = localServerIds.has(item.id);
      // Experimental servers can be identified by tags or naming convention
      const isExperimental = item.id?.toLowerCase().includes('experimental') || 
                           item.id?.toLowerCase().includes('test') ||
                           (item as any).tags?.includes('experimental');
      
      if (isExperimental) {
        groups.experimental.push(item);
      } else if (isLocal) {
        groups.local.push(item);
      } else {
        groups.remote.push(item);
      }
    });
    
    return groups;
  }, [items, localServerIds]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const GroupHeader = ({ name, count, group }: { name: string; count: number; group: string }) => (
    <button
      onClick={() => toggleGroup(group)}
      className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800 transition-colors rounded"
    >
      {collapsedGroups.has(group) ? (
        <ChevronRight size={16} className="text-zinc-500" />
      ) : (
        <ChevronDown size={16} className="text-zinc-500" />
      )}
      <span className="text-sm font-medium text-zinc-300">{name}</span>
      <span className="text-xs text-zinc-500">({count})</span>
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
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
            <button
              onClick={() => setTab("executor")}
              className={`text-xs px-2 py-1 rounded ${tab === "executor" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Executor
            </button>
          </div>
          {/* A5: Global health summary */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400">Active: </span>
              <span className="font-mono text-zinc-200">{globalStats.activeServers}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-zinc-500" />
              <span className="text-zinc-400">Tools: </span>
              <span className="font-mono text-zinc-200">{globalStats.totalTools}</span>
            </div>
            {globalStats.errorServers > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-red-500" />
                <span className="text-zinc-400">Errors: </span>
                <span className="font-mono text-red-400">{globalStats.errorServers}</span>
              </div>
            )}
            {globalStats.startingServers > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-amber-500" />
                <span className="text-zinc-400">Starting: </span>
                <span className="font-mono text-amber-400">{globalStats.startingServers}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleForceStartAll}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-500 transition-colors"
          >
            Force Start All
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 transition-colors"
          >
            + Add Server
          </button>
          <button 
            onClick={handleOpenRawConfigModal}
            className="text-xs bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded hover:bg-zinc-600 transition-colors flex items-center gap-1"
          >
            <Settings size={14} />
            Config
          </button>
          <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
        </div>
      </div>

      {tab === "registry" ? (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([group, groupItems]) => {
            if (groupItems.length === 0) return null;
            
            const isCollapsed = collapsedGroups.has(group);
            const groupName = group === 'local' ? 'Local Servers' : 
                              group === 'remote' ? 'Remote Servers' : 
                              'Experimental Servers';
            
            return (
              <div key={group}>
                <GroupHeader name={groupName} count={groupItems.length} group={group} />
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {groupItems.map((item: any) => {
                      const server = runtimeById[item.id];
                      const toolCount = server?.tools?.length ?? 0;
                      const lastHealth = server?.lastOkAt ? formatTimestamp(Number(server.lastOkAt)) : 'Never';
                      const hasError = server?.lastError;
                      const isLocal = localServerIds.has(item.id);
                      
                      // A4: Status color system
                      const statusColor = item.status === 'active' ? 'bg-green-500' : 
                                        item.status === 'starting' ? 'bg-amber-500' : 
                                        item.status === 'error' ? 'bg-red-500' : 'bg-zinc-600';
                      const statusBg = item.status === 'active' ? 'bg-green-900/20 text-green-400 border-green-900/50' : 
                                     item.status === 'starting' ? 'bg-amber-900/20 text-amber-400 border-amber-900/50' : 
                                     item.status === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 
                                     'bg-zinc-800 text-zinc-500 border-zinc-700';
                      
                      return (
                        <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors">
                          {/* A4: Status indicator bar */}
                          <div className={`h-1 ${statusColor}`} />
                          
                          <div className="p-4">
                            {/* A1: Minimal card header with server name and status */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-sm text-zinc-200 break-all mb-1">{item.id}</div>
                                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${statusBg}`}>
                                  {item.status === 'active' ? 'ACTIVE' : 
                                   item.status === 'starting' ? 'STARTING' : 
                                   item.status === 'error' ? 'ERROR' : 
                                   item.status === 'inactive' ? 'STOPPED' : item.status.toUpperCase()}
                                </div>
                              </div>
                              {/* A4: Error indicator */}
                              {hasError && (
                                <div className="flex items-center gap-1 text-red-400" title={String(server.lastError)}>
                                  <AlertCircle size={14} />
                                </div>
                              )}
                            </div>

                            {/* A1: Tool count and last health timestamp */}
                            <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                              <div className="flex items-center gap-1.5">
                                <Zap size={12} />
                                <span>{toolCount} tools</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} />
                                <span>{lastHealth}</span>
                              </div>
                            </div>

                            {/* A2: Inline actions (restart, enable/disable) */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {isLocal && (
                                  <button
                                    onClick={() => handleRestart(item.id)}
                                    disabled={restarting === item.id}
                                    className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                    title="Restart server"
                                  >
                                    {restarting === item.id ? '...' : 'Restart'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggle(item.id, item.status || 'inactive')}
                                  disabled={toggling === item.id}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    item.status === 'active' || item.status === 'starting' || item.status === 'error'
                                    ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700' 
                                    : 'bg-blue-600 text-white hover:bg-blue-500'
                                  }`}
                                  title={item.status === 'active' || item.status === 'starting' || item.status === 'error' ? 'Disable' : 'Enable'}
                                >
                                  {toggling === item.id ? (
                                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : item.status === 'active' || item.status === 'starting' || item.status === 'error' ? (
                                    <X size={12} />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                </button>
                              </div>
                              
                              {/* A2: Secondary dropdown (inspect, logs, config, delete) */}
                              <div className="relative" style={{ zIndex: 50 }}>
                                <button
                                  onClick={() => setExpanded((prev) => (prev === item.id ? null : item.id))}
                                  className="text-xs p-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                                  title="More options"
                                >
                                  <MoreVertical size={14} />
                                </button>
                                
                                {expanded === item.id && (
                                  <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl" style={{ zIndex: 100 }}>
                                    <div className="p-1">
                                      <button
                                        onClick={() => {
                                          mcpInspectorService.setSelectedId(item.id);
                                          setTab("inspector");
                                          setExpanded(null);
                                        }}
                                        className="w-full text-left text-xs px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 transition-colors"
                                      >
                                        Inspect
                                      </button>
                                      <button
                                        onClick={() => {
                                          mcpInspectorService.setSelectedId(item.id);
                                          setTab("inspector");
                                          void mcpInspectorService.handshake(item.id, { toolsListTimeoutMs: 60000 }).catch(() => {});
                                          setTimeout(() => window.dispatchEvent(new CustomEvent("mcp-inspector-focus-logs")), 200);
                                          setExpanded(null);
                                        }}
                                        className="w-full text-left text-xs px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                      >
                                        <Activity size={12} />
                                        View Logs
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleOpenEditModal(item.id);
                                          setExpanded(null);
                                        }}
                                        className="w-full text-left text-xs px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 transition-colors"
                                      >
                                        Edit Config
                                      </button>
                                      {!isLocal && (
                                        <button
                                          onClick={() => {
                                            handleAddToLocalConfig(item.id);
                                            setExpanded(null);
                                          }}
                                          className="w-full text-left text-xs px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 transition-colors"
                                        >
                                          + Add to Local Config
                                        </button>
                                      )}
                                      <div className="border-t border-zinc-800 my-1" />
                                      <button
                                        onClick={() => {
                                          handleDeleteServer(item.id);
                                          setExpanded(null);
                                        }}
                                        className="w-full text-left text-xs px-3 py-2 rounded text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                      >
                                        <Trash2 size={12} />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === "inspector" ? (
        <McpInspectorPanel />
      ) : (
        <div className="relative" style={{ height: "calc(100vh - 180px)" }}>
          <McpToolExecutorPanel />
        </div>
      )}
      
      <AddServerModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onSave={handleAddServer}
      />
      <RawConfigModal
        isOpen={showRawConfigModal}
        onClose={() => setShowRawConfigModal(false)}
        onSave={handleSaveRawConfig}
        initialConfig={rawConfig}
      />
      <EditServerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditServer}
        serverId={editingServerId}
        initialConfig={editingServerConfig}
      />
    </div>
  );
};
