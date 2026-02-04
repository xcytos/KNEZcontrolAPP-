export type PresenceState = "SILENT" | "OBSERVING" | "REFLECTING" | "RESPONDING";

export type SessionId = string;

export interface ChatMessage {
  id: string;
  sessionId: SessionId;
  from: "user" | "knez";
  text: string;
  createdAt: string;
  relativeTimeLabel?: string;
  hiddenLocally?: boolean;
  refusal?: boolean;
}

export interface ChatSession {
  id: SessionId;
  title?: string;
  messages: ChatMessage[];
}

export interface MemoryEntry {
  id: string;
  sessionId?: SessionId;
  summary: string;
  details?: string;
  createdAt: string;
  importance?: number;
  uiClusterId?: string;
  hasUiOnlyGrouping?: boolean;
  hasGapBefore?: boolean;
}

export interface MemoryGap {
  id: string;
  from: string;
  to: string;
  reason?: string;
}

export interface SessionSegment {
  id: string;
  sessionId: SessionId;
  kind: "message" | "event" | "decision" | "fork" | "resume";
  refId: string;
  createdAt: string;
}

export interface SessionTimeline {
  sessionId: SessionId;
  segments: SessionSegment[];
  partial: boolean;
  warning?: string;
}

export interface GovernanceEvent {
  id: string;
  kind:
    | "phase_violation"
    | "governance_block"
    | "presence_violation"
    | "contract_violation"
    | "runtime_failure";
  createdAt: string;
  message: string;
  detailsAvailable: boolean;
}

export type ErrorCategory =
  | "api_error"
  | "data_contract_violation"
  | "presence_spec_violation"
  | "governance_violation"
  | "ui_render_error"
  | "unknown";

export interface AppError {
  id: string;
  category: ErrorCategory;
  createdAt: string;
  userMessage: string;
  diagnosticMessage?: string;
  canRetry: boolean;
}

