import { McpStdioClient } from "../client/McpStdioClient";
import { McpHttpClient } from "../client/McpHttpClient";
import { McpRustClient } from "../client/McpRustClient";
import { McpBuiltinClient } from "../client/McpBuiltinClient";
import { mcpHostConfigService } from "../config/McpHostConfigService";
import type { McpConfigIssue, McpServerConfig, NormalizedMcpConfig, NormalizedMcpServerConfig } from "../config/McpHostConfig";
import { normalizeMcpConfig } from "../config/McpHostConfig";
import { extractServerInputRefs, listInputsById, substituteServerInputRefs } from "../config/McpInputs";
import type { McpToolDefinition } from "../../services/mcp/McpTypes";
import { knezClient } from '../../services/knez/KnezClient';
import { getMcpAuthority } from "../authority";
import { logger, LogLevel } from '../../services/utils/LogService';
import { classifyMcpError } from "../McpErrorTaxonomy";
import { MCP_LOG_METHODS, MCP_LOG_CATEGORIES } from "./McpLoggingConstants";

export type McpInspectorLifecycle = "IDLE" | "STARTING" | "INITIALIZED" | "LISTING_TOOLS" | "READY" | "ERROR";

export type McpInspectorServerStatus = {
  id: string;
  enabled: boolean;
  tags: string[];
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line" | "http";
  lastOkAt: number | null;
  initializedAt: number | null;
  initializeDurationMs: number | null;
  toolsListDurationMs: number | null;
  lastError: string | null;
  toolsCached: number;
  toolsCacheAt: number | null;
  toolsPending: boolean;
  stdoutTail: string | null;
  stderrTail: string | null;
};

export type McpInspectorConfigState = {
  raw: string;
  normalized: NormalizedMcpConfig | null;
  issues: McpConfigIssue[];
  issuesByServerId: Record<string, McpConfigIssue[]>;
};

export type KnezHealthSnapshot = {
  endpoint: string;
  checkedAt: number | null;
  ok: boolean | null;
  error: string | null;
};

type ServerSession = {
  server: NormalizedMcpServerConfig;
  client: McpStdioClient | McpHttpClient | McpRustClient | McpBuiltinClient;
  state: McpInspectorLifecycle;
  lastOkAt: number | null;
  initializedAt: number | null;
  initializeDurationMs: number | null;
  toolsListDurationMs: number | null;
  lastError: string | null;
  tools: McpToolDefinition[];
  toolsCacheAt: number | null;
  toolsPending: boolean;
};

export class McpInspectorService {
  private sessions = new Map<string, ServerSession>();
  private subscribers = new Set<() => void>();
  private config: McpInspectorConfigState = { raw: "", normalized: null, issues: [], issuesByServerId: {} };
  private selectedId: string | null = null;
  private opChains = new Map<string, Promise<void>>();
  private knezHealth: KnezHealthSnapshot = { endpoint: "", checkedAt: null, ok: null, error: null };
  private inputValues = new Map<string, string>();
  private runtimePollTimer: number | null = null;
  private lastRunningByServerId = new Map<string, boolean>();

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private emit() {
    for (const fn of this.subscribers) {
      try {
        fn();
      } catch {}
    }
  }

  private ensureRuntimePoll() {
    if (this.runtimePollTimer !== null) return;
    this.runtimePollTimer = window.setInterval(() => {
      try {
        this.pollRuntimeState();
      } catch {}
    }, 250);
  }

  private pollRuntimeState() {
    let changed = false;
    for (const [id, s] of this.sessions) {
      const dbg = s.client.getDebugState();
      const running = Boolean((dbg as any)?.running);
      const prior = this.lastRunningByServerId.get(id);
      if (prior === undefined || prior !== running) {
        this.lastRunningByServerId.set(id, running);
      }
      if (!running && s.state !== "IDLE") {
        if (s.state !== "ERROR") {
          s.state = "ERROR";
          s.toolsPending = false;
          s.lastError = String((dbg as any)?.lastError ?? s.lastError ?? "mcp_process_crashed");
          changed = true;
        }
      }
    }
    if (changed) this.emit();
  }

