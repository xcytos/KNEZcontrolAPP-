import React, { useMemo } from "react";
import type { McpTrafficEvent } from "../../../mcp/inspector/McpTraffic";

interface TaqwinMcpInspectorProps {
  traffic: McpTrafficEvent[];
  selectedId: string | null;
}

interface TaqwinExecutionLog {
  id: string;
  timestamp: number;
  tool: string;
  requestRationale?: {
    what?: string;
    why?: string;
    memory_context?: string;
  };
  ticket?: string;
  executionId?: string;
  duration?: number;
  success: boolean;
  error?: string;
}

export const TaqwinMcpInspector: React.FC<TaqwinMcpInspectorProps> = ({ traffic, selectedId }) => {
  const executions = useMemo(() => {
    const logs: TaqwinExecutionLog[] = [];
    const requestMap = new Map<string, any>();

    for (const event of traffic) {
      if (event.kind === "request" && event.method === "tools/call") {
        const toolName = event.json?.params?.name;
        const args = event.json?.params?.arguments;
        const requestRationale = args?.request_rationale;
        const ticket = args?.ticket;
        
        if (toolName) {
          requestMap.set(event.id, {
            id: event.id,
            timestamp: event.at,
            tool: toolName,
            requestRationale,
            ticket,
          });
        }
      }

      if (event.kind === "response") {
        const request = requestMap.get(event.id);
        if (request) {
          const executionId = event.json?.result?.execution_id;
          const duration = event.json?.result?.duration_ms;
          
          logs.push({
            ...request,
            executionId,
            duration,
            success: event.ok,
            error: event.ok ? undefined : JSON.stringify(event.json?.error),
          });
          
          requestMap.delete(event.id);
        }
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [traffic]);

  const formatTime = (ts: number): string => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return String(ts);
    }
  };

  const formatDuration = (ms?: number): string => {
    if (ms === undefined) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-zinc-200">TAQWIN MCP Inspector</div>
        <div className="text-xs text-zinc-500">{executions.length} executions</div>
      </div>

      {!selectedId ? (
        <div className="text-sm text-zinc-500">Select an MCP server to view TAQWIN execution logs.</div>
      ) : executions.length === 0 ? (
        <div className="text-sm text-zinc-500">No TAQWIN executions recorded yet.</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {executions.map((exec) => (
            <div
              key={exec.id}
              className={`border rounded p-2 ${
                exec.success ? "border-zinc-700 bg-zinc-950" : "border-red-900/40 bg-red-900/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-mono text-xs text-zinc-200">{exec.tool}</div>
                <div className="text-[10px] text-zinc-500">{formatTime(exec.timestamp)}</div>
              </div>

              {exec.ticket && (
                <div className="text-[10px] text-blue-300 mb-1">
                  <span className="font-semibold">Ticket:</span> {exec.ticket}
                </div>
              )}

              {exec.executionId && (
                <div className="text-[10px] text-purple-300 mb-1">
                  <span className="font-semibold">Execution ID:</span> {exec.executionId.slice(0, 8)}...
                </div>
              )}

              {exec.requestRationale && (
                <div className="mb-1 space-y-1">
                  {exec.requestRationale.what && (
                    <div className="text-[10px] text-zinc-400">
                      <span className="font-semibold text-zinc-300">What:</span> {exec.requestRationale.what}
                    </div>
                  )}
                  {exec.requestRationale.why && (
                    <div className="text-[10px] text-zinc-400">
                      <span className="font-semibold text-zinc-300">Why:</span> {exec.requestRationale.why}
                    </div>
                  )}
                  {exec.requestRationale.memory_context && (
                    <div className="text-[10px] text-zinc-400">
                      <span className="font-semibold text-zinc-300">Memory Context:</span> {exec.requestRationale.memory_context}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className={`text-[10px] ${exec.success ? "text-emerald-300" : "text-red-300"}`}>
                  {exec.success ? "✓ Success" : "✗ Failed"}
                </div>
                <div className="text-[10px] text-zinc-500">
                  Duration: {formatDuration(exec.duration)}
                </div>
              </div>

              {exec.error && (
                <div className="mt-1 text-[10px] text-red-300 whitespace-pre-wrap break-words">
                  {exec.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
