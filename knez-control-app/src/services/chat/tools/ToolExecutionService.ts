// ─── ToolExecutionService.ts ────────────────────────────────────────────
// Extracted from ChatService.ts - Phase 1 Week 1
// Responsibilities: Tool execution, persistence, and trace management
// Dependencies injected: sessionDatabase, logger, mcpOrchestrator, toolExecutionService
// ─────────────────────────────────────────────────────────────────────────────

import { ChatMessage, ToolCallMessage } from "../../../domain/DataContracts";
import { sessionDatabase } from "../../session/SessionDatabase";
import { logger } from "../../utils/LogService";
import { mcpOrchestrator } from "../../../mcp/McpOrchestrator";
import { toolExecutionService } from "../../mcp/ToolExecutionService";
import { getTimeoutConfig, adaptiveTimeoutManager } from "../../utils/TimeoutConfig";

export interface ToolExecutionCallbacks {
  onToolTracePersisted: (sessionId: string, msg: ChatMessage) => void;
  onToolTraceUpdated: (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  emitEvent: (eventType: string, payload: any, sessionId: string) => void;
}

export interface ToolExecutionInput {
  sessionId: string;
  assistantId: string;
  toolCallId: string;
  toolName: string;
  args: any;
  traceId: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  payload: any;
  errorMsg?: string;
  errorCode?: string;
  serverId?: string;
  originalName?: string;
  durationMs?: number;
}

export interface SyntheticToolErrorInput {
  sessionId: string;
  assistantId: string;
  step: number;
  toolName: string;
  errorCode: string;
  errorMessage: string;
}

export class ToolExecutionService {
  private callbacks: ToolExecutionCallbacks;

  constructor(callbacks: ToolExecutionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Execute tool with deterministic error handling
   */
  async executeToolDeterministic(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const toolName = String(input.toolName ?? "").trim();
    const idx = toolName.indexOf("__");
    const serverIdHint = idx > 0 ? toolName.slice(0, idx) : undefined;
    const originalNameHint = idx > 0 && idx < toolName.length - 2 ? toolName.slice(idx + 2) : undefined;
    const runtimeHint = serverIdHint ? mcpOrchestrator.getServer(serverIdHint) : null;
    const startedAt = performance.now();

    this.callbacks.emitEvent("tool_call_started", {
      trace_id: input.traceId,
      tool_call_id: input.toolCallId,
      tool: toolName,
      server_id: serverIdHint ?? null,
      original_name: originalNameHint ?? null,
      pid: runtimeHint?.pid ?? null,
      framing: runtimeHint?.framing ?? null,
      generation: runtimeHint?.generation ?? null,
      status: "started",
      correlation_id: input.assistantId
    }, input.sessionId);

    logger.info("mcp_audit", "tool_call_started", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      tool: toolName,
      serverId: serverIdHint ?? null,
      originalName: originalNameHint ?? null,
      pid: runtimeHint?.pid ?? null,
      framing: runtimeHint?.framing ?? null,
      generation: runtimeHint?.generation ?? null,
      status: "started",
      correlationId: input.assistantId
    });

    logger.info("mcp_loop", "entering_tool_execution", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      correlationId: input.assistantId,
      tool: toolName
    });

    const timeoutConfig = getTimeoutConfig(toolName);
    const adaptiveTimeout = adaptiveTimeoutManager.getAdaptiveTimeout(toolName, timeoutConfig);

    let exec;
    try {
      exec = await toolExecutionService.executeNamespacedTool(toolName, input.args, {
        timeoutMs: adaptiveTimeout,
        traceId: input.traceId,
        toolCallId: input.toolCallId,
        correlationId: input.assistantId
      });
    } catch (error) {
      logger.error("mcp_loop", "tool_execution_unexpected_error", {
        traceId: input.traceId,
        toolCallId: input.toolCallId,
        tool: toolName,
        error: String(error)
      });
      return {
        ok: false,
        payload: { ok: false, error: { code: "tool_execution_error", message: String(error) } },
        errorMsg: `tool_execution_error:${String(error)}`,
        errorCode: "tool_execution_error",
        durationMs: Math.round(performance.now() - startedAt)
      };
    }

    if (!exec || !exec.tool) {
      logger.error("mcp_loop", "tool_execution_invalid_response", {
        traceId: input.traceId,
        toolCallId: input.toolCallId,
        tool: toolName
      });
      return {
        ok: false,
        payload: { ok: false, error: { code: "tool_execution_invalid_response", message: "Tool execution returned invalid response" } },
        errorMsg: "tool_execution_invalid_response:Tool execution returned invalid response",
        errorCode: "tool_execution_invalid_response",
        durationMs: Math.round(performance.now() - startedAt)
      };
    }

    const serverId = exec.tool.serverId;
    const originalName = exec.tool.originalName;
    const runtime = serverId ? mcpOrchestrator.getServer(serverId) : null;
    const durationMs = exec.ok
      ? (typeof exec.durationMs === "number" ? exec.durationMs : Math.round(performance.now() - startedAt))
      : Math.round(performance.now() - startedAt);

