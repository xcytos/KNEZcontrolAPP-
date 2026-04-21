// ─── RetryStrategy.ts ─────────────────────────────────────────────────
// T10: Retry with Alternative Strategies — retry with modified args, tool substitution,
//     strategy selection for better error recovery.
// T2-Enhancement: Structured Failure Feedback Engine — failure taxonomy,
//     classification, remediation suggestions, effectiveness tracking.
// ─────────────────────────────────────────────────────────────────────────────

import { getFallbackChain, fallbackManager } from '../utils/FallbackStrategy';

export type RetryStrategy = "same" | "modified_args" | "alternative_tool" | "fallback";

// T2-Enhancement: Failure taxonomy
export type FailureType = 
  | "network"
  | "timeout"
  | "validation"
  | "permission"
  | "data_mismatch"
  | "schema_error"
  | "element_not_found"
  | "api_error"
  | "unknown";

export interface FailureClassification {
  type: FailureType;
  severity: "low" | "medium" | "high" | "critical";
  category: "transient" | "permanent" | "intermittent";
  remediation: string;
  suggestedStrategy: RetryStrategy;
  confidence: number; // 0-1
}

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

// T3-Enhancement: Contextual retry memory interfaces
export interface RetryContext {
  sessionId: string;
  toolName: string;
  args: any;
  error: string;
  failureType: FailureType;
  timestamp: number;
  attemptCount: number;
}

