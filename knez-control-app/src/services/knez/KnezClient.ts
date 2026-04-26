import {
  KnezConnectionProfile,
  MemoryEntry,
  KnezHealthResponse,
  McpRegistrySnapshot,
  KnezEvent,
  ResumeSnapshot,
  // SessionLineage,
  InfluenceContract,
  ReplayTimeline,
  CognitiveState,
  AuditResult,
  PerceptionSnapshot,
  ActiveWindowInfo,
  KnowledgeDoc
} from '../../domain/DataContracts';
import { AppError } from '../../domain/Errors';
import { logger } from '../utils/LogService';
import { webSocketClient } from '../websocket/WebSocketClient';

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
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ChatCompletionTool = {
  name: string;
  description?: string;
  parameters: any;
};

export type ChatCompletionToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type ChatCompletionsRequest = {
  messages: CompletionMessage[];
  stream: boolean;
  session_id: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: any;
  tool_choice?: any;
};

export type ChatCompletionsFinal = {
  id: string;
  object: string;
  model?: string;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  choices: Array<{
    message?: { role: string; content: string; tool_calls?: ChatCompletionToolCall[] };
    finish_reason?: string;
    delta?: { content?: string; tool_calls?: ChatCompletionToolCall[] };
  }>;
};

function toOpenAiTools(tools: ChatCompletionTool[] | undefined): any[] | undefined {
  if (tools === undefined) return undefined;
  if (tools.length === 0) return [];
  return tools
    .filter((t) => t && t.name)
    .map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
}

type KnezErrorResponse = {
  error: string;
  reason?: string;
};

type TaqwinObservation = {
  type: string;
  summary: string;
  details?: Record<string, any>;
};

type TaqwinProposal = {
  proposal_type: string;
  risk_level: "low" | "medium" | "high";
  scope: string;
  summary: string;
  rationale: string;
  metadata?: Record<string, any>;
};

type TaqwinResponse = {
  session_id: string;
  intent: string;
  correlation_id?: string;
  trace_id?: string;
  observations?: TaqwinObservation[];
  proposals?: TaqwinProposal[];
};

const PROFILE_STORAGE_KEY = "knez_connection_profile";
const SESSION_STORAGE_KEY = "knez_session_id";

const DEFAULT_PROFILE: KnezConnectionProfile = {
  id: "local-default",
  type: "local",
  transport: "http",
  endpoint: "http://127.0.0.1:8000",
  trustLevel: "untrusted",
};

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function normalizeEndpoint(endpoint: string): string {
  const raw = endpoint.trim();
  if (!raw) return raw;
  if (!isTauriRuntime()) return raw;
  return raw.replace(/http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1");
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function healthViaShell(url: string, timeoutMs: number): Promise<KnezHealthResponse> {
  const { Command } = await import("@tauri-apps/plugin-shell");
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const out = await Command.create("cmd", ["/d", "/s", "/c", "curl", "-sS", "--max-time", String(timeoutSec), url]).execute();
  if (out.code === 0) {
    const data = safeJsonParse<KnezHealthResponse>(out.stdout);
    if (!data) {
      throw new AppError("KNEZ_HEALTH_FAILED", `Health check invalid JSON (cmd)`, { url, stdout: out.stdout });
    }
    return data;
  }
  throw new AppError("KNEZ_HEALTH_FAILED", `Health check failed (cmd code ${out.code})`, { url, stderr: out.stderr });
}

async function postJsonViaShell<T>(url: string, payload: any, timeoutMs: number): Promise<T> {
  const { Command } = await import("@tauri-apps/plugin-shell");
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const body = JSON.stringify(payload ?? {});
  // Use a temp file or stdin if body is large? For now, stick to simple curl, but escape double quotes?
  // Windows cmd argument escaping is tricky.
  // Better approach: echo body | curl -d @- ...
  // But pipe is tricky with Command.
  // Alternative: write to temp file?
  // Or just escape double quotes: " -> \"
  const escapedBody = body.replace(/"/g, '\\"');
  
  const out = await Command.create("cmd", [
    "/d",
    "/s",
    "/c",
    "curl",
    "-sS",
    "--max-time",
    String(timeoutSec),
    "-H",
    "Content-Type: application/json",
    "-d",
    escapedBody,
    url,
  ]).execute();
  
  if (out.code === 0) {
    const data = safeJsonParse<T>(out.stdout);
    if (!data) {
      throw new AppError("KNEZ_FETCH_FAILED", `Shell POST invalid JSON (cmd): ${url}`, { url, stdout: out.stdout });
    }
    return data;
  }
  throw new AppError("KNEZ_FETCH_FAILED", `Shell POST failed (cmd code ${out.code})`, { url, stderr: out.stderr });
}

const testFailOnce = new Set<string>();

async function safeRequest<T>(fn: () => Promise<T>, context: string): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 10000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      logger.warn("knez_client", `request_failed_attempt_${i + 1}`, { context, error: String((e as any)?.message ?? e) });

      if (i === MAX_RETRIES - 1) throw e;

      // Exponential backoff with jitter
      const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, i), MAX_DELAY_MS);
      const jitter = Math.random() * 200; // Add up to 200ms jitter
      const delay = exponentialDelay + jitter;

      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("safeRequest: unexpected exit");
}

