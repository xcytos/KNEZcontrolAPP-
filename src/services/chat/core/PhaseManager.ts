// ─── PhaseManager.ts ────────────────────────────────────────────────────
// Phase transitions (sending/thinking/streaming/completed/failed)
// Responsibilities: setPhase, validate transitions, allow idempotent updates
// Rules: thinking → thinking allowed, streaming → streaming allowed
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "streaming"
  | "tool_running"
  | "completed"
  | "failed";

const VALID_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking", "failed"],
  thinking: ["streaming", "tool_running", "failed"],
  streaming: ["streaming", "completed", "failed"],
  tool_running: ["thinking", "streaming", "failed"],
  completed: ["idle"],
  failed: ["idle"]
};

export class PhaseManager {
  private currentPhase: ChatPhase = "idle";
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setPhase(newPhase: ChatPhase): void {
    // Allow idempotent updates (same phase → same phase)
    if (this.currentPhase === newPhase) {
      logger.debug("phase_manager", "phase_idempotent", { sessionId: this.sessionId, phase: newPhase });
      return;
    }

    const validTransitions = VALID_TRANSITIONS[this.currentPhase];
    if (!validTransitions.includes(newPhase)) {
      logger.warn("phase_manager", "invalid_transition", { 
        sessionId: this.sessionId, 
        from: this.currentPhase, 
        to: newPhase 
      });
      // Don't throw error - allow recovery but log the issue
      this.currentPhase = newPhase;
      return;
    }

    this.currentPhase = newPhase;
    logger.debug("phase_manager", "phase_changed", { sessionId: this.sessionId, phase: newPhase });
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

  isToolRunning(): boolean {
    return this.currentPhase === "tool_running";
  }
}