  private emitMcpEvent(eventName: string, payload: Record<string, any>, severity: string = "INFO") {
    void knezClient.emitEvent({
      event_type: "ACTION",
      event_name: eventName,
      source: "tool",
      severity,
      payload,
      tags: ["mcp"]
    }).catch(() => {});
  }

  private enqueue<T>(serverId: string, fn: () => Promise<T>): Promise<T> {
    const prior = this.opChains.get(serverId) ?? Promise.resolve();
    const p = prior.then(fn, fn);
    this.opChains.set(
      serverId,
      p.then(
        () => {},
        () => {}
      )
    );
    return p;
  }

  getConfig(): McpInspectorConfigState {
    return this.config;
  }

  getInputs() {
    return (this.config.normalized?.inputs ?? []).slice();
  }

  getResolvedInputIds(): string[] {
    return Array.from(this.inputValues.keys()).sort();
  }

  setInputValue(id: string, value: string) {
    const key = String(id ?? "").trim();
    if (!key) return;
    this.inputValues.set(key, String(value ?? ""));
    this.emit();
  }

  clearInputValue(id: string) {
    const key = String(id ?? "").trim();
    if (!key) return;
    this.inputValues.delete(key);
    this.emit();
  }

  clearAllInputValues() {
    this.inputValues.clear();
    this.emit();
  }

  getRequiredInputsForServer(serverId: string): string[] {
    const s = this.sessions.get(serverId);
    if (!s) return [];
    const cfg = this.toServerConfig(s.server);
    return extractServerInputRefs(cfg);
  }

  getKnezHealth(): KnezHealthSnapshot {
    const endpoint = knezClient.getProfile().endpoint;
    if (this.knezHealth.endpoint !== endpoint) {
      this.knezHealth = { endpoint, checkedAt: null, ok: null, error: null };
    }
    return this.knezHealth;
  }

  async refreshKnezHealth(timeoutMs = 1200): Promise<KnezHealthSnapshot> {
    const endpoint = knezClient.getProfile().endpoint;
    if (this.knezHealth.endpoint !== endpoint) {
      this.knezHealth = { endpoint, checkedAt: null, ok: null, error: null };
    }
    try {
      await knezClient.health({ timeoutMs });
      this.knezHealth = { endpoint, checkedAt: Date.now(), ok: true, error: null };
    } catch (e: any) {
      this.knezHealth = { endpoint, checkedAt: Date.now(), ok: false, error: String(e?.message ?? e) };
    }
    this.emit();
    return this.knezHealth;
  }

  private requiresKnez(server: NormalizedMcpServerConfig): boolean {
    if (server.id === "taqwin") return true;
    if (server.type === "stdio") {
      const env = server.env ?? {};
      if (env.TAQWIN_GOVERNANCE_SNAPSHOT_URL) return true;
      if (env.KNEZ_ENDPOINT) return true;
    }
    return false;
  }

  private async ensureKnezHealthy(): Promise<void> {
    const snap = this.getKnezHealth();
    const ttlMs = 2500;
    if (snap.checkedAt && Date.now() - snap.checkedAt < ttlMs) {
      if (snap.ok) return;
      // Log warning but don't throw - allow MCP to work without KNEZ
      logger.warn("mcp_audit", "knez_health_check_failed", { 
        error: snap.error ?? "health_failed",
        note: "Proceeding without KNEZ health check"
      });
      return;
    }
    try {
      const next = await this.refreshKnezHealth(5000);
      if (next.ok) return;
      // Log warning but don't throw - allow MCP to work without KNEZ
      logger.warn("mcp_audit", "knez_health_check_failed", { 
        error: next.error ?? "health_failed",
        note: "Proceeding without KNEZ health check"
      });
    } catch (e: any) {
      // Log warning but don't throw - allow MCP to work without KNEZ
      logger.warn("mcp_audit", "knez_health_check_exception", { 
        error: String(e?.message ?? e),
        note: "Proceeding without KNEZ health check"
      });
    }
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  setSelectedId(id: string | null) {
    this.selectedId = id;
    this.emit();
  }

  async loadConfig(): Promise<void> {
    const loaded = await mcpHostConfigService.load();
    const effective = loaded ?? mcpHostConfigService.getDefault();
    this.applyConfig(effective.raw);
  }

  hasLoadedConfig(): boolean {
    return !!this.config.raw;
  }

  patchServer(serverId: string, patch: Partial<NormalizedMcpServerConfig>) {
    const s = this.sessions.get(serverId);
    if (!s) return;
    s.server = { ...s.server, ...patch, id: serverId } as NormalizedMcpServerConfig;
    this.emit();
  }

  getClientInstance(serverId: string): McpStdioClient | McpHttpClient | McpRustClient | McpBuiltinClient | null {
    return this.sessions.get(serverId)?.client ?? null;
  }

  applyConfig(raw: string) {
    const next: McpInspectorConfigState = { raw, normalized: null, issues: [], issuesByServerId: {} };
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeMcpConfig(parsed);
      next.normalized = normalized;
      next.issuesByServerId = validateNormalizedServers(normalized);
    } catch (e: any) {
      next.issues.push({ level: "error", message: `config parse failed: ${String(e?.message ?? e)}` });
    }
    this.config = next;
    this.reconcileSessions();
    if (this.selectedId && !this.sessions.has(this.selectedId)) this.selectedId = null;
    if (!this.selectedId) this.selectedId = this.getServers()[0]?.id ?? null;
    this.emit();
  }

