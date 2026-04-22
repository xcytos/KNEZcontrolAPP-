/**
 * Real-time Tool Executor
 * 
 * Bridges WebSocket tool_call events to MCP execution.
 * When a tool_call event is received via WebSocket, this service:
 * 1. Executes the tool via existing MCP infrastructure
 * 2. Sends the result back to backend via HTTP
 * 
 * This maintains separation of concerns while enabling event-driven tool execution.
 */

import { knezClient } from '../knez/KnezClient';
import { toolExecutionService } from '../mcp/ToolExecutionService';
import { logger } from '../utils/LogService';
import { ToolCallEventData } from '../../domain/RealtimeProtocol';
import { realtimeEventHandler } from './RealtimeEventHandler';

export class RealtimeToolExecutor {
  private enabled = false;
  private sessionId: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.setupToolCallHandler();
  }

  /**
   * Enable real-time tool execution for a session
   */
  enable(sessionId: string): void {
    this.sessionId = sessionId;
    this.enabled = true;
    logger.info('realtime_tool_executor', 'enabled', { sessionId });
  }

  /**
   * Disable real-time tool execution
   */
  disable(): void {
    this.enabled = false;
    this.sessionId = null;
    logger.info('realtime_tool_executor', 'disabled');
  }

  /**
   * Setup tool call event handler
   */
  private setupToolCallHandler(): void {
    this.unsubscribe = realtimeEventHandler.onToolCall(async (data: ToolCallEventData) => {
      if (!this.enabled) {
        logger.debug('realtime_tool_executor', 'disabled_ignoring_tool_call', { tool_name: data.tool_name });
        return;
      }

      if (this.sessionId !== data.call_id?.split(':')[0]) {
        logger.debug('realtime_tool_executor', 'session_mismatch_ignoring_tool_call', { 
          expected: this.sessionId, 
          received: data.call_id 
        });
        return;
      }

      await this.executeTool(data);
    });
  }

  /**
   * Execute tool via MCP and send result to backend
   */
  private async executeTool(data: ToolCallEventData): Promise<void> {
    const startTime = Date.now();
    logger.info('realtime_tool_executor', 'executing_tool', { 
      tool_name: data.tool_name, 
      tool_id: data.tool_id 
    });

    try {
      // Execute tool via existing MCP infrastructure
      const outcome = await toolExecutionService.executeNamespacedTool(
        data.tool_name,
        data.arguments
      );

      const executionTimeMs = Date.now() - startTime;

      if (!outcome.ok) {
        throw new Error(outcome.error.message || 'Tool execution failed');
      }

      const result = outcome.result;

      logger.info('realtime_tool_executor', 'tool_execution_success', { 
        tool_name: data.tool_name, 
        execution_time_ms: executionTimeMs 
      });

      // Send result to backend via HTTP
      await this.submitToolResult({
        tool_id: data.tool_id,
        result: result,
        error: null,
        execution_time_ms: executionTimeMs,
        call_id: data.call_id
      });

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('realtime_tool_executor', 'tool_execution_failed', { 
        tool_name: data.tool_name, 
        error: errorMessage,
        execution_time_ms: executionTimeMs 
      });

      // Send error result to backend
      await this.submitToolResult({
        tool_id: data.tool_id,
        result: null,
        error: errorMessage,
        execution_time_ms: executionTimeMs,
        call_id: data.call_id
      });
    }
  }

  /**
   * Submit tool result to backend via HTTP
   */
  private async submitToolResult(data: {
    tool_id: string;
    result: any;
    error: string | null;
    execution_time_ms: number;
    call_id?: string;
  }): Promise<void> {
    if (!this.sessionId) {
      logger.warn('realtime_tool_executor', 'no_session_id_cannot_submit_result');
      return;
    }

    try {
      const baseUrl = knezClient['baseUrl']();
      const url = `${baseUrl}/v1/tool/result`;

      const payload = {
        session_id: this.sessionId,
        tool_id: data.tool_id,
        result: data.result,
        error: data.error,
        execution_time_ms: data.execution_time_ms,
        call_id: data.call_id
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      logger.debug('realtime_tool_executor', 'tool_result_submitted', { 
        tool_id: data.tool_id,
        status: 'success' 
      });

    } catch (error) {
      logger.error('realtime_tool_executor', 'tool_result_submission_failed', { 
        tool_id: data.tool_id,
        error: String(error) 
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.disable();
  }
}

// Singleton instance
export const realtimeToolExecutor = new RealtimeToolExecutor();
