// ─── ExecutionCoordinator.ts ─────────────────────────────────────────
// Execution lifecycle authority and event tracking
// Responsibilities: track executionId, enforce single request/stream events, event uniqueness
// Rules: ONE execution, ONE request_started, ONE stream_started, ONE stream_completed
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/LogService";

interface ExecutionState {
  requestStarted: boolean;
  streamStarted: boolean;
  streamCompleted: boolean;
  startedAt: number;
}

export class ExecutionCoordinator {
  private activeExecutionId: string | null = null;
  private executionState: Map<string, ExecutionState> = new Map();
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start a new execution lifecycle
   * @throws Error if an execution is already active
   */
  startExecution(): string {
    if (this.activeExecutionId) {
      logger.error("execution_coordinator", "EXECUTION_ALREADY_ACTIVE", {
        sessionId: this.sessionId,
        activeExecutionId: this.activeExecutionId,
        error: "Cannot start new execution while one is active"
      });
      throw new Error(`Execution already active: ${this.activeExecutionId}`);
    }

    const executionId = uuidv4();
    this.activeExecutionId = executionId;
    this.executionState.set(executionId, {
      requestStarted: false,
      streamStarted: false,
      streamCompleted: false,
      startedAt: Date.now()
    });

    logger.info("execution_coordinator", "EXECUTION_STARTED", {
      sessionId: this.sessionId,
      executionId,
      timestamp: Date.now()
    });

    return executionId;
  }

  /**
   * End an execution lifecycle
   */
  endExecution(executionId: string): void {
    if (this.activeExecutionId !== executionId) {
      logger.warn("execution_coordinator", "EXECUTION_ID_MISMATCH", {
        sessionId: this.sessionId,
        activeExecutionId: this.activeExecutionId,
        attemptedEnd: executionId
      });
      return;
    }

    const state = this.executionState.get(executionId);
    const duration = state ? Date.now() - state.startedAt : 0;

    this.executionState.delete(executionId);
    this.activeExecutionId = null;

    logger.info("execution_coordinator", "EXECUTION_ENDED", {
      sessionId: this.sessionId,
      executionId,
      duration,
      state: state ? {
        requestStarted: state.requestStarted,
        streamStarted: state.streamStarted,
        streamCompleted: state.streamCompleted
      } : null
    });
  }

  /**
   * Track request_started event
   * @throws Error if duplicate or invalid execution
   */
  trackRequestStarted(executionId: string): void {
    if (this.activeExecutionId !== executionId) {
      logger.error("execution_coordinator", "REQUEST_STARTED_INVALID_EXECUTION", {
        sessionId: this.sessionId,
        activeExecutionId: this.activeExecutionId,
        attemptedExecutionId: executionId
      });
      throw new Error(`Invalid execution ID for request_started: ${executionId}`);
    }

    const state = this.executionState.get(executionId);
    if (!state) {
      logger.error("execution_coordinator", "REQUEST_STARTED_NO_STATE", {
        sessionId: this.sessionId,
        executionId
      });
      throw new Error(`No state found for execution: ${executionId}`);
    }

    if (state.requestStarted) {
      logger.error("execution_coordinator", "DUPLICATE_REQUEST_STARTED", {
        sessionId: this.sessionId,
        executionId,
        error: "request_started already tracked for this execution"
      });
      throw new Error(`Duplicate request_started for execution: ${executionId}`);
    }

    state.requestStarted = true;
    logger.info("execution_coordinator", "REQUEST_STARTED_TRACKED", {
      sessionId: this.sessionId,
      executionId
    });
  }

  /**
   * Track stream_started event
   * @throws Error if duplicate or invalid execution
   */
  trackStreamStarted(executionId: string, streamId: string): void {
    if (this.activeExecutionId !== executionId) {
      logger.error("execution_coordinator", "STREAM_STARTED_INVALID_EXECUTION", {
        sessionId: this.sessionId,
        activeExecutionId: this.activeExecutionId,
        attemptedExecutionId: executionId,
        streamId
      });
      throw new Error(`Invalid execution ID for stream_started: ${executionId}`);
    }

    const state = this.executionState.get(executionId);
    if (!state) {
      logger.error("execution_coordinator", "STREAM_STARTED_NO_STATE", {
        sessionId: this.sessionId,
        executionId,
        streamId
      });
      throw new Error(`No state found for execution: ${executionId}`);
    }

    if (state.streamStarted) {
      logger.error("execution_coordinator", "DUPLICATE_STREAM_STARTED", {
        sessionId: this.sessionId,
        executionId,
        streamId,
        error: "stream_started already tracked for this execution"
      });
      throw new Error(`Duplicate stream_started for execution: ${executionId}`);
    }

    state.streamStarted = true;
    logger.info("execution_coordinator", "STREAM_STARTED_TRACKED", {
      sessionId: this.sessionId,
      executionId,
      streamId
    });
  }

  /**
   * Track stream_completed event
   * @throws Error if duplicate or invalid execution
   */
  trackStreamCompleted(executionId: string, streamId: string): void {
    if (this.activeExecutionId !== executionId) {
      logger.error("execution_coordinator", "STREAM_COMPLETED_INVALID_EXECUTION", {
        sessionId: this.sessionId,
        activeExecutionId: this.activeExecutionId,
        attemptedExecutionId: executionId,
        streamId
      });
      throw new Error(`Invalid execution ID for stream_completed: ${executionId}`);
    }

    const state = this.executionState.get(executionId);
    if (!state) {
      logger.error("execution_coordinator", "STREAM_COMPLETED_NO_STATE", {
        sessionId: this.sessionId,
        executionId,
        streamId
      });
      throw new Error(`No state found for execution: ${executionId}`);
    }

    if (state.streamCompleted) {
      logger.error("execution_coordinator", "DUPLICATE_STREAM_COMPLETED", {
        sessionId: this.sessionId,
        executionId,
        streamId,
        error: "stream_completed already tracked for this execution"
      });
      throw new Error(`Duplicate stream_completed for execution: ${executionId}`);
    }

    state.streamCompleted = true;
    logger.info("execution_coordinator", "STREAM_COMPLETED_TRACKED", {
      sessionId: this.sessionId,
      executionId,
      streamId
    });
  }

  /**
   * Check if an execution is currently active
   */
  isActive(): boolean {
    return this.activeExecutionId !== null;
  }

  /**
   * Get the current active execution ID
   */
  getCurrentExecutionId(): string | null {
    return this.activeExecutionId;
  }

  /**
   * Get the execution state for validation
   */
  getExecutionState(executionId: string): ExecutionState | null {
    return this.executionState.get(executionId) || null;
  }

  /**
   * Validate execution state (for testing/debugging)
   */
  validateExecutionState(executionId: string): boolean {
    const state = this.executionState.get(executionId);
    if (!state) return false;

    // Expected: requestStarted=true, streamStarted=true, streamCompleted=true
    return (
      state.requestStarted &&
      state.streamStarted &&
      state.streamCompleted
    );
  }
}
