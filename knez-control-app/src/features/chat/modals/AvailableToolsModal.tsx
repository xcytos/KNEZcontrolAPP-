import React, { useState } from 'react';
import { Modal } from '../../../components/ui/core/Modal';
import { Button } from '../../../components/ui/core/Button';
import { Badge } from '../../../components/ui/core/Badge';

interface AvailableToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: any[];
  runtimeById: Record<string, any>;
  onStartServer: (serverId: string) => void;
  onRefreshTools: (serverId: string) => void;
  panelError: string | null;
}

export const AvailableToolsModal: React.FC<AvailableToolsModalProps> = ({
  isOpen,
  onClose,
  tools,
  runtimeById,
  onStartServer,
  onRefreshTools,
  panelError,
}) => {
  const [collapsedServers, setCollapsedServers] = useState<Set<string>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toolsByServer = (() => {
    const map = new Map<string, any[]>();
    for (const t of tools) {
      const sid = String(t?.serverId ?? "unknown");
      const arr = map.get(sid) ?? [];
      arr.push(t);
      map.set(sid, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const allServerIds = Array.from(new Set([...Object.keys(runtimeById), ...toolsByServer.map(([sid]) => sid)])).sort((a, b) => a.localeCompare(b));

  const toggleCollapse = (serverId: string) => {
    setCollapsedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const toggleToolExpand = (toolName: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const getServerStatusInfo = (runtime: any) => {
    const state = String(runtime?.state ?? "unknown");
    const lastError = runtime?.lastError;
    const toolsCacheAt = runtime?.toolsCacheAt;
    const toolCount = runtime?.tools?.length ?? 0;
    
    let connectionStatus = "unknown";
    let connectionColor = "bg-zinc-500";
    let pulse = false;
    
    if (state === "READY" || state === "INITIALIZED") {
      connectionStatus = "connected";
      connectionColor = "bg-emerald-500";
      pulse = true;
    } else if (state === "STARTING" || state === "LISTING_TOOLS") {
      connectionStatus = "connecting";
      connectionColor = "bg-amber-500";
      pulse = true;
    } else if (state === "ERROR") {
      connectionStatus = "error";
      connectionColor = "bg-red-500";
    } else if (state === "IDLE" || state === "STOPPED") {
      connectionStatus = "stopped";
      connectionColor = "bg-zinc-600";
    }

    return {
      state,
      connectionStatus,
      connectionColor,
      pulse,
      lastError,
      toolsCacheAt,
      toolCount
    };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Tools">
      <div className="p-4 space-y-4">
        {panelError && (
          <div className="text-xs text-red-300 border border-red-900/40 bg-red-900/10 rounded p-2 whitespace-pre-wrap break-words">{panelError}</div>
        )}
        {allServerIds.length === 0 ? (
          <div className="text-sm text-zinc-500">No MCP servers.</div>
        ) : (
          allServerIds.map((sid) => {
            const runtime = runtimeById[sid];
            const list = toolsByServer.find((x) => x[0] === sid)?.[1] ?? [];
            const statusInfo = getServerStatusInfo(runtime);
            const isCollapsed = collapsedServers.has(sid);
            
            return (
              <div key={sid} className="border border-zinc-800 bg-zinc-950/40 rounded overflow-hidden">
                <div 
                  className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => toggleCollapse(sid)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-zinc-400 transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}>▶</span>
                    <div className={`w-2 h-2 rounded-full ${statusInfo.connectionColor} ${statusInfo.pulse ? 'animate-pulse' : ''} flex-none`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-zinc-200 break-all">{sid}</div>
                      <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                        <Badge variant={
                          statusInfo.connectionStatus === 'connected' ? 'success' :
                          statusInfo.connectionStatus === 'connecting' ? 'warning' :
                          statusInfo.connectionStatus === 'error' ? 'error' : 'default'
                        }>
                          {statusInfo.connectionStatus}
                        </Badge>
                        {statusInfo.lastError && (
                          <span className="text-red-400">⚠ {String(statusInfo.lastError).slice(0, 30)}</span>
                        )}
                        {statusInfo.toolsCacheAt && (
                          <span className="text-zinc-500">
                            • {statusInfo.toolCount} tools
                          </span>
                        )}
                        {statusInfo.toolsCacheAt && (
                          <span className="text-zinc-600">
                            • cached {new Date(statusInfo.toolsCacheAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); onStartServer(sid); }}
                    >
                      Start
                    </Button>
                    <Button 
                      variant="secondary"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); onRefreshTools(sid); }}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="p-3 pt-0 mt-3 space-y-2 border-t border-zinc-800/50">
                    {list.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-2">No exposed tools.</div>
                    ) : (
                      list.map((t) => {
                        const toolName = String(t?.name ?? "");
                        const isToolExpanded = expandedTools.has(toolName);
                        return (
                          <div key={toolName} className="border border-zinc-800 bg-zinc-950/20 rounded overflow-hidden">
                            <div
                              className="flex items-center justify-between gap-3 p-2 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                              onClick={() => toggleToolExpand(toolName)}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-xs text-zinc-200 break-all">{toolName}</div>
                              </div>
                              <span className={`text-zinc-400 transition-transform ${isToolExpanded ? 'rotate-90' : 'rotate-0'}`}>▶</span>
                            </div>
                            {isToolExpanded && (
                              <div className="p-2 pt-0 mt-2 border-t border-zinc-800/50">
                                {t?.description ? <div className="text-xs text-zinc-500 whitespace-pre-wrap break-words">{String(t.description)}</div> : null}
                                <div className="text-[10px] text-zinc-400 mt-2">
                                  execution governed by governance{t.riskLevel ? ` • risk:${t.riskLevel}` : ""}
                                </div>
                                {t?.parameters ? (
                                  <div className="mt-2">
                                    <div className="text-[10px] text-zinc-500 font-semibold">Parameters:</div>
                                    <pre className="text-[10px] text-zinc-600 overflow-x-auto">{JSON.stringify(t.parameters, null, 2)}</pre>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};
