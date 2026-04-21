import { logger } from '../utils/LogService';

export type ConnectionHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  healthCheckFn: () => Promise<boolean>;
}

export interface ConnectionHealthState {
  status: ConnectionHealthStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckTime: number;
  lastSuccessTime: number | null;
  lastFailureTime: number | null;
  isMonitoring: boolean;
}

export class ConnectionHealthMonitor {
  private config: HealthCheckConfig;
  private state: ConnectionHealthState;
  private intervalId: NodeJS.Timeout | null = null;
  private subscribers: Set<(state: ConnectionHealthState) => void> = new Set();

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.state = {
      status: "unknown",
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheckTime: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      isMonitoring: false,
    };
  }

  getState(): ConnectionHealthState {
    return { ...this.state };
  }

  subscribe(callback: (state: ConnectionHealthState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        logger.error("connection_health_monitor", "subscriber_error", { error: String(error) });
      }
    });
  }

  private updateStatus(): void {
    const { consecutiveFailures, consecutiveSuccesses } = this.state;
    const { failureThreshold, recoveryThreshold } = this.config;

    let newStatus: ConnectionHealthStatus;

    if (consecutiveSuccesses >= recoveryThreshold) {
      newStatus = "healthy";
    } else if (consecutiveFailures >= failureThreshold) {
      newStatus = "unhealthy";
    } else if (consecutiveFailures > 0) {
      newStatus = "degraded";
    } else {
      newStatus = "unknown";
    }

    if (newStatus !== this.state.status) {
      logger.info("connection_health_monitor", "status_changed", {
        from: this.state.status,
        to: newStatus,
        consecutiveFailures,
        consecutiveSuccesses,
      });
      this.state.status = newStatus;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    this.state.lastCheckTime = startTime;

    try {
      const isHealthy = await Promise.race([
        this.config.healthCheckFn(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error("Health check timeout")), this.config.timeoutMs)
        ),
      ]);

      if (isHealthy) {
        this.state.consecutiveSuccesses++;
        this.state.consecutiveFailures = 0;
        this.state.lastSuccessTime = Date.now();
        logger.debug("connection_health_monitor", "health_check_passed", {
          duration: Date.now() - startTime,
          consecutiveSuccesses: this.state.consecutiveSuccesses,
        });
      } else {
        throw new Error("Health check returned false");
      }
    } catch (error) {
      this.state.consecutiveFailures++;
      this.state.consecutiveSuccesses = 0;
      this.state.lastFailureTime = Date.now();
      logger.warn("connection_health_monitor", "health_check_failed", {
        error: String(error),
        consecutiveFailures: this.state.consecutiveFailures,
      });
    }

    this.updateStatus();
    this.notifySubscribers();
  }

  start(): void {
    if (this.state.isMonitoring) {
      logger.warn("connection_health_monitor", "already_monitoring");
      return;
    }

    // Clear any existing interval to prevent multiple intervals
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state.isMonitoring = true;
    logger.info("connection_health_monitor", "started", {
      intervalMs: this.config.intervalMs,
      timeoutMs: this.config.timeoutMs,
    });

    // Immediate check
    void this.performHealthCheck();

    // Start periodic checks
    this.intervalId = setInterval(() => {
      void this.performHealthCheck();
    }, this.config.intervalMs);
  }

  stop(): void {
    if (!this.state.isMonitoring) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state.isMonitoring = false;
    logger.info("connection_health_monitor", "stopped");
  }

  async checkNow(): Promise<ConnectionHealthState> {
    await this.performHealthCheck();
    return this.getState();
  }

  reset(): void {
    this.state = {
      status: "unknown",
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheckTime: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      isMonitoring: this.state.isMonitoring,
    };
    logger.info("connection_health_monitor", "reset");
    this.notifySubscribers();
  }
}
