// ─── ExecutionController.ts ───────────────────────────────────────────
// Global execution control with abort capability
// Responsibilities: single AbortController per session, STOP functionality, state reset
// Rules: STOP must kill entire execution, reset phase to idle, clear all state
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export class ExecutionController {
  private abortController: AbortController | null = null;
  private isStoppedFlag: boolean = false;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Create a new AbortController for the current execution
   */
  createAbortController(): AbortController {
    this.abortController = new AbortController();
    this.isStoppedFlag = false;
    logger.debug("execution_controller", "ABORT_CONTROLLER_CREATED", {
      sessionId: this.sessionId
    });
    return this.abortController;
  }

  /**
   * Get the current AbortController
   */
  getAbortController(): AbortController | null {
    return this.abortController;
  }

  /**
   * STOP the entire execution
   * - Abort current stream
   * - Reset phase to idle
   * - Clear abort controller
   * - Clear stopped flag
   */
  stop(): void {
    if (!this.abortController) {
      logger.warn("execution_controller", "STOP_NO_ACTIVE_CONTROLLER", {
        sessionId: this.sessionId,
        warning: "No active execution to stop"
      });
      return;
    }

    logger.info("execution_controller", "EXECUTION_STOPPED", {
      sessionId: this.sessionId,
      reason: "STOP requested"
    });

    // Abort the current operation
    this.abortController.abort();
    logger.info("execution_controller", "ABORT_TRIGGERED", {
      sessionId: this.sessionId
    });

    // Clear the abort controller
    this.abortController = null;
    this.isStoppedFlag = true;

    logger.info("execution_controller", "STATE_RESET_TO_IDLE", {
      sessionId: this.sessionId,
      note: "Phase reset must be handled by caller"
    });
  }

  /**
   * Check if execution has been stopped
   */
  isStopped(): boolean {
    return this.isStoppedFlag;
  }

  /**
   * Full state reset to idle
   * Clear all execution state
   */
  reset(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isStoppedFlag = false;

    logger.info("execution_controller", "FULL_STATE_RESET", {
      sessionId: this.sessionId
    });
  }

  /**
   * Check if there's an active execution
   */
  hasActiveExecution(): boolean {
    return this.abortController !== null;
  }
}
