import React, { useState, useMemo, useEffect } from 'react';
import { ChatMessage } from '../../domain/DataContracts';
import { agentTracer, AgentTrace } from '../../services/agent/AgentTracer';

interface ToolCallHistory {
  tool: string;
  status: string;
  executionTimeMs?: number;
  mcpLatencyMs?: number;
  timestamp: string;
  sessionId: string;
  messageId: string;
}

interface DebugPanelProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ messages, isOpen, onClose }) => {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [agentTraces, setAgentTraces] = useState<Map<string, AgentTrace>>(new Map());

  // Fetch AgentTracer data when panel opens
  useEffect(() => {
    if (isOpen) {
      const traces = new Map<string, AgentTrace>();
      const allTraces = agentTracer.getAllCompletedTraces();
      allTraces.forEach(trace => {
        traces.set(trace.sessionId, trace);
      });
      
      // Also include active traces
      const activeTrace = selectedSession ? agentTracer.getActiveTrace(selectedSession) : null;
      if (activeTrace) {
        traces.set(activeTrace.sessionId, activeTrace);
      }
      
      setAgentTraces(traces);
    }
  }, [isOpen, selectedSession]);

  const toolCallHistory = useMemo(() => {
    const history: ToolCallHistory[] = [];
    
    messages.forEach(msg => {
      if (msg.toolCall) {
        history.push({
          tool: msg.toolCall.tool,
          status: msg.toolCall.status,
          executionTimeMs: msg.toolCall.executionTimeMs,
          mcpLatencyMs: msg.toolCall.mcpLatencyMs,
          timestamp: msg.createdAt,
          sessionId: msg.sessionId,
          messageId: msg.id,
        });
      }
    });

    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages]);

  const sessions = useMemo(() => {
    const sessionSet = new Set<string>();
    messages.forEach(msg => sessionSet.add(msg.sessionId));
    return Array.from(sessionSet);
  }, [messages]);

  const filteredHistory = useMemo(() => {
    if (!selectedSession) return toolCallHistory;
    return toolCallHistory.filter(h => h.sessionId === selectedSession);
  }, [toolCallHistory, selectedSession]);

  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const succeeded = filteredHistory.filter(h => h.status === 'succeeded' || h.status === 'completed').length;
    const failed = filteredHistory.filter(h => h.status === 'failed').length;
    const avgExecutionTime = filteredHistory
      .filter(h => h.executionTimeMs !== undefined)
      .reduce((sum, h) => sum + (h.executionTimeMs || 0), 0) / 
      filteredHistory.filter(h => h.executionTimeMs !== undefined).length || 0;
    const avgMcpLatency = filteredHistory
      .filter(h => h.mcpLatencyMs !== undefined)
      .reduce((sum, h) => sum + (h.mcpLatencyMs || 0), 0) / 
      filteredHistory.filter(h => h.mcpLatencyMs !== undefined).length || 0;

    // Add AgentTracer stats if available
    let agentTotalSteps = 0;
    let agentTotalFailures = 0;
    let agentTotalRetries = 0;
    let agentTotalTime = 0;
    let agentSuccessRate = 0;

    if (selectedSession && agentTraces.has(selectedSession)) {
      const trace = agentTraces.get(selectedSession)!;
      agentTotalSteps = trace.summary.totalSteps;
      agentTotalFailures = trace.summary.totalFailures;
      agentTotalRetries = trace.summary.totalRetries;
      agentTotalTime = trace.summary.totalTime;
      agentSuccessRate = trace.summary.successRate;
    } else if (!selectedSession && agentTraces.size > 0) {
      // Aggregate all traces
      const allSummaries = Array.from(agentTraces.values()).map(t => t.summary);
      agentTotalSteps = allSummaries.reduce((sum, s) => sum + s.totalSteps, 0);
      agentTotalFailures = allSummaries.reduce((sum, s) => sum + s.totalFailures, 0);
      agentTotalRetries = allSummaries.reduce((sum, s) => sum + s.totalRetries, 0);
      agentTotalTime = allSummaries.reduce((sum, s) => sum + s.totalTime, 0);
      const totalTools = allSummaries.reduce((sum, s) => sum + s.totalTools, 0);
      const successfulTools = allSummaries.reduce((sum, s) => sum + (s.totalTools * s.successRate), 0);
      agentSuccessRate = totalTools > 0 ? successfulTools / totalTools : 0;
    }

