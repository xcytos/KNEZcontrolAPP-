// ─── TimeoutConfig.ts ─────────────────────────────────────────────────
// T6: Adaptive Timeout Handling — per-tool timeout configuration,
//     exponential backoff for retries, timeout classification.
// ─────────────────────────────────────────────────────────────────────────────

export type TimeoutType = "network" | "render" | "execution" | "default";

export interface TimeoutConfig {
  baseTimeoutMs: number;
  maxTimeoutMs: number;
  backoffMultiplier: number;
  maxRetries: number;
  timeoutType: TimeoutType;
}

/**
 * Default timeout configurations for different tool categories.
 */
const DEFAULT_TIMEOUTS: Record<string, TimeoutConfig> = {
  // Browser navigation tools - need render time
  playwright__browser_navigate: {
    baseTimeoutMs: 30000,
    maxTimeoutMs: 60000,
    backoffMultiplier: 2,
    maxRetries: 3,
    timeoutType: "render"
  },
  playwright__browser_click: {
    baseTimeoutMs: 10000,
    maxTimeoutMs: 30000,
    backoffMultiplier: 2,
    maxRetries: 3,
    timeoutType: "render"
  },
  playwright__browser_snapshot: {
    baseTimeoutMs: 15000,
    maxTimeoutMs: 45000,
    backoffMultiplier: 2,
    maxRetries: 3,
    timeoutType: "render"
  },
  
  // File system tools - fast
  filesystem__read_file: {
    baseTimeoutMs: 5000,
    maxTimeoutMs: 15000,
    backoffMultiplier: 1.5,
    maxRetries: 2,
    timeoutType: "execution"
  },
  filesystem__write_file: {
    baseTimeoutMs: 5000,
    maxTimeoutMs: 15000,
    backoffMultiplier: 1.5,
    maxRetries: 2,
    timeoutType: "execution"
  },
  
  // Network fetch tools - moderate
  fetch__fetch: {
    baseTimeoutMs: 15000,
    maxTimeoutMs: 45000,
    backoffMultiplier: 2,
    maxRetries: 3,
    timeoutType: "network"
  },
  
  // Default for all other tools
  default: {
    baseTimeoutMs: 30000,
    maxTimeoutMs: 120000,
    backoffMultiplier: 2,
    maxRetries: 3,
    timeoutType: "default"
  }
};

/**
 * Get timeout configuration for a specific tool.
 */
export function getTimeoutConfig(toolName: string): TimeoutConfig {
  return DEFAULT_TIMEOUTS[toolName] ?? DEFAULT_TIMEOUTS.default;
}

/**
 * Calculate timeout for a specific retry attempt using exponential backoff.
 */
export function calculateRetryTimeout(config: TimeoutConfig, retryAttempt: number): number {
  const timeout = Math.min(
    config.baseTimeoutMs * Math.pow(config.backoffMultiplier, retryAttempt),
    config.maxTimeoutMs
  );
  return Math.round(timeout);
}

/**
 * Classify timeout error based on tool type and context.
 */
export function classifyTimeout(
  timeoutMs: number,
  config: TimeoutConfig
): {
  type: TimeoutType;
  severity: "warning" | "error" | "critical";
  message: string;
  suggestion: string;
} {
  const isNearMax = timeoutMs >= config.maxTimeoutMs * 0.9;
  const isNearBase = timeoutMs <= config.baseTimeoutMs * 1.5;

  let severity: "warning" | "error" | "critical" = "error";
  let message = "";
  let suggestion = "";

  switch (config.timeoutType) {
    case "render":
      if (isNearMax) {
        severity = "critical";
        message = "Page render timeout - page may be stuck or have heavy JavaScript";
        suggestion = "Try navigating to a simpler page, disable JavaScript, or use fetch instead";
      } else if (isNearBase) {
        severity = "warning";
        message = "Page render timeout - dynamic content may need more time";
        suggestion = "Retry with longer timeout or use waitForSelector if available";
      } else {
        message = "Page render timeout";
        suggestion = "Retry with longer timeout or try alternative navigation method";
      }
      break;

    case "network":
      if (isNearMax) {
        severity = "critical";
        message = "Network timeout - server may be unreachable or slow";
        suggestion = "Check URL validity, try alternative URL, or use cached content";
      } else if (isNearBase) {
        severity = "warning";
        message = "Network timeout - slow connection";
        suggestion = "Retry with longer timeout or check network connectivity";
      } else {
        message = "Network timeout";
        suggestion = "Retry with longer timeout or try alternative network method";
      }
      break;

    case "execution":
      if (isNearMax) {
        severity = "critical";
        message = "Execution timeout - tool may be stuck in infinite loop";
        suggestion = "Check tool arguments for validity, simplify request, or try alternative tool";
      } else {
        message = "Execution timeout";
        suggestion = "Retry with longer timeout or simplify the request";
      }
      break;

    default:
      message = "Tool execution timeout";
      suggestion = "Retry with longer timeout or try alternative approach";
  }

  return {
    type: config.timeoutType,
    severity,
    message,
    suggestion
  };
}

/**
 * Calculate adaptive timeout based on historical performance.
 */
export class AdaptiveTimeoutManager {
  private toolPerformance: Map<string, { avgTime: number; count: number; timeouts: number }> = new Map();

  recordPerformance(toolName: string, durationMs: number, timedOut: boolean): void {
    const current = this.toolPerformance.get(toolName) ?? { avgTime: 0, count: 0, timeouts: 0 };
    const newCount = current.count + 1;
    const newAvg = (current.avgTime * current.count + durationMs) / newCount;
    const newTimeouts = current.timeouts + (timedOut ? 1 : 0);

    this.toolPerformance.set(toolName, { avgTime: newAvg, count: newCount, timeouts: newTimeouts });
  }

  getAdaptiveTimeout(toolName: string, baseConfig: TimeoutConfig): number {
    const perf = this.toolPerformance.get(toolName);
    if (!perf || perf.count < 3) {
      return baseConfig.baseTimeoutMs;
    }

    // If tool frequently times out, increase timeout
    const timeoutRate = perf.timeouts / perf.count;
    if (timeoutRate > 0.5) {
      return Math.min(perf.avgTime * 2, baseConfig.maxTimeoutMs);
    }

    // If tool is consistently fast, use base timeout
    if (perf.avgTime < baseConfig.baseTimeoutMs * 0.5) {
      return baseConfig.baseTimeoutMs;
    }

    // Otherwise, use average time with buffer
    return Math.min(perf.avgTime * 1.5, baseConfig.maxTimeoutMs);
  }

  shouldRetry(toolName: string, retryAttempt: number, config: TimeoutConfig): boolean {
    const perf = this.toolPerformance.get(toolName);
    
    // Don't retry if we've exceeded max retries
    if (retryAttempt >= config.maxRetries) {
      return false;
    }

    // If tool frequently times out, limit retries
    if (perf && (perf.timeouts / perf.count) > 0.7) {
      return retryAttempt < 2; // Max 2 retries for problematic tools
    }

    return true;
  }

  getPerformanceStats(toolName: string): { avgTime: number; count: number; timeoutRate: number } | null {
    const perf = this.toolPerformance.get(toolName);
    if (!perf) return null;
    return {
      avgTime: perf.avgTime,
      count: perf.count,
      timeoutRate: perf.timeouts / perf.count
    };
  }
}

// Global instance
export const adaptiveTimeoutManager = new AdaptiveTimeoutManager();
