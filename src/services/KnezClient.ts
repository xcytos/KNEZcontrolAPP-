import {
  KnezConnectionProfile,
  MemoryEntry,
  KnezHealthResponse,
  McpRegistrySnapshot,
  KnezEvent,
} from "../domain/DataContracts";

export type KnezMemoryRecord = {
  memory_id: string;
  created_at: string;
  session_id: string;
  memory_type: string;
  summary: string;
  evidence_event_ids: string[];
  confidence: number;
  retention_policy: string;
};

export type KnezInsight = {
  insight_id: string;
  severity: string;
  message: string;
  evidence: any;
};

type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionsRequest = {
  messages: CompletionMessage[];
  stream: boolean;
  session_id: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

export type ChatCompletionsFinal = {
  id: string;
  object: string;
  choices: Array<{
    message?: { role: string; content: string };
    finish_reason?: string;
    delta?: { content?: string };
  }>;
};

type KnezErrorResponse = {
  error: string;
  reason?: string;
};

const PROFILE_STORAGE_KEY = "knez_connection_profile";
const SESSION_STORAGE_KEY = "knez_session_id";

const DEFAULT_PROFILE: KnezConnectionProfile = {
  id: "local-default",
  type: "local",
  transport: "http",
  endpoint: "http://localhost:8000",
  trustLevel: "untrusted",
};

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

import { logger } from "./LogService";

export class KnezClient {
  private profile: KnezConnectionProfile;
  private sessionId: string | null;

  constructor() {
    const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    this.profile = savedProfile ? safeJsonParse<KnezConnectionProfile>(savedProfile) ?? DEFAULT_PROFILE : DEFAULT_PROFILE;
    this.sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    logger.info("knez_client", "Client initialized", { profile: this.profile.id });
  }

  getProfile(): KnezConnectionProfile {
    return this.profile;
  }

  setProfile(profile: KnezConnectionProfile): void {
    this.profile = profile;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    logger.info("knez_client", "Profile updated", { id: profile.id });
  }

  setTrusted(trusted: boolean): void {
    this.profile = { ...this.profile, trustLevel: trusted ? "verified" : "untrusted" };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    logger.info("knez_client", "Trust level changed", { trusted });
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async health(): Promise<KnezHealthResponse> {
    const resp = await fetch(`${this.profile.endpoint.replace(/\/$/, "")}/health`);
    if (!resp.ok) {
      logger.error("knez_client", "Health check failed", { status: resp.status });
      throw new Error(`health_failed_${resp.status}`);
    }
    const data = (await resp.json()) as KnezHealthResponse;
    logger.debug("knez_client", "Health check passed", { backends: data.backends.length });
    return data;
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const url = new URL(`${this.profile.endpoint.replace(/\/$/, "")}/events`);
    url.searchParams.set("limit", "1");
    url.searchParams.set("session_id", sessionId);
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return false;
    }
    const events = (await resp.json()) as any[];
    return Array.isArray(events) && events.length > 0;
  }

  async ensureSession(): Promise<string> {
    const existing = this.sessionId;
    if (existing && (await this.validateSession(existing))) {
      return existing;
    }
    const fresh = newSessionId();
    this.sessionId = fresh;
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    logger.info("knez_client", "New session created", { sessionId: fresh });
    return fresh;
  }


  async listEvents(sessionId: string, limit = 50): Promise<KnezEvent[]> {
    const url = new URL(`${this.profile.endpoint.replace(/\/$/, "")}/events`);
    url.searchParams.set("limit", String(limit));
    if (sessionId) {
      url.searchParams.set("session_id", sessionId);
    }
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`events_failed_${resp.status}`);
    }
    return (await resp.json()) as KnezEvent[];
  }

  async tryGetMcpRegistry(): Promise<McpRegistrySnapshot> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/mcp/registry`;
    try {
      const resp = await fetch(url);
      if (resp.status === 404) {
        return { supported: false, reason: "KNEZ does not expose MCP registry via HTTP." };
      }
      if (!resp.ok) {
        return { supported: false, reason: `MCP registry request failed (${resp.status}).` };
      }
      const raw = (await resp.json()) as any;
      const itemsRaw: any[] = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
        return { supported: true, items: [] };
      }
      const normalized = itemsRaw.map((it: any, idx: number) => ({
        id: String(it.id ?? it.name ?? it.mcp_id ?? `mcp_${idx}`),
        provider: typeof it.provider === "string" ? it.provider : undefined,
        status: typeof it.status === "string" ? it.status : undefined,
        capabilities: Array.isArray(it.capabilities) ? it.capabilities.map(String) : undefined,
      }));
      return { supported: true, items: normalized };
    } catch {
      return { supported: false, reason: "MCP registry unreachable." };
    }
  }

  async listMemory(sessionId?: string, limit = 100): Promise<KnezMemoryRecord[]> {
    const url = new URL(`${this.profile.endpoint.replace(/\/$/, "")}/memory`);
    url.searchParams.set("limit", String(limit));
    if (sessionId) {
      url.searchParams.set("session_id", sessionId);
    }
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`memory_failed_${resp.status}`);
    }
    return (await resp.json()) as KnezMemoryRecord[];
  }

  async getInsights(sessionId: string): Promise<KnezInsight[]> {
    const resp = await fetch(`${this.profile.endpoint.replace(/\/$/, "")}/sessions/${sessionId}/insights`);
    if (!resp.ok) {
      throw new Error(`insights_failed_${resp.status}`);
    }
    return (await resp.json()) as KnezInsight[];
  }

  async getSummary(sessionId: string): Promise<Record<string, any>> {
    const resp = await fetch(`${this.profile.endpoint.replace(/\/$/, "")}/sessions/${sessionId}/summary`);
    if (!resp.ok) {
      throw new Error(`summary_failed_${resp.status}`);
    }
    return (await resp.json()) as Record<string, any>;
  }

  // --- Checkpoint 2: Approval & Influence ---

  async submitVote(sessionId: string, messageId: string, vote: "upvote" | "downvote"): Promise<void> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/influence/vote`;
    const payload = {
      sessionId,
      messageId,
      vote,
      createdAt: new Date().toISOString()
    };
    
    // We send this as fire-and-forget for UI responsiveness, but catch errors to log
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[KnezClient] Failed to submit vote:", err);
      // We don't throw here to avoid disrupting the chat flow
    }
  }

  async getPendingApprovals(): Promise<any[]> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/approvals/pending`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return [];
      return (await resp.json()) as any[];
    } catch {
      return [];
    }
  }

  async submitApprovalDecision(approvalId: string, decision: "approved" | "rejected"): Promise<void> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/approvals/${approvalId}/decision`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!resp.ok) {
      throw new Error(`approval_decision_failed_${resp.status}`);
    }
  }

  async chatCompletionsNonStream(messages: CompletionMessage[], sessionId: string): Promise<string> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/v1/chat/completions`;
    const payload: ChatCompletionsRequest = {
      messages,
      stream: false,
      session_id: sessionId,
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`completions_failed_${resp.status}`);
    }
    const raw = (await resp.json()) as any;
    if (raw && typeof raw.error === "string") {
      const err = raw as KnezErrorResponse;
      throw new Error(`${err.error}${err.reason ? `:${err.reason}` : ""}`);
    }
    const data = raw as ChatCompletionsFinal;
    return data.choices?.[0]?.message?.content ?? "";
  }

  async *chatCompletionsStream(messages: CompletionMessage[], sessionId: string): AsyncGenerator<string, void, void> {
    const url = `${this.profile.endpoint.replace(/\/$/, "")}/v1/chat/completions`;
    const payload: ChatCompletionsRequest = {
      messages,
      stream: true,
      session_id: sessionId,
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`completions_stream_failed_${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = frame.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          if (!data) continue;
          const parsedAny = safeJsonParse<any>(data);
          if (parsedAny && typeof parsedAny.error === "string") {
            const err = parsedAny as KnezErrorResponse;
            throw new Error(`${err.error}${err.reason ? `:${err.reason}` : ""}`);
          }
          const parsed = parsedAny as ChatCompletionsFinal | null;
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    }
  }

  mapMemoryToUi(records: KnezMemoryRecord[]): MemoryEntry[] {
    return records.map((m) => ({
      id: m.memory_id,
      sessionId: m.session_id,
      summary: m.summary,
      details: `confidence=${m.confidence} retention=${m.retention_policy} evidence=${m.evidence_event_ids.join(",")}`,
      createdAt: m.created_at,
      importance: m.confidence,
    }));
  }
}

export const knezClient = new KnezClient();
