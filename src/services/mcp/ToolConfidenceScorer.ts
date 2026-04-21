// ─── ToolConfidenceScorer.ts ─────────────────────────────────────────────────
// T5: Tool Confidence Scoring — tracks tool execution reliability with confidence
//     metrics (success rate, result quality, timeout frequency, error patterns).
//     Score calculation: 0-100 scale based on historical performance.
//     Storage: IndexedDB for persistence across sessions.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolExecutionMetrics {
  toolName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  timeoutCount: number;
  averageDurationMs: number;
  lastExecutionTime: number;
  errorPatterns: Map<string, number>; // error type -> count
  resultQualityScore: number; // 0-100 based on result validation
}

export interface ConfidenceScore {
  toolName: string;
  score: number; // 0-100
  reliability: 'high' | 'medium' | 'low';
  metrics: ToolExecutionMetrics;
  lastUpdated: number;
}

const DB_NAME = 'ToolConfidenceDB';
const DB_VERSION = 1;
const STORE_NAME = 'toolConfidence';

/**
 * Tool confidence scorer with IndexedDB persistence.
 * Tracks tool execution metrics and calculates confidence scores.
 */
export class ToolConfidenceScorer {
  private db: IDBDatabase | null = null;
  private metricsCache: Map<string, ToolExecutionMetrics> = new Map();
  private initialized = false;

