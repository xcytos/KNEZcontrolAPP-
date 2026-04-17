/**
 * AgentOrchestrator - Central brain for agent execution
 * Owns the loop, tool execution, retries, decisions, and final output
 */

import { agentLoopService } from "./AgentLoopService";
import { agentContextManager, AgentContext } from "./AgentContext";
import { loopController } from "./LoopController";
import { retryStrategyEngine } from "./RetryStrategyEngine";
import { executionSandbox } from "./ExecutionSandbox";
import { toolResultNormalizer } from "./ToolResultNormalizer";
import { securityLayer } from "./SecurityLayer";
import { agentTracer } from "./AgentTracer";
import { knezClient } from "../KnezClient";
import { toolExposureService } from "../ToolExposureService";
import { toolExecutionService } from "../ToolExecutionService";

export interface AgentCallbacks {
  onThinking: (isThinking: boolean) => void;
  onStreamingChunk: (chunk: string) => void;
  onToolStart: (toolName: string, args: any) => void;
  onToolEnd: (toolName: string, result: any, success: boolean) => void;
  onFinal: (finalOutput: string) => void;
}

export interface AgentOrchestratorConfig {
  maxAgentTime: number;
  maxSteps: number;
}

export class AgentOrchestrator {
  private config: AgentOrchestratorConfig = {
    maxAgentTime: 20000, // 20 seconds
    maxSteps: 5
  };

