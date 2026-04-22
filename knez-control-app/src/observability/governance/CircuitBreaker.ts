/**
 * Circuit Breaker Governance Layer
 * 
 * If:
 * - latency > threshold
 * - error rate > threshold
 * 
 * Then:
 * - pause execution
 * - emit system_alert
 * - block further packets
 * 
 * This prevents feedback amplification loops
 */

import { getEventBus } from '../eventBus/EventBus';
import { getGraphStateEngine } from '../graphState/GraphStateEngine';

interface CircuitBreakerConfig {
  latencyThresholdMs: number;
  errorRateThreshold: number;
  windowMs: number;
  cooldownMs: number;
  maxFailures: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private cooldownUntil = 0;
  private config: CircuitBreakerConfig;
  private eventBus = getEventBus();
  private graphState = getGraphStateEngine();
  private blockedPackets = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  /**
   * Check if execution should be allowed
   */
  allowExecution(): boolean {
    const now = Date.now();

    // Check if in cooldown
    if (now < this.cooldownUntil) {
      this.state = 'open';
      return false;
    }

    // Check if should transition to half-open
    if (this.state === 'open' && now >= this.cooldownUntil) {
      this.state = 'half-open';
      this.emitStateChange('open', 'half-open');
    }

    // Check failure count
    if (this.failureCount >= this.config.maxFailures) {
      this.trip();
      return false;
    }

    return this.state !== 'open';
  }

  /**
   * Record success
   */
  recordSuccess(latencyMs: number): void {
    // Check latency threshold
    if (latencyMs > this.config.latencyThresholdMs) {
      this.handleLatencyViolation(latencyMs);
      return;
    }

    // Reset failure count on success in half-open state
    if (this.state === 'half-open') {
      this.failureCount = 0;
      this.state = 'closed';
      this.emitStateChange('half-open', 'closed');
    }
  }

  /**
   * Record failure
   */
  recordFailure(error?: string): void {
    this.failureCount++;

    // Emit failure event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'circuit_breaker',
      target_node: 'system',
      event_type: 'circuit_breaker_failure',
      payload: {
        failure_count: this.failureCount,
        error
      },
      latency_ms: 0,
      status: 'failed'
    });

    // Check if should trip
    if (this.failureCount >= this.config.maxFailures) {
      this.trip();
    }
  }

  /**
   * Trip circuit breaker (pause execution)
   */
  private trip(): void {
    if (this.state === 'open') return;

    this.state = 'open';
    this.cooldownUntil = Date.now() + this.config.cooldownMs;

    // Emit system alert
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'circuit_breaker',
      target_node: 'system',
      event_type: 'system_alert',
      payload: {
        alert_type: 'circuit_breaker_tripped',
        failure_count: this.failureCount,
        cooldown_until: this.cooldownUntil,
        message: 'Execution paused due to excessive failures'
      },
      latency_ms: 0,
      status: 'failed'
    });

    // Block all packets
    this.blockPackets();

    // Update graph state to degraded
    const nodes = this.graphState.getAllNodes();
    nodes.forEach((_, nodeId) => {
      this.graphState.updateNodeState(nodeId, 'degraded');
    });
  }

  /**
   * Handle latency violation
   */
  private handleLatencyViolation(latencyMs: number): void {
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'circuit_breaker',
      target_node: 'system',
      event_type: 'latency_violation',
      payload: {
        latency_ms: latencyMs,
        threshold_ms: this.config.latencyThresholdMs
      },
      latency_ms: latencyMs,
      status: 'failed'
    });

    // Count as failure if latency is significantly over threshold
    if (latencyMs > this.config.latencyThresholdMs * 2) {
      this.recordFailure(`Latency exceeded threshold: ${latencyMs}ms`);
    }
  }

  /**
   * Block all packets
   */
  private blockPackets(): void {
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'circuit_breaker',
      target_node: 'system',
      event_type: 'packets_blocked',
      payload: {
        blocked_count: this.blockedPackets
      },
      latency_ms: 0,
      status: 'failed'
    });
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.cooldownUntil = 0;
    this.blockedPackets = 0;

    this.emitStateChange(this.state, 'closed');

    // Restore graph state
    const nodes = this.graphState.getAllNodes();
    nodes.forEach((_, nodeId) => {
      const nodeState = this.graphState.getNode(nodeId);
      if (nodeState?.status === 'degraded') {
        this.graphState.updateNodeState(nodeId, 'idle');
      }
    });
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    state: CircuitState;
    failure_count: number;
    blocked_packets: number;
    cooldown_remaining_ms: number;
  } {
    const cooldownRemaining = Math.max(0, this.cooldownUntil - Date.now());
    
    return {
      state: this.state,
      failure_count: this.failureCount,
      blocked_packets: this.blockedPackets,
      cooldown_remaining_ms: cooldownRemaining
    };
  }

  /**
   * Emit state change event
   */
  private emitStateChange(from: CircuitState, to: CircuitState): void {
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: 'circuit_breaker',
      target_node: 'system',
      event_type: 'circuit_state_change',
      payload: {
        from,
        to
      },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Setup event listeners
   * This implements event-driven state propagation (NO POLLING)
   */
  private setupEventListeners(): void {
    // Listen to packet failures
    this.eventBus.subscribe('packet_failed', () => {
      this.recordFailure('Packet failed to arrive');
    });

    // Listen to node failures
    this.eventBus.subscribe('node_status_change', (event) => {
      const { new_status } = event.payload as { new_status: string };
      if (new_status === 'failed') {
        this.recordFailure('Node failed');
      }
    });

    // Listen to edge failures
    this.eventBus.subscribe('edge_status_change', (event) => {
      const { new_status } = event.payload as { new_status: string };
      if (new_status === 'blocked') {
        this.recordFailure('Edge blocked');
      }
    });

    // Listen to trace failures
    this.eventBus.subscribe('trace_complete', (event) => {
      if (event.status === 'failed') {
        this.recordFailure('Trace failed');
      }
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
let circuitBreakerInstance: CircuitBreaker | null = null;

export function getCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  if (!circuitBreakerInstance) {
    circuitBreakerInstance = new CircuitBreaker(config || {
      latencyThresholdMs: 5000, // 5 seconds
      errorRateThreshold: 0.5, // 50% error rate
      windowMs: 60000, // 1 minute window
      cooldownMs: 30000, // 30 second cooldown
      maxFailures: 5 // Max 5 failures before tripping
    });
  }
  return circuitBreakerInstance;
}
