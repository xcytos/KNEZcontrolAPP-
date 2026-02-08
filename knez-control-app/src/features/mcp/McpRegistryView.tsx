import React, { useState } from 'react';
import { McpRegistrySnapshot } from '../../domain/DataContracts';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { taqwinMcpService } from '../../services/TaqwinMcpService';
import { logger } from '../../services/LogService';

export const McpRegistryView: React.FC<{ 
  snapshot: McpRegistrySnapshot | null;
  onRefresh: () => void; 
}> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

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
      await knezClient.toggleMcpItem(id, !isEnabled);
      showToast(`MCP Server ${isEnabled ? 'disabled' : 'enabled'}`, 'success');
      onRefresh();
    } catch (e) {
      showToast("Failed to toggle MCP server", 'error');
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
      const tools = await taqwinMcpService.listTools(true);
      logger.info("mcp", "MCP connectivity test ok", { id, tools: tools.length });
      showToast(`MCP test OK (${tools.length} tools)`, "success");
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-zinc-100">MCP Registry</h2>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.items?.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative overflow-hidden">
            {/* Health Indicator Stripe */}
            <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'active' ? 'bg-green-500' : 'bg-zinc-700'}`} />
            
            <div className="pl-3">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-mono text-sm text-zinc-200">{item.id}</div>
                  <div className="text-xs text-zinc-500">{item.provider}</div>
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
                  {item.capabilities?.map(cap => (
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
                    {toggling === item.id ? '...' : item.status === 'active' ? 'Disable' : 'Enable'}
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
