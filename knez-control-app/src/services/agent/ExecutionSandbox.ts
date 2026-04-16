/**
 * ExecutionSandbox - Provides isolation and timeout for tool execution
 * Prevents stuck tools from blocking the system
 */

export interface SandboxConfig {
  defaultTimeout: number;
  enableCancellation: boolean;
  maxConcurrentExecutions: number;
}

export interface SandboxExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  timedOut: boolean;
  cancelled: boolean;
  executionTime: number;
}

export class ExecutionSandbox {
  private config: SandboxConfig = {
    defaultTimeout: 30000,
    enableCancellation: true,
    maxConcurrentExecutions: 5
  };

  private activeExecutions: Map<string, AbortController> = new Map();
  private executionCount: number = 0;

  constructor(config?: Partial<SandboxConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Execute a function with timeout and cancellation support
   */
  async execute<T>(
    executionId: string,
    fn: (signal: AbortSignal) => Promise<T>,
    timeout?: number
  ): Promise<SandboxExecutionResult<T>> {
    const startTime = Date.now();
    const effectiveTimeout = timeout || this.config.defaultTimeout;
    
    // Check concurrent execution limit
    if (this.executionCount >= this.config.maxConcurrentExecutions) {
      return {
        success: false,
        error: "Maximum concurrent executions reached",
        timedOut: false,
        cancelled: false,
        executionTime: 0
      };
    }

    this.executionCount++;
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          abortController.abort();
          reject(new Error(`Execution timeout after ${effectiveTimeout}ms`));
        }, effectiveTimeout);
      });

      // Execute the function with cancellation support
      const result = await Promise.race([
        fn(abortController.signal),
        timeoutPromise
      ]);

      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        result,
        timedOut: false,
        cancelled: false,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes("timeout")) {
        return {
          success: false,
          error: errorMessage,
          timedOut: true,
          cancelled: false,
          executionTime
        };
      }

      if (errorMessage.includes("abort")) {
        return {
          success: false,
          error: errorMessage,
          timedOut: false,
          cancelled: true,
          executionTime
        };
      }

      return {
        success: false,
        error: errorMessage,
        timedOut: false,
        cancelled: false,
        executionTime
      };
    } finally {
      this.executionCount--;
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Cancel an active execution
   */
  cancel(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (!controller) return false;

    controller.abort();
    this.activeExecutions.delete(executionId);
    return true;
  }

  /**
   * Cancel all active executions
   */
  cancelAll(): void {
    this.activeExecutions.forEach((controller) => {
      controller.abort();
    });
    this.activeExecutions.clear();
  }

  /**
   * Check if an execution is active
   */
  isActive(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }

  /**
   * Get count of active executions
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(updates: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Execute a simple function without timeout
   */
  async executeSimple<T>(fn: () => Promise<T>): Promise<SandboxExecutionResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        result,
        timedOut: false,
        cancelled: false,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error?.message || String(error);
      
      return {
        success: false,
        error: errorMessage,
        timedOut: false,
        cancelled: false,
        executionTime
      };
    }
  }

  /**
   * Execute multiple functions in parallel with isolation
   */
  async executeParallel<T>(
    executions: Array<{ id: string; fn: (signal: AbortSignal) => Promise<T>; timeout?: number }>
  ): Promise<Map<string, SandboxExecutionResult<T>>> {
    const results = new Map<string, SandboxExecutionResult<T>>();
    
    const promises = executions.map(async ({ id, fn, timeout }) => {
      const result = await this.execute(id, fn, timeout);
      results.set(id, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Execute functions sequentially with isolation
   */
  async executeSequential<T>(
    executions: Array<{ id: string; fn: (signal: AbortSignal) => Promise<T>; timeout?: number }>
  ): Promise<Map<string, SandboxExecutionResult<T>>> {
    const results = new Map<string, SandboxExecutionResult<T>>();
    
    for (const { id, fn, timeout } of executions) {
      const result = await this.execute(id, fn, timeout);
      results.set(id, result);
      
      // Stop if execution failed and not recoverable
      if (!result.success && !result.timedOut && !result.cancelled) {
        break;
      }
    }

    return results;
  }
}

// Singleton instance
export const executionSandbox = new ExecutionSandbox();