  async saveConfig(raw: string): Promise<void> {
    // Validate JSON structure before save
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Config must be a valid JSON object");
      }
      if (parsed.mcpServers && typeof parsed.mcpServers !== "object") {
        throw new Error("mcpServers must be an object");
      }
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        throw new Error("Invalid JSON: " + e.message);
      }
      throw e;
    }
    
    const { config } = await mcpHostConfigService.save(raw);
    const normalized = normalizeMcpConfig({ schema_version: config.schema_version, inputs: config.inputs ?? [], servers: config.servers });
    this.applyConfig(
      JSON.stringify({ schema_version: normalized.schema_version ?? "1", inputs: normalized.inputs ?? [], servers: normalized.servers }, null, 2)
    );
  }

  getServers(): NormalizedMcpServerConfig[] {
    const list = Array.from(this.sessions.values()).map((s) => s.server);
    list.sort((a, b) => a.id.localeCompare(b.id));
    return list;
  }

  getStatusById(): Record<string, McpInspectorServerStatus> {
    const out: Record<string, McpInspectorServerStatus> = {};
    for (const [id, s] of this.sessions) {
      out[id] = this.buildStatus(s);
    }
    return out;
  }

  getTools(serverId: string): McpToolDefinition[] {
    const s = this.sessions.get(serverId);
    return s ? s.tools.slice() : [];
  }

  getTraffic(serverId: string) {
    const s = this.sessions.get(serverId);
    return s ? s.client.getTraffic() : [];
  }

  async start(serverId: string): Promise<void> {
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      if (!s.server.enabled) throw new Error("mcp_server_disabled");
      if (s.client.getDebugState().running) return;
      s.state = "STARTING";
      s.lastError = null;
      s.tools = [];
      s.toolsPending = false;
      this.emit();
      try {
        const cfg = await this.resolveInputsForServer(this.toServerConfig(s.server));
        await s.client.startWithConfig(cfg);
        s.state = "IDLE";
        s.lastError = null;
        this.emit();
      } catch (e: any) {
        s.state = "ERROR";
        s.lastError = String(e?.message ?? e);
        this.emit();
        throw e;
      }
    });
  }

  async stop(serverId: string): Promise<void> {
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) return;
      try {
        await s.client.stop();
      } catch {}
      s.state = "IDLE";
      s.initializedAt = null;
      s.initializeDurationMs = null;
      s.toolsListDurationMs = null;
      s.tools = [];
      s.toolsCacheAt = null;
      s.toolsPending = false;
      s.lastError = null;
      this.emit();
    });
  }

  async restart(serverId: string): Promise<void> {
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) return;
      try {
        await s.client.stop();
      } catch {}
      // Wait a bit for the process to fully stop
      await new Promise(resolve => setTimeout(resolve, 100));
      s.state = "IDLE";
      s.initializedAt = null;
      s.initializeDurationMs = null;
      s.toolsListDurationMs = null;
      s.tools = [];
      s.toolsCacheAt = null;
      s.toolsPending = false;
      s.lastError = null;
      this.emit();
      if (!s.server.enabled) throw new Error("mcp_server_disabled");
      // Check if client is still running after stop delay
      if (s.client.getDebugState().running) {
        // Force another stop attempt if still running
        try {
          await s.client.stop();
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {}
        if (s.client.getDebugState().running) {
          throw new Error("mcp_process_stuck");
        }
      }
      s.state = "STARTING";
      this.emit();
      const cfg = await this.resolveInputsForServer(this.toServerConfig(s.server));
      await s.client.startWithConfig(cfg);
      s.state = "IDLE";
      s.toolsCacheAt = null; // Force tool cache invalidation on server restart
      this.emit();
    });
  }

  async initialize(serverId: string): Promise<any> {
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      if (!s.client.getDebugState().running) {
        if (!s.server.enabled) throw new Error("mcp_server_disabled");
        s.state = "STARTING";
        s.lastError = null;
        s.tools = [];
        s.toolsPending = false;
        this.emit();
        const cfg = await this.resolveInputsForServer(this.toServerConfig(s.server));
        await s.client.startWithConfig(cfg);
      }
      const startedAt = performance.now();
      s.state = "STARTING";
      s.lastError = null;
      this.emit();
      try {
        const res = await s.client.initialize();
        if (typeof (s.client as any).notifyInitialized === "function") {
          try {
            await (s.client as any).notifyInitialized();
          } catch {}
        }
        s.initializeDurationMs = Math.round(performance.now() - startedAt);
        s.initializedAt = Date.now();
        s.lastOkAt = Date.now();
        s.state = "INITIALIZED";
        s.lastError = null;
        this.emit();
        return res;
      } catch (e: any) {
        s.initializeDurationMs = Math.round(performance.now() - startedAt);
        s.state = "ERROR";
        s.lastError = String(e?.message ?? e);
        this.emit();
        throw e;
      }
    });
  }

  async handshake(serverId: string, opts?: { toolsListTimeoutMs?: number }): Promise<McpToolDefinition[]> {
    const toolsListTimeoutMs = opts?.toolsListTimeoutMs ?? 60000;
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      this.emitMcpEvent("mcp_handshake_started", { server_id: serverId, authority: getMcpAuthority(), type: s.server.type });
      logger.info("mcp_audit", "handshake_started", { serverId, authority: getMcpAuthority(), type: s.server.type });

      if (!s.client.getDebugState().running) {
        if (!s.server.enabled) throw new Error("mcp_server_disabled");
        s.state = "STARTING";
        s.lastError = null;
        s.tools = [];
        s.toolsCacheAt = null;
        s.toolsPending = false;
        this.emit();
        const cfg = await this.resolveInputsForServer(this.toServerConfig(s.server));
        await s.client.startWithConfig(cfg);
        // Add delay to allow server to be ready for handshake
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const initStartedAt = performance.now();
      s.state = "STARTING";
      s.lastError = null;
      this.emit();
      try {
        const res = await s.client.initialize();
        if (typeof (s.client as any).notifyInitialized === "function") {
          try {
            await (s.client as any).notifyInitialized();
          } catch {}
        }
        s.initializeDurationMs = Math.round(performance.now() - initStartedAt);
        s.initializedAt = Date.now();
        s.lastOkAt = Date.now();
        s.state = "INITIALIZED";
        s.lastError = null;
        this.emit();
        void res;
      } catch (e: any) {
        const classified = classifyMcpError(e);
        this.emitMcpEvent("mcp_handshake_failed", { server_id: serverId, stage: "initialize", error_code: classified.code, error: classified.message }, "WARN");
        logger.warn("mcp_audit", "handshake_failed", { serverId, stage: "initialize", errorCode: classified.code });
        s.initializeDurationMs = Math.round(performance.now() - initStartedAt);
        s.state = "ERROR";
        s.lastError = String(e?.message ?? e);
        this.emit();
        throw e;
      }

      if (this.requiresKnez(s.server)) {
        try {
          await this.ensureKnezHealthy();
        } catch (e: any) {
          const classified = classifyMcpError(e);
          this.emitMcpEvent("mcp_handshake_failed", { server_id: serverId, stage: "knez_health", error_code: classified.code, error: classified.message }, "WARN");
          logger.warn("mcp_audit", "handshake_failed", { serverId, stage: "knez_health", errorCode: classified.code });
          s.state = "ERROR";
          s.lastError = String(e?.message ?? e);
          this.emit();
          throw e;
        }
      }

      const toolsStartedAt = performance.now();
      s.state = "LISTING_TOOLS";
      s.toolsPending = true;
      s.lastError = null;
      this.emit();
      try {
        const tools = await s.client.listTools({ timeoutMs: toolsListTimeoutMs, logTimeoutLevel: "warn" });
        if (!Array.isArray(tools) || tools.length === 0) {
          s.tools = [];
          s.toolsCacheAt = Date.now();
          s.toolsListDurationMs = Math.round(performance.now() - toolsStartedAt);
          s.lastOkAt = Date.now();
          s.state = "ERROR";
          s.toolsPending = false;
          s.lastError = "mcp_server_no_tools";
          this.emit();
          throw new Error("mcp_server_no_tools");
        }
        s.tools = tools;
        s.toolsCacheAt = Date.now();
        s.toolsListDurationMs = Math.round(performance.now() - toolsStartedAt);
        s.lastOkAt = Date.now();
        s.state = "READY";
        s.toolsPending = false;
        s.lastError = null;
        this.emit();
        this.emitMcpEvent("mcp_handshake_completed", { server_id: serverId, init_ms: s.initializeDurationMs, tools_list_ms: s.toolsListDurationMs, tools: tools.length });
        this.emitMcpEvent("mcp_tools_updated", { server_id: serverId, tools: tools.length });
        logger.info("mcp_audit", "handshake_completed", { serverId, tools: tools.length, initMs: s.initializeDurationMs, toolsListMs: s.toolsListDurationMs });
        return tools;
      } catch (e: any) {
        const classified = classifyMcpError(e);
        this.emitMcpEvent("mcp_handshake_failed", { server_id: serverId, stage: "tools_list", error_code: classified.code, error: classified.message }, "WARN");
        logger.warn("mcp_audit", "handshake_failed", { serverId, stage: "tools_list", errorCode: classified.code });
        s.toolsListDurationMs = Math.round(performance.now() - toolsStartedAt);
        s.state = "ERROR";
        s.toolsPending = false;
        s.lastError = String(e?.message ?? e);
        this.emit();
        throw e;
      }
    });
  }

  listTools(serverId: string, opts?: { timeoutMs?: number; waitForResult?: boolean }): Promise<McpToolDefinition[]> {
    const waitForResult = opts?.waitForResult === true;
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      if (this.requiresKnez(s.server)) {
        try {
          await this.ensureKnezHealthy();
        } catch (e: any) {
          s.state = "ERROR";
          s.toolsPending = false;
          s.lastError = String(e?.message ?? e);
          this.emit();
          throw e;
        }
      }
      if (!s.initializedAt) throw new Error("mcp_not_initialized");
      const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : waitForResult ? 15000 : 60000;
      const startedAt = performance.now();
      s.state = "LISTING_TOOLS";
      s.toolsPending = true;
      this.emit();
      try {
        const tools = await s.client.listTools({ timeoutMs, logTimeoutLevel: waitForResult ? "warn" : "debug" });
        if (!Array.isArray(tools) || tools.length === 0) {
          s.tools = [];
          s.toolsCacheAt = Date.now();
          s.toolsListDurationMs = Math.round(performance.now() - startedAt);
          s.lastOkAt = Date.now();
          s.state = "ERROR";
          s.toolsPending = false;
          s.lastError = "mcp_server_no_tools";
          this.emit();
          throw new Error("mcp_server_no_tools");
        }
        s.tools = tools;
        s.toolsCacheAt = Date.now();
        s.toolsListDurationMs = Math.round(performance.now() - startedAt);
        s.lastOkAt = Date.now();
        s.state = "READY";
        s.toolsPending = false;
        s.lastError = null;
        this.emit();
        this.emitMcpEvent("mcp_tools_updated", { server_id: serverId, tools: tools.length });
        logger.info("mcp_audit", "tools_updated", { serverId, tools: tools.length, durationMs: s.toolsListDurationMs });
        return tools;
      } catch (e: any) {
        s.toolsListDurationMs = Math.round(performance.now() - startedAt);
        s.state = "ERROR";
        s.toolsPending = false;
        s.lastError = String(e?.message ?? e);
        this.emit();
        throw e;
      }
    });
  }

  async callTool(
    serverId: string,
    name: string,
    args: any,
    optsOrTimeout: number | { timeoutMs?: number; traceId?: string; toolCallId?: string; correlationId?: string }
  ): Promise<{ result: any; durationMs: number }> {
    const timeoutMs = typeof optsOrTimeout === "number" ? optsOrTimeout : (optsOrTimeout?.timeoutMs ?? 180000);
    const traceId = typeof optsOrTimeout === "number" ? undefined : optsOrTimeout?.traceId;
    const toolCallId = typeof optsOrTimeout === "number" ? undefined : optsOrTimeout?.toolCallId;
    const correlationId = typeof optsOrTimeout === "number" ? undefined : optsOrTimeout?.correlationId;
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      if (!s.client.getDebugState().running) throw new Error("mcp_not_started");
      if (!s.initializedAt) throw new Error("mcp_not_initialized");
      if (this.requiresKnez(s.server)) {
        await this.ensureKnezHealthy();
      }
      if (!s.toolsCacheAt || s.tools.length === 0) {
        const startedAt = performance.now();
        const category = MCP_LOG_CATEGORIES.PREFIX_LOCAL(serverId);
        
        await logger.writeServerLog(serverId, LogLevel.INFO, category, MCP_LOG_METHODS.LIST_TOOLS, {
          message: "Listing tools..."
        });
        
        s.state = "LISTING_TOOLS";
        s.toolsPending = true;
        this.emit();
        try {
          const tools = await s.client.listTools({ timeoutMs: 60000, logTimeoutLevel: "warn" });
          if (!Array.isArray(tools) || tools.length === 0) {
            s.tools = [];
            s.toolsCacheAt = Date.now();
            s.toolsListDurationMs = Math.round(performance.now() - startedAt);
            s.lastOkAt = Date.now();
            s.state = "ERROR";
            s.toolsPending = false;
            s.lastError = "mcp_server_no_tools";
            this.emit();
            
            await logger.writeServerLog(serverId, LogLevel.ERROR, category, MCP_LOG_METHODS.LIST_TOOLS, {
              message: "No tools returned",
              durationMs: s.toolsListDurationMs
            });
            
            throw new Error("mcp_server_no_tools");
          }
          s.tools = tools;
          s.toolsCacheAt = Date.now();
          s.toolsListDurationMs = Math.round(performance.now() - startedAt);
          s.lastOkAt = Date.now();
          s.state = "READY";
          s.toolsPending = false;
          s.lastError = null;
          this.emit();
          
          await logger.writeServerLog(serverId, LogLevel.INFO, category, MCP_LOG_METHODS.LIST_TOOLS, {
            message: `Got ${tools.length} tools`,
            tools: tools.map((t: any) => t.name),
            durationMs: s.toolsListDurationMs
          });
          
        } catch (e: any) {
          s.toolsListDurationMs = Math.round(performance.now() - startedAt);
          s.state = "ERROR";
          s.toolsPending = false;
          s.lastError = String(e?.message ?? e);
          this.emit();
          
          await logger.writeServerLog(serverId, LogLevel.ERROR, category, MCP_LOG_METHODS.LIST_TOOLS, {
            message: "Failed to list tools",
            error: String(e?.message ?? e),
            durationMs: s.toolsListDurationMs
          });
          
          throw e;
        }
      }
      if (!s.tools.some((t) => t?.name === name)) {
        throw new Error(`mcp_tool_not_found:${name}`);
      }
      const startedAt = performance.now();
      const category = MCP_LOG_CATEGORIES.PREFIX_LOCAL(serverId);
      
      // Log tool call start with arguments
      await logger.writeServerLog(serverId, LogLevel.INFO, category, MCP_LOG_METHODS.CALL_TOOL, {
        message: `Calling tool: ${name}`,
        tool: name,
        args: args
      });
      
      this.emitMcpEvent("tool_call_started", {
        server_id: serverId,
        tool: name,
        trace_id: traceId ?? null,
        tool_call_id: toolCallId ?? null,
        correlation_id: correlationId ?? null
      });
      logger.info("mcp_audit", "tool_call_started", {
        serverId,
        tool: name,
        traceId: traceId ?? null,
        toolCallId: toolCallId ?? null,
        correlationId: correlationId ?? null
      });
      try {
        const res = await s.client.callTool(name, args, { timeoutMs });
        const durationMs = Math.round(performance.now() - startedAt);
        s.lastOkAt = Date.now();
        this.emit();
        
        // Log tool call result
        await logger.writeServerLog(serverId, LogLevel.INFO, category, MCP_LOG_METHODS.CALL_TOOL, {
          message: `Tool call succeeded: ${name}`,
          tool: name,
          durationMs,
          result: res
        });
        
        this.emitMcpEvent("tool_call_completed", {
          server_id: serverId,
          tool: name,
          trace_id: traceId ?? null,
          tool_call_id: toolCallId ?? null,
          correlation_id: correlationId ?? null,
          duration_ms: durationMs,
          durationMs
        });
        logger.info("mcp_audit", "tool_call_completed", {
          serverId,
          tool: name,
          traceId: traceId ?? null,
          toolCallId: toolCallId ?? null,
          correlationId: correlationId ?? null,
          durationMs
        });
        return { result: res, durationMs };
      } catch (e: any) {
        const durationMs = Math.round(performance.now() - startedAt);
        const classified = classifyMcpError(e);
        
        // Log tool call failure
        await logger.writeServerLog(serverId, LogLevel.ERROR, category, MCP_LOG_METHODS.CALL_TOOL, {
          message: `Tool call failed: ${name}`,
          tool: name,
          durationMs,
          error: classified.message,
          errorCode: classified.code
        });
        
        this.emitMcpEvent("tool_call_failed", {
          server_id: serverId,
          tool: name,
          trace_id: traceId ?? null,
          tool_call_id: toolCallId ?? null,
          correlation_id: correlationId ?? null,
          duration_ms: durationMs,
          durationMs,
          error_code: classified.code,
          error: classified.message
        }, "WARN");
        logger.warn("mcp_audit", "tool_call_failed", {
          serverId,
          tool: name,
          traceId: traceId ?? null,
          toolCallId: toolCallId ?? null,
          correlationId: correlationId ?? null,
          durationMs,
          errorCode: classified.code
        });
        throw e;
      }
    });
  }

  private toServerConfig(s: NormalizedMcpServerConfig): McpServerConfig {
    if (s.type === "http") {
      return {
        id: s.id,
        type: "http",
        url: s.url,
        headers: s.headers,
        enabled: s.enabled,
        start_on_boot: s.start_on_boot,
        allowed_tools: s.allowed_tools,
        blocked_tools: s.blocked_tools,
        tags: s.tags
      };
    }
    return {
      id: s.id,
      type: "stdio",
      command: s.command,
      args: s.args,
      env: s.env,
      cwd: s.cwd,
      enabled: s.enabled,
      start_on_boot: s.start_on_boot,
      allowed_tools: s.allowed_tools,
      blocked_tools: s.blocked_tools,
      tags: s.tags
    };
  }

  private async resolveInputsForServer(server: McpServerConfig): Promise<McpServerConfig> {
    const cfg = this.config.normalized;
    const inputs = listInputsById(cfg?.inputs ?? []);
    const refs = extractServerInputRefs(server);
    if (!refs.length) return server;
    const resolved: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of refs) {
      const cached = this.inputValues.get(id);
      if (cached === undefined) {
        missing.push(id);
        continue;
      }
      resolved[id] = cached;
    }
    if (missing.length) {
      const labels = missing.map((id) => {
        const meta = inputs[id];
        return meta?.description ? `${id} (${meta.description})` : id;
      });
      throw new Error(`mcp_input_required:${labels.join(",")}`);
    }
    return substituteServerInputRefs(server, resolved);
  }

  private buildStatus(s: ServerSession): McpInspectorServerStatus {
    const dbg = s.client.getDebugState();
    const framing = String((dbg as any)?.requestFraming ?? "http");
    const running = Boolean((dbg as any)?.running);
    const effectiveState: McpInspectorLifecycle =
      !running && s.state !== "IDLE" ? "ERROR" : s.state;
    const effectiveLastError =
      !running && s.state !== "IDLE"
        ? String(s.lastError ?? (dbg as any)?.lastError ?? "mcp_process_crashed")
        : (s.lastError ?? (dbg as any)?.lastError ?? null);
    return {
      id: s.server.id,
      enabled: s.server.enabled,
      tags: s.server.tags,
      type: s.server.type,
      command: s.server.type === "stdio" ? s.server.command : undefined,
      args: s.server.type === "stdio" ? s.server.args : undefined,
      cwd: s.server.type === "stdio" ? s.server.cwd : undefined,
      env: s.server.type === "stdio" ? s.server.env : undefined,
      url: s.server.type === "http" ? s.server.url : undefined,
      headers: s.server.type === "http" ? s.server.headers : undefined,
      state: effectiveState,
      pid: dbg.pid ?? null,
      running: running,
      framing: framing === "line" || framing === "content-length" ? framing : "http",
      lastOkAt: s.lastOkAt,
      initializedAt: s.initializedAt,
      initializeDurationMs: s.initializeDurationMs,
      toolsListDurationMs: s.toolsListDurationMs,
      lastError: effectiveLastError,
      toolsCached: s.tools.length,
      toolsCacheAt: s.toolsCacheAt,
      toolsPending: s.toolsPending,
      stdoutTail: dbg.stdoutTail ?? null,
      stderrTail: dbg.stderrTail ?? null
    };
  }

  private reconcileSessions() {
    const normalized = this.config.normalized;
    const authority = getMcpAuthority();
    const next = new Map<string, ServerSession>();
    if (normalized) {
      for (const srv of Object.values(normalized.servers)) {
        const existing = this.sessions.get(srv.id);
        if (existing) {
          existing.server = srv;
          next.set(srv.id, existing);
        } else {
          next.set(srv.id, {
            server: srv,
            client:
              srv.id === "tauri-ui"
                ? new McpBuiltinClient()
                : srv.type === "http"
                  ? new McpHttpClient()
                  : authority === "rust"
                    ? new McpRustClient()
                    : new McpStdioClient(),
            state: "IDLE",
            lastOkAt: null,
            initializedAt: null,
            initializeDurationMs: null,
            toolsListDurationMs: null,
            lastError: null,
            tools: [],
            toolsCacheAt: null,
            toolsPending: false
          });
        }
      }
    }
    for (const [id, old] of this.sessions) {
      if (next.has(id)) continue;
      try {
        void old.client.stop().catch(() => {});
      } catch {}
      this.lastRunningByServerId.delete(id);
    }
    this.sessions = next;
    if (this.sessions.size > 0) this.ensureRuntimePoll();
  }
}