  /**
   * Initialize IndexedDB database.
   */
  private async initializeDB(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'toolName' });
          store.createIndex('score', 'score', { unique: false });
          store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
      };
    });
  }

  /**
   * Load all metrics from IndexedDB into cache.
   */
  private async loadMetricsFromDB(): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result as any[];
        this.metricsCache.clear();
        for (const result of results) {
          const metrics = this.deserializeMetrics(result);
          this.metricsCache.set(metrics.toolName, metrics);
        }
        resolve();
      };
    });
  }

  /**
   * Save metrics to IndexedDB.
   */
  private async saveMetricsToDB(metrics: ToolExecutionMetrics): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const serialized = this.serializeMetrics(metrics);
      const request = store.put(serialized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Serialize metrics for IndexedDB storage.
   */
  private serializeMetrics(metrics: ToolExecutionMetrics): any {
    return {
      toolName: metrics.toolName,
      totalExecutions: metrics.totalExecutions,
      successfulExecutions: metrics.successfulExecutions,
      failedExecutions: metrics.failedExecutions,
      timeoutCount: metrics.timeoutCount,
      averageDurationMs: metrics.averageDurationMs,
      lastExecutionTime: metrics.lastExecutionTime,
      errorPatterns: Array.from(metrics.errorPatterns.entries()),
      resultQualityScore: metrics.resultQualityScore
    };
  }

  /**
   * Deserialize metrics from IndexedDB storage.
   */
  private deserializeMetrics(data: any): ToolExecutionMetrics {
    return {
      toolName: data.toolName,
      totalExecutions: data.totalExecutions,
      successfulExecutions: data.successfulExecutions,
      failedExecutions: data.failedExecutions,
      timeoutCount: data.timeoutCount,
      averageDurationMs: data.averageDurationMs,
      lastExecutionTime: data.lastExecutionTime,
      errorPatterns: new Map(data.errorPatterns || []),
      resultQualityScore: data.resultQualityScore || 50
    };
  }

  /**
   * Get or create metrics for a tool.
   */
  private getOrCreateMetrics(toolName: string): ToolExecutionMetrics {
    if (!this.metricsCache.has(toolName)) {
      this.metricsCache.set(toolName, {
        toolName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        timeoutCount: 0,
        averageDurationMs: 0,
        lastExecutionTime: 0,
        errorPatterns: new Map(),
        resultQualityScore: 50 // Default neutral score
      });
    }
    return this.metricsCache.get(toolName)!;
  }

  /**
   * Calculate confidence score (0-100) based on metrics.
   */
  private calculateScore(metrics: ToolExecutionMetrics): number {
    if (metrics.totalExecutions === 0) return 50; // Neutral score for no data

    // Success rate component (40% weight)
    const successRate = metrics.successfulExecutions / metrics.totalExecutions;
    const successScore = successRate * 40;

    // Result quality component (30% weight)
    const qualityScore = (metrics.resultQualityScore / 100) * 30;

    // Timeout penalty (15% weight)
    const timeoutRate = metrics.timeoutCount / metrics.totalExecutions;
    const timeoutScore = (1 - timeoutRate) * 15;

    // Error pattern penalty (15% weight)
    const errorRate = metrics.failedExecutions / metrics.totalExecutions;
    const errorScore = (1 - errorRate) * 15;

    const totalScore = successScore + qualityScore + timeoutScore + errorScore;
    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  /**
   * Determine reliability level based on score.
   */
  private getReliabilityLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  /**
   * Score a tool execution.
   */
  async scoreToolExecution(
    toolName: string,
    _args: any,
    result: any,
    durationMs: number,
    success: boolean,
    errorType?: string
  ): Promise<void> {
    await this.loadMetricsFromDB();

    const metrics = this.getOrCreateMetrics(toolName);
    
    // Update execution counts
    metrics.totalExecutions++;
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
      if (errorType) {
        const currentCount = metrics.errorPatterns.get(errorType) || 0;
        metrics.errorPatterns.set(errorType, currentCount + 1);
      }
    }

    // Check for timeout
    if (!success && (errorType?.toLowerCase().includes('timeout') || durationMs > 30000)) {
      metrics.timeoutCount++;
    }

    // Update average duration
    if (metrics.totalExecutions === 1) {
      metrics.averageDurationMs = durationMs;
    } else {
      metrics.averageDurationMs = 
        (metrics.averageDurationMs * (metrics.totalExecutions - 1) + durationMs) / metrics.totalExecutions;
    }

    // Update result quality score
    if (success && result) {
      const quality = this.assessResultQuality(result);
      // Rolling average for quality score
      metrics.resultQualityScore = (metrics.resultQualityScore * 0.8) + (quality * 0.2);
    }

    metrics.lastExecutionTime = Date.now();

    await this.saveMetricsToDB(metrics);
  }

  /**
   * Assess result quality (0-100).
   */
  private assessResultQuality(result: any): number {
    if (!result) return 0;

    let score = 50; // Base score

    // Check for structured data
    if (typeof result === 'object') {
      score += 10;

      // Check for meaningful content
      if (result.content || result.data || result.result) {
        score += 10;
      }

      // Check for status success
      if (result.status === 'success' || result.ok === true) {
        score += 15;
      }

      // Penalize errors
      if (result.error || result.errorMessage) {
        score -= 20;
      }

      // Check for non-empty content
      const contentLength = String(result.content || result.data || '').length;
      if (contentLength > 100) {
        score += 5;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get confidence score for a tool.
   */
  async getConfidenceScore(toolName: string): Promise<ConfidenceScore | null> {
    await this.loadMetricsFromDB();

    const metrics = this.metricsCache.get(toolName);
    if (!metrics) return null;

    const score = this.calculateScore(metrics);
    const reliability = this.getReliabilityLevel(score);

    return {
      toolName,
      score,
      reliability,
      metrics,
      lastUpdated: metrics.lastExecutionTime
    };
  }

  /**
   * Get tool reliability summary.
   */
  async getToolReliability(toolName: string): Promise<{
    reliability: 'high' | 'medium' | 'low';
    score: number;
    successRate: number;
    avgDurationMs: number;
    commonErrors: Array<{ type: string; count: number }>;
  } | null> {
    const confidence = await this.getConfidenceScore(toolName);
    if (!confidence) return null;

    const { metrics, score, reliability } = confidence;
    const successRate = metrics.totalExecutions > 0 
      ? metrics.successfulExecutions / metrics.totalExecutions 
      : 0;

    const commonErrors = Array.from(metrics.errorPatterns.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      reliability,
      score,
      successRate,
      avgDurationMs: metrics.averageDurationMs,
      commonErrors
    };
  }

  /**
   * Get all tools sorted by confidence score.
   */
  async getAllToolScores(): Promise<ConfidenceScore[]> {
    await this.loadMetricsFromDB();

    const scores: ConfidenceScore[] = [];
    for (const metrics of this.metricsCache.values()) {
      const score = this.calculateScore(metrics);
      const reliability = this.getReliabilityLevel(score);
      scores.push({
        toolName: metrics.toolName,
        score,
        reliability,
        metrics,
        lastUpdated: metrics.lastExecutionTime
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get low-confidence tools (score < 50).
   */
  async getLowConfidenceTools(): Promise<ConfidenceScore[]> {
    const allScores = await this.getAllToolScores();
    return allScores.filter(s => s.score < 50);
  }

  /**
   * Reset metrics for a tool.
   */
  async resetToolMetrics(toolName: string): Promise<void> {
    await this.loadMetricsFromDB();

    const metrics = this.getOrCreateMetrics(toolName);
    metrics.totalExecutions = 0;
    metrics.successfulExecutions = 0;
    metrics.failedExecutions = 0;
    metrics.timeoutCount = 0;
    metrics.averageDurationMs = 0;
    metrics.lastExecutionTime = 0;
    metrics.errorPatterns.clear();
    metrics.resultQualityScore = 50;

    await this.saveMetricsToDB(metrics);
  }

  /**
   * Clear all metrics.
   */
  async clearAllMetrics(): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.metricsCache.clear();
        resolve();
      };
    });
  }

  /**
   * Get statistics summary.
   */
  async getStatistics(): Promise<{
    totalTools: number;
    totalExecutions: number;
    overallSuccessRate: number;
    highConfidenceTools: number;
    lowConfidenceTools: number;
  }> {
    await this.loadMetricsFromDB();

    let totalExecutions = 0;
    let totalSuccesses = 0;
    let highConfidence = 0;
    let lowConfidence = 0;

    for (const metrics of this.metricsCache.values()) {
      totalExecutions += metrics.totalExecutions;
      totalSuccesses += metrics.successfulExecutions;
      
      const score = this.calculateScore(metrics);
      if (score >= 75) highConfidence++;
      if (score < 50) lowConfidence++;
    }

    const overallSuccessRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 0;

    return {
      totalTools: this.metricsCache.size,
      totalExecutions,
      overallSuccessRate,
      highConfidenceTools: highConfidence,
      lowConfidenceTools: lowConfidence
    };
  }
}

// Global instance
export const toolConfidenceScorer = new ToolConfidenceScorer();