    if (exec.ok) {
      this.callbacks.emitEvent("tool_call_completed", {
        trace_id: input.traceId,
        tool_call_id: input.toolCallId,
        tool: toolName,
        server_id: serverId ?? null,
        original_name: originalName ?? null,
        pid: runtime?.pid ?? null,
        framing: runtime?.framing ?? null,
        generation: runtime?.generation ?? null,
        duration_ms: durationMs,
        durationMs,
        status: "succeeded",
        correlation_id: input.assistantId,
        execution_time_ms: durationMs
      }, input.sessionId);

      logger.info("mcp_audit", "tool_call_completed", {
        traceId: input.traceId,
        toolCallId: input.toolCallId,
        tool: toolName,
        serverId: serverId ?? null,
        originalName: originalName ?? null,
        pid: runtime?.pid ?? null,
        framing: runtime?.framing ?? null,
        generation: runtime?.generation ?? null,
        durationMs,
        status: "succeeded",
        correlationId: input.assistantId
      });

      return {
        ok: true,
        payload: exec.result,
        serverId,
        originalName,
        durationMs
      };
    }

    const errorMsg = exec.error ? `${exec.error.code}:${exec.error.message}` : "tool_execution_failed:Unknown error";
    const errorCode = exec.error?.code ?? "tool_execution_failed";

    this.callbacks.emitEvent("tool_call_failed", {
      trace_id: input.traceId,
      tool_call_id: input.toolCallId,
      tool: toolName,
      server_id: serverId ?? null,
      original_name: originalName ?? null,
      pid: runtime?.pid ?? null,
      framing: runtime?.framing ?? null,
      generation: runtime?.generation ?? null,
      duration_ms: durationMs,
      durationMs,
      error_code: errorCode,
      status: exec.kind === "denied" ? "denied" : "failed",
      correlation_id: input.assistantId
    }, input.sessionId);

    logger.warn("mcp_audit", "tool_call_failed", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      tool: toolName,
      serverId: serverId ?? null,
      originalName: originalName ?? null,
      pid: runtime?.pid ?? null,
      framing: runtime?.framing ?? null,
      generation: runtime?.generation ?? null,
      durationMs,
      errorCode,
      status: exec.kind === "denied" ? "denied" : "failed",
      correlationId: input.assistantId
    });

    return {
      ok: false,
      payload: { ok: false, error: { code: errorCode, message: errorMsg } },
      errorMsg,
      errorCode,
      serverId,
      originalName,
      durationMs
    };
  }

  /**
   * Persist tool trace message to database and notify state
   */
  async persistToolTrace(sessionId: string, msg: ChatMessage): Promise<void> {
    await sessionDatabase.saveMessages(sessionId, [msg]);
    this.callbacks.onToolTracePersisted(sessionId, msg);
  }

  /**
   * Update tool trace message in database and state
   */
  async updateToolTrace(sessionId: string, messageId: string, patch: Partial<ChatMessage>): Promise<void> {
    await sessionDatabase.updateMessage(messageId, patch as any);
    this.callbacks.onToolTraceUpdated(sessionId, messageId, patch);
  }

  /**
   * Serialize tool payload to string with length limit
   */
  stringifyToolPayload(value: any, maxChars: number): string {
    try {
      const raw = JSON.stringify(value ?? null);
      if (raw.length <= maxChars) return raw;
      return raw.slice(0, maxChars - 3) + "...";
    } catch {
      return String(value ?? "").slice(0, maxChars);
    }
  }

  /**
   * Create synthetic tool error message
   */
  async appendSyntheticToolError(input: SyntheticToolErrorInput, newMessageId: () => string): Promise<void> {
    const startedAt = new Date().toISOString();
    const traceMessageId = `${input.assistantId}-tool-${input.step}-error`;
    const errorPayload = { ok: false, error: { code: input.errorCode, message: input.errorMessage } };

    const toolCall: ToolCallMessage = {
      tool: input.toolName,
      args: {},
      status: "calling",
      startedAt
    };

    await this.persistToolTrace(input.sessionId, {
      id: traceMessageId,
      sessionId: input.sessionId,
      from: "tool_execution" as any,
      text: this.stringifyToolPayload(errorPayload, 20000),
      createdAt: startedAt,
      traceId: newMessageId(),
      toolCallId: `${input.assistantId}-tool-${input.step}-error-call`,
      toolCall,
      deliveryStatus: "delivered",
      replyToMessageId: input.assistantId,
      correlationId: input.assistantId
    });

    const executionTimeMs = Date.now() - new Date(startedAt).getTime();
    const mcpLatencyMs = Math.round(executionTimeMs * 0.3);

    await this.updateToolTrace(input.sessionId, traceMessageId, {
      text: this.stringifyToolPayload(errorPayload, 20000),
      toolCall: {
        ...toolCall,
        status: "failed",
        error: `${errorPayload.error.code}: ${errorPayload.error.message}`,
        finishedAt: new Date().toISOString(),
        executionTimeMs,
        mcpLatencyMs
      }
    });
  }
}
