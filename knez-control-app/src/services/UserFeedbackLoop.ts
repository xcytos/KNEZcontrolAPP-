// ─── UserFeedbackLoop.ts ─────────────────────────────────────────────────
// T8: User Feedback Loop — adds failure confirmation, corrected arguments,
//     skip capability for better user control over tool execution.
// ─────────────────────────────────────────────────────────────────────────────

export type FeedbackAction = "retry" | "skip" | "correct" | "abort";

export interface FeedbackRequest {
  tool: string;
  args: any;
  error: string;
  suggestedActions: FeedbackAction[];
  suggestedCorrections?: Array<{ field: string; suggestion: string }>;
}

export interface FeedbackResponse {
  action: FeedbackAction;
  correctedArgs?: any;
  userMessage?: string;
}

/**
 * User feedback loop manager for handling tool execution failures.
 */
export class UserFeedbackLoop {
  private pendingFeedback: Map<string, FeedbackRequest> = new Map();
  private feedbackHistory: Array<{ tool: string; action: FeedbackAction; timestamp: Date }> = [];

  /**
   * Request user feedback for a failed tool execution.
   */
  requestFeedback(requestId: string, request: FeedbackRequest): void {
    this.pendingFeedback.set(requestId, request);
  }

  /**
   * Submit user feedback for a pending request.
   */
  submitFeedback(requestId: string, response: FeedbackResponse): void {
    const request = this.pendingFeedback.get(requestId);
    if (!request) return;

    // Record feedback in history
    this.feedbackHistory.push({
      tool: request.tool,
      action: response.action,
      timestamp: new Date()
    });

    // Remove from pending
    this.pendingFeedback.delete(requestId);
  }

  /**
   * Check if there's pending feedback for a request.
   */
  hasPendingFeedback(requestId: string): boolean {
    return this.pendingFeedback.has(requestId);
  }

  /**
   * Get pending feedback request.
   */
  getPendingFeedback(requestId: string): FeedbackRequest | null {
    return this.pendingFeedback.get(requestId) ?? null;
  }

  /**
   * Cancel pending feedback request.
   */
  cancelFeedback(requestId: string): void {
    this.pendingFeedback.delete(requestId);
  }

  /**
   * Generate suggested corrections based on error.
   */
  generateSuggestedCorrections(_tool: string, args: any, error: string): Array<{ field: string; suggestion: string }> {
    const corrections: Array<{ field: string; suggestion: string }> = [];
    const lowerError = error.toLowerCase();

    // URL-related errors
    if (lowerError.includes("404") || lowerError.includes("not found")) {
      if (args.url) {
        corrections.push({
          field: "url",
          suggestion: "Check if URL is correct or try parent path"
        });
      }
    }

    // Timeout errors
    if (lowerError.includes("timeout")) {
      if (args.timeout) {
        corrections.push({
          field: "timeout",
          suggestion: `Increase timeout from ${args.timeout}ms to ${args.timeout * 2}ms`
        });
      } else {
        corrections.push({
          field: "timeout",
          suggestion: "Add timeout parameter (e.g., 60000ms)"
        });
      }
    }

    // Selector errors
    if (lowerError.includes("selector") || lowerError.includes("element not found")) {
      if (args.selector) {
        corrections.push({
          field: "selector",
          suggestion: "Check if selector is correct or use a different selector"
        });
      }
    }

    // File path errors
    if (lowerError.includes("file") && (lowerError.includes("not found") || lowerError.includes("no such file"))) {
      if (args.path) {
        corrections.push({
          field: "path",
          suggestion: "Check if file path is correct"
        });
      }
    }

    return corrections;
  }

  /**
   * Generate suggested actions based on error type.
   */
  generateSuggestedActions(error: string): FeedbackAction[] {
    const actions: FeedbackAction[] = [];
    const lowerError = error.toLowerCase();

    // Always allow skip and abort
    actions.push("skip", "abort");

    // Retry for transient errors
    if (lowerError.includes("timeout") || lowerError.includes("network")) {
      actions.push("retry");
    }

    // Correct for parameter errors
    if (lowerError.includes("404") || lowerError.includes("selector") || lowerError.includes("invalid")) {
      actions.push("correct");
    }

    return actions;
  }

  /**
   * Get feedback statistics.
   */
  getFeedbackStats(): {
    total: number;
    retry: number;
    skip: number;
    correct: number;
    abort: number;
    byTool: Record<string, { total: number; retry: number; skip: number; correct: number; abort: number }>
  } {
    const stats = {
      total: this.feedbackHistory.length,
      retry: 0,
      skip: 0,
      correct: 0,
      abort: 0,
      byTool: {} as Record<string, { total: number; retry: number; skip: number; correct: number; abort: number }>
    };

    for (const entry of this.feedbackHistory) {
      stats[entry.action]++;

      if (!stats.byTool[entry.tool]) {
        stats.byTool[entry.tool] = { total: 0, retry: 0, skip: 0, correct: 0, abort: 0 };
      }
      stats.byTool[entry.tool].total++;
      stats.byTool[entry.tool][entry.action]++;
    }

    return stats;
  }

  /**
   * Get most common action for a tool.
   */
  getMostCommonAction(tool: string): FeedbackAction | null {
    const toolStats = this.feedbackHistory.filter(e => e.tool === tool);
    if (toolStats.length === 0) return null;

    const counts: Record<string, number> = {};
    for (const entry of toolStats) {
      counts[entry.action] = (counts[entry.action] ?? 0) + 1;
    }

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FeedbackAction ?? null;
  }

  /**
   * Clear feedback history.
   */
  clearHistory(): void {
    this.feedbackHistory = [];
  }

  /**
   * Clear all pending feedback requests.
   */
  clearPending(): void {
    this.pendingFeedback.clear();
  }

  /**
   * Get all pending feedback requests.
   */
  getAllPending(): Array<{ requestId: string; request: FeedbackRequest }> {
    return Array.from(this.pendingFeedback.entries()).map(([requestId, request]) => ({
      requestId,
      request
    }));
  }
}

// Global instance
export const userFeedbackLoop = new UserFeedbackLoop();
