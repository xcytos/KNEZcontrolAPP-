/**
 * RetryStrategyEngine - Adaptive retry logic for tool failures
 * Determines retry strategy based on failure type and context
 */

import { knezClient } from "../KnezClient";

export interface RetryStrategy {
  shouldRetry: boolean;
  refinedArgs?: any;
  delayMs: number;
  reason: string;
}

export interface RetryConfig {
  maxRetryPerStep: number;
  maxTotalRetries: number;
  defaultDelayMs: number;
  selectorNotFoundDelayMs: number;
  navigationFailedDelayMs: number;
  timeoutDelayMs: number;
}

export class RetryStrategyEngine {
  private config: RetryConfig = {
    maxRetryPerStep: 2,
    maxTotalRetries: 5,
    defaultDelayMs: 1000,
    selectorNotFoundDelayMs: 500,
    navigationFailedDelayMs: 2000,
    timeoutDelayMs: 3000
  };

  constructor(config?: Partial<RetryConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Get retry strategy based on failure type
   */
  async getRetryStrategy(
    failureType: string,
    args: any,
    attempt: number,
    totalRetries: number
  ): Promise<RetryStrategy> {
    // Check retry limits
    if (attempt >= this.config.maxRetryPerStep) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `Max retries per step reached (${this.config.maxRetryPerStep})`
      };
    }

    if (totalRetries >= this.config.maxTotalRetries) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `Max total retries reached (${this.config.maxTotalRetries})`
      };
    }

    // Determine strategy based on failure type
    switch (failureType) {
      case "selector_not_found":
        return this.handleSelectorNotFound(args);

      case "navigation_failed":
        return this.handleNavigationFailed();

      case "timeout":
        return this.handleTimeout(args);

      case "invalid_args":
        return await this.handleInvalidArgs(args);

      case "tool_execution_exception":
        return this.handleToolExecutionException(args);

      default:
        return this.handleGenericFailure();
    }
  }

  /**
   * Handle selector not found failure
   * Strategy: trigger snapshot + retry with delay
   */
  private handleSelectorNotFound(args: any): RetryStrategy {
    return {
      shouldRetry: true,
      refinedArgs: args, // Keep same args, should take snapshot before retry
      delayMs: this.config.selectorNotFoundDelayMs,
      reason: "Selector not found - will retry after snapshot"
    };
  }

  /**
   * Handle navigation failed failure
   * Strategy: retry with delay
   */
  private handleNavigationFailed(): RetryStrategy {
    return {
      shouldRetry: true,
      delayMs: this.config.navigationFailedDelayMs,
      reason: "Navigation failed - will retry with delay"
    };
  }

  /**
   * Handle timeout failure
   * Strategy: increase timeout in args
   */
  private handleTimeout(args: any): RetryStrategy {
    const refinedArgs = { ...args };
    if (refinedArgs.timeout) {
      refinedArgs.timeout = refinedArgs.timeout * 2;
    } else {
      refinedArgs.timeout = 30000; // Default 30s timeout
    }

    return {
      shouldRetry: true,
      refinedArgs,
      delayMs: this.config.timeoutDelayMs,
      reason: "Timeout occurred - will retry with increased timeout"
    };
  }

  /**
   * Handle invalid args failure
   * Strategy: apply heuristic fixes, then regenerate args via model if needed
   */
  private async handleInvalidArgs(args: any, context?: any): Promise<RetryStrategy> {
    // Apply heuristic fixes for common issues
    const refinedArgs = { ...args };

    // Fix URL format if missing protocol
    if (args.url && !args.url.startsWith('http')) {
      refinedArgs.url = `https://${args.url}`;
    }

    // Fix selector format if not a valid CSS selector
    if (args.selector && !args.selector.startsWith('#') && !args.selector.startsWith('.') && !args.selector.startsWith('[')) {
      refinedArgs.selector = `[data-testid="${args.selector}"]`;
    }

    // If heuristic fixes applied, retry with refined args
    if (JSON.stringify(refinedArgs) !== JSON.stringify(args)) {
      return {
        shouldRetry: true,
        refinedArgs,
        delayMs: 1000,
        reason: "Invalid arguments - applied heuristic fixes"
      };
    }

    // No heuristic fix available, try model regeneration
    try {
      const regenerationPrompt = `
The previous tool call failed due to invalid arguments.
Original tool: ${context?.toolName || 'unknown'}
Original args: ${JSON.stringify(args)}
Error: ${context?.error || 'unknown'}

Please regenerate corrected arguments in JSON format:
{"tool_call":{"name":"${context?.toolName || 'unknown'}","arguments":{...}}}
`;

      const response = await knezClient.chatCompletionsNonStreamRaw(
        [{ role: "user", content: regenerationPrompt }],
        context?.sessionId || "regen",
        {}
      );

      const regenerated = this.parseToolCall(String(response?.choices?.[0]?.message?.content || ""));
      if (regenerated) {
        return {
          shouldRetry: true,
          refinedArgs: regenerated.args,
          delayMs: 2000,
          reason: "Invalid arguments - regenerated via model"
        };
      }
    } catch {
      // Model regeneration failed, fall through
    }

    return {
      shouldRetry: false,
      delayMs: 0,
      reason: "Invalid arguments - cannot automatically regenerate"
    };
  }

  /**
   * Parse tool call from model output using strict JSON parsing only
   * Matches AgentOrchestrator.parseToolCall approach
   */
  private parseToolCall(modelOutput: string): { name: string; args: any } | null {
    const text = String(modelOutput ?? "").trim();
    if (!text) return null;

    // Helper: extract tool call from parsed JSON object
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

    // Strict: Try direct JSON parse of the entire text only
    try {
      const parsed = JSON.parse(text);
      return extractFromParsed(parsed);
    } catch {
      // Invalid JSON - return null, don't try to fix it
      return null;
    }
  }

  /**
   * Handle tool execution exception
   * Strategy: retry with delay
   */
  private handleToolExecutionException(_args: any): RetryStrategy {
    return {
      shouldRetry: true,
      delayMs: this.config.defaultDelayMs,
      reason: "Tool execution exception - will retry"
    };
  }

  /**
   * Handle generic failure
   * Strategy: retry with default delay
   */
  private handleGenericFailure(): RetryStrategy {
    return {
      shouldRetry: true,
      delayMs: this.config.defaultDelayMs,
      reason: "Generic failure - will retry with default delay"
    };
  }

  /**
   * Update retry configuration
   */
  updateConfig(updates: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Reset retry counters for a step
   */
  resetStepCounters(): void {
    // This would be called when starting a new step
    // Implementation depends on how we track retry counts
  }

  /**
   * Reset total retry counters
   */
  resetTotalCounters(): void {
    // This would be called when starting a new agent execution
    // Implementation depends on how we track retry counts
  }
}

// Singleton instance
export const retryStrategyEngine = new RetryStrategyEngine();
