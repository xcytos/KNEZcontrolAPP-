// ─── ToolExecutionBridge.ts ────────────────────────────────────────────────
// MCP/tool execution wrapper
// Responsibilities: executeTool, return normalized result
// Rules: NO UI logic, NO streaming logic
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";
import { toolExecutionService } from "../../mcp/ToolExecutionService";

export interface ToolExecutionResult {
  ok: boolean;
  result?: any;
  error?: string;
  executionTimeMs?: number;
}

export class ToolExecutionBridge {
  async executeTool(toolName: string, args: any): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.debug("tool_execution_bridge", "tool_execution_started", { toolName });
      
      const outcome = await toolExecutionService.executeNamespacedTool(
        toolName,
        args,
        { timeoutMs: 30000 } // Default 30s timeout
      );

      const executionTimeMs = Date.now() - startTime;
      
      if (outcome.ok) {
        logger.debug("tool_execution_bridge", "tool_execution_success", { 
          toolName, 
          executionTimeMs 
        });

        return {
          ok: true,
          result: outcome.result,
          executionTimeMs
        };
      } else {
        logger.error("tool_execution_bridge", "tool_execution_failed", { 
          toolName, 
          error: outcome.error.message,
          executionTimeMs 
        });

        return {
          ok: false,
          error: outcome.error.message,
          executionTimeMs
        };
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("tool_execution_bridge", "tool_execution_failed", { 
        toolName, 
        error: errorMessage,
        executionTimeMs 
      });

      return {
        ok: false,
        error: errorMessage,
        executionTimeMs
      };
    }
  }
}