  constructor(config?: Partial<AgentOrchestratorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Main entry point - run agent for a session
   */
  async runAgent(
    sessionId: string,
    userInput: string,
    callbacks: AgentCallbacks
  ): Promise<void> {
    const startTime = Date.now();
    let context: AgentContext;

    try {
      // Initialize context
      agentLoopService.initializeContext(sessionId, userInput);
      context = agentContextManager.getContext(sessionId)!;
      agentContextManager.setPhase(sessionId, "executing");

      // Start trace
      agentTracer.startTrace(sessionId);

      callbacks.onThinking(true);

      // Main agent loop
      let step = 0;
      let totalRetries = 0;

      while (step < this.config.maxSteps) {
        const elapsedTime = Date.now() - startTime;

        // Check global timeout
        if (elapsedTime > this.config.maxAgentTime) {
          agentTracer.logFailure(sessionId, "timeout", "Global timeout exceeded", step);
          break;
        }

        // Get loop decision
        const decision = loopController.getDecision(context, elapsedTime);

        if (decision.shouldStop) {
          agentTracer.logStep(sessionId, {
            stepNumber: step,
            decision: decision.reason || "Loop stopped",
            timing: { start: Date.now(), end: Date.now(), duration: 0 }
          });
          break;
        }

        if (!decision.shouldContinue) {
          if (decision.shouldForceAnswer) {
            agentTracer.logStep(sessionId, {
              stepNumber: step,
              decision: decision.reason || "Forcing final answer",
              timing: { start: Date.now(), end: Date.now(), duration: 0 }
            });
            break;
          } else {
            break;
          }
        }

        // Execute step
        const stepResult = await this.executeStep(sessionId, userInput, step, callbacks, context, totalRetries);

        if (stepResult.shouldStop) {
          break;
        }

        if (stepResult.retryCount > 0) {
          totalRetries += stepResult.retryCount;
        }

        step++;
      }

      // Generate final answer
      const finalAnswer = await this.generateFinalAnswer(sessionId, context);
      callbacks.onFinal(finalAnswer);

      // End trace
      agentTracer.endTrace(sessionId);

      // Finalize context
      agentLoopService.finalizeContext(sessionId);

    } catch (error: any) {
      agentTracer.logFailure(sessionId, "execution_error", error.message, 0);
      callbacks.onFinal(`Error: ${error.message}`);
    } finally {
      callbacks.onThinking(false);
    }
  }

  /**
   * Execute a single step in the agent loop
   */
  private async executeStep(
    sessionId: string,
    userInput: string,
    step: number,
    callbacks: AgentCallbacks,
    context: AgentContext,
    totalRetries: number
  ): Promise<{ shouldStop: boolean; retryCount: number }> {
    let retryCount = 0;

    agentLoopService.incrementStep(sessionId);

    // Call model to get decision
    const modelOutput = await this.callModel(sessionId, userInput, context);

    // Check if model wants to execute a tool
    const toolCall = this.parseToolCall(modelOutput);

    if (!toolCall) {
      // Model returned final answer
      callbacks.onFinal(modelOutput);
      return { shouldStop: true, retryCount: 0 };
    }

    // Security gate
    const validation = securityLayer.validateToolCall(toolCall.name, toolCall.args);
    if (!validation.allowed) {
      agentTracer.logFailure(sessionId, "security_blocked", `Tool blocked: ${validation.reason}`, step);
      return { shouldStop: true, retryCount: 0 };
    }

    // Execute tool with retry logic
    let toolResult: any;
    let toolSuccess = false;

    for (let attempt = 0; attempt <= 2; attempt++) {
      callbacks.onToolStart(toolCall.name, toolCall.args);

      const execStart = Date.now();

      try {
        toolResult = await this.executeTool(sessionId, toolCall.name, toolCall.args);
        toolSuccess = true;

        agentTracer.logToolCall(
          sessionId,
          `${sessionId}-tool-${step}-${attempt}`,
          toolCall.name,
          toolCall.args,
          toolResult,
          true,
          execStart,
          Date.now()
        );

        callbacks.onToolEnd(toolCall.name, toolResult, true);
        break;

      } catch (error: any) {
        const errorMsg = error.message;
        const failureType = this.classifyFailure(errorMsg);

        agentTracer.logFailure(sessionId, failureType, errorMsg, step);

        // Check retry strategy
        const retryStrategy = await retryStrategyEngine.getRetryStrategy(
          failureType,
          toolCall.args,
          attempt,
          totalRetries + retryCount
        );

        if (!retryStrategy.shouldRetry) {
          callbacks.onToolEnd(toolCall.name, { error: errorMsg }, false);
          return { shouldStop: true, retryCount };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryStrategy.delayMs));

        // Update args if refined
        if (retryStrategy.refinedArgs) {
          toolCall.args = retryStrategy.refinedArgs;
        }

        retryCount++;
        agentTracer.logRetry(sessionId, attempt + 1, toolCall.args, errorMsg);
      }
    }

    if (!toolSuccess) {
      return { shouldStop: true, retryCount };
    }

    // Normalize tool result
    const normalized = toolResultNormalizer.normalize(toolCall.name, toolResult);
    const modelInput = normalized.structuredData;

    // Update context with tool result
    agentLoopService.recordToolExecution(sessionId, toolCall.name, toolCall.args, toolResult, true);
    agentContextManager.setIntermediateState(sessionId, `tool_${toolCall.name}`, modelInput);

    // Check for pagination
    if (toolResult.pagination?.hasNext) {
      await this.handlePagination(sessionId, toolCall.name, toolCall.args, context);
    }

    return { shouldStop: false, retryCount };
  }