export interface RetryPattern {
  fingerprint: string;
  occurrences: number;
  lastSeen: number;
  successRate: number;
  recommendedStrategy: RetryStrategy;
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

// T2-Enhancement: Failure classification patterns
const FAILURE_PATTERNS: Record<FailureType, { patterns: string[]; severity: string; category: string; remediation: string; strategy: RetryStrategy }> = {
  network: {
    patterns: ["network", "connection", "econnrefused", "enotfound", "etimedout"],
    severity: "medium",
    category: "transient",
    remediation: "Network connectivity issue. Retry with same arguments after brief delay.",
    strategy: "same"
  },
  timeout: {
    patterns: ["timeout", "timed out", "deadline exceeded"],
    severity: "medium",
    category: "transient",
    remediation: "Operation timed out. Increase timeout duration and retry.",
    strategy: "modified_args"
  },
  validation: {
    patterns: ["validation", "invalid", "malformed", "schema"],
    severity: "low",
    category: "permanent",
    remediation: "Input validation failed. Check and correct input parameters.",
    strategy: "modified_args"
  },
  permission: {
    patterns: ["permission", "unauthorized", "forbidden", "access denied"],
    severity: "high",
    category: "permanent",
    remediation: "Permission denied. Check credentials and access rights.",
    strategy: "fallback"
  },
  data_mismatch: {
    patterns: ["not found", "404", "no data", "empty", "null"],
    severity: "medium",
    category: "intermittent",
    remediation: "Data not found or mismatch. Try alternative data source or fallback.",
    strategy: "alternative_tool"
  },
  schema_error: {
    patterns: ["schema", "structure", "parse", "json"],
    severity: "medium",
    category: "permanent",
    remediation: "Schema or structure mismatch. Validate expected format.",
    strategy: "modified_args"
  },
  element_not_found: {
    patterns: ["element not found", "selector", "no such element"],
    severity: "medium",
    category: "intermittent",
    remediation: "UI element not found. Wait for element or use alternative selector.",
    strategy: "modified_args"
  },
  api_error: {
    patterns: ["api", "500", "502", "503", "504"],
    severity: "high",
    category: "transient",
    remediation: "API error. Retry with exponential backoff or use fallback.",
    strategy: "same"
  },
  unknown: {
    patterns: [],
    severity: "low",
    category: "intermittent",
    remediation: "Unknown error. Retry with fallback strategy.",
    strategy: "fallback"
  }
};

// T2-Enhancement: Classify failure type from error message
export function classifyFailure(error: string, _toolName?: string, _context?: any): FailureClassification {
  const lowerError = error.toLowerCase();
  
  for (const [type, config] of Object.entries(FAILURE_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (lowerError.includes(pattern)) {
        return {
          type: type as FailureType,
          severity: config.severity as any,
          category: config.category as any,
          remediation: config.remediation,
          suggestedStrategy: config.strategy,
          confidence: 0.8
        };
      }
    }
  }
  
  // Default to unknown
  return {
    type: "unknown",
    severity: "low",
    category: "intermittent",
    remediation: "Unknown error. Retry with fallback strategy.",
    suggestedStrategy: "fallback",
    confidence: 0.5
  };
}

// T2-Enhancement: Get remediation suggestion for failure type
export function getRemediation(failureType: FailureType): string {
  return FAILURE_PATTERNS[failureType]?.remediation || "Retry with fallback strategy.";
}

// T3-Enhancement: Generate fingerprint for retry context
export function generateRetryFingerprint(context: RetryContext): string {
  const argsStr = JSON.stringify(context.args);
  const errorStr = context.error.toLowerCase();
  const key = `${context.toolName}:${context.failureType}:${argsStr.substring(0, 100)}:${errorStr.substring(0, 50)}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `fp_${Math.abs(hash).toString(16)}`;
}

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
      const chain = getFallbackChain(toolName);
      if (chain && chain.fallbacks.length > 0) {
        const fallback = chain.fallbacks[0];
        nextTool = fallback.tool;
        if (fallback.argumentModifier) {
          nextArgs = fallback.argumentModifier(args);
        }
        // Record fallback with reasoning
        fallbackManager.recordFallback(toolName, nextTool, `Alternative tool due to: ${error}`);
      }
      break;

    case "fallback":
      // Use last fallback in chain
      const fallbackChain = getFallbackChain(toolName);
      if (fallbackChain && fallbackChain.fallbacks.length > 0) {
        const lastFallback = fallbackChain.fallbacks[fallbackChain.fallbacks.length - 1];
        nextTool = lastFallback.tool;
        if (lastFallback.argumentModifier) {
          nextArgs = lastFallback.argumentModifier(args);
        }
        // Record fallback with reasoning
        fallbackManager.recordFallback(toolName, nextTool, `Fallback strategy due to: ${error}`);
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
  
  // T2-Enhancement: Remediation effectiveness tracking
  private _remediationStats: Map<FailureType, { attempts: number; successes: number }> = new Map();
  
  // T3-Enhancement: Contextual retry memory
  private retryContexts: Map<string, RetryContext[]> = new Map(); // sessionId -> contexts
  private retryPatterns: Map<string, RetryPattern> = new Map(); // fingerprint -> pattern

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

  // T2-Enhancement: Track remediation effectiveness
  recordRemediation(failureType: FailureType, success: boolean): void {
    const existing = this._remediationStats.get(failureType);

    if (existing) {
      existing.attempts++;
      if (success) {
        existing.successes++;
      }
    } else {
      this._remediationStats.set(failureType, {
        attempts: 1,
        successes: success ? 1 : 0
      });
    }
  }

  getRemediationEffectiveness(failureType: FailureType): number {
    const stats = this._remediationStats.get(failureType);
    if (!stats || stats.attempts === 0) return 0;
    return stats.successes / stats.attempts;
  }

  getAllRemediationStats(): Map<FailureType, { attempts: number; successes: number; effectiveness: number }> {
    const result = new Map<FailureType, { attempts: number; successes: number; effectiveness: number }>();
    
    for (const [type, stats] of this._remediationStats.entries()) {
      result.set(type, {
        attempts: stats.attempts,
        successes: stats.successes,
        effectiveness: stats.attempts > 0 ? stats.successes / stats.attempts : 0
      });
    }
    
    return result;
  }

  // T3-Enhancement: Record retry context
  recordRetryContext(context: RetryContext): void {
    const sessionContexts = this.retryContexts.get(context.sessionId) || [];
    sessionContexts.push(context);
    this.retryContexts.set(context.sessionId, sessionContexts);

    // Update retry pattern
    const fingerprint = generateRetryFingerprint(context);
    const existingPattern = this.retryPatterns.get(fingerprint);
    
    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.lastSeen = context.timestamp;
      // Update success rate based on recent attempts
      const recentContexts = sessionContexts.filter(c => generateRetryFingerprint(c) === fingerprint).slice(-10);
      const successes = recentContexts.filter(c => c.failureType === 'unknown').length; // Simplified
      existingPattern.successRate = successes / recentContexts.length;
    } else {
      this.retryPatterns.set(fingerprint, {
        fingerprint,
        occurrences: 1,
        lastSeen: context.timestamp,
        successRate: 0.5, // Default neutral
        recommendedStrategy: 'same'
      });
    }
  }

  // T3-Enhancement: Get retry patterns for a tool
  getRetryPatterns(toolName: string): RetryPattern[] {
    const patterns: RetryPattern[] = [];
    
    for (const pattern of this.retryPatterns.values()) {
      // Pattern fingerprint contains tool name
      if (pattern.fingerprint.includes(toolName.toLowerCase())) {
        patterns.push(pattern);
      }
    }
    
    return patterns.sort((a, b) => b.occurrences - a.occurrences);
  }

  // T3-Enhancement: Check if should retry based on context
  shouldRetryWithContext(context: RetryContext): boolean {
    const fingerprint = generateRetryFingerprint(context);
    const pattern = this.retryPatterns.get(fingerprint);
    
    if (!pattern) return true; // No pattern, allow retry
    
    // If pattern has low success rate and many occurrences, don't retry
    if (pattern.occurrences > 5 && pattern.successRate < 0.2) {
      return false;
    }
    
    // If pattern is recent (within last hour) and failed, limit retries
    const timeSinceLastSeen = Date.now() - pattern.lastSeen;
    if (timeSinceLastSeen < 3600000 && pattern.occurrences > 3 && pattern.successRate < 0.3) {
      return false;
    }
    
    return true;
  }

  // T3-Enhancement: Get recommended strategy based on context
  getRecommendedStrategy(context: RetryContext): RetryStrategy | null {
    const fingerprint = generateRetryFingerprint(context);
    const pattern = this.retryPatterns.get(fingerprint);
    
    if (pattern && pattern.occurrences > 2) {
      return pattern.recommendedStrategy;
    }
    
    return null;
  }

  // T3-Enhancement: Clear context for a session
  clearSessionContext(sessionId: string): void {
    this.retryContexts.delete(sessionId);
  }

  // T3-Enhancement: Get context for a session
  getSessionContext(sessionId: string): RetryContext[] {
    return this.retryContexts.get(sessionId) || [];
  }
}

// Global instance
export const retryManager = new RetryManager();