export class KnezClient {
  private profile: KnezConnectionProfile;
  private sessionId: string | null;
  private toolCallingSupportByEndpoint = new Map<string, "supported" | "unsupported">();

  constructor() {
    let savedProfile: string | null = null;
    try {
      savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    } catch (e) {
      // localStorage not available
    }
    this.profile = savedProfile ? safeJsonParse<KnezConnectionProfile>(savedProfile) ?? DEFAULT_PROFILE : DEFAULT_PROFILE;
    const normalizedEndpoint = normalizeEndpoint(this.profile.endpoint);
    if (normalizedEndpoint !== this.profile.endpoint) {
      this.profile = { ...this.profile, endpoint: normalizedEndpoint };
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      } catch (e) {
        // localStorage not available - profile won't persist
      }
    }
    let sessionId: string | null = null;
    try {
      sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    } catch (e) {
      // localStorage not available
    }
    this.sessionId = sessionId;
    logger.info("knez_client", "Client initialized", { profile: this.profile.id });

    // Fetch and log available models from Ollama
    void this.fetchAndLogModels();
  }

  private async fetchAndLogModels(): Promise<void> {
    try {
      const resp = await fetch("http://localhost:11434/api/tags");
      if (resp.ok) {
        const data = await resp.json() as any;
        const models = data?.models ?? [];
        const modelNames = models.map((m: any) => m.name).join(", ");
        logger.info("knez_client", "available_models_loaded", { count: models.length, models: modelNames });
      }
    } catch (e) {
      // Silently ignore if Ollama not running - will be logged when health check runs
      // Only log if it's not a connection refused error
      const errMsg = String(e);
      if (!errMsg.includes("ERR_CONNECTION_REFUSED") && !errMsg.includes("Failed to fetch")) {
        logger.warn("knez_client", "failed_to_fetch_models", { error: errMsg });
      }
    }
  }

  private baseUrl(): string {
    return normalizeEndpoint(this.profile.endpoint).replace(/\/$/, "");
  }

  private async fetchIdentity(): Promise<{ knez_instance_id: string; fingerprint: string; version?: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl()}/identity`);
      if (!resp.ok) return null;
      const data = (await resp.json()) as any;
      const iid = String(data?.knez_instance_id ?? "");
      const fp = String(data?.fingerprint ?? "");
      const version = data?.version != null ? String(data.version) : undefined;
      if (!iid || !fp) return null;
      return { knez_instance_id: iid, fingerprint: fp, version };
    } catch {
      return null;
    }
  }

  private async syncTrustIdentity(trusted: boolean): Promise<void> {
    if (!trusted) {
      this.profile = { ...this.profile, trustLevel: "untrusted", pinnedFingerprint: undefined, verifiedAt: undefined, instanceId: undefined };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      return;
    }
    const ident = await this.fetchIdentity();
    if (!ident) {
      this.profile = { ...this.profile, trustLevel: "untrusted" };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      return;
    }
    const pinned = this.profile.pinnedFingerprint;
    if (pinned && pinned !== ident.fingerprint) {
      this.profile = { ...this.profile, trustLevel: "untrusted" };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      logger.warn("knez_client", "KNEZ fingerprint mismatch; trust revoked", { endpoint: this.profile.endpoint });
      return;
    }
    this.profile = {
      ...this.profile,
      trustLevel: "verified",
      pinnedFingerprint: pinned ?? ident.fingerprint,
      verifiedAt: new Date().toISOString(),
      instanceId: ident.knez_instance_id,
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
  }

  getProfile(): KnezConnectionProfile {
    return this.profile;
  }

  setProfile(profile: KnezConnectionProfile): void {
    this.profile = { ...profile, endpoint: normalizeEndpoint(profile.endpoint) };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    logger.info("knez_client", "Profile updated", { id: profile.id });
  }

  setTrusted(trusted: boolean): void {
    this.profile = { ...this.profile, trustLevel: trusted ? "verified" : "untrusted" };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    logger.info("knez_client", "Trust level changed", { trusted });
    void this.syncTrustIdentity(trusted);
  }

  resetToDefault(): void {
    this.profile = { ...DEFAULT_PROFILE };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    logger.info("knez_client", "Profile reset to default", { endpoint: this.profile.endpoint });
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(sessionId: string | null): void {
    // Disconnect WebSocket if session is being cleared
    if (!sessionId && this.sessionId) {
      webSocketClient.disconnect();
    }

    this.sessionId = sessionId;
    if (sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      // Connect WebSocket when session is set
      webSocketClient.connect(sessionId);
      logger.info("knez_client", "WebSocket connecting", { sessionId });
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  async createNewLocalSession(): Promise<string> {
    // Call backend to create session (backend generates session ID)
    const url = `${this.baseUrl()}/sessions/create`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: null }),
      });
      if (!resp.ok) {
        throw new AppError("KNEZ_SESSION_CREATE_FAILED", `Session creation failed (${resp.status})`, { status: resp.status });
      }
      const data = await resp.json() as { session_id: string };
      const sessionId = data.session_id;
      this.setSessionId(sessionId);
      logger.info("knez_client", "Session created by backend", { sessionId });
      return sessionId;
    } catch (e: any) {
      if (isTauriRuntime()) {
        try {
          const data = await postJsonViaShell<{ session_id: string }>(url, { agent_id: null }, 5000);
          const sessionId = data.session_id;
          this.setSessionId(sessionId);
          logger.info("knez_client", "Session created by backend (shell)", { sessionId });
          return sessionId;
        } catch (shellErr: any) {
          if (shellErr instanceof AppError) throw shellErr;
          throw new AppError("KNEZ_SESSION_CREATE_FAILED", `Failed to create session: ${url}`, { url, reason: String(shellErr?.message ?? shellErr) });
        }
      }
      if (e instanceof AppError) throw e;
      throw new AppError("KNEZ_SESSION_CREATE_FAILED", `Failed to create session: ${url}`, { url, reason: String(e?.message ?? e) });
    }
  }

  async health(options?: { timeoutMs?: number }): Promise<KnezHealthResponse> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 15000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const url = `${this.baseUrl()}/health`;
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        logger.error("knez_client", "Health check failed", { status: resp.status });
        throw new AppError("KNEZ_HEALTH_FAILED", `Health check failed (${resp.status})`, { status: resp.status });
      }
      const data = (await resp.json()) as KnezHealthResponse;
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new AppError("KNEZ_FETCH_FAILED", "Health check returned invalid response (not an object)", {});
      }
      if (!Array.isArray(data.backends)) {
        throw new AppError("KNEZ_FETCH_FAILED", "Health check returned invalid response (backends not an array)", {});
      }
      if (!data.status || typeof data.status !== 'string') {
        throw new AppError("KNEZ_FETCH_FAILED", "Health check returned invalid response (status missing or invalid)", {});
      }
      logger.debugThrottled("knez_health_ok", 180000, "knez_client", "Health check passed", { backends: data.backends.length });
      return data;
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new AppError("KNEZ_TIMEOUT", `Health check timed out: ${url}`, { timeoutMs, url });
      }
      if (isTauriRuntime()) {
        try {
          const data = await healthViaShell(url, timeoutMs);
          logger.debugThrottled("knez_health_ok_shell", 180000, "knez_client", "Health check passed (shell)", { backends: data.backends.length });
          return data;
        } catch (shellErr: any) {
          if (shellErr instanceof AppError) throw shellErr;
          throw new AppError("KNEZ_FETCH_FAILED", `Failed to fetch: ${url}`, { url, reason: String(shellErr?.message ?? shellErr) });
        }
      }
      throw new AppError("KNEZ_FETCH_FAILED", `Failed to fetch: ${url}`, { url, reason: String(e?.message ?? e) });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const url = new URL(`${this.baseUrl()}/events`);
    url.searchParams.set("limit", "1");
    url.searchParams.set("session_id", sessionId);
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return false;
    }
    const events = (await resp.json()) as any[];
    return Array.isArray(events) && events.length > 0;
  }

  async getOllamaStatus(): Promise<{ reachable: boolean; models: string[]; error: string | null }> {
    const url = `${this.baseUrl()}/system/ollama-status`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new AppError("OLLAMA_STATUS_FAILED", `Ollama status check failed (${resp.status})`, { status: resp.status });
      }
      return await resp.json();
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError("OLLAMA_STATUS_FETCH_FAILED", `Failed to fetch ollama status: ${url}`, { url, reason: String(e?.message ?? e) });
    }
  }

  async loadModel(model: string): Promise<{ success: boolean; loaded: boolean; error?: string }> {
    const url = `${this.baseUrl()}/system/load-model`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model })
      });
      if (!resp.ok) {
        throw new AppError("LOAD_MODEL_FAILED", `Load model failed (${resp.status})`, { status: resp.status });
      }
      return await resp.json();
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError("LOAD_MODEL_FETCH_FAILED", `Failed to load model: ${url}`, { url, reason: String(e?.message ?? e) });
    }
  }

  async ensureSession(): Promise<string> {
    const existing = this.sessionId;
    if (existing && (await this.validateSession(existing))) {
      return existing;
    }
    // CP8-6: Enforce fresh session creation if validation fails or doesn't exist
    // Backend now generates session IDs (not frontend)
    const fresh = await this.createNewLocalSession();
    logger.info("knez_client", "Session created by backend (ensureSession)", { sessionId: fresh });
    try {
      await this.emitEvent({
        session_id: fresh,
        event_type: "INPUT",
        event_name: "ui_session_started",
        source: "system",
        severity: "INFO",
        payload: { session_id: fresh },
        tags: ["session_bootstrap", "control_app"],
      });
    } catch (e: any) {
      logger.warn("knez_client", "Session bootstrap event failed", { sessionId: fresh, error: String(e?.message ?? e) });
    }
    return fresh;
  }


  async listEvents(sessionId: string, limit = 50): Promise<KnezEvent[]> {
    const url = new URL(`${this.baseUrl()}/events`);
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

  async emitTaqwinResponse(payload: TaqwinResponse): Promise<void> {
    const url = `${this.baseUrl()}/taqwin/events`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        throw new Error(`taqwin_event_failed_${resp.status}`);
      }
    } catch (e: any) {
      // Shell fallback removed - unreliable, rely on HTTP/WebSocket only
      throw e;
    }
  }

  async emitTaqwinEvent(sessionId: string, eventName: string, payload: any = {}): Promise<void> {
    await this.emitTaqwinResponse({
      session_id: sessionId,
      intent: eventName,
      observations: [
        {
          type: "control_app_event",
          summary: eventName,
          details: payload ?? {},
        },
      ],
    });
  }

  async tryGetMcpRegistry(): Promise<McpRegistrySnapshot> {
    const url = `${this.baseUrl()}/mcp/registry`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
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
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return { supported: false, reason: "MCP registry request timed out." };
      }
      return { supported: false, reason: `MCP registry unreachable: ${String(e?.message ?? e)}` };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mcpRuntimeReportSupported: boolean | null = null;

  async reportMcpRuntime(args: { id: string; running: boolean; pid?: number | null; last_ok?: number | null; last_error?: string | null }): Promise<void> {
    const enabled = String((import.meta as any)?.env?.VITE_ENABLE_MCP_RUNTIME_REPORT ?? "false").toLowerCase() === "true";
    if (!enabled) {
      this.mcpRuntimeReportSupported = false;
      return;
    }
    if (this.mcpRuntimeReportSupported === false) return;
    const url = `${this.baseUrl()}/mcp/registry/report`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    if (resp.status === 404 || resp.status === 405) {
      this.mcpRuntimeReportSupported = false;
      return;
    }
    if (!resp.ok) {
      throw new Error(`mcp_registry_report_failed_${resp.status}`);
    }
    this.mcpRuntimeReportSupported = true;
  }

  async getGovernanceSnapshot(): Promise<any | null> {
    try {
      const resp = await fetch(`${this.baseUrl()}/governance/snapshot`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async listMemory(sessionId?: string, options?: { limit?: number; since?: string; order?: "asc" | "desc" }): Promise<KnezMemoryRecord[]> {
    const url = new URL(`${this.baseUrl()}/memory`);
    const limit = options?.limit ?? 100;
    url.searchParams.set("limit", String(limit));
    if (options?.since) {
      url.searchParams.set("since", options.since);
    }
    if (options?.order) {
      url.searchParams.set("order", options.order);
    }
    if (sessionId) {
      url.searchParams.set("session_id", sessionId);
    }
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`memory_failed_${resp.status}`);
    }
    return (await resp.json()) as KnezMemoryRecord[];
  }

  async checkMemoryGate(sessionId: string): Promise<any> {
    const url = `${this.baseUrl()}/memory/gate/check`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!resp.ok) {
      throw new Error(`memory_gate_failed_${resp.status}`);
    }
    return await resp.json();
  }

  async getInsights(sessionId: string): Promise<KnezInsight[]> {
    const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/insights`);
    if (!resp.ok) {
      throw new Error(`insights_failed_${resp.status}`);
    }
    return (await resp.json()) as KnezInsight[];
  }

  async getSummary(sessionId: string): Promise<Record<string, any>> {
    const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/summary`);
    if (!resp.ok) {
      throw new Error(`summary_failed_${resp.status}`);
    }
    return (await resp.json()) as Record<string, any>;
  }

  // --- Checkpoint 4 & 5: Full KNEZ Integration ---

  async getCognitiveState(): Promise<CognitiveState> {
    const controller = new AbortController();
    const timeoutMs = 6000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl()}/state/overview`, { signal: controller.signal });
      if (!resp.ok) throw new Error(`state_failed_${resp.status}`);
      return await resp.json();
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new AppError("KNEZ_TIMEOUT", "State overview timed out", { timeoutMs });
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async getDetailedSubsystemState(subsystem: "governance" | "influence" | "taqwin"): Promise<any> {
     const resp = await fetch(`${this.baseUrl()}/state/${subsystem}`);
     if (!resp.ok) return {};
     return await resp.json();
  }

  async forkSession(sessionId: string, messageId?: string): Promise<string> {
    const url = `${this.baseUrl()}/sessions/${sessionId}/fork`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_reason: messageId ? `fork_from_${messageId}` : "fork" }),
    });
    if (!resp.ok) throw new Error(`fork_failed_${resp.status}`);
    const data = await resp.json();
    const next = String(data.new_session_id || "");
    if (!next) throw new Error("fork_failed_invalid_response");
    return next;
  }
  
  async resumeSession(sessionId: string, snapshotId?: string): Promise<string> {
    const url = `${this.baseUrl()}/sessions/${sessionId}/resume`;
    const resp = await fetch(url, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ resume_reason: snapshotId ? `resume_snapshot_${snapshotId}` : "resume" })
    });
    if (!resp.ok) throw new Error(`resume_failed_${resp.status}`);
    const data = await resp.json();
    const next = String(data.new_session_id || "");
    if (!next) throw new Error("resume_failed_invalid_response");
    return next;
  }
  
  async getResumeSnapshot(sessionId: string): Promise<ResumeSnapshot | null> {
    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/resume_snapshot`, { signal: controller.signal });
      if (resp.status === 404) {
        // TICKET-4: Expected when no snapshot exists — suppress console noise
        logger.debug("knez_client", "resume_snapshot_not_found", { sessionId });
        return null;
      }
      if (!resp.ok) {
        logger.debug("knez_client", "resume_snapshot_error", { sessionId, status: resp.status });
        return null;
      }
      return await resp.json();
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new AppError("KNEZ_TIMEOUT", "Resume snapshot timed out", { timeoutMs });
      }
      logger.debug("knez_client", "resume_snapshot_fetch_error", { sessionId, error: String(e) });
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getSessionLineageChain(sessionId: string): Promise<{ head: string; chain: any[] } | null> {
    try {
      const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/lineage`);
      if (resp.status === 404) {
        // TICKET-4: Expected when no lineage exists — suppress console noise
        logger.debug("knez_client", "lineage_not_found", { sessionId });
        return null;
      }
      if (!resp.ok) {
        logger.debug("knez_client", "lineage_error", { sessionId, status: resp.status });
        return null;
      }
      return await resp.json();
    } catch (e: any) {
      logger.debug("knez_client", "lineage_fetch_error", { sessionId, error: String(e) });
      return null;
    }
  }

  async getOperatorControls(): Promise<{ enabled: boolean, policies: any[] }> {
    const resp = await fetch(`${this.baseUrl()}/operator/influence/global`);
    if (!resp.ok) return { enabled: false, policies: [] };
    return await resp.json();
  }
  
  async getActiveContracts(): Promise<InfluenceContract[]> {
     const resp = await fetch(`${this.baseUrl()}/operator/influence/contracts`);
     if (!resp.ok) return [];
     return await resp.json();
  }

  async getRunbook(sessionId: string): Promise<any[]> {
    const resp = await fetch(`${this.baseUrl()}/runbooks/${sessionId}`);
    if (!resp.ok) return [];
    return await resp.json();
  }

  async getReplayTimeline(sessionId: string): Promise<ReplayTimeline | null> {
    const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/replay`);
    if (!resp.ok) return null;
    return await resp.json();
  }

  async listCheckpoints(sessionId: string, limit = 200): Promise<{ session_id: string; items: { token_index: number; sha: string; created_at: number }[] }> {
    const url = new URL(`${this.baseUrl()}/sessions/${sessionId}/checkpoints`);
    url.searchParams.set("limit", String(limit));
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`checkpoints_failed_${resp.status}`);
    return await resp.json();
  }

  async emitEvent(args: {
    session_id?: string;
    task_id?: string;
    event_type: string;
    event_name: string;
    source?: string;
    severity?: string;
    payload?: Record<string, any>;
    tags?: string[];
  }): Promise<void> {
    const url = `${this.baseUrl()}/events`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!resp.ok) throw new Error(`event_emit_failed_${resp.status}`);
    } catch (e: any) {
      // Shell fallback removed - unreliable, rely on HTTP/WebSocket only
      throw e;
    }
  }

  async getMemoryDetail(memoryId: string): Promise<KnezMemoryRecord> {
    const resp = await fetch(`${this.baseUrl()}/memory/${memoryId}`);
    if (!resp.ok) throw new Error(`memory_detail_failed_${resp.status}`);
    return await resp.json();
  }
  
  async getAuditConsistency(): Promise<AuditResult[]> {
    const resp = await fetch(`${this.baseUrl()}/audit/consistency`);
    if (!resp.ok) return [];
    return await resp.json();
  }

  // --- CP6: Perception ---

  async takeSnapshot(): Promise<PerceptionSnapshot> {
    const resp = await fetch(`${this.baseUrl()}/perception/snapshot`, {
      method: "POST"
    });
    if (!resp.ok) throw new Error(`snapshot_failed_${resp.status}`);
    return await resp.json();
  }

  async getActiveWindow(): Promise<ActiveWindowInfo> {
    const resp = await fetch(`${this.baseUrl()}/perception/active_window`);
    if (!resp.ok) return { title: "Unknown", bounds: { left:0, top:0, right:0, bottom:0 } };
    return await resp.json();
  }

  // --- CP6: Knowledge ---

  async listKnowledge(): Promise<KnowledgeDoc[]> {
    const resp = await fetch(`${this.baseUrl()}/memory/knowledge`);
    if (!resp.ok) return [];
    return await resp.json();
  }

  async addKnowledge(doc: Partial<KnowledgeDoc>): Promise<void> {
    await fetch(`${this.baseUrl()}/memory/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
  }

  async toggleMcpItem(itemId: string, enabled: boolean): Promise<void> {
    const url = `${this.baseUrl()}/mcp/registry/${itemId}/toggle`;
    const urlWithQuery = new URL(url);
    urlWithQuery.searchParams.set("enabled", String(enabled));
    const resp = await fetch(urlWithQuery.toString(), { method: "POST" });
    if (!resp.ok) throw new Error("Failed to toggle MCP item");
  }

  // --- End CP4 ---

  async submitVote(sessionId: string, messageId: string, vote: "upvote" | "downvote"): Promise<void> {
    const url = `${this.baseUrl()}/influence/vote`;
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
      logger.warn("knez_client", "vote_submit_failed", { error: String((err as any)?.message ?? err) });
      // We don't throw here to avoid disrupting the chat flow
    }
  }

  async getPendingApprovals(): Promise<any[]> {
    const url = `${this.baseUrl()}/approvals/pending`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return [];
      return (await resp.json()) as any[];
    } catch {
      return [];
    }
  }

  async requestApproval(kind: string, payload: any = {}, sessionId?: string): Promise<any> {
    const url = `${this.baseUrl()}/approvals/request`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload, session_id: sessionId }),
    });
    if (!resp.ok) {
      throw new Error(`approval_request_failed_${resp.status}`);
    }
    return await resp.json();
  }

  async submitApprovalDecision(approvalId: string, decision: "approve" | "deny", actor?: string, reason?: string, sessionId?: string): Promise<void> {
    const url = `${this.baseUrl()}/approvals/${approvalId}/decision`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, actor, reason, session_id: sessionId }),
    });
    if (!resp.ok) {
      throw new Error(`approval_decision_failed_${resp.status}`);
    }
  }

  async chatCompletionsNonStream(
    messages: CompletionMessage[],
    sessionId: string,
    options?: { onMeta?: (meta: { model?: string; totalTokens?: number }) => void }
  ): Promise<string> {
    const data = await this.chatCompletionsNonStreamRaw(messages, sessionId, { onMeta: options?.onMeta });
    return data.choices?.[0]?.message?.content ?? "";
  }

  async chatCompletionsNonStreamRaw(
    messages: CompletionMessage[],
    sessionId: string,
    options?: {
      tools?: ChatCompletionTool[];
      toolChoice?: any;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      onMeta?: (meta: { model?: string; totalTokens?: number }) => void;
    }
  ): Promise<ChatCompletionsFinal> {
    return safeRequest(async () => {
      const url = `${this.baseUrl()}/v1/chat/completions`;
      const payload: ChatCompletionsRequest = {
        messages,
        stream: false,
        session_id: sessionId,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        tools: toOpenAiTools(options?.tools),
        tool_choice: options?.toolChoice,
      };
      let raw: any;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new AppError("KNEZ_COMPLETION_FAILED", `Completions request failed (${resp.status})`, { status: resp.status, url, detail });
        }
        raw = (await resp.json()) as any;
      } catch (e: any) {
        if (isTauriRuntime()) {
          raw = await postJsonViaShell<any>(url, payload, 30000);
        } else {
          throw e;
        }
      }
      if (raw && typeof raw.error === "string") {
        const err = raw as KnezErrorResponse;
        throw new AppError("KNEZ_COMPLETION_FAILED", `${err.error}${err.reason ? `:${err.reason}` : ""}`);
      }
      const data = raw as ChatCompletionsFinal;
      if (data?.model) {
        logger.info("knez_client", "model_loaded", { model: data.model, sessionId });
      }
      if (data?.model && options?.onMeta) {
        try { options.onMeta({ model: data.model }); } catch {}
      }
      if (data?.usage?.total_tokens && options?.onMeta) {
        try { options.onMeta({ totalTokens: data.usage.total_tokens }); } catch {}
      }
      return data;
    }, "chatCompletionsNonStreamRaw");
  }

  async getToolCallingSupport(): Promise<"supported" | "unsupported"> {
    const key = this.baseUrl();
    const cached = this.toolCallingSupportByEndpoint.get(key);
    if (cached) return cached;
    try {
      const session = await this.ensureSession();
      await this.chatCompletionsNonStreamRaw([{ role: "user", content: "ping" }], session, {
        tools: [],
        toolChoice: "none",
        maxTokens: 1
      });
      this.toolCallingSupportByEndpoint.set(key, "supported");
      return "supported";
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const detail = String((e as any)?.details?.detail ?? "");
      const combined = `${msg} ${detail}`.toLowerCase();
      const unsupported =
        combined.includes("unknown field") ||
        combined.includes("unexpected") ||
        combined.includes("tools") && combined.includes("not") && combined.includes("allowed") ||
        combined.includes("invalid") && combined.includes("tools");
      if (unsupported) {
        this.toolCallingSupportByEndpoint.set(key, "unsupported");
      }
      return "unsupported";
    }
  }

  async validateCognition(): Promise<boolean> {
    const messages: CompletionMessage[] = [{ role: "user", content: "1+1=" }];
    try {
      // Short timeout for validation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const url = `${this.baseUrl()}/v1/chat/completions`;
      const payload: ChatCompletionsRequest = {
        messages,
        stream: false,
        session_id: "validation-harness",
        max_tokens: 5,
      };
      
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) return false;
      const data = await resp.json() as ChatCompletionsFinal;
      return !!data.choices?.[0]?.message?.content;
    } catch {
      return false;
    }
  }

  async *chatCompletionsStream(
    messages: CompletionMessage[],
    sessionId: string,
    options?: { signal?: AbortSignal; onMeta?: (meta: { model?: string; totalTokens?: number }) => void }
  ): AsyncGenerator<string, void, void> {
    console.log('[KnezClient] chatCompletionsStream called', { sessionId, messageCount: messages.length });
    if (sessionId.startsWith("test-session-")) {
      const lastUser = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
      if (lastUser.includes("[FAIL_ONCE]")) {
        const key = `${sessionId}:${lastUser.slice(0, 120)}`;
        if (!testFailOnce.has(key)) {
          testFailOnce.add(key);
          throw new Error("forced_fail_once");
        }
      }
    }

    const url = `${this.baseUrl()}/v1/chat/completions`;
    console.log('[KnezClient] Request URL:', url);
    const payload: ChatCompletionsRequest = {
      messages,
      stream: true,
      session_id: sessionId,
    };

    // CP3-C: Retry Logic
    let attempts = 0;
    const maxAttempts = 1;
    const externalSignal = options?.signal;

    while (attempts < maxAttempts) {
      if (externalSignal?.aborted) {
        throw new DOMException("Request cancelled", "AbortError");
      }
      try {
        let yieldedAny = false;
        const controller = new AbortController();
        if (externalSignal) {
          if (externalSignal.aborted) controller.abort();
          else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
        }
        const connectTimeoutId = window.setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(connectTimeoutId);

        if (!resp.ok) {
           // If 5xx error, maybe retry. If 4xx, likely client error, don't retry.
           if (resp.status >= 500) {
             throw new Error(`Server error ${resp.status}`);
           }
           throw new Error(`completions_stream_failed_${resp.status}`);
        }
        
        if (!resp.body) throw new Error("No response body");
        const hdrModel =
          resp.headers.get("x-model-id") ??
          resp.headers.get("x-model") ??
          resp.headers.get("openai-model") ??
          resp.headers.get("x-openai-model");
        if (hdrModel) {
          logger.info("knez_client", "model_loaded", { model: hdrModel, sessionId });
        }
        if (hdrModel && options?.onMeta) {
          try { options.onMeta({ model: hdrModel }); } catch {}
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let inactivityTimeoutId = window.setTimeout(() => controller.abort(), 25000);
        
        // Successful connection established, break retry loop and yield
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          clearTimeout(inactivityTimeoutId);
          inactivityTimeoutId = window.setTimeout(() => controller.abort(), 25000);
          buffer += decoder.decode(value, { stream: true });
          const findFrameBoundary = (raw: string): { idx: number; len: number } | null => {
            const n = raw.indexOf("\n\n");
            const r = raw.indexOf("\r\n\r\n");
            if (n < 0 && r < 0) return null;
            if (n >= 0 && (r < 0 || n < r)) return { idx: n, len: 2 };
            return { idx: r, len: 4 };
          };
          while (true) {
            const boundary = findFrameBoundary(buffer);
            if (!boundary) break;
            const frame = buffer.slice(0, boundary.idx);
            buffer = buffer.slice(boundary.idx + boundary.len);
            const lines = frame.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                clearTimeout(inactivityTimeoutId);
                if (!yieldedAny) {
                  logger.warn("knez_client", "STREAM_FALLBACK_NONSTREAM", { message: "Stream [DONE] without delta.content, falling back to non-streaming" });
                  const final = await this.chatCompletionsNonStream(messages, sessionId, { onMeta: options?.onMeta });
                  if (!final.trim()) {
                    logger.warn("knez_client", "STREAM_EMPTY_RESPONSE", { message: "Stream [DONE] and non-stream both returned no content — allowing empty response" });
                    return;
                  }
                  // Simulate streaming by chunking
                  const chunkSize = 50;
                  for (let i = 0; i < final.length; i += chunkSize) {
                    yield final.slice(i, i + chunkSize);
                  }
                }
                return;
              }
              if (!data) continue;
              const parsedAny = safeJsonParse<any>(data);
              if (parsedAny && typeof parsedAny.error === "string") {
                const err = parsedAny as KnezErrorResponse;
                throw new AppError("KNEZ_STREAM_FAILED", `${err.error}${err.reason ? `:${err.reason}` : ""}`);
              }
              const parsed = parsedAny as ChatCompletionsFinal | null;
              if (parsed?.model && options?.onMeta) {
                try { options.onMeta({ model: parsed.model }); } catch {}
              }
              const finishReason = parsed?.choices?.[0]?.finish_reason;
              if (finishReason === "stop") {
                const total = (parsed as any)?.usage?.total_tokens;
                if (total && options?.onMeta) {
                  try { options.onMeta({ totalTokens: total }); } catch {}
                }
              }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) {
                yieldedAny = true;
                yield delta;
                continue;
              }
              // Fallback: some backends return content in message.content instead of delta.content
              const messageContent = (parsed as any)?.choices?.[0]?.message?.content;
              if (messageContent) {
                logger.warn("knez_client", "STREAM_FALLBACK_MESSAGE_CONTENT", { message: "Backend yielded message.content instead of delta.content — using fallback extraction" });
                yieldedAny = true;
                yield messageContent;
              }
            }
          }
        }
        clearTimeout(inactivityTimeoutId);
        if (!yieldedAny) {
          logger.warn("knez_client", "STREAM_FALLBACK_NONSTREAM", { message: "Stream ended without delta.content, falling back to non-streaming" });
          const final = await this.chatCompletionsNonStream(messages, sessionId, { onMeta: options?.onMeta });
          if (!final.trim()) {
            logger.warn("knez_client", "STREAM_EMPTY_RESPONSE", { message: "Stream and non-stream both returned no content — allowing empty response" });
            return;
          }
          // Simulate streaming by chunking
          const chunkSize = 50;
          for (let i = 0; i < final.length; i += chunkSize) {
            yield final.slice(i, i + chunkSize);
          }
        }
        return; // Success, exit generator

      } catch (err: any) {
        if (externalSignal?.aborted) {
          const abortErr =
            err?.name === "AbortError" ? err : new DOMException("Request cancelled", "AbortError");
          throw abortErr;
        }
        attempts++;
        if (attempts < maxAttempts) {
          logger.warn("knez_client", `Stream attempt ${attempts} failed, retrying...`, { error: err });
          await new Promise(r => setTimeout(r, 500 * attempts)); // Reduced backoff for faster recovery
        }
      }
    }
    
    // If we exhausted retries
    throw new AppError("KNEZ_STREAM_FAILED", "Stream retries exhausted - backend must yield delta.content");
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