  /**
   * Call the model
   */
  private async callModel(sessionId: string, userInput: string, _context: AgentContext): Promise<string> {
    const toolsForModel = toolExposureService.getToolsForModel();
    const contextSummary = agentLoopService.getContextSummary(sessionId);

    const systemPrompt = `
You are an intelligent agent that executes tools with self-correction capabilities.

CRITICAL RULES:
1. When a tool fails, ANALYZE the error message to understand WHY it failed
2. If the error indicates:
   - Selector not found: Try alternative selectors (data-testid, aria-label, class)
   - Navigation failed: Check URL validity, try different navigation method
   - Timeout: Increase timeout, retry with same args
   - Invalid arguments: Fix the argument format or values
3. NEVER give up after a single failure
4. If multiple attempts fail, explain what you tried and what the errors were
5. Use the tool execution history to avoid repeating failed approaches

${contextSummary}

TOOL CALL FORMAT:
{"tool_call":{"name":"<tool_name>","arguments":{...}}}

PLAIN TEXT FORMAT:
For normal conversation, respond directly with natural language.
`;

    const conversation = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput }
    ];

    // Call KNEZ client
    const res = await knezClient.chatCompletionsNonStreamRaw(conversation as any, sessionId, {
      tools: toolsForModel,
      toolChoice: toolsForModel.length ? "auto" : "none"
    });

    const msg = res?.choices?.[0]?.message as any;
    return String(msg?.content ?? "");
  }

  /**
   * Parse tool call from model output
   */
  private parseToolCall(modelOutput: string): { name: string; args: any } | null {
    const text = String(modelOutput ?? "").trim();
    if (!text) return null;

    // Try direct JSON first
    if (text.includes('"tool_call"')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.tool_call) {
          return { name: parsed.tool_call.name, args: parsed.tool_call.arguments };
        }
      } catch {
        // Invalid JSON, try other formats
      }
    }

    // Try markdown code block extraction
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?(\{.*?\})\s*```/s);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (parsed.tool_call) {
          return { name: parsed.tool_call.name, args: parsed.tool_call.arguments };
        }
      } catch {
        // Invalid JSON in code block
      }
    }

    // Try to find JSON object in mixed text
    const jsonMatch = text.match(/\{[^{}]*"tool_call"[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_call) {
          return { name: parsed.tool_call.name, args: parsed.tool_call.arguments };
        }
      } catch {
        // Invalid JSON
      }
    }

    return null;
  }

  /**
   * Execute a tool
   */
  private async executeTool(sessionId: string, toolName: string, args: any): Promise<any> {
    const executionId = `${sessionId}-${toolName}-${Date.now()}`;

    return executionSandbox.execute(executionId, async (_signal) => {
      // Resolve namespaced name from toolExposureService
      const toolsCatalog = toolExposureService.getCatalog();
      const toolMeta = toolsCatalog.find(t => t.originalName === toolName || t.name === toolName);

      if (!toolMeta) {
        throw new Error(`Tool not found in catalog: ${toolName}`);
      }

      const namespacedName = toolMeta.name;

      // Execute via toolExecutionService (real MCP tool execution)
      const outcome = await toolExecutionService.executeNamespacedTool(namespacedName, args, {
        timeoutMs: 30000,
        traceId: executionId
      });

      if (outcome.ok) {
        return { success: true, data: outcome.result, durationMs: outcome.durationMs };
      } else {
        throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
      }
    }, 30000);
  }

  /**
   * Classify failure type
   */
  private classifyFailure(errorMsg: string): string {
    if (errorMsg.includes("selector") || errorMsg.includes("element")) {
      return "selector_not_found";
    }
    if (errorMsg.includes("navigation") || errorMsg.includes("navigate")) {
      return "navigation_failed";
    }
    if (errorMsg.includes("timeout")) {
      return "timeout";
    }
    if (errorMsg.includes("argument") || errorMsg.includes("invalid")) {
      return "invalid_args";
    }
    return "tool_execution_exception";
  }

  /**
   * Handle pagination
   */
  private async handlePagination(sessionId: string, toolName: string, args: any, _context: AgentContext): Promise<void> {
    const nextPageArgs = { ...args, page: (args.page || 1) + 1 };
    agentContextManager.setIntermediateState(sessionId, `pagination_${toolName}`, nextPageArgs);
  }

  /**
   * Generate final answer
   */
  private async generateFinalAnswer(sessionId: string, _context: AgentContext): Promise<string> {
    const summary = agentLoopService.exportContext(sessionId);
    return `Final answer based on ${summary.toolHistory.length} tool executions.`;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AgentOrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentOrchestratorConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const agentOrchestrator = new AgentOrchestrator();