export const mcpInspectorService = new McpInspectorService();

function validateNormalizedServers(cfg: NormalizedMcpConfig): Record<string, McpConfigIssue[]> {
  const out: Record<string, McpConfigIssue[]> = {};
  for (const [id, s] of Object.entries(cfg.servers)) {
    out[id] = validateGeneralServer(s);
  }
  return out;
}

function validateGeneralServer(server: NormalizedMcpServerConfig): McpConfigIssue[] {
  const issues: McpConfigIssue[] = [];
  if (server.type === "http") {
    if (!server.url) issues.push({ level: "error", message: "url is required", field: "url" });
    return issues;
  }

  if (!server.command) issues.push({ level: "error", message: "command is required", field: "command" });
  if (!Array.isArray(server.args)) issues.push({ level: "error", message: "args must be an array", field: "args" });
  const base = String(server.command ?? "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const looksLikePython = base === "python" || base === "python.exe" || server.command.toLowerCase().endsWith("\\python.exe");
  const hasPy = (server.args ?? []).some((a) => /\.py$/i.test(String(a)));
  if (looksLikePython && hasPy) {
    if (!(server.args ?? []).includes("-u")) issues.push({ level: "warn", message: "python args usually need -u (unbuffered)", field: "args" });
    if (String(server.env?.PYTHONUNBUFFERED ?? "") !== "1") {
      issues.push({ level: "warn", message: "python env usually needs PYTHONUNBUFFERED=1", field: "env.PYTHONUNBUFFERED" });
    }
  }
  return issues;
}
