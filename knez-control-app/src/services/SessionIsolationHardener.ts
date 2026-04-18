// ─── SessionIsolationHardener.ts ───────────────────────────────────────────
// T16: Session Isolation Hardening — hardens session isolation with sandboxing,
//     resource quotas, and cleanup strategies. Isolation strategies: per-session
//     sandboxes, resource quotas, cleanup on session end, cross-session protection.
// ─────────────────────────────────────────────────────────────────────────────

export type IsolationLevel = 'basic' | 'strict' | 'sandbox';

export interface SessionResourceQuota {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxOperations: number;
  maxDurationMs: number;
}

export interface SessionSandbox {
  sessionId: string;
  level: IsolationLevel;
  createdAt: number;
  resourceQuota: SessionResourceQuota;
  resourceUsage: {
    memoryMB: number;
    cpuPercent: number;
    operations: number;
    durationMs: number;
  };
  isolatedData: Map<string, any>;
}

export interface IsolationViolation {
  sessionId: string;
  type: 'memory' | 'cpu' | 'operations' | 'duration';
  limit: number;
  actual: number;
  timestamp: number;
  action: 'warn' | 'throttle' | 'terminate';
}

/**
 * Session isolation hardener with sandboxing and resource quotas.
 */
export class SessionIsolationHardener {
  private sandboxes: Map<string, SessionSandbox> = new Map();
  private violations: IsolationViolation[] = [];
  private defaultQuota: SessionResourceQuota = {
    maxMemoryMB: 512,
    maxCpuPercent: 80,
    maxOperations: 1000,
    maxDurationMs: 300000 // 5 minutes
  };

  /**
   * Create a sandbox for a session.
   */
  createSandbox(
    sessionId: string,
    level: IsolationLevel = 'basic',
    quota?: Partial<SessionResourceQuota>
  ): SessionSandbox {
    const resourceQuota: SessionResourceQuota = {
      maxMemoryMB: quota?.maxMemoryMB || this.defaultQuota.maxMemoryMB,
      maxCpuPercent: quota?.maxCpuPercent || this.defaultQuota.maxCpuPercent,
      maxOperations: quota?.maxOperations || this.defaultQuota.maxOperations,
      maxDurationMs: quota?.maxDurationMs || this.defaultQuota.maxDurationMs
    };

    const sandbox: SessionSandbox = {
      sessionId,
      level,
      createdAt: Date.now(),
      resourceQuota,
      resourceUsage: {
        memoryMB: 0,
        cpuPercent: 0,
        operations: 0,
        durationMs: 0
      },
      isolatedData: new Map()
    };

    this.sandboxes.set(sessionId, sandbox);
    return sandbox;
  }

  /**
   * Get sandbox for a session.
   */
  getSandbox(sessionId: string): SessionSandbox | null {
    return this.sandboxes.get(sessionId) || null;
  }

  /**
   * Update resource usage for a session.
   */
  updateResourceUsage(
    sessionId: string,
    usage: Partial<SessionSandbox['resourceUsage']>
  ): IsolationViolation | null {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return null;

    // Update usage
    if (usage.memoryMB !== undefined) sandbox.resourceUsage.memoryMB = usage.memoryMB;
    if (usage.cpuPercent !== undefined) sandbox.resourceUsage.cpuPercent = usage.cpuPercent;
    if (usage.operations !== undefined) sandbox.resourceUsage.operations = usage.operations;
    if (usage.durationMs !== undefined) sandbox.resourceUsage.durationMs = usage.durationMs;

    // Check for violations
    return this.checkViolations(sessionId);
  }

  /**
   * Check for quota violations.
   */
  private checkViolations(sessionId: string): IsolationViolation | null {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return null;

    const quota = sandbox.resourceQuota;
    const usage = sandbox.resourceUsage;

    // Check memory
    if (usage.memoryMB > quota.maxMemoryMB) {
      const violation: IsolationViolation = {
        sessionId,
        type: 'memory',
        limit: quota.maxMemoryMB,
        actual: usage.memoryMB,
        timestamp: Date.now(),
        action: sandbox.level === 'sandbox' ? 'terminate' : 'throttle'
      };
      this.violations.push(violation);
      return violation;
    }

    // Check CPU
    if (usage.cpuPercent > quota.maxCpuPercent) {
      const violation: IsolationViolation = {
        sessionId,
        type: 'cpu',
        limit: quota.maxCpuPercent,
        actual: usage.cpuPercent,
        timestamp: Date.now(),
        action: sandbox.level === 'sandbox' ? 'terminate' : 'throttle'
      };
      this.violations.push(violation);
      return violation;
    }

    // Check operations
    if (usage.operations > quota.maxOperations) {
      const violation: IsolationViolation = {
        sessionId,
        type: 'operations',
        limit: quota.maxOperations,
        actual: usage.operations,
        timestamp: Date.now(),
        action: sandbox.level === 'sandbox' ? 'terminate' : 'warn'
      };
      this.violations.push(violation);
      return violation;
    }

    // Check duration
    const currentDuration = Date.now() - sandbox.createdAt;
    if (currentDuration > quota.maxDurationMs) {
      const violation: IsolationViolation = {
        sessionId,
        type: 'duration',
        limit: quota.maxDurationMs,
        actual: currentDuration,
        timestamp: Date.now(),
        action: sandbox.level === 'sandbox' ? 'terminate' : 'throttle'
      };
      this.violations.push(violation);
      return violation;
    }

    return null;
  }

