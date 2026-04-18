// ─── FailurePatternLearner.ts ─────────────────────────────────────────────
// T14: Failure Pattern Learning — detects patterns in failures using statistical
//     models (frequency, transition probabilities). Tracks frequent failure
//     sequences, tool-specific failure modes, and temporal patterns.
//     Storage: IndexedDB for learned patterns.
// ─────────────────────────────────────────────────────────────────────────────

import { FailureType } from './RetryStrategy';

const DB_NAME = 'FailurePatternDB';
const DB_VERSION = 1;
const STORE_NAME = 'failurePatterns';

export interface FailureRecord {
  id: string;
  sessionId: string;
  toolName: string;
  failureType: FailureType;
  errorMessage: string;
  timestamp: number;
  context?: any;
}

export interface FailureSequence {
  sequence: string[]; // Array of tool names
  frequency: number;
  lastSeen: number;
  avgDurationMs: number;
}

export interface ToolFailureMode {
  toolName: string;
  failureType: FailureType;
  frequency: number;
  lastSeen: number;
  commonContexts: Map<string, number>;
  successRateAfterRemediation: number;
}

export interface PatternPrediction {
  toolName: string;
  predictedFailureType: FailureType | null;
  confidence: number;
  suggestedRemediation: string;
}

export interface LearnedPatterns {
  failureSequences: FailureSequence[];
  toolFailureModes: ToolFailureMode[];
  temporalPatterns: Map<string, number>; // hour -> failure count
  totalFailures: number;
  lastUpdated: number;
}

/**
 * Failure pattern learner with statistical pattern detection.
 */
export class FailurePatternLearner {
  private db: IDBDatabase | null = null;
  private initialized = false;
  private failureRecords: FailureRecord[] = [];
  private learnedPatterns: LearnedPatterns = {
    failureSequences: [],
    toolFailureModes: [],
    temporalPatterns: new Map(),
    totalFailures: 0,
    lastUpdated: Date.now()
  };

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
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('toolName', 'toolName', { unique: false });
          store.createIndex('failureType', 'failureType', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Record a failure for pattern learning.
   */
  async recordFailure(
    sessionId: string,
    toolName: string,
    failureType: FailureType,
    errorMessage: string,
    context?: any
  ): Promise<void> {
    await this.initializeDB();

    const record: FailureRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      toolName,
      failureType,
      errorMessage,
      timestamp: Date.now(),
      context
    };

    this.failureRecords.push(record);
    this.learnedPatterns.totalFailures++;
    this.learnedPatterns.lastUpdated = Date.now();

    // Persist to IndexedDB
    await this.saveRecordToDB(record);

    // Update patterns
    this.updatePatterns();
  }

