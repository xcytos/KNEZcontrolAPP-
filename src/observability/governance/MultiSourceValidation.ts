/**
 * Multi-Source Validation (Consensus Check)
 * 
 * For critical actions, require:
 * - backend validation
 * - memory validation
 * - tool validation
 * 
 * Only proceed if ALL succeed
 * This implements multi-sig style governance
 */

import { getEventBus } from '../eventBus/EventBus';

type ValidationResult = 'pending' | 'valid' | 'invalid';
type ValidationSource = 'backend' | 'memory' | 'tool';

interface ValidationRequest {
  requestId: string;
  action: string;
  sources: ValidationSource[];
  results: Map<ValidationSource, ValidationResult>;
  startTime: number;
  timeoutMs: number;
}

export class MultiSourceValidation {
  private pendingValidations: Map<string, ValidationRequest> = new Map();
  private eventBus = getEventBus();
  private defaultTimeoutMs = 5000; // 5 seconds

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Request validation for a critical action
   * Returns requestId for tracking
   */
  requestValidation(action: string, sources: ValidationSource[]): string {
    const requestId = this.generateUUID();
    const request: ValidationRequest = {
      requestId,
      action,
      sources,
      results: new Map(),
      startTime: Date.now(),
      timeoutMs: this.defaultTimeoutMs
    };

    this.pendingValidations.set(requestId, request);

    // Emit validation request event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'multi_source_validation',
      target_node: 'system',
      event_type: 'validation_requested',
      payload: {
        request_id: requestId,
        action,
        sources
      },
      latency_ms: 0,
      status: 'success'
    });

    // Set timeout for validation
    setTimeout(() => {
      this.checkValidationTimeout(requestId);
    }, request.timeoutMs);

    return requestId;
  }

  /**
   * Submit validation result from a source
   */
  submitValidation(requestId: string, source: ValidationSource, result: ValidationResult): void {
    const request = this.pendingValidations.get(requestId);
    if (!request) {
      console.warn(`[MultiSourceValidation] Request ${requestId} not found`);
      return;
    }

    request.results.set(source, result);

    // Emit validation result event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: source,
      target_node: 'multi_source_validation',
      event_type: 'validation_result',
      payload: {
        request_id: requestId,
        source,
        result
      },
      latency_ms: Date.now() - request.startTime,
      status: result === 'valid' ? 'success' : 'failed'
    });

    // Check if all sources have responded
    if (this.allSourcesResponded(request)) {
      this.resolveValidation(requestId);
    }
  }

  /**
   * Check if all sources have responded
   */
  private allSourcesResponded(request: ValidationRequest): boolean {
    return request.sources.every(source => request.results.has(source));
  }

  /**
   * Resolve validation (check consensus)
   */
  private resolveValidation(requestId: string): void {
    const request = this.pendingValidations.get(requestId);
    if (!request) return;

    // Check if all validations passed
    const allValid = Array.from(request.results.values()).every(r => r === 'valid');
    const consensusReached = allValid;

    // Emit consensus event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'multi_source_validation',
      target_node: 'system',
      event_type: consensusReached ? 'validation_consensus_reached' : 'validation_consensus_failed',
      payload: {
        request_id: requestId,
        action: request.action,
        consensus_reached: consensusReached,
        results: Object.fromEntries(request.results)
      },
      latency_ms: Date.now() - request.startTime,
      status: consensusReached ? 'success' : 'failed'
    });

    // Remove from pending
    this.pendingValidations.delete(requestId);
  }

  /**
   * Check validation timeout
   */
  private checkValidationTimeout(requestId: string): void {
    const request = this.pendingValidations.get(requestId);
    if (!request) return;

    // Emit timeout event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'multi_source_validation',
      target_node: 'system',
      event_type: 'validation_timeout',
      payload: {
        request_id: requestId,
        action: request.action,
        results: Object.fromEntries(request.results),
        missing_sources: request.sources.filter(s => !request.results.has(s))
      },
      latency_ms: Date.now() - request.startTime,
      status: 'failed'
    });

    // Remove from pending
    this.pendingValidations.delete(requestId);
  }

  /**
   * Get pending validation status
   */
  getValidationStatus(requestId: string): {
    status: 'pending' | 'resolved' | 'timeout';
    results: Record<ValidationSource, ValidationResult>;
    elapsedMs: number;
  } | undefined {
    const request = this.pendingValidations.get(requestId);
    if (!request) return undefined;

    return {
      status: this.allSourcesResponded(request) ? 'resolved' : 'pending',
      results: Object.fromEntries(request.results) as Record<ValidationSource, ValidationResult>,
      elapsedMs: Date.now() - request.startTime
    };
  }

  /**
   * Cancel pending validation
   */
  cancelValidation(requestId: string): void {
    const request = this.pendingValidations.get(requestId);
    if (!request) return;

    this.pendingValidations.delete(requestId);

    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'multi_source_validation',
      target_node: 'system',
      event_type: 'validation_cancelled',
      payload: {
        request_id: requestId,
        action: request.action
      },
      latency_ms: Date.now() - request.startTime,
      status: 'success'
    });
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    pending_validations: number;
    total_validations: number;
    consensus_reached: number;
    consensus_failed: number;
    timeouts: number;
  } {
    // This would require tracking historical data
    // For now, return current state
    return {
      pending_validations: this.pendingValidations.size,
      total_validations: 0,
      consensus_reached: 0,
      consensus_failed: 0,
      timeouts: 0
    };
  }

  /**
   * Setup event listeners
   * This implements event-driven state propagation (NO POLLING)
   */
  private setupEventListeners(): void {
    // Listen to backend validation results
    this.eventBus.subscribe('backend_validation_result', (event) => {
      const { request_id, result } = event.payload as { request_id: string; result: ValidationResult };
      this.submitValidation(request_id, 'backend', result);
    });

    // Listen to memory validation results
    this.eventBus.subscribe('memory_validation_result', (event) => {
      const { request_id, result } = event.payload as { request_id: string; result: ValidationResult };
      this.submitValidation(request_id, 'memory', result);
    });

    // Listen to tool validation results
    this.eventBus.subscribe('tool_validation_result', (event) => {
      const { request_id, result } = event.payload as { request_id: string; result: ValidationResult };
      this.submitValidation(request_id, 'tool', result);
    });
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Singleton instance
let multiSourceValidationInstance: MultiSourceValidation | null = null;

export function getMultiSourceValidation(): MultiSourceValidation {
  if (!multiSourceValidationInstance) {
    multiSourceValidationInstance = new MultiSourceValidation();
  }
  return multiSourceValidationInstance;
}