  /**
   * Store data in isolated session storage.
   */
  setIsolatedData(sessionId: string, key: string, value: any): void {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return;

    sandbox.isolatedData.set(key, value);
  }

  /**
   * Get data from isolated session storage.
   */
  getIsolatedData(sessionId: string, key: string): any | null {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return null;

    return sandbox.isolatedData.get(key) || null;
  }

  /**
   * Check if data is isolated for a session.
   */
  hasIsolatedData(sessionId: string, key: string): boolean {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return false;

    return sandbox.isolatedData.has(key);
  }

  /**
   * Clear isolated data for a session.
   */
  clearIsolatedData(sessionId: string, key?: string): void {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return;

    if (key) {
      sandbox.isolatedData.delete(key);
    } else {
      sandbox.isolatedData.clear();
    }
  }

  /**
   * Terminate a session sandbox.
   */
  terminateSandbox(sessionId: string): void {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return;

    // Clear isolated data
    sandbox.isolatedData.clear();

    // Remove sandbox
    this.sandboxes.delete(sessionId);
  }

  /**
   * Cleanup all expired or terminated sandboxes.
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, sandbox] of this.sandboxes.entries()) {
      const age = now - sandbox.createdAt;
      if (age > maxAgeMs) {
        this.terminateSandbox(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all violations.
   */
  getViolations(sessionId?: string): IsolationViolation[] {
    if (sessionId) {
      return this.violations.filter(v => v.sessionId === sessionId);
    }
    return [...this.violations];
  }

  /**
   * Clear violation history.
   */
  clearViolations(sessionId?: string): void {
    if (sessionId) {
      this.violations = this.violations.filter(v => v.sessionId !== sessionId);
    } else {
      this.violations = [];
    }
  }

  /**
   * Get isolation status for all sessions.
   */
  getIsolationStatus(): Array<{
    sessionId: string;
    level: IsolationLevel;
    resourceUsage: SessionSandbox['resourceUsage'];
    resourceQuota: SessionResourceQuota;
    violations: number;
  }> {
    const status: Array<{
      sessionId: string;
      level: IsolationLevel;
      resourceUsage: SessionSandbox['resourceUsage'];
      resourceQuota: SessionResourceQuota;
      violations: number;
    }> = [];

    for (const [sessionId, sandbox] of this.sandboxes.entries()) {
      const violations = this.violations.filter(v => v.sessionId === sessionId).length;
      status.push({
        sessionId,
        level: sandbox.level,
        resourceUsage: { ...sandbox.resourceUsage },
        resourceQuota: sandbox.resourceQuota,
        violations
      });
    }

    return status;
  }

  /**
   * Check if session should be terminated based on violations.
   */
  shouldTerminate(sessionId: string): boolean {
    const violations = this.violations.filter(v => v.sessionId === sessionId);
    const terminateViolations = violations.filter(v => v.action === 'terminate');
    
    // Terminate if more than 2 terminate violations
    return terminateViolations.length > 2;
  }

  /**
   * Get resource utilization percentage.
   */
  getResourceUtilization(sessionId: string): {
    memoryPercent: number;
    cpuPercent: number;
    operationsPercent: number;
    durationPercent: number;
  } | null {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return null;

    const quota = sandbox.resourceQuota;
    const usage = sandbox.resourceUsage;

    return {
      memoryPercent: (usage.memoryMB / quota.maxMemoryMB) * 100,
      cpuPercent: (usage.cpuPercent / quota.maxCpuPercent) * 100,
      operationsPercent: (usage.operations / quota.maxOperations) * 100,
      durationPercent: ((Date.now() - sandbox.createdAt) / quota.maxDurationMs) * 100
    };
  }

  /**
   * Update default resource quota.
   */
  setDefaultQuota(quota: Partial<SessionResourceQuota>): void {
    this.defaultQuota = { ...this.defaultQuota, ...quota };
  }

  /**
   * Get active session count.
   */
  getActiveSessionCount(): number {
    return this.sandboxes.size;
  }

  /**
   * Get session IDs.
   */
  getSessionIds(): string[] {
    return Array.from(this.sandboxes.keys());
  }

  /**
   * Reset hardener.
   */
  reset(): void {
    this.sandboxes.clear();
    this.violations = [];
  }
}

// Global instance
export const sessionIsolationHardener = new SessionIsolationHardener();
