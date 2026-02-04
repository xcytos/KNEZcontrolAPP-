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
  isPartial?: boolean;
  metrics?: {
    timeToFirstTokenMs?: number;
    totalTokens?: number;
    finishReason?: string;
  };
  influence?: {
    vote?: InfluenceVote;
    reason?: string;
  };
}

export type InfluenceVote = "upvote" | "downvote";

export interface InfluenceAction {
  id: string;
  sessionId: SessionId;
  messageId: string;
  vote: InfluenceVote;
  reason?: string;
  createdAt: string;
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

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  summary: string;
  payload: any;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// Phase 2: Reflection
export interface ReflectionObservation {
  id: string;
  summary: string;
  evidenceRefIds: string[]; // Links to MemoryEntry or SessionSegment
  confidence: number; // 0.0 - 1.0
  suggestedCorrection?: string;
  createdAt: string;
}

export interface ReflectionSession {
  id: string;
  sessionId: SessionId; // The session being analyzed
  observations: ReflectionObservation[];
  createdAt: string;
}

// Phase 2: Mistake Ledger
export type MistakeStatus = "active" | "archived" | "disputed";

export interface MistakeEntry {
  id: string;
  summary: string;
  context: string;
  outcome: string;
  status: MistakeStatus;
  recurrenceCount: number;
  createdAt: string;
  resolvedAt?: string;
  disputeReason?: string;
}

// Phase 2: Drift Analysis
export interface DriftMetric {
  id: string;
  dimension: "scope" | "rule" | "focus";
  value: number; // 0.0 - 1.0 (1.0 = High Drift)
  label: string; // e.g. "Unplanned Code Edits"
  timestamp: string;
}

// Phase 2: Challenge System
export type ChallengeLevel = "soft_nudge" | "explicit" | "hard_stop";

export interface ChallengeEvent {
  id: string;
  level: ChallengeLevel;
  triggerReason: string;
  evidenceRefIds?: string[];
  createdAt: string;
  acknowledged: boolean;
}

// Phase 2: KNEZ Connection & Protocol (Prompt-006)

export interface KnezConnectionProfile {
  id: string; // "local-default" or uuid
  type: "local" | "remote";
  transport: "http" | "ipc";
  endpoint: string; // e.g. "http://localhost:3000"
  instanceId?: string; // Filled after handshake
  declaredCapabilities?: string[]; // Filled after handshake
  trustLevel: "untrusted" | "verified";
}

export interface HandshakeRequest {
  clientId: string; // "knez-control-app"
  appVersion: string;
  capabilitiesRequested: string[]; // ["chat", "memory", "reflection"]
}

export interface HandshakeResponse {
  knezInstanceId: string;
  supportedFeatures: string[];
  memoryMode: "read_only" | "read_write";
  sessionPolicy: "persistent" | "ephemeral";
}

export interface SessionRequest {
  resumeSessionId?: string;
  context?: Record<string, any>;
}

export interface SessionResponse {
  sessionId: string;
  status: "resumed" | "created";
  activeContextSummary?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
  localTimestamp: string;
}

export interface SendMessageResponse {
  id: string;
  text: string;
  refusal?: boolean;
  memoryRefs?: string[]; // IDs of memories accessed/created
  presenceUpdate?: PresenceState;
  challengeEvent?: ChallengeEvent;
  mcpUsage?: McpUsageInfo[];
}

export interface McpUsageInfo {
  mcpName: string;
  toolName: string;
  scope: string;
}

export interface McpDeclaration {
  name: string;
  capabilities: string[];
  scope: "read" | "write" | "admin";
}

// Checkpoint 1.5: Runtime Discovery & Observability

export interface HealthBackend {
  model_id: string;
  status: string;
  latency_ms?: number;
  failure_rate?: number | null;
  tokens_per_sec?: number | null;
  last_ping?: number | null;
  rolling_score?: number | null;
}

export interface KnezHealthResponse {
  status: "ok" | string;
  backends: HealthBackend[];
}

export interface McpRegistryItem {
  id: string;
  provider?: string;
  status?: string;
  capabilities?: string[];
}

export type McpRegistrySnapshot =
  | {
      supported: true;
      items: McpRegistryItem[];
    }
  | {
      supported: false;
      reason: string;
    };

export type KnezEvent = Record<string, any>;

