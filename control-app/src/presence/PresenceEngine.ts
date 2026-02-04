import { PresenceState } from "../domain/DataContracts";

export type PresenceEventKind =
  | "app_opened"
  | "app_closed"
  | "connection_lost"
  | "connection_restored"
  | "user_message"
  | "knez_response_started"
  | "knez_response_finished"
  | "knez_reflection_started"
  | "knez_reflection_finished"
  | "user_force_silent";

export interface PresenceEvent {
  kind: PresenceEventKind;
  at: number;
}

export interface PresenceConfig {
  debounceMillis: number;
}

export interface PresenceSnapshot {
  state: PresenceState;
  lastTransitionAt: number;
}

const allowedTransitions: Record<PresenceState, PresenceState[]> = {
  SILENT: ["OBSERVING"],
  OBSERVING: ["SILENT", "RESPONDING", "REFLECTING"],
  REFLECTING: ["OBSERVING", "RESPONDING"],
  RESPONDING: ["OBSERVING"],
};

export class PresenceEngine {
  private config: PresenceConfig;
  private snapshot: PresenceSnapshot;

  constructor(config: PresenceConfig, initial?: PresenceSnapshot) {
    this.config = config;
    this.snapshot =
      initial ?? {
        state: "SILENT",
        lastTransitionAt: 0,
      };
  }

  getSnapshot(): PresenceSnapshot {
    return this.snapshot;
  }

  apply(event: PresenceEvent): PresenceSnapshot {
    if (event.kind === "user_force_silent") {
      this.snapshot = { state: "SILENT", lastTransitionAt: event.at };
      return this.snapshot;
    }

    const nextState = this.nextStateForEvent(this.snapshot.state, event);
    if (!nextState) {
      return this.snapshot;
    }

    if (!this.isAllowedTransition(this.snapshot.state, nextState)) {
      return this.snapshot;
    }

    if (!this.passesDebounce(event.at)) {
      return this.snapshot;
    }

    this.snapshot = { state: nextState, lastTransitionAt: event.at };
    return this.snapshot;
  }

  private nextStateForEvent(
    current: PresenceState,
    event: PresenceEvent
  ): PresenceState | undefined {
    if (event.kind === "app_opened") {
      return "SILENT";
    }
    if (event.kind === "app_closed" || event.kind === "connection_lost") {
      return "SILENT";
    }
    if (event.kind === "connection_restored") {
      if (current === "SILENT") {
        return "OBSERVING";
      }
      return current;
    }
    if (event.kind === "user_message") {
      return "RESPONDING";
    }
    if (event.kind === "knez_response_started") {
      return "RESPONDING";
    }
    if (event.kind === "knez_response_finished") {
      return "OBSERVING";
    }
    if (event.kind === "knez_reflection_started") {
      return "REFLECTING";
    }
    if (event.kind === "knez_reflection_finished") {
      if (current === "REFLECTING") {
        return "OBSERVING";
      }
      return current;
    }
    return undefined;
  }

  private isAllowedTransition(
    from: PresenceState,
    to: PresenceState
  ): boolean {
    const allowed = allowedTransitions[from] ?? [];
    return allowed.includes(to);
  }

  private passesDebounce(now: number): boolean {
    if (this.snapshot.lastTransitionAt === 0) {
      return true;
    }
    const delta = now - this.snapshot.lastTransitionAt;
    return delta >= this.config.debounceMillis;
  }
}

