/**
 * FailureClassifier - Classifies failures with appropriate retry strategies
 * Maps different failure types to specific retry approaches
 */

export enum FailureType {
  SELECTOR_NOT_FOUND = "selector_not_found",
  NAVIGATION_FAILED = "navigation_failed",
  TIMEOUT = "timeout",
  INVALID_ARGS = "invalid_args",
  PERMISSION_DENIED = "permission_denied",
  NETWORK_ERROR = "network_error",
  UNKNOWN = "unknown"
}

export enum RetryStrategy {
  RETRY_SAME = "retry_same",
  RETRY_WITH_SNAPSHOT = "retry_with_snapshot",
  RETRY_WITH_REFINEMENT = "retry_with_refinement",
  RETRY_AFTER_DELAY = "retry_after_delay",
  ABORT = "abort"
}

export enum Severity {
  RECOVERABLE = "recoverable",
  FATAL = "fatal"
}

export interface FailureClassification {
  type: FailureType;
  severity: Severity;
  retryStrategy: RetryStrategy;
  retryDelay: number;
  maxRetries: number;
  suggestedAction?: string;
}

export class FailureClassifier {
  private readonly DEFAULT_RETRY_DELAY = 1000;
  private readonly DEFAULT_MAX_RETRIES = 2;
  
  private readonly RETRY_DELAYS: Map<FailureType, number> = new Map([
    [FailureType.TIMEOUT, 2000],
    [FailureType.NETWORK_ERROR, 3000],
    [FailureType.SELECTOR_NOT_FOUND, 0],
    [FailureType.INVALID_ARGS, 0],
    [FailureType.NAVIGATION_FAILED, 1000],
    [FailureType.PERMISSION_DENIED, 0]
  ]);

  private readonly MAX_RETRIES: Map<FailureType, number> = new Map([
    [FailureType.TIMEOUT, 3],
    [FailureType.NETWORK_ERROR, 3],
    [FailureType.SELECTOR_NOT_FOUND, 2],
    [FailureType.INVALID_ARGS, 1],
    [FailureType.NAVIGATION_FAILED, 2],
    [FailureType.PERMISSION_DENIED, 0]
  ]);

  /**
   * Classify failure based on error message and context
   */
  classify(error: any, toolName: string, args: any): FailureClassification {
    const errorMsg = this.extractErrorMessage(error);
    const failureType = this.determineFailureType(errorMsg, toolName);
    const severity = this.determineSeverity(failureType);
    const retryStrategy = this.determineRetryStrategy(failureType, toolName);
    const retryDelay = this.RETRY_DELAYS.get(failureType) || this.DEFAULT_RETRY_DELAY;
    const maxRetries = this.MAX_RETRIES.get(failureType) || this.DEFAULT_MAX_RETRIES;
    const suggestedAction = this.generateSuggestedAction(failureType, toolName, args);

    return {
      type: failureType,
      severity,
      retryStrategy,
      retryDelay,
      maxRetries,
      suggestedAction
    };
  }

  /**
   * Extract error message from various error formats
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    if (error?.errorMsg) return error.errorMsg;
    return String(error);
  }

  /**
   * Determine failure type based on error message and tool name
   */
  private determineFailureType(errorMsg: string, toolName: string): FailureType {
    const lowerMsg = errorMsg.toLowerCase();

    // Selector/element not found
    if (lowerMsg.includes("selector") || 
        lowerMsg.includes("not found") || 
        lowerMsg.includes("element") ||
        lowerMsg.includes("no such element")) {
      return FailureType.SELECTOR_NOT_FOUND;
    }

    // Timeout
    if (lowerMsg.includes("timeout") || 
        lowerMsg.includes("timed out")) {
      return FailureType.TIMEOUT;
    }

    // Permission denied
    if (lowerMsg.includes("permission") || 
        lowerMsg.includes("denied") || 
        lowerMsg.includes("forbidden") ||
        lowerMsg.includes("unauthorized")) {
      return FailureType.PERMISSION_DENIED;
    }

    // Network errors
    if (lowerMsg.includes("network") || 
        lowerMsg.includes("econnrefused") || 
        lowerMsg.includes("fetch") ||
        lowerMsg.includes("connection")) {
      return FailureType.NETWORK_ERROR;
    }

    // Navigation failures
    if (toolName.includes("navigate") || toolName.includes("goto")) {
      if (lowerMsg.includes("404") || 
          lowerMsg.includes("dns") || 
          lowerMsg.includes("resolve")) {
        return FailureType.NAVIGATION_FAILED;
      }
    }

    // Invalid arguments
    if (lowerMsg.includes("invalid") || 
        lowerMsg.includes("argument") || 
        lowerMsg.includes("parameter") ||
        lowerMsg.includes("parse")) {
      return FailureType.INVALID_ARGS;
    }

    return FailureType.UNKNOWN;
  }

