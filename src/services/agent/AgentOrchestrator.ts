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
import { logger } from "../LogService";

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
      let directAnswerProvided = false;

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
          if (stepResult.directAnswerProvided) directAnswerProvided = true;
          break;
        }

        if (stepResult.retryCount > 0) {
          totalRetries += stepResult.retryCount;
        }

        step++;
      }

      // T14: after navigation, auto-snapshot so generateFinalAnswer has page content
      if (!directAnswerProvided) {
        const toolHistory = context.toolHistory ?? [];
        const lastTool = toolHistory[toolHistory.length - 1];
        const isNavResult = lastTool && /browser_navigate$/.test(lastTool.name) && lastTool.success;
        if (isNavResult) {
          const snapTool = toolExposureService.getToolsForModel().find((t) => /browser_snapshot$/.test(t.name));
          if (snapTool) {
            try {
              callbacks.onToolStart(snapTool.name, {});
              const snapResult = await this.executeTool(sessionId, snapTool.name, {});
              callbacks.onToolEnd(snapTool.name, snapResult, true);
              agentContextManager.addToolToHistory(sessionId, {
                name: snapTool.name,
                args: {},
                result: snapResult,
                success: true,
                timestamp: Date.now()
              });
            } catch { /* snapshot is best-effort */ }
          }
        }

        const finalAnswer = await this.generateFinalAnswer(sessionId, context);
        callbacks.onFinal(finalAnswer);
      }

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
  ): Promise<{ shouldStop: boolean; retryCount: number; directAnswerProvided?: boolean }> {
    let retryCount = 0;

    agentLoopService.incrementStep(sessionId);

    // PRE-MODEL: step 0 — detect tool intent directly from user text, bypass model for clear actions
    let toolCall: { name: string; args: any } | null = step === 0
      ? this.detectToolIntent(userInput)
      : null;

    if (!toolCall) {
      // Call model to get decision
      const modelOutput = await this.callModel(sessionId, userInput, context);

      toolCall = this.parseToolCall(modelOutput);

      if (!toolCall) {
        // POST-MODEL: if model refused, try intent detection as fallback
        if (this.isRefusal(modelOutput)) {
          toolCall = this.detectToolIntent(userInput);
        }

        if (!toolCall) {
          const cleanOutput = modelOutput.replace(/^\/plain_text\s*/i, "").trim();
          // Don't surface refusal text — let generateFinalAnswer handle empty case instead
          if (cleanOutput && !this.isRefusal(modelOutput)) {
            callbacks.onFinal(cleanOutput);
            return { shouldStop: true, retryCount: 0, directAnswerProvided: true };
          }
          return { shouldStop: true, retryCount: 0, directAnswerProvided: false };
        }
      }
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

    for (let attempt = 0; attempt < 1; attempt++) {
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

    const toolsStr = toolsForModel.length
      ? toolsForModel
          .map((t) => `- ${t.name}: ${t.description ?? "no description"}`)
          .join("\n")
      : "(no tools available)";

    const systemPrompt = `
You are a tool-calling agent. You have these tools:

${toolsStr}

OUTPUT FORMAT:
- To call a tool: output ONLY this JSON (no other text):
{"tool_call":{"name":"<tool_name>","arguments":{...}}}
- To reply in text: write plain text only.

WHEN TO CALL A TOOL:
- Navigation, browsing, clicking, typing, screenshots → call the matching playwright tool
- Web search or research → call web_intelligence
- Status checks → call get_server_status

${contextSummary}
`;

    // Few-shot examples built from actual available tools — small models need patterns, not just instructions
    const fewShot: Array<{ role: string; content: string }> = [];
    const navTool = toolsForModel.find((t) => /browser_navigate$/.test(t.name));
    const clickTool = toolsForModel.find((t) => /browser_click$/.test(t.name));
    const screenshotTool = toolsForModel.find((t) => /browser_take_screenshot$/.test(t.name));

    if (navTool) {
      fewShot.push(
        { role: "user", content: "navigate to https://example.com" },
        { role: "assistant", content: JSON.stringify({ tool_call: { name: navTool.name, arguments: { url: "https://example.com" } } }) }
      );
    }
    if (clickTool) {
      fewShot.push(
        { role: "user", content: "click the submit button" },
        { role: "assistant", content: JSON.stringify({ tool_call: { name: clickTool.name, arguments: { selector: "button[type=submit]", element: "submit button" } } }) }
      );
    }
    if (screenshotTool) {
      fewShot.push(
        { role: "user", content: "take a screenshot of the page" },
        { role: "assistant", content: JSON.stringify({ tool_call: { name: screenshotTool.name, arguments: { type: "png" } } }) }
      );
    }

    const conversation = [
      { role: "system", content: systemPrompt },
      ...fewShot,
      { role: "user", content: userInput }
    ];

    // Call KNEZ client — temperature=0 for deterministic JSON tool call output
    const res = await knezClient.chatCompletionsNonStreamRaw(conversation as any, sessionId, {
      tools: toolsForModel,
      toolChoice: toolsForModel.length ? "auto" : "none",
      temperature: 0
    });

    const msg = res?.choices?.[0]?.message as any;
    let content = String(msg?.content ?? "");

    // Handle native tool_calls response format — model may use tool_calls instead of content
    if (!content.trim() && Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
      const first = msg.tool_calls[0];
      const fn = first?.function ?? first;
      try {
        const args = typeof fn?.arguments === "string" ? JSON.parse(fn.arguments) : (fn?.arguments ?? {});
        content = JSON.stringify({ tool_call: { name: String(fn?.name ?? ""), arguments: args } });
      } catch {
        content = JSON.stringify({ tool_call: { name: String(fn?.name ?? ""), arguments: {} } });
      }
    }

    return content;
  }

  /**
   * Parse tool call from model output
   */
  private parseToolCall(modelOutput: string): { name: string; args: any } | null {
    const text = String(modelOutput ?? "").trim();
    if (!text) return null;

    // Helper: try to extract a tool call from a parsed JSON object
    const extractFromParsed = (parsed: any): { name: string; args: any } | null => {
      // Format 1: {"tool_call": {"name": "...", "arguments": {...}}}
      if (parsed?.tool_call?.name) {
        return { name: String(parsed.tool_call.name), args: parsed.tool_call.arguments ?? {} };
      }
      // Format 2: {"function_call": {"name": "...", "arguments": "..."}} (OpenAI legacy)
      if (parsed?.function_call?.name) {
        const rawArgs = parsed.function_call.arguments;
        const args = typeof rawArgs === "string" ? (JSON.parse(rawArgs) ?? {}) : (rawArgs ?? {});
        return { name: String(parsed.function_call.name), args };
      }
      // Format 3: {"name": "...", "arguments": {...}} (bare format)
      if (parsed?.name && typeof parsed.name === "string" && parsed.arguments !== undefined) {
        return { name: parsed.name, args: parsed.arguments ?? {} };
      }
      return null;
    };

    // Helper: extract first complete JSON object from text
    const extractJson = (src: string): any | null => {
      const start = src.indexOf("{");
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) {
            try { return JSON.parse(src.slice(start, i + 1)); } catch { return null; }
          }
        }
      }
      return null;
    };

    // 1. Try direct JSON parse of the whole text
    try {
      const parsed = JSON.parse(text);
      const result = extractFromParsed(parsed);
      if (result) return result;
    } catch { /* not valid JSON */ }

    // 2. Try markdown code blocks (```json ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        const result = extractFromParsed(parsed);
        if (result) return result;
      } catch { /* invalid JSON in code block */ }
    }

    // 3. Try extracting first JSON object from mixed text
    const parsed = extractJson(text);
    if (parsed) {
      const result = extractFromParsed(parsed);
      if (result) return result;
    }

    return null;
  }

  /**
   * T06 — Detect model refusal phrases so we can fall back to intent detection
   */
  private isRefusal(output: string): boolean {
    const REFUSALS = [
      /\bi(?:'m| am)\s+unable\s+to\b/i,
      /\bi\s+(?:cannot|can't)\s+(?:directly\s+)?(?:run|execute|use|access|browse|navigate|visit|open|perform)\b/i,
      /\bi\s+don't\s+have\s+(?:the\s+)?(?:ability|access|capability|tools?)\s+to\b/i,
      /\bi\s+(?:cannot|can't|am\s+not\s+able\s+to)\s+(?:access|browse|open|visit|navigate|use)\b/i,
      /(?:directly|actually)\s+(?:run|execute|access|use)\s+(?:tools|MCP|browser|playwright)/i,
      /\bnot\s+(?:able|capable)\s+to\s+(?:run|execute|browse|navigate|use)\b/i,
    ];
    return REFUSALS.some((r) => r.test(output));
  }

  /**
   * T01-T04, T08, T12 — Detect tool intent from user message without relying on model
   * Maps natural language patterns directly to tool+args
   */
  private detectToolIntent(userInput: string): { name: string; args: any } | null {
    const tools = toolExposureService.getToolsForModel();
    logger.info("intent_detection", "detect_attempt", { toolCount: tools.length, inputPreview: userInput.slice(0, 80) });
    if (!tools.length) return null;

    const input = userInput.trim();

    // Helper: find tool by name-suffix pattern
    const find = (pat: RegExp) => tools.find((t) => pat.test(t.name)) ?? null;

    // Helper: normalise URL — prepend https:// when scheme is missing
    const normalizeUrl = (raw: string): string => {
      const u = raw.trim().replace(/[.,!?;:)'"]+$/, "");
      return /^https?:\/\//i.test(u) ? u : `https://${u}`;
    };

    // ── NAVIGATION (navigate/go/open/visit/browse/load + URL or domain) ──────
    const navVerb = /(?:navigate|go|open|visit|browse|load)\s+(?:to\s+)?/i;
    const navMatch = input.match(new RegExp(navVerb.source + "([a-zA-Z0-9][^\\s,!?]+)", "i"));
    const inlineUrl = input.match(/\bhttps?:\/\/[^\s]+/i);
    const bareUrl   = input.match(/\b([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-z]{2,}(?:\/[^\s]*)?)\b/i);

    if (navMatch || inlineUrl || bareUrl) {
      const navTool = find(/browser_navigate$/);
      if (navTool) {
        const raw = navMatch?.[1] ?? inlineUrl?.[0] ?? bareUrl?.[1] ?? "";
        if (raw) return { name: navTool.name, args: { url: normalizeUrl(raw) } };
      }
    }

    // ── SCREENSHOT ────────────────────────────────────────────────────────────
    if (/(?:take\s+(?:a\s+)?)?screenshot|capture\s+(?:the\s+)?(?:screen|page)/i.test(input)) {
      const t = find(/browser_take_screenshot$/);
      if (t) return { name: t.name, args: { type: "png" } };
    }

    // ── SNAPSHOT / accessibility ──────────────────────────────────────────────
    if (/\bsnapshot\b|accessibility\s+snapshot|page\s+(?:content|structure)/i.test(input)) {
      const t = find(/browser_snapshot$/);
      if (t) return { name: t.name, args: {} };
    }

    // ── CLICK ─────────────────────────────────────────────────────────────────
    const clickMatch = input.match(/(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(.{2,60?}?)(?:\s+button|\s+link|\s+icon|\s+tab)?(?:\s*$|[.,!?])/i);
    if (clickMatch) {
      const t = find(/browser_click$/);
      if (t) return { name: t.name, args: { selector: clickMatch[1].trim(), element: clickMatch[1].trim() } };
    }

    // ── TYPE / FILL ───────────────────────────────────────────────────────────
    const typeMatch = input.match(/(?:type|enter|input)\s+["']?(.+?)["']?\s+in(?:to)?\s+(?:the\s+)?(.+)/i);
    if (typeMatch) {
      const t = find(/browser_type$/);
      if (t) return { name: t.name, args: { ref: typeMatch[2].trim(), text: typeMatch[1].trim() } };
    }

    // ── GO BACK ───────────────────────────────────────────────────────────────
    if (/\bgo\s+back\b/i.test(input)) {
      const t = find(/browser_navigate_back$/);
      if (t) return { name: t.name, args: {} };
    }

    // ── CLOSE ─────────────────────────────────────────────────────────────────
    if (/close\s+(?:the\s+)?(?:browser|page|tab)/i.test(input)) {
      const t = find(/browser_close$/);
      if (t) return { name: t.name, args: {} };
    }

    // ── TAQWIN tool patterns (T12) ────────────────────────────────────────────
    if (/(?:taqwin\s+)?(?:server\s+)?status|get\s+status/i.test(input)) {
      const t = find(/get_server_status$/);
      if (t) return { name: t.name, args: {} };
    }
    if (/(?:taqwin\s+)?(?:session|create\s+session|list\s+sessions?)/i.test(input) && !/screenshot/.test(input)) {
      const t = find(/session$/);
      if (t) return { name: t.name, args: { action: "list" } };
    }
    if (/(?:web\s+(?:search|intelligence|research)|search\s+(?:the\s+)?web)/i.test(input)) {
      const t = find(/web_intelligence$/);
      if (t) {
        const q = input.replace(/(?:web\s+(?:search|intelligence|research)|search\s+(?:the\s+)?web)\s+(?:for\s+)?/i, "").trim();
        return { name: t.name, args: { query: q || input } };
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
  private async generateFinalAnswer(sessionId: string, context: AgentContext): Promise<string> {
    const toolHistory = context.toolHistory ?? [];
    if (toolHistory.length === 0) {
      // No tools ran — model gave an empty response. Try a plain-text fallback call.
      try {
        const fallback = [
          { role: "system", content: "You are a helpful assistant. Reply in plain text only, no JSON, no tool calls." },
          { role: "user", content: context.currentGoal }
        ];
        const data = await knezClient.chatCompletionsNonStreamRaw(fallback as any, sessionId);
        const fc = String(data?.choices?.[0]?.message?.content ?? "")
          .replace(/^\/plain_text\s*/i, "")
          .trim();
        if (fc) return fc;
      } catch {
        // fall through
      }
      return ""; // empty string signals delivery failure
    }

    // Build a compact summary of tool results for the model to synthesize
    const toolSummary = toolHistory
      .map((h) => {
        const result = h.result;
        const resultStr = typeof result === "string"
          ? result
          : (result?.data != null
            ? (typeof result.data === "string" ? result.data : JSON.stringify(result.data))
            : JSON.stringify(result));
        return `Tool: ${h.name}\nResult: ${resultStr}`;
      })
      .join("\n\n");

    const messages = [
      { role: "system", content: "Based on the tool execution results provided, give a clear and complete plain-text answer. Do not output JSON or tool calls." },
      { role: "user", content: `Tool results:\n${toolSummary}` }
    ];

    try {
      const data = await knezClient.chatCompletionsNonStreamRaw(messages as any, sessionId);
      const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
      return content || "Task completed. See tool execution results above.";
    } catch {
      // If synthesis call fails, return a concise fallback using last result
      const last = toolHistory[toolHistory.length - 1];
      const lastResult = last?.result;
      const fallback = typeof lastResult === "string"
        ? lastResult
        : (lastResult?.data != null
          ? (typeof lastResult.data === "string" ? lastResult.data : JSON.stringify(lastResult.data))
          : null);
      return fallback || "Task completed. See tool execution results above.";
    }
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
