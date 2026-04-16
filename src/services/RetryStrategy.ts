// ─── RetryStrategy.ts ─────────────────────────────────────────────────
// T10: Retry with Alternative Strategies — retry with modified args, tool substitution,
//     strategy selection for better error recovery.
// ─────────────────────────────────────────────────────────────────────────────

export type RetryStrategy = "same" | "modified_args" | "alternative_tool" | "fallback";

export interface RetryAttempt {
  strategy: RetryStrategy;
  tool: string;
  args: any;
  attemptNumber: number;
  maxAttempts: number;
}

export interface RetryResult {
  shouldRetry: boolean;
  nextStrategy?: RetryStrategy;
  nextTool?: string;
  nextArgs?: any;
  reason: string;
}

/**
 * Argument modifiers for common retry scenarios.
 */
const ARGUMENT_MODIFIERS: Record<string, (args: any) => any> = {
  timeout: (args) => ({ ...args, timeout: (args.timeout || 30000) * 2 }),
  wait_for_selector: (args) => ({ ...args, waitFor: args.selector || "body" }),
  scroll: (args) => ({ ...args, scroll: true }),
  retry_with_delay: (args) => ({ ...args, delay: 1000 }),
  remove_optional: (args) => {
    const { optional, ...rest } = args;
    return rest;
  }
};

/**
 * Get argument modifier based on error type.
 */
export function getArgumentModifier(error: string): ((args: any) => any) | null {
  const lowerError = error.toLowerCase();

  if (lowerError.includes("timeout")) {
    return ARGUMENT_MODIFIERS.timeout;
  }

  if (lowerError.includes("element not found") || lowerError.includes("selector")) {
    return ARGUMENT_MODIFIERS.wait_for_selector;
  }

  if (lowerError.includes("minimal_content") || lowerError.includes("empty")) {
    return ARGUMENT_MODIFIERS.scroll;
  }

  if (lowerError.includes("invalid") || lowerError.includes("parse")) {
    return ARGUMENT_MODIFIERS.retry_with_delay;
  }

  return null;
}

/**
 * Determine retry strategy based on error and attempt count.
 */
export function determineRetryStrategy(
  toolName: string,
  error: string,
  attemptCount: number,
  maxAttempts: number = 3
): RetryResult {
  if (attemptCount >= maxAttempts) {
    return {
      shouldRetry: false,
      reason: "Max retry attempts reached"
    };
  }

  const lowerError = error.toLowerCase();

  // Strategy 1: Same args (first attempt for transient errors)
  if (attemptCount === 0 && (lowerError.includes("network") || lowerError.includes("timeout"))) {
    return {
      shouldRetry: true,
      nextStrategy: "same",
      reason: "Transient error detected, retry with same arguments"
    };
  }

  // Strategy 2: Modified args (for parameter-related errors)
  const argModifier = getArgumentModifier(error);
  if (argModifier && attemptCount === 0) {
    return {
      shouldRetry: true,
      nextStrategy: "modified_args",
      reason: "Error suggests argument modification may help"
    };
  }

  // Strategy 3: Alternative tool (for persistent failures)
  if (attemptCount === 1) {
    return {
      shouldRetry: true,
      nextStrategy: "alternative_tool",
      reason: "Previous retry failed, trying alternative tool"
    };
  }

  // Strategy 4: Fallback (last resort)
  if (attemptCount === maxAttempts - 1) {
    return {
      shouldRetry: true,
      nextStrategy: "fallback",
      reason: "Last attempt using fallback strategy"
    };
  }

  return {
    shouldRetry: false,
    reason: "No appropriate retry strategy found"
  };
}

/**
 * Apply retry strategy to get next execution parameters.
 */
export function applyRetryStrategy(
  strategy: RetryStrategy,
  toolName: string,
  args: any,
  error: string
): RetryAttempt {
  let nextTool = toolName;
  let nextArgs = args;

  switch (strategy) {
    case "same":
      // No changes
      break;

    case "modified_args":
      const modifier = getArgumentModifier(error);
      if (modifier) {
        nextArgs = modifier(args);
      }
      break;

    case "alternative_tool":
      // Use fallback chain to get alternative tool
      const { getFallbackChain } = require("./FallbackStrategy");
      const chain = getFallbackChain(toolName);
      if (chain && chain.fallbacks.length > 0) {
        const fallback = chain.fallbacks[0];
        nextTool = fallback.tool;
        if (fallback.argumentModifier) {
          nextArgs = fallback.argumentModifier(args);
        }
      }
      break;

    case "fallback":
      // Use last fallback in chain
      const { getFallbackChain: getChain } = require("./FallbackStrategy");
      const fallbackChain = getChain(toolName);
      if (fallbackChain && fallbackChain.fallbacks.length > 0) {
        const lastFallback = fallbackChain.fallbacks[fallbackChain.fallbacks.length - 1];
        nextTool = lastFallback.tool;
        if (lastFallback.argumentModifier) {
          nextArgs = lastFallback.argumentModifier(args);
        }
      }
      break;
  }

  return {
    strategy,
    tool: nextTool,
    args: nextArgs,
    attemptNumber: 0,
    maxAttempts: 3
  };
}

/**
 * Retry strategy manager for tracking retry effectiveness.
 */
export class RetryManager {
  private retryStats: Map<string, { attempts: number; successes: number; failures: number }> = new Map();

  recordRetry(toolName: string, strategy: RetryStrategy, success: boolean): void {
    const key = `${toolName}:${strategy}`;
    const existing = this.retryStats.get(key);

    if (existing) {
      existing.attempts++;
      if (success) {
        existing.successes++;
      } else {
        existing.failures++;
      }
    } else {
      this.retryStats.set(key, {
        attempts: 1,
        successes: success ? 1 : 0,
        failures: success ? 0 : 1
      });
    }
  }

  getRetryStats(toolName: string): Array<{ strategy: RetryStrategy; attempts: number; successes: number; failures: number; successRate: number }> {
    const stats: Array<{ strategy: RetryStrategy; attempts: number; successes: number; failures: number; successRate: number }> = [];

    for (const [key, data] of this.retryStats.entries()) {
      const [tool, strategy] = key.split(":");
      if (tool === toolName) {
        stats.push({
          strategy: strategy as RetryStrategy,
          attempts: data.attempts,
          successes: data.successes,
          failures: data.failures,
          successRate: data.attempts > 0 ? data.successes / data.attempts : 0
        });
      }
    }

    return stats.sort((a, b) => b.successRate - a.successRate);
  }

  getBestStrategy(toolName: string): RetryStrategy | null {
    const stats = this.getRetryStats(toolName);
    if (stats.length === 0) return null;

    const best = stats[0];
    return best.successRate > 0.5 ? best.strategy : null;
  }

  clear(): void {
    this.retryStats.clear();
  }

  getOverallStats(): { totalRetries: number; totalSuccesses: number; totalFailures: number; overallSuccessRate: number } {
    let totalRetries = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    for (const data of this.retryStats.values()) {
      totalRetries += data.attempts;
      totalSuccesses += data.successes;
      totalFailures += data.failures;
    }

    return {
      totalRetries,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalRetries > 0 ? totalSuccesses / totalRetries : 0
    };
  }
}

// Global instance
export const retryManager = new RetryManager();