  /**
   * Determine severity of failure
   */
  private determineSeverity(failureType: FailureType): Severity {
    switch (failureType) {
      case FailureType.PERMISSION_DENIED:
        return Severity.FATAL;
      case FailureType.INVALID_ARGS:
        return Severity.FATAL;
      case FailureType.UNKNOWN:
        return Severity.FATAL;
      default:
        return Severity.RECOVERABLE;
    }
  }

  /**
   * Determine retry strategy based on failure type
   */
  private determineRetryStrategy(failureType: FailureType, toolName: string): RetryStrategy {
    switch (failureType) {
      case FailureType.SELECTOR_NOT_FOUND:
        if (toolName.includes("click") || toolName.includes("snapshot")) {
          return RetryStrategy.RETRY_WITH_SNAPSHOT;
        }
        return RetryStrategy.RETRY_WITH_REFINEMENT;

      case FailureType.TIMEOUT:
        return RetryStrategy.RETRY_AFTER_DELAY;

      case FailureType.NETWORK_ERROR:
        return RetryStrategy.RETRY_AFTER_DELAY;

      case FailureType.NAVIGATION_FAILED:
        return RetryStrategy.RETRY_WITH_REFINEMENT;

      case FailureType.INVALID_ARGS:
        return RetryStrategy.RETRY_WITH_REFINEMENT;

      case FailureType.PERMISSION_DENIED:
        return RetryStrategy.ABORT;

      default:
        return RetryStrategy.ABORT;
    }
  }

  /**
   * Generate suggested action for recovery
   */
  private generateSuggestedAction(failureType: FailureType, toolName: string, _args: any): string {
    switch (failureType) {
      case FailureType.SELECTOR_NOT_FOUND:
        if (toolName.includes("click")) {
          return "Take a snapshot first to get the correct element ref, then retry with the ref instead of element name.";
        }
        return "Verify the selector is correct. Take a snapshot to inspect the page structure.";

      case FailureType.TIMEOUT:
        return "The operation timed out. Wait a moment and retry, or check if the page is loading slowly.";

      case FailureType.NETWORK_ERROR:
        return "Network connection failed. Check internet connectivity and retry.";

      case FailureType.NAVIGATION_FAILED:
        return "Navigation failed. Verify the URL is correct and accessible.";

      case FailureType.INVALID_ARGS:
        return "Invalid arguments provided. Review the tool schema and provide correct parameters.";

      case FailureType.PERMISSION_DENIED:
        return "Permission denied. This action is not allowed.";

      default:
        return "An unknown error occurred. Review the error message and try a different approach.";
    }
  }

  /**
   * Check if failure is recoverable
   */
  isRecoverable(classification: FailureClassification): boolean {
    return classification.severity === Severity.RECOVERABLE && 
           classification.retryStrategy !== RetryStrategy.ABORT;
  }

  /**
   * Check if should retry based on classification and current retry count
   */
  shouldRetry(classification: FailureClassification, currentRetryCount: number): boolean {
    return this.isRecoverable(classification) && 
           currentRetryCount < classification.maxRetries;
  }

  /**
   * Get retry delay for classification
   */
  getRetryDelay(classification: FailureClassification): number {
    return classification.retryDelay;
  }
}

// Singleton instance
export const failureClassifier = new FailureClassifier();
