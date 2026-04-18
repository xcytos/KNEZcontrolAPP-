// ─── LatencyOptimizer.ts ─────────────────────────────────────────────────
// T15: Latency Optimizer — optimizes latency through caching, batching,
//     parallel execution, and prefetching. Strategies: tool result caching,
//     request batching, parallel independent tool execution, result prefetching.
// ─────────────────────────────────────────────────────────────────────────────

export type OptimizationStrategy = 'caching' | 'batching' | 'parallel' | 'prefetching' | 'adaptive';

export interface LatencyMetric {
  operation: string;
  durationMs: number;
  timestamp: number;
  cached: boolean;
  batched: boolean;
}

export interface OptimizationSuggestion {
  strategy: OptimizationStrategy;
  operation: string;
  reason: string;
  estimatedSavingsMs: number;
}

export interface OptimizationConfig {
  enableCaching: boolean;
  enableBatching: boolean;
  enableParallel: boolean;
  enablePrefetching: boolean;
  cacheTTLMs: number;
  batchSize: number;
  maxParallelOperations: number;
}

/**
 * Latency optimizer with multiple optimization strategies.
 */
export class LatencyOptimizer {
  private metrics: LatencyMetric[] = [];
  private config: OptimizationConfig = {
    enableCaching: true,
    enableBatching: true,
    enableParallel: true,
    enablePrefetching: false, // Disabled by default
    cacheTTLMs: 60000, // 1 minute
    batchSize: 5,
    maxParallelOperations: 3
  };

  private operationCache: Map<string, { result: any; timestamp: number }> = new Map();
  private pendingOperations: Map<string, Promise<any>> = new Map();

