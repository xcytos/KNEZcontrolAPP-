// ─── PhaseManager.ts ────────────────────────────────────────────────────
// STRICT Phase transitions (idle → sending → thinking → streaming → finalizing → idle)
// Responsibilities: setPhase, validate transitions, SAFE transitions (no throws)
// Rules: NO illegal transitions - log and ignore instead of throwing
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "streaming"
  | "finalizing"
  | "error";

// STRICT FSM - only these transitions are allowed
const ALLOWED_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking", "error"],
  thinking: ["streaming", "error"],
  streaming: ["finalizing", "error"],
  finalizing: ["idle"],
  error: ["idle"]
};

export class PhaseManager {
  private currentPhase: ChatPhase = "idle";
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setPhase(newPhase: ChatPhase): boolean {
    // Allow idempotent updates for same phase
    if (this.currentPhase === newPhase) {
      logger.debug("phase_manager", "phase_idempotent", { 
        sessionId: this.sessionId, 
        phase: newPhase 
      });
      return true;
    }

    const validTransitions = ALLOWED_TRANSITIONS[this.currentPhase];
    if (!validTransitions) {
      logger.error("phase_manager", "INVALID_CURRENT_PHASE", { 
        sessionId: this.sessionId, 
        currentPhase: this.currentPhase,
        error: "Valid transitions map missing"
      });
      return false;
    }

    if (!validTransitions.includes(newPhase)) {
      logger.warn("phase_manager", "INVALID_TRANSITION_IGNORED", { 
        sessionId: this.sessionId, 
        from: this.currentPhase, 
        to: newPhase,
        error: "Strict FSM violation - transition ignored"
      });
      return false; // Return false instead of throwing
    }

    const previousPhase = this.currentPhase;
    this.currentPhase = newPhase;
    logger.info("phase_manager", "phase_transition", { 
      sessionId: this.sessionId, 
      from: previousPhase, 
      to: newPhase 
    });
    return true;
  }

  getPhase(): ChatPhase {
    return this.currentPhase;
  }

  isIdle(): boolean {
    return this.currentPhase === "idle";
  }

  isActive(): boolean {
    return this.currentPhase !== "idle";
  }

  isStreaming(): boolean {
    return this.currentPhase === "streaming";
  }

  isFinalizing(): boolean {
    return this.currentPhase === "finalizing";
  }

  isError(): boolean {
    return this.currentPhase === "error";
  }

  // Force set phase bypassing FSM validation (for hard resets only)
  forceSetPhase(newPhase: ChatPhase): void {
    const previousPhase = this.currentPhase;
    this.currentPhase = newPhase;
    logger.warn("phase_manager", "phase_force_set", { 
      sessionId: this.sessionId, 
      from: previousPhase, 
      to: newPhase,
      reason: "hard_reset"
    });
  }

  // Reset to idle (for new session or cleanup)
  reset(): void {
    const previousPhase = this.currentPhase;
    this.currentPhase = "idle";
    logger.info("phase_manager", "phase_reset", { 
      sessionId: this.sessionId, 
      from: previousPhase, 
      to: "idle"
    });
  }
}
