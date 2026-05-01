// CircuitBreaker.ts
// Zero-tolerance circuit breaker pattern for resilient connections

export enum CircuitState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Circuit is open, blocking calls
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time to wait before trying again (ms)
  monitoringPeriod: number;    // Time window for failure counting (ms)
  expectedRecoveryTime: number; // Expected time for service to recover (ms)
  halfOpenMaxCalls: number;    // Max calls in half-open state
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private failureWindow: number[] = []; // Timestamps of recent failures
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private halfOpenCalls: number = 0;
  
  constructor(private config: CircuitBreakerConfig) {
    this.validateConfig();
  }

  private validateConfig(): void {
    if (this.config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be > 0');
    }
    if (this.config.recoveryTimeout <= 0) {
      throw new Error('recoveryTimeout must be > 0');
    }
    if (this.config.monitoringPeriod <= 0) {
      throw new Error('monitoringPeriod must be > 0');
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime!) {
        throw new Error(`Circuit breaker is OPEN. Next attempt at ${new Date(this.nextAttemptTime!).toISOString()}`);
      }
      // Try to transition to half-open
      this.transitionToHalfOpen();
    }

    // Check if we've exceeded half-open call limit
    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error('Circuit breaker is HALF_OPEN and has exceeded max test calls');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Service has recovered, close the circuit
        this.transitionToClosed();
        break;
      case CircuitState.CLOSED:
        // Normal operation, just reset failure count if needed
        this.cleanupOldFailures();
        break;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureWindow.push(Date.now());

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Service still failing, open the circuit again
        this.transitionToOpen();
        break;
      case CircuitState.CLOSED:
        // Check if we should open the circuit
        this.cleanupOldFailures();
        if (this.failureWindow.length >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;
    }
  }

  private cleanupOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitoringPeriod;
    this.failureWindow = this.failureWindow.filter(timestamp => timestamp > cutoff);
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    console.warn(`[CircuitBreaker] Circuit OPENED due to ${this.failureWindow.length} failures. Next attempt at ${new Date(this.nextAttemptTime!).toISOString()}`);
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenCalls = 0;
    console.info(`[CircuitBreaker] Circuit HALF_OPEN, testing service recovery`);
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.failureWindow = [];
    this.nextAttemptTime = null;
    console.info(`[CircuitBreaker] Circuit CLOSED, service has recovered`);
  }

  // Get current circuit breaker statistics
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  // Force reset circuit breaker to closed state
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.failureWindow = [];
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.halfOpenCalls = 0;
    console.info(`[CircuitBreaker] Circuit manually reset to CLOSED`);
  }

  // Check if circuit is currently allowing calls
  isCallAllowed(): boolean {
    if (this.state === CircuitState.OPEN) {
      return Date.now() >= this.nextAttemptTime!;
    }
    if (this.state === CircuitState.HALF_OPEN) {
      return this.halfOpenCalls < this.config.halfOpenMaxCalls;
    }
    return true;
  }

  // Get success rate (0-1)
  getSuccessRate(): number {
    if (this.totalCalls === 0) return 1;
    return this.successes / this.totalCalls;
  }

  // Get failure rate (0-1)
  getFailureRate(): number {
    if (this.totalCalls === 0) return 0;
    return this.failures / this.totalCalls;
  }
}

// Factory function for creating circuit breakers with sensible defaults
export function createCircuitBreaker(overrides: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,           // Open after 5 failures
    recoveryTimeout: 60000,        // Wait 1 minute before trying again
    monitoringPeriod: 300000,     // Look at last 5 minutes for failures
    expectedRecoveryTime: 30000,   // Expect service to recover in 30s
    halfOpenMaxCalls: 3           // Allow 3 test calls in half-open state
  };

  const config = { ...defaultConfig, ...overrides };
  return new CircuitBreaker(config);
}

// Circuit breaker registry for managing multiple breakers
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  create(name: string, config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
    const breaker = createCircuitBreaker(config);
    this.breakers.set(name, breaker);
    return breaker;
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  reset(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global circuit breaker registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
