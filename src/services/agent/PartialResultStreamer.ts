/**
 * PartialResultStreamer - Streams partial results during execution
 * Shows progress and intermediate results to improve UX
 */

export interface PartialResult {
  id: string;
  type: "progress" | "partial" | "intermediate" | "error";
  data: any;
  timestamp: number;
  progress?: number;
  message?: string;
}

export interface StreamConfig {
  enableProgress: boolean;
  enablePartial: boolean;
  throttleMs: number;
  maxPartialResults: number;
}

export class PartialResultStreamer {
  private config: StreamConfig = {
    enableProgress: true,
    enablePartial: true,
    throttleMs: 100,
    maxPartialResults: 50
  };

  private activeStreams: Map<string, PartialResult[]> = new Map();
  private callbacks: Map<string, (result: PartialResult) => void> = new Map();
  private lastEmitTime: Map<string, number> = new Map();

  constructor(config?: Partial<StreamConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Start a new stream for an execution
   */
  startStream(streamId: string, callback?: (result: PartialResult) => void): void {
    this.activeStreams.set(streamId, []);
    if (callback) {
      this.callbacks.set(streamId, callback);
    }
  }

  /**
   * Emit a progress update
   */
  emitProgress(streamId: string, progress: number, message?: string): void {
    if (!this.config.enableProgress) return;

    const result: PartialResult = {
      id: `${streamId}-progress-${Date.now()}`,
      type: "progress",
      data: { progress },
      timestamp: Date.now(),
      progress,
      message
    };

    this.addResult(streamId, result);
  }

  /**
   * Emit a partial result
   */
  emitPartial(streamId: string, data: any): void {
    if (!this.config.enablePartial) return;

    const result: PartialResult = {
      id: `${streamId}-partial-${Date.now()}`,
      type: "partial",
      data,
      timestamp: Date.now()
    };

    this.addResult(streamId, result);
  }

  /**
   * Emit an intermediate result
   */
  emitIntermediate(streamId: string, data: any, message?: string): void {
    const result: PartialResult = {
      id: `${streamId}-intermediate-${Date.now()}`,
      type: "intermediate",
      data,
      timestamp: Date.now(),
      message
    };

    this.addResult(streamId, result);
  }

  /**
   * Emit an error
   */
  emitError(streamId: string, error: string): void {
    const result: PartialResult = {
      id: `${streamId}-error-${Date.now()}`,
      type: "error",
      data: { error },
      timestamp: Date.now()
    };

    this.addResult(streamId, result);
  }

  /**
   * Add a result to the stream with throttling
   */
  private addResult(streamId: string, result: PartialResult): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTime.get(streamId) || 0;

    // Check throttle
    if (now - lastEmit < this.config.throttleMs && result.type !== "error") {
      return;
    }

    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    // Check max results limit
    if (stream.length >= this.config.maxPartialResults) {
      stream.shift(); // Remove oldest
    }

    stream.push(result);
    this.lastEmitTime.set(streamId, now);

    // Call callback if registered
    const callback = this.callbacks.get(streamId);
    if (callback) {
      callback(result);
    }
  }

  /**
   * Get all results for a stream
   */
  getResults(streamId: string): PartialResult[] {
    return this.activeStreams.get(streamId) || [];
  }

  /**
   * Get results by type
   */
  getResultsByType(streamId: string, type: PartialResult["type"]): PartialResult[] {
    const results = this.activeStreams.get(streamId) || [];
    return results.filter(r => r.type === type);
  }

  /**
   * Get latest result
   */
  getLatestResult(streamId: string): PartialResult | undefined {
    const results = this.activeStreams.get(streamId);
    return results?.[results.length - 1];
  }

  /**
   * Get latest progress
   */
  getLatestProgress(streamId: string): number | undefined {
    const progressResults = this.getResultsByType(streamId, "progress");
    if (progressResults.length === 0) return undefined;
    return progressResults[progressResults.length - 1].progress;
  }

  /**
   * End a stream
   */
  endStream(streamId: string): PartialResult[] {
    const results = this.activeStreams.get(streamId) || [];
    this.activeStreams.delete(streamId);
    this.callbacks.delete(streamId);
    this.lastEmitTime.delete(streamId);
    return results;
  }

  /**
   * Cancel a stream
   */
  cancelStream(streamId: string): void {
    this.activeStreams.delete(streamId);
    this.callbacks.delete(streamId);
    this.lastEmitTime.delete(streamId);
  }

  /**
   * Check if stream is active
   */
  isStreamActive(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }

  /**
   * Get count of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): StreamConfig {
    return { ...this.config };
  }

  /**
   * Clear all streams
   */
  clearAllStreams(): void {
    this.activeStreams.clear();
    this.callbacks.clear();
    this.lastEmitTime.clear();
  }
}

// Singleton instance
export const partialResultStreamer = new PartialResultStreamer();
