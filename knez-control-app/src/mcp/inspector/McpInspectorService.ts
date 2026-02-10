import { McpStdioClient } from "../client/McpStdioClient";
import { mcpHostConfigService } from "../config/McpHostConfigService";
import type { McpConfigIssue, McpServerConfig, NormalizedMcpConfig, NormalizedMcpServerConfig } from "../config/McpHostConfig";
import { normalizeMcpConfig } from "../config/McpHostConfig";
import type { McpToolDefinition } from "../../services/McpTypes";
import { knezClient } from "../../services/KnezClient";

export type McpInspectorLifecycle = "IDLE" | "STARTING" | "INITIALIZED" | "LISTING_TOOLS" | "READY" | "ERROR";

export type McpInspectorServerStatus = {
  id: string;
  enabled: boolean;
  tags: string[];
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line";
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
  client: McpStdioClient;
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
    const env = server.env ?? {};
    if (env.TAQWIN_GOVERNANCE_SNAPSHOT_URL) return true;
    if (env.KNEZ_ENDPOINT) return true;
    return false;
  }

  private async ensureKnezHealthy(): Promise<void> {
    const snap = this.getKnezHealth();
    const ttlMs = 2500;
    if (snap.checkedAt && Date.now() - snap.checkedAt < ttlMs) {
      if (snap.ok) return;
      throw new Error(`knez_unreachable: ${snap.error ?? "health_failed"}`);
    }
    const next = await this.refreshKnezHealth(1200);
    if (next.ok) return;
    throw new Error(`knez_unreachable: ${next.error ?? "health_failed"}`);
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
    s.server = { ...s.server, ...patch, id: serverId };
    this.emit();
  }

  getClientInstance(serverId: string): McpStdioClient | null {
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
    const { config } = await mcpHostConfigService.save(raw);
    const normalized = normalizeMcpConfig({ schema_version: config.schema_version, servers: config.servers });
    this.applyConfig(JSON.stringify({ schema_version: normalized.schema_version ?? "1", servers: normalized.servers }, null, 2));
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
        await s.client.startWithConfig(this.toServerConfig(s.server));
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
      if (s.client.getDebugState().running) return;
      s.state = "STARTING";
      this.emit();
      await s.client.startWithConfig(this.toServerConfig(s.server));
      s.state = "IDLE";
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
        await s.client.startWithConfig(this.toServerConfig(s.server));
      }
      const startedAt = performance.now();
      s.state = "STARTING";
      s.lastError = null;
      this.emit();
      try {
        const res = await s.client.initialize();
        s.initializeDurationMs = Math.round(performance.now() - startedAt);
        s.initializedAt = Date.now();
        s.lastOkAt = Date.now();
        s.state = "READY";
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
      const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : waitForResult ? 15000 : 60000;
      const startedAt = performance.now();
      s.state = "LISTING_TOOLS";
      s.toolsPending = true;
      this.emit();
      try {
        const tools = await s.client.listTools({ timeoutMs, logTimeoutLevel: waitForResult ? "warn" : "debug" });
        s.tools = tools;
        s.toolsCacheAt = Date.now();
        s.toolsListDurationMs = Math.round(performance.now() - startedAt);
        s.lastOkAt = Date.now();
        s.state = "READY";
        s.toolsPending = false;
        s.lastError = null;
        this.emit();
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

  async callTool(serverId: string, name: string, args: any, timeoutMs: number): Promise<{ result: any; durationMs: number }> {
    return this.enqueue(serverId, async () => {
      const s = this.sessions.get(serverId);
      if (!s) throw new Error("mcp_server_not_found");
      if (!s.client.getDebugState().running) throw new Error("mcp_not_started");
      if (this.requiresKnez(s.server)) {
        await this.ensureKnezHealthy();
      }
      const startedAt = performance.now();
      const res = await s.client.callTool(name, args, { timeoutMs });
      s.lastOkAt = Date.now();
      this.emit();
      return { result: res, durationMs: Math.round(performance.now() - startedAt) };
    });
  }

  private toServerConfig(s: NormalizedMcpServerConfig): McpServerConfig {
    return { id: s.id, command: s.command, args: s.args, env: s.env, cwd: s.cwd, enabled: s.enabled, tags: s.tags };
  }

  private buildStatus(s: ServerSession): McpInspectorServerStatus {
    const dbg = s.client.getDebugState();
    return {
      id: s.server.id,
      enabled: s.server.enabled,
      tags: s.server.tags,
      command: s.server.command,
      args: s.server.args,
      cwd: s.server.cwd,
      env: s.server.env,
      state: s.state,
      pid: dbg.pid ?? null,
      running: dbg.running,
      framing: dbg.requestFraming,
      lastOkAt: s.lastOkAt,
      initializedAt: s.initializedAt,
      initializeDurationMs: s.initializeDurationMs,
      toolsListDurationMs: s.toolsListDurationMs,
      lastError: s.lastError ?? dbg.lastError ?? null,
      toolsCached: s.tools.length,
      toolsCacheAt: s.toolsCacheAt,
      toolsPending: s.toolsPending,
      stdoutTail: dbg.stdoutTail ?? null,
      stderrTail: dbg.stderrTail ?? null
    };
  }

  private reconcileSessions() {
    const normalized = this.config.normalized;
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
            client: new McpStdioClient(),
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
    }
    this.sessions = next;
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
