import React, { useEffect, useMemo, useState } from "react";
import { taqwinMcpService } from "../../services/TaqwinMcpService";
import { getTaqwinToolPermissions, isTaqwinToolAllowed, setTaqwinToolEnabled } from "../../services/TaqwinToolPermissions";
import { McpToolDefinition } from "../../services/McpTypes";
import { sessionController } from "../../services/SessionController";
import { chatService } from "../../services/ChatService";
import { sessionDatabase } from "../../services/SessionDatabase";
import { ChatMessage, ToolCallMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";

function newLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}-${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
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
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => getTaqwinToolPermissions());

  const toolByName = useMemo(() => new Map(tools.map(t => [t.name, t])), [tools]);

  const defaultArgsForTool = (tool: string) => {
    const sessionId = sessionController.getSessionId();
    if (tool === "activate_taqwin_unified_consciousness") {
      return { level: "superintelligence", query: "Hello TAQWIN.", context: { session_id: sessionId } };
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
        if (!cancelled) setError(String(e?.message ?? e));
      }
    };
    void load(true);
    const t = window.setInterval(() => void load(true), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPermissions(getTaqwinToolPermissions());
  }, [isOpen]);

  if (!isOpen) return null;

  const runTool = async () => {
    setError("");
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
      const finishedAt = new Date().toISOString();
      await sessionDatabase.updateMessage(messageId, {
        toolCall: { ...toolCall, status: "succeeded", result, finishedAt }
      });
      await chatService.load(sessionId);
    } catch (e: any) {
      const finishedAt = new Date().toISOString();
      await sessionDatabase.updateMessage(messageId, {
        toolCall: { ...toolCall, status: "failed", error: String(e?.message ?? e), finishedAt }
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
            <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white">Close</button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-2">
            <div className="text-xs font-mono text-zinc-500 mb-2">registry</div>
            <div className="border border-zinc-800 rounded bg-zinc-950/40 overflow-hidden">
              {tools.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500">No tools loaded.</div>
              ) : (
                tools.map((t) => {
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
                          const next = !enabled;
                          setTaqwinToolEnabled(t.name, next);
                          setPermissions(getTaqwinToolPermissions());
                        }}
                        className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                          enabled ? "bg-blue-900/20 text-blue-200 border-blue-900/40" : "bg-zinc-950/50 text-zinc-500 border-zinc-800"
                        }`}
                        title={allowed ? "enabled" : "blocked by trust policy"}
                      >
                        {enabled ? "on" : "off"}
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
