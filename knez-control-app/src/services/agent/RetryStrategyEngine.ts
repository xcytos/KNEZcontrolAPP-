/**
 * RetryStrategyEngine - Adaptive retry logic for tool failures
 * Determines retry strategy based on failure type and context
 */

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
  getRetryStrategy(
    failureType: string,
    args: any,
    currentRetryCount: number,
    totalRetryCount: number
  ): RetryStrategy {
    // Check hard limits
    if (currentRetryCount >= this.config.maxRetryPerStep) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `Max retries per step reached (${this.config.maxRetryPerStep})`
      };
    }

    if (totalRetryCount >= this.config.maxTotalRetries) {
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
        return this.handleInvalidArgs(args);

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
   * Strategy: regenerate args via model (placeholder for now)
   */
  private handleInvalidArgs(_args: any): RetryStrategy {
    // In a full implementation, this would call the model to regenerate args
    // For now, we return false as we can't regenerate without model context
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: "Invalid arguments - cannot automatically regenerate"
    };
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
