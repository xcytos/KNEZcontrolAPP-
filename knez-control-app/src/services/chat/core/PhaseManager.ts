// ─── PhaseManager.ts ────────────────────────────────────────────────────
// STRICT Phase transitions (idle → sending → thinking → streaming → finalizing → done → idle)
// Responsibilities: setPhase, validate transitions, FAIL FAST on invalid transitions
// Rules: NO illegal transitions - ever, strict FSM enforcement
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "streaming"
  | "finalizing"
  | "done";

const VALID_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking"],
  thinking: ["streaming"],
  streaming: ["finalizing"],
  finalizing: ["done"],
  done: ["idle"]
};

export class PhaseManager {
  private currentPhase: ChatPhase = "idle";
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setPhase(newPhase: ChatPhase): void {
    // Allow idempotent updates only for idle → idle
    if (this.currentPhase === newPhase && newPhase === "idle") {
      logger.debug("phase_manager", "phase_idempotent_idle", { sessionId: this.sessionId, phase: newPhase });
      return;
    }

    const validTransitions = VALID_TRANSITIONS[this.currentPhase];
    if (!validTransitions) {
      logger.error("phase_manager", "INVALID_CURRENT_PHASE", { 
        sessionId: this.sessionId, 
        currentPhase: this.currentPhase,
        error: "Valid transitions map missing - race condition detected"
      });
      throw new Error(`Invalid current phase: ${this.currentPhase}`);
    }

    if (!validTransitions.includes(newPhase)) {
      logger.error("phase_manager", "INVALID_TRANSITION_REJECTED", { 
        sessionId: this.sessionId, 
        from: this.currentPhase, 
        to: newPhase,
        error: "Strict FSM violation"
      });
      throw new Error(`Invalid phase transition: ${this.currentPhase} → ${newPhase}`);
    }

    this.currentPhase = newPhase;
    logger.info("phase_manager", "phase_transition", { 
      sessionId: this.sessionId, 
      from: this.currentPhase, 
      to: newPhase 
    });
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

  isDone(): boolean {
    return this.currentPhase === "done";
  }
}