  /**
   * Record latency metric for an operation.
   */
  recordMetric(metric: LatencyMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get average latency for an operation.
   */
  getAverageLatency(operation: string, considerCached: boolean = false): number {
    const relevantMetrics = this.metrics.filter(
      m => m.operation === operation && (considerCached || !m.cached)
    );

    if (relevantMetrics.length === 0) return 0;

    const total = relevantMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    return total / relevantMetrics.length;
  }

  /**
   * Get latency statistics for all operations.
   */
  getLatencyStats(): Map<string, { avgMs: number; minMs: number; maxMs: number; count: number }> {
    const stats = new Map<string, { avgMs: number; minMs: number; maxMs: number; count: number }>();

    const grouped = new Map<string, LatencyMetric[]>();
    for (const metric of this.metrics) {
      const ops = grouped.get(metric.operation) || [];
      ops.push(metric);
      grouped.set(metric.operation, ops);
    }

    for (const [operation, metrics] of grouped.entries()) {
      const durations = metrics.map(m => m.durationMs);
      const avgMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minMs = Math.min(...durations);
      const maxMs = Math.max(...durations);

      stats.set(operation, { avgMs, minMs, maxMs, count: metrics.length });
    }

    return stats;
  }

  /**
   * Check cache for operation result.
   */
  getCachedResult(operation: string, args: any): any | null {
    if (!this.config.enableCaching) return null;

    const cacheKey = this.getCacheKey(operation, args);
    const cached = this.operationCache.get(cacheKey);

    if (!cached) return null;

    // Check TTL
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTLMs) {
      this.operationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache operation result.
   */
  cacheResult(operation: string, args: any, result: any): void {
    if (!this.config.enableCaching) return;

    const cacheKey = this.getCacheKey(operation, args);
    this.operationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Generate cache key for operation.
   */
  private getCacheKey(operation: string, args: any): string {
    const argsStr = JSON.stringify(args);
    return `${operation}:${argsStr}`;
  }

  /**
   * Clear expired cache entries.
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.operationCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTLMs) {
        this.operationCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries.
   */
  clearCache(): void {
    this.operationCache.clear();
  }

  /**
   * Execute operation with caching.
   */
  async executeWithCache<T>(
    operation: string,
    args: any,
    executor: () => Promise<T>
  ): Promise<{ result: T; cached: boolean; durationMs: number }> {
    const startTime = Date.now();

    // Check cache first
    const cached = this.getCachedResult(operation, args);
    if (cached !== null) {
      const durationMs = Date.now() - startTime;
      this.recordMetric({ operation, durationMs, timestamp: Date.now(), cached: true, batched: false });
      return { result: cached, cached: true, durationMs };
    }

    // Execute operation
    const result = await executor();
    const durationMs = Date.now() - startTime;

    // Cache result
    this.cacheResult(operation, args, result);

    this.recordMetric({ operation, durationMs, timestamp: Date.now(), cached: false, batched: false });
    return { result, cached: false, durationMs };
  }

  /**
   * Batch multiple operations together.
   */
  async executeBatch<T>(
    operations: Array<{ operation: string; args: any; executor: () => Promise<T> }>
  ): Promise<Array<{ result: T; durationMs: number }>> {
    if (!this.config.enableBatching || operations.length === 0) {
      return Promise.all(operations.map(op => op.executor().then(result => ({ result, durationMs: 0 }))));
    }

    const batchSize = this.config.batchSize;
    const results: Array<{ result: T; durationMs: number }> = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(op => op.executor().then(result => ({ result, durationMs: 0 })))
      );
      results.push(...batchResults);
    }

    // Record batched metrics
    for (const op of operations) {
      this.recordMetric({ operation: op.operation, durationMs: 0, timestamp: Date.now(), cached: false, batched: true });
    }

    return results;
  }

  /**
   * Execute independent operations in parallel.
   */
  async executeParallel<T>(
    operations: Array<{ operation: string; args: any; executor: () => Promise<T> }>
  ): Promise<Array<{ result: T; durationMs: number }>> {
    if (!this.config.enableParallel || operations.length === 0) {
      return Promise.all(operations.map(op => op.executor().then(result => ({ result, durationMs: 0 }))));
    }

    const maxParallel = this.config.maxParallelOperations;
    const results: Array<{ result: T; durationMs: number }> = [];

    for (let i = 0; i < operations.length; i += maxParallel) {
      const batch = operations.slice(i, i + maxParallel);
      const batchResults = await Promise.all(
        batch.map(async op => {
          const startTime = Date.now();
          const result = await op.executor();
          const durationMs = Date.now() - startTime;
          return { result, durationMs };
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get optimization suggestions based on metrics.
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const stats = this.getLatencyStats();

    for (const [operation, stat] of stats.entries()) {
      // Suggest caching for slow operations
      if (stat.avgMs > 100 && this.config.enableCaching) {
        suggestions.push({
          strategy: 'caching',
          operation,
          reason: 'Slow operation (>100ms), caching could save time',
          estimatedSavingsMs: stat.avgMs * 0.8 // 80% potential savings
        });
      }

      // Suggest batching for frequent operations
      if (stat.count > 10 && this.config.enableBatching) {
        suggestions.push({
          strategy: 'batching',
          operation,
          reason: 'Frequent operation, batching could reduce overhead',
          estimatedSavingsMs: stat.avgMs * 0.3
        });
      }
    }

    return suggestions.sort((a, b) => b.estimatedSavingsMs - a.estimatedSavingsMs);
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Get cache size.
   */
  getCacheSize(): number {
    return this.operationCache.size;
  }

  /**
   * Get metrics summary.
   */
  getMetricsSummary(): {
    totalOperations: number;
    cachedOperations: number;
    batchedOperations: number;
    averageLatencyMs: number;
    cacheHitRate: number;
  } {
    const totalOperations = this.metrics.length;
    const cachedOperations = this.metrics.filter(m => m.cached).length;
    const batchedOperations = this.metrics.filter(m => m.batched).length;
    const averageLatencyMs = totalOperations > 0
      ? this.metrics.reduce((sum, m) => sum + m.durationMs, 0) / totalOperations
      : 0;
    const cacheHitRate = totalOperations > 0 ? cachedOperations / totalOperations : 0;

    return {
      totalOperations,
      cachedOperations,
      batchedOperations,
      averageLatencyMs,
      cacheHitRate
    };
  }

  /**
   * Clear all metrics.
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Reset optimizer to initial state.
   */
  reset(): void {
    this.metrics = [];
    this.operationCache.clear();
    this.pendingOperations.clear();
  }
}

// Global instance
export const latencyOptimizer = new LatencyOptimizer();