    return { 
      total, succeeded, failed, avgExecutionTime, avgMcpLatency,
      agentTotalSteps, agentTotalFailures, agentTotalRetries, agentTotalTime, agentSuccessRate
    };
  }, [filteredHistory, selectedSession, agentTraces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-6xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-bold text-white">Debug Panel - Agent Execution Traces</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Session Filter */}
          <div className="w-48 border-r border-zinc-700 p-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-zinc-400 mb-2">SESSIONS</h3>
            <button
              onClick={() => setSelectedSession(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs mb-1 ${
                !selectedSession ? 'bg-indigo-900/50 text-indigo-200' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Sessions
            </button>
            {sessions.map(session => (
              <button
                key={session}
                onClick={() => setSelectedSession(session)}
                className={`w-full text-left px-2 py-1 rounded text-xs mb-1 truncate ${
                  selectedSession === session ? 'bg-indigo-900/50 text-indigo-200' : 'text-zinc-400 hover:text-white'
                }`}
                title={session}
              >
                {session.slice(0, 12)}...
              </button>
            ))}
          </div>

          {/* Stats & History */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats */}
            <div className="p-4 border-b border-zinc-700">
              <h3 className="text-xs font-bold text-zinc-400 mb-3">AGENT TRACER STATISTICS</h3>
              <div className="grid grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.agentTotalSteps}</div>
                  <div className="text-xs text-zinc-400">Total Steps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.succeeded}</div>
                  <div className="text-xs text-zinc-400">Succeeded</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.agentTotalFailures}</div>
                  <div className="text-xs text-zinc-400">Failures</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.agentTotalRetries}</div>
                  <div className="text-xs text-zinc-400">Retries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {stats.agentTotalTime > 0 ? `${(stats.agentTotalTime / 1000).toFixed(1)}s` : 'N/A'}
                  </div>
                  <div className="text-xs text-zinc-400">Total Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {(stats.agentSuccessRate * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-zinc-400">Success Rate</div>
                </div>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-bold text-zinc-400 mb-2">EXECUTION STEPS</h3>
              {selectedSession && agentTraces.has(selectedSession) ? (
                <div className="space-y-3">
                  {agentTraces.get(selectedSession)!.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-800 rounded p-3 border border-zinc-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-zinc-300">Step {step.stepNumber + 1}</span>
                        <span className="text-[10px] text-zinc-500">
                          {step.timing.duration > 0 ? `${step.timing.duration}ms` : ''}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-200 mb-2">{step.decision}</div>
                      {step.toolCall && (
                        <div className="mt-2 p-2 bg-zinc-900/50 rounded border border-zinc-800">
                          <div className="text-[10px] font-mono text-zinc-400 mb-1">Tool: {step.toolCall.name}</div>
                          <div className={`text-[10px] font-mono px-2 py-0.5 rounded inline-block ${
                            step.toolCall.success
                              ? 'bg-green-900/20 text-green-300'
                              : 'bg-red-900/20 text-red-300'
                          }`}>
                            {step.toolCall.success ? 'Success' : 'Failed'}
                          </div>
                          {step.toolCall.result && (
                            <div className="mt-2 text-[10px] text-zinc-400 truncate">
                              {typeof step.toolCall.result === 'string'
                                ? step.toolCall.result.slice(0, 100)
                                : JSON.stringify(step.toolCall.result).slice(0, 100)}
                            </div>
                          )}
                        </div>
                      )}
                      {step.failure && (
                        <div className="mt-2 p-2 bg-red-900/10 rounded border border-red-900/30">
                          <div className="text-[10px] font-mono text-red-400">Failure: {step.failure.type}</div>
                          <div className="text-[10px] text-red-300 mt-1">{step.failure.message}</div>
                        </div>
                      )}
                      {step.retry && (
                        <div className="mt-2 p-2 bg-yellow-900/10 rounded border border-yellow-900/30">
                          <div className="text-[10px] font-mono text-yellow-400">Retry Attempt {step.retry.attempt}</div>
                          <div className="text-[10px] text-yellow-300 mt-1">
                            Error: {step.retry.originalError.slice(0, 80)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <h3 className="text-xs font-bold text-zinc-400 mb-2 mt-4">TOOL CALL HISTORY</h3>
                  {filteredHistory.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">
                      {selectedSession ? 'No AgentTracer data for this session' : 'No tool calls recorded'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredHistory.map((item, idx) => (
                        <div
                          key={`${item.messageId}-${idx}`}
                          className="bg-zinc-800 rounded p-3 border border-zinc-700"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-mono text-zinc-200">{item.tool}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              item.status === 'succeeded' || item.status === 'completed'
                                ? 'bg-green-900/20 text-green-300'
                                : item.status === 'failed'
                                  ? 'bg-red-900/20 text-red-300'
                                  : 'bg-blue-900/20 text-blue-200'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                            <div>
                              <span className="text-zinc-500">Time: </span>
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </div>
                            {item.executionTimeMs && (
                              <div>
                                <span className="text-zinc-500">Exec: </span>
                                {item.executionTimeMs}ms
                              </div>
                            )}
                            {item.mcpLatencyMs && (
                              <div>
                                <span className="text-zinc-500">MCP: </span>
                                {item.mcpLatencyMs}ms
                              </div>
                            )}
                            <div>
                              <span className="text-zinc-500">Session: </span>
                              {item.sessionId.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
