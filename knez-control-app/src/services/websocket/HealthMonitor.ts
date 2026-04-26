/**
 * Connection Health Monitor
 * Tracks latency, message loss rate, and calculates connection quality score
 */

import { ConnectionHealth, HealthMonitorConfig } from '../../domain/WebSocketProtocol';

const DEFAULT_CONFIG: HealthMonitorConfig = {
  pingInterval: 30000, // 30 seconds
  pongTimeout: 60000, // 60 seconds
  healthCheckInterval: 60000, // 60 seconds
};

export class HealthMonitor {
  private health: ConnectionHealth;
  private config: HealthMonitorConfig;
  private pingTimer: number | null = null;
  private healthCheckTimer: number | null = null;
  private pingTimestamps: Map<number, number> = new Map();
  private latencyHistory: number[] = [];
  private maxLatencyHistory = 100;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.health = {
      connectedAt: Date.now(),
      lastPong: Date.now(),
      lastMessage: Date.now(),
      messageCount: 0,
      errorCount: 0,
      healthScore: 1.0,
      latency: 0,
      qualityScore: 1.0,
    };
  }

  /**
   * Start health monitoring
   */
  start(onPing: (timestamp: number) => void): void {
    // Start ping interval
    this.pingTimer = window.setInterval(() => {
      const timestamp = Date.now();
      this.pingTimestamps.set(timestamp, timestamp);
      onPing(timestamp);
    }, this.config.pingInterval);

    // Start health check interval
    this.healthCheckTimer = window.setInterval(() => {
      this.checkHealth();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Record pong response
   */
  recordPong(timestamp: number): void {
    const pingTime = this.pingTimestamps.get(timestamp);
    if (pingTime) {
      const latency = Date.now() - pingTime;
      this.updateLatency(latency);
      this.health.lastPong = Date.now();
      this.pingTimestamps.delete(timestamp);
    }
  }

  /**
   * Record message received
   */
  recordMessage(): void {
    this.health.lastMessage = Date.now();
    this.health.messageCount++;
    this.updateHealthScore();
  }

  /**
   * Record error
   */
  recordError(): void {
    this.health.errorCount++;
    this.updateHealthScore();
  }

  /**
   * Get current health
   */
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  /**
   * Update latency tracking
   */
  private updateLatency(latency: number): void {
    this.health.latency = latency;
    this.latencyHistory.push(latency);

    // Keep only recent history
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }

    // Calculate average latency
    const avgLatency = this.latencyHistory.reduce((sum, val) => sum + val, 0) / this.latencyHistory.length;
    this.health.latency = avgLatency;

    // Update quality score based on latency
    // Latency < 100ms = 1.0, Latency > 1000ms = 0.0
    const latencyScore = Math.max(0, 1 - (avgLatency - 100) / 900);
    this.health.qualityScore = latencyScore;
  }

  /**
   * Update health score
   */
  private updateHealthScore(): void {
    const totalMessages = this.health.messageCount + this.health.errorCount;
    if (totalMessages === 0) {
      this.health.healthScore = 1.0;
      return;
    }

    const errorRate = this.health.errorCount / totalMessages;
    const errorScore = 1 - errorRate;

    // Combine latency score and error score
    this.health.healthScore = (this.health.qualityScore + errorScore) / 2;
  }

  /**
   * Check health and emit events if needed
   */
  private checkHealth(): void {
    const now = Date.now();
    const timeSinceLastPong = now - this.health.lastPong;
    const timeSinceLastMessage = now - this.health.lastMessage;

    // Check for pong timeout
    if (timeSinceLastPong > this.config.pongTimeout) {
      console.warn('[HealthMonitor] Pong timeout detected');
      // Emit pong timeout event
      this.emitEvent('pong_timeout', { timeSinceLastPong });
    }

    // Check for idle connection
    if (timeSinceLastMessage > this.config.healthCheckInterval * 2) {
      console.warn('[HealthMonitor] Connection appears idle');
      // Emit idle event
      this.emitEvent('connection_idle', { timeSinceLastMessage });
    }

    // Check for degraded health
    if (this.health.healthScore < 0.5) {
      console.warn('[HealthMonitor] Degraded connection health', this.health);
      // Emit degraded event
      this.emitEvent('connection_degraded', this.health);
    }
  }

  /**
   * Emit health event (placeholder for event bus integration)
   */
  private emitEvent(event: string, data: any): void {
    // TODO: Integrate with event bus
    console.log(`[HealthMonitor] Event: ${event}`, data);
  }

  /**
   * Reset health monitoring
   */
  reset(): void {
    this.health = {
      connectedAt: Date.now(),
      lastPong: Date.now(),
      lastMessage: Date.now(),
      messageCount: 0,
      errorCount: 0,
      healthScore: 1.0,
      latency: 0,
      qualityScore: 1.0,
    };
    this.latencyHistory = [];
    this.pingTimestamps.clear();
  }

  /**
   * Get health statistics
   */
  getStats() {
    return {
      ...this.health,
      avgLatency: this.health.latency,
      minLatency: this.latencyHistory.length > 0 ? Math.min(...this.latencyHistory) : 0,
      maxLatency: this.latencyHistory.length > 0 ? Math.max(...this.latencyHistory) : 0,
      latencySamples: this.latencyHistory.length,
    };
  }
}
