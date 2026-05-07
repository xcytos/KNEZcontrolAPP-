export enum PTYState {
  CREATED = 'created',
  SPAWNING = 'spawning',
  ATTACHING = 'attaching',
  RUNNING = 'running',
  DETACHING = 'detaching',
  EXITING = 'exiting',
  EXITED = 'exited',
  DESTROYED = 'destroyed',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

export interface PTYStateTransition {
  from: PTYState;
  to: PTYState;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface PTYLifecycleConfig {
  maxRetries: number;
  retryDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  enableAutoReconnect: boolean;
}

export interface PTYLifecycleEvent {
  type: 'state_change' | 'heartbeat' | 'error' | 'reconnect' | 'cleanup';
  ptyId: string;
  state: PTYState;
  timestamp: Date;
  data?: any;
  error?: Error;
  reason?: string;
  metadata?: Record<string, any>;
}

export class PTYLifecycleManager {
  private stateMachines: Map<string, PTYState> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private config: PTYLifecycleConfig;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<PTYLifecycleConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      heartbeatInterval: 5000,
      connectionTimeout: 30000,
      enableAutoReconnect: true,
      ...config
    };
  }

  // Public API
  createPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.CREATED);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.CREATED,
      reason: 'PTY instance created',
      timestamp: new Date()
    });
  }

  spawnPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.SPAWNING);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.SPAWNING,
      reason: 'Process spawning initiated',
      timestamp: new Date()
    });
  }

  attachPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.ATTACHING);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.ATTACHING,
      reason: 'PTY attachment initiated',
      timestamp: new Date()
    });
  }

  startPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.RUNNING);
    this.startHeartbeat(ptyId);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.RUNNING,
      reason: 'PTY process started and ready',
      timestamp: new Date()
    });
  }

  detachPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.DETACHING);
    this.stopHeartbeat(ptyId);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.DETACHING,
      reason: 'PTY detachment initiated',
      timestamp: new Date()
    });
  }

  exitPTY(ptyId: string, exitCode?: number): void {
    this.setState(ptyId, PTYState.EXITING);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.EXITING,
      reason: `PTY process exiting with code ${exitCode}`,
      metadata: { exitCode },
      timestamp: new Date()
    });
  }

  destroyPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.DESTROYED);
    this.stopHeartbeat(ptyId);
    this.stateMachines.delete(ptyId);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.DESTROYED,
      reason: 'PTY instance destroyed and cleaned up',
      timestamp: new Date()
    });
  }

  errorPTY(ptyId: string, error: Error): void {
    this.setState(ptyId, PTYState.ERROR);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.ERROR,
      reason: error.message,
      metadata: { error: error.message, stack: error.stack },
      timestamp: new Date()
    });
  }

  reconnectPTY(ptyId: string): void {
    this.setState(ptyId, PTYState.RECONNECTING);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: PTYState.RECONNECTING,
      reason: 'PTY reconnection initiated',
      timestamp: new Date()
    });
  }

  // State management
  private setState(ptyId: string, newState: PTYState, reason?: string, metadata?: Record<string, any>): void {
    const oldState = this.stateMachines.get(ptyId);
    const transition: PTYStateTransition = {
      from: oldState || PTYState.CREATED,
      to: newState,
      timestamp: new Date(),
      reason,
      metadata
    };

    this.stateMachines.set(ptyId, newState);
    this.emitEvent('state_change', {
      type: 'state_change',
      ptyId,
      state: newState,
      data: transition,
      timestamp: new Date()
    });

    // Log state transition
    console.log(`[PTY Lifecycle] ${ptyId}: ${oldState || 'NONE'} → ${newState} (${reason})`);
  }

  getState(ptyId: string): PTYState | undefined {
    return this.stateMachines.get(ptyId);
  }

  getAllStates(): Map<string, PTYState> {
    return new Map(this.stateMachines);
  }

  getActivePTYs(): string[] {
    return Array.from(this.stateMachines.entries())
      .filter(([_, state]) => 
        state === PTYState.RUNNING || state === PTYState.ATTACHING
      )
      .map(([ptyId, _]) => ptyId);
  }

  getPTYsByState(state: PTYState): string[] {
    return Array.from(this.stateMachines.entries())
      .filter(([_, ptyState]) => ptyState === state)
      .map(([ptyId, _]) => ptyId);
  }

  // Heartbeat management
  private startHeartbeat(ptyId: string): void {
    this.stopHeartbeat(ptyId);
    
    const timer = setInterval(() => {
      this.emitEvent('heartbeat', {
        type: 'heartbeat',
        ptyId,
        state: this.getState(ptyId) || PTYState.CREATED,
        timestamp: new Date(),
        data: { alive: true }
      });
    }, this.config.heartbeatInterval);
    
    this.heartbeatTimers.set(ptyId, timer);
  }

  private stopHeartbeat(ptyId: string): void {
    const timer = this.heartbeatTimers.get(ptyId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(ptyId);
    }
  }

  // Event handling
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: PTYLifecycleEvent): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in PTYLifecycleManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    // Stop all heartbeats
    this.heartbeatTimers.forEach(timer => clearInterval(timer));
    this.heartbeatTimers.clear();
    
    // Clear all state machines
    this.stateMachines.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    console.log('[PTY Lifecycle Manager] Destroyed');
  }

  // Validation
  validateState(ptyId: string): boolean {
    const state = this.getState(ptyId);
    if (!state) {
      return false;
    }

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      [PTYState.CREATED]: [PTYState.SPAWNING, PTYState.DESTROYED],
      [PTYState.SPAWNING]: [PTYState.ATTACHING, PTYState.RUNNING, PTYState.DESTROYED],
      [PTYState.ATTACHING]: [PTYState.RUNNING, PTYState.DETACHING, PTYState.DESTROYED],
      [PTYState.RUNNING]: [PTYState.DETACHING, PTYState.EXITING, PTYState.DESTROYED],
      [PTYState.DETACHING]: [PTYState.EXITING, PTYState.DESTROYED, PTYState.RECONNECTING],
      [PTYState.EXITING]: [PTYState.DESTROYED, PTYState.ERROR, PTYState.RECONNECTING],
      [PTYState.DESTROYED]: [], // Terminal state
      [PTYState.ERROR]: [PTYState.CREATED, PTYState.SPAWNING, PTYState.ATTACHING], // Can recover from error
      [PTYState.RECONNECTING]: [PTYState.CREATED, PTYState.SPAWNING, PTYState.ATTACHING] // Can retry connection
    };

    return validTransitions[state]?.includes(state) || false;
  }

  // Monitoring
  getHealthStatus(): { healthy: boolean; issues: string[] } {
    const states = Array.from(this.stateMachines.values());
    const issues: string[] = [];

    // Check for stuck states
    const stuckPTYs = states.filter(state => 
      state === PTYState.SPAWNING || state === PTYState.ATTACHING
    );
    
    if (stuckPTYs.length > 0) {
      issues.push(`${stuckPTYs.length} PTYs stuck in spawning/attaching`);
    }

    // Check for error states
    const errorPTYs = states.filter(state => state === PTYState.ERROR);
    if (errorPTYs.length > 0) {
      issues.push(`${errorPTYs.length} PTYs in error state`);
    }

    // Check for old connections
    // const _fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // const _oldPTYs = states.filter(state => 
    //   state === PTYState.RUNNING || state === PTYState.DETACHING
    // ).filter(_ => {
    //   // This would need timestamp tracking in real implementation
    //   return false; // Placeholder
    // });

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}

// Singleton instance
let globalPTYLifecycleManager: PTYLifecycleManager | null = null;

export function getPTYLifecycleManager(): PTYLifecycleManager {
  if (!globalPTYLifecycleManager) {
    globalPTYLifecycleManager = new PTYLifecycleManager();
  }
  return globalPTYLifecycleManager;
}
