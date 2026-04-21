// ─── GracefulDegradation.ts ─────────────────────────────────────────────────
// T17: Graceful Degradation — defines degradation levels, partial results,
//     fallback to manual mode for better user experience when tools fail.
// ─────────────────────────────────────────────────────────────────────────────

export type DegradationLevel = "full" | "partial" | "minimal" | "fallback";

export interface DegradationState {
  level: DegradationLevel;
  reason: string;
  successfulOperations: string[];
  failedOperations: string[];
  partialResults: Record<string, any>;
  canContinue: boolean;
  suggestion: string;
}

/**
 * Determine degradation level based on tool execution results.
 */
export function determineDegradationLevel(
  totalOperations: number,
  successfulOperations: number,
  criticalFailures: boolean = false
): DegradationLevel {
  if (totalOperations === 0) return "full";

  const successRate = successfulOperations / totalOperations;

  if (criticalFailures) {
    return "fallback";
  }

  if (successRate >= 0.9) {
    return "full";
  } else if (successRate >= 0.5) {
    return "partial";
  } else if (successRate >= 0.2) {
    return "minimal";
  } else {
    return "fallback";
  }
}

/**
 * Build degradation state from tool execution results.
 */
export function buildDegradationState(
  operations: Array<{ name: string; success: boolean; result?: any; error?: string }>
): DegradationState {
  const successfulOps = operations.filter(op => op.success);
  const failedOps = operations.filter(op => !op.success);
  const criticalFailures = failedOps.some(op => 
    op.error?.includes("critical") || 
    op.error?.includes("500") ||
    op.error?.includes("MCP_HANDSHAKE_FAILED")
  );

  const level = determineDegradationLevel(
    operations.length,
    successfulOps.length,
    criticalFailures
  );

  const partialResults: Record<string, any> = {};
  successfulOps.forEach(op => {
    if (op.result !== undefined) {
      partialResults[op.name] = op.result;
    }
  });

  let suggestion = "";
  let canContinue = true;

  switch (level) {
    case "full":
      suggestion = "All operations completed successfully. No degradation.";
      break;
    case "partial":
      suggestion = "Some operations failed, but partial results are available. You can continue with available data or retry failed operations.";
      canContinue = true;
      break;
    case "minimal":
      suggestion = "Most operations failed. Limited results available. Consider retrying with alternative approach or manual input.";
      canContinue = true;
      break;
    case "fallback":
      suggestion = "Critical failures occurred. Tools are not available. Please provide information manually or try again later.";
      canContinue = false;
      break;
  }

  return {
    level,
    reason: failedOps.length > 0 
      ? `${failedOps.length} of ${operations.length} operations failed`
      : "No failures",
    successfulOperations: successfulOps.map(op => op.name),
    failedOperations: failedOps.map(op => op.name),
    partialResults,
    canContinue,
    suggestion
  };
}

/**
 * Generate user-friendly degradation message.
 */
export function generateDegradationMessage(state: DegradationState): string {
  const levelEmoji = {
    full: "✅",
    partial: "⚠️",
    minimal: "⚠️",
    fallback: "❌"
  };

  const header = `${levelEmoji[state.level]} Degradation Level: ${state.level.toUpperCase()}`;
  const reason = `Reason: ${state.reason}`;
  const suggestion = `Suggestion: ${state.suggestion}`;

  let details = "";
  if (state.successfulOperations.length > 0) {
    details += `\n\n✓ Successful: ${state.successfulOperations.join(", ")}`;
  }
  if (state.failedOperations.length > 0) {
    details += `\n\n✗ Failed: ${state.failedOperations.join(", ")}`;
  }

  return `${header}\n${reason}\n${suggestion}${details}`;
}

/**
 * Check if operation should be retried based on degradation state.
 */
export function shouldRetryOperation(
  operationName: string,
  degradationState: DegradationState,
  retryCount: number
): boolean {
  // Don't retry if in fallback mode
  if (degradationState.level === "fallback") {
    return false;
  }

  // Don't retry if already retried too many times
  if (retryCount >= 3) {
    return false;
  }

  // In partial mode, only retry critical operations
  if (degradationState.level === "partial") {
    const criticalOps = ["navigate", "fetch", "read"];
    return criticalOps.some(op => operationName.toLowerCase().includes(op));
  }

  // In minimal mode, only retry if operation is essential
  if (degradationState.level === "minimal") {
    const essentialOps = ["navigate"];
    return essentialOps.some(op => operationName.toLowerCase().includes(op));
  }

  // In full mode, retry is acceptable
  return true;
}

/**
 * Get fallback action for failed operation.
 */
export function getFallbackAction(
  operationName: string,
  error: string
): {
  action: string;
  description: string;
  requiresUserInput: boolean;
} {
  const lowerOp = operationName.toLowerCase();
  const lowerError = error.toLowerCase();

  // Navigation fallbacks
  if (lowerOp.includes("navigate")) {
    if (lowerError.includes("timeout")) {
      return {
        action: "use_fetch",
        description: "Try using fetch tool instead of browser navigation",
        requiresUserInput: false
      };
    }
    if (lowerError.includes("404")) {
      return {
        action: "try_parent_url",
        description: "Try navigating to parent URL",
        requiresUserInput: false
      };
    }
    return {
      action: "manual_input",
      description: "Please provide the URL content manually",
      requiresUserInput: true
    };
  }

  // Click fallbacks
  if (lowerOp.includes("click")) {
    return {
      action: "try_selector",
      description: "Try alternative selector or navigate directly",
      requiresUserInput: false
    };
  }

  // Snapshot fallbacks
  if (lowerOp.includes("snapshot")) {
    return {
      action: "use_fetch",
      description: "Try using fetch to get page content",
      requiresUserInput: false
    };
  }

  // Generic fallback
  return {
    action: "manual_input",
    description: "Please provide the required information manually",
    requiresUserInput: true
  };
}

/**
 * Degradation manager for tracking system health over time.
 */
export class DegradationManager {
  private history: Array<{ timestamp: Date; level: DegradationLevel; reason: string }> = [];
  private maxHistorySize = 100;

  recordDegradation(state: DegradationState): void {
    this.history.push({
      timestamp: new Date(),
      level: state.level,
      reason: state.reason
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getCurrentTrend(): "improving" | "degrading" | "stable" {
    if (this.history.length < 3) return "stable";

    const recent = this.history.slice(-5);
    const levels = recent.map(h => {
      const levelValue = { full: 3, partial: 2, minimal: 1, fallback: 0 };
      return levelValue[h.level];
    });

    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const latest = levels[levels.length - 1];

    if (latest > avg + 0.5) return "improving";
    if (latest < avg - 0.5) return "degrading";
    return "stable";
  }

  getFailureRate(timeWindowMs: number = 60000): number {
    const now = Date.now();
    const windowStart = now - timeWindowMs;

    const recentFailures = this.history.filter(
      h => h.timestamp.getTime() > windowStart && h.level !== "full"
    );

    return recentFailures.length / this.history.length;
  }

  clear(): void {
    this.history = [];
  }

  getSummary(): {
    total: number;
    full: number;
    partial: number;
    minimal: number;
    fallback: number;
    trend: string;
  } {
    const summary = {
      total: this.history.length,
      full: 0,
      partial: 0,
      minimal: 0,
      fallback: 0,
      trend: this.getCurrentTrend()
    };

    for (const h of this.history) {
      summary[h.level]++;
    }

    return summary;
  }
}

// Global instance
export const degradationManager = new DegradationManager();