  /**
   * Save record to IndexedDB.
   */
  private async saveRecordToDB(record: FailureRecord): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Load records from IndexedDB.
   */
  private async loadRecordsFromDB(): Promise<void> {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.failureRecords = request.result as FailureRecord[];
        resolve();
      };
    });
  }

  /**
   * Update learned patterns from failure records.
   */
  private updatePatterns(): void {
    this.learnedPatterns.failureSequences = this.detectFailureSequences();
    this.learnedPatterns.toolFailureModes = this.detectToolFailureModes();
    this.learnedPatterns.temporalPatterns = this.detectTemporalPatterns();
  }

  /**
   * Detect frequent failure sequences.
   */
  private detectFailureSequences(): FailureSequence[] {
    const sequences: Map<string, { count: number; lastSeen: number; durations: number[] }> = new Map();

    // Group failures by session
    const sessionFailures = new Map<string, FailureRecord[]>();
    for (const record of this.failureRecords) {
      const failures = sessionFailures.get(record.sessionId) || [];
      failures.push(record);
      sessionFailures.set(record.sessionId, failures);
    }

    // Extract sequences from each session
    for (const failures of sessionFailures.values()) {
      // Sort by timestamp
      failures.sort((a, b) => a.timestamp - b.timestamp);

      // Extract sequences of 2-3 consecutive tools
      for (let i = 0; i < failures.length - 1; i++) {
        const seq2 = `${failures[i].toolName}->${failures[i + 1].toolName}`;
        const duration = failures[i + 1].timestamp - failures[i].timestamp;
        
        const existing = sequences.get(seq2);
        if (existing) {
          existing.count++;
          existing.lastSeen = failures[i + 1].timestamp;
          existing.durations.push(duration);
        } else {
          sequences.set(seq2, {
            count: 1,
            lastSeen: failures[i + 1].timestamp,
            durations: [duration]
          });
        }
      }

      for (let i = 0; i < failures.length - 2; i++) {
        const seq3 = `${failures[i].toolName}->${failures[i + 1].toolName}->${failures[i + 2].toolName}`;
        const duration = failures[i + 2].timestamp - failures[i].timestamp;
        
        const existing = sequences.get(seq3);
        if (existing) {
          existing.count++;
          existing.lastSeen = failures[i + 2].timestamp;
          existing.durations.push(duration);
        } else {
          sequences.set(seq3, {
            count: 1,
            lastSeen: failures[i + 2].timestamp,
            durations: [duration]
          });
        }
      }
    }

    // Convert to array and filter by frequency
    const result: FailureSequence[] = [];
    for (const [sequence, data] of sequences.entries()) {
      if (data.count >= 2) {
        const avgDuration = data.durations.length > 0
          ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
          : 0;
        
        result.push({
          sequence: sequence.split('->'),
          frequency: data.count,
          lastSeen: data.lastSeen,
          avgDurationMs: avgDuration
        });
      }
    }

    return result.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect tool-specific failure modes.
   */
  private detectToolFailureModes(): ToolFailureMode[] {
    const modes: Map<string, ToolFailureMode> = new Map();

    for (const record of this.failureRecords) {
      const key = `${record.toolName}:${record.failureType}`;
      const existing = modes.get(key);

      if (existing) {
        existing.frequency++;
        existing.lastSeen = record.timestamp;
        
        // Track context patterns
        const contextStr = JSON.stringify(record.context || {});
        const contextCount = existing.commonContexts.get(contextStr) || 0;
        existing.commonContexts.set(contextStr, contextCount + 1);
      } else {
        modes.set(key, {
          toolName: record.toolName,
          failureType: record.failureType,
          frequency: 1,
          lastSeen: record.timestamp,
          commonContexts: new Map([[JSON.stringify(record.context || {}), 1]]),
          successRateAfterRemediation: 0.5 // Default neutral
        });
      }
    }

    return Array.from(modes.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect temporal patterns (time-based failure patterns).
   */
  private detectTemporalPatterns(): Map<string, number> {
    const patterns = new Map<string, number>();

    for (const record of this.failureRecords) {
      const hour = new Date(record.timestamp).getHours().toString();
      const count = patterns.get(hour) || 0;
      patterns.set(hour, count + 1);
    }

    return patterns;
  }

  /**
   * Detect patterns for a specific session.
   */
  async detectPatterns(sessionId: string): Promise<LearnedPatterns> {
    await this.loadRecordsFromDB();
    
    // Filter records for session
    const sessionRecords = this.failureRecords.filter(r => r.sessionId === sessionId);
    
    // Build session-specific patterns
    const sessionPatterns: LearnedPatterns = {
      failureSequences: this.detectFailureSequences(),
      toolFailureModes: this.detectToolFailureModes(),
      temporalPatterns: this.detectTemporalPatterns(),
      totalFailures: sessionRecords.length,
      lastUpdated: Date.now()
    };

    return sessionPatterns;
  }

  /**
   * Get failure predictions for a tool.
   */
  async getFailurePredictions(toolName: string): Promise<PatternPrediction[]> {
    await this.loadRecordsFromDB();
    this.updatePatterns();

    const predictions: PatternPrediction[] = [];
    
    // Find tool-specific failure modes
    const toolModes = this.learnedPatterns.toolFailureModes.filter(m => m.toolName === toolName);
    
    for (const mode of toolModes) {
      const confidence = Math.min(0.9, mode.frequency / this.learnedPatterns.totalFailures * 10);
      
      predictions.push({
        toolName,
        predictedFailureType: mode.failureType,
        confidence,
        suggestedRemediation: this.getRemediationSuggestion(mode.failureType)
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get pattern suggestions based on learned patterns.
   */
  async getPatternSuggestions(): Promise<{
    frequentSequences: FailureSequence[];
    problematicTools: ToolFailureMode[];
    temporalInsights: Array<{ hour: string; count: number }>;
  }> {
    await this.loadRecordsFromDB();
    this.updatePatterns();

    return {
      frequentSequences: this.learnedPatterns.failureSequences.slice(0, 10),
      problematicTools: this.learnedPatterns.toolFailureModes.slice(0, 10),
      temporalInsights: Array.from(this.learnedPatterns.temporalPatterns.entries())
        .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  /**
   * Get remediation suggestion for failure type.
   */
  private getRemediationSuggestion(failureType: FailureType): string {
    const remediations: Record<FailureType, string> = {
      network: "Check network connectivity, retry with exponential backoff",
      timeout: "Increase timeout duration, optimize operation",
      validation: "Validate input parameters, check schema",
      permission: "Verify credentials and access rights",
      data_mismatch: "Verify data source, use fallback data",
      schema_error: "Validate expected format, check API documentation",
      element_not_found: "Wait for element, use alternative selector",
      api_error: "Retry with backoff, check API status",
      unknown: "Investigate error details, check logs"
    };

    return remediations[failureType] || "Retry with fallback strategy";
  }

  /**
   * Get all learned patterns.
   */
  async getLearnedPatterns(): Promise<LearnedPatterns> {
    await this.loadRecordsFromDB();
    this.updatePatterns();
    return this.learnedPatterns;
  }

  /**
   * Clear all learned patterns.
   */
  async clearPatterns(): Promise<void> {
    this.failureRecords = [];
    this.learnedPatterns = {
      failureSequences: [],
      toolFailureModes: [],
      temporalPatterns: new Map(),
      totalFailures: 0,
      lastUpdated: Date.now()
    };

    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get statistics.
   */
  async getStatistics(): Promise<{
    totalFailures: number;
    uniqueTools: number;
    uniqueFailureTypes: number;
    patternsDetected: number;
  }> {
    await this.loadRecordsFromDB();

    const uniqueTools = new Set(this.failureRecords.map(r => r.toolName)).size;
    const uniqueFailureTypes = new Set(this.failureRecords.map(r => r.failureType)).size;
    const patternsDetected = this.learnedPatterns.failureSequences.length + 
                            this.learnedPatterns.toolFailureModes.length;

    return {
      totalFailures: this.failureRecords.length,
      uniqueTools,
      uniqueFailureTypes,
      patternsDetected
    };
  }
}

// Global instance
export const failurePatternLearner = new FailurePatternLearner();
