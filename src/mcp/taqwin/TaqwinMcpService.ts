import { McpToolDefinition } from "../../services/McpTypes";
import { logger } from "../../services/LogService";
import { mcpHostConfigService } from "../config/McpHostConfigService";
import { normalizeTaqwinMcpServer } from "../config/McpHostConfig";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

export function resolveTaqwinActivationToolName(
  tools: Array<{ name: string }>
): "activate_taqwin_unified_consciousness" | "taqwin_activate" | null {
  const names = new Set((tools ?? []).map((t) => t.name));
  if (names.has("activate_taqwin_unified_consciousness")) return "activate_taqwin_unified_consciousness";
  if (names.has("taqwin_activate")) return "taqwin_activate";
  return null;
}

class TaqwinMcpService {
  private client: import("../client/McpStdioClient").McpStdioClient | null = null;
  private initialized = false;
  private toolsCache: McpToolDefinition[] | null = null;
  private toolsCacheAt: number | null = null;
  private toolsCacheTtlMs = 30000;
  private initPromise: Promise<import("../client/McpStdioClient").McpStdioClient> | null = null;
  private opChain: Promise<void> = Promise.resolve();
  private consecutiveFailures = 0;
  private lastRawError: string | null = null;
  private lastNormalizedError: string | null = null;
  private lastDebugState: any | null = null;
  private generation = 0;
  private framingPreference: "line" | "content-length" = "content-length";
  private state: "down" | "starting" | "running" | "error" = "down";
  private lastStartAt: number | null = null;
  private lastOkAt: number | null = null;
  private listeners = new Set<(status: ReturnType<TaqwinMcpService["getStatus"]>) => void>();

  subscribe(listener: (status: ReturnType<TaqwinMcpService["getStatus"]>) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getStatus());
    } catch {}
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitStatus() {
    const snap = this.getStatus();
    for (const l of this.listeners) {
      try {
        l(snap);
      } catch {}
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.opChain.then(fn, fn);
    this.opChain = p.then(
      () => {},
      () => {}
    );
    return p;
  }

  private async backoffDelay(): Promise<void> {
    const n = Math.min(6, this.consecutiveFailures);
    const base = 250 * Math.pow(2, n);
    const jitter = Math.floor(Math.random() * 200);
    const delay = Math.min(5000, base + jitter);
    await new Promise((r) => setTimeout(r, delay));
  }

  private async awaitInitSettled(): Promise<void> {
    const p = this.initPromise;
    if (!p) return;
    try {
      await p;
    } catch {
    }
  }

  private async getClient(): Promise<import("../client/McpStdioClient").McpStdioClient> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    if (this.initPromise) return this.initPromise;
    const gen = this.generation;
    this.state = "starting";
    this.lastStartAt = Date.now();
    this.emitStatus();
    this.initPromise = (async () => {
      let client = this.client;
      try {
        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (!client) {
              const { McpStdioClient } = await import("../client/McpStdioClient");
              client = new McpStdioClient();
              this.client = client;
              const loaded = await mcpHostConfigService.load();
              const effective = loaded ?? mcpHostConfigService.getDefault();
              const selected =
                effective.config.servers["taqwin"] ??
                Object.values(effective.config.servers)[0];
              const server = normalizeTaqwinMcpServer(selected);
              server.env = {
                ...(server.env ?? {}),
                KNEZ_MCP_CLIENT_FRAMING: this.framingPreference,
                TAQWIN_MCP_OUTPUT_MODE: this.framingPreference
              };
              await client.startWithConfig(server);
              this.initialized = false;
              this.toolsCache = null;
              this.toolsCacheAt = null;
            }
            if (!this.initialized) {
              if (gen !== this.generation) throw new Error("mcp_restart_in_progress");
              await client.initialize();
              try {
                await client.notifyInitialized?.();
              } catch {}
              this.initialized = true;
            }
            this.state = "running";
            this.lastOkAt = Date.now();
            this.emitStatus();
            this.consecutiveFailures = 0;
            this.lastRawError = null;
            this.lastNormalizedError = null;
            this.lastDebugState = client.getDebugState?.() ?? null;
            return client;
          } catch (err) {
            lastErr = err;
            const raw = String((err as any)?.message ?? err);
            const dbg = client?.getDebugState?.() ?? this.lastDebugState;
            const lastTimeout = dbg?.lastTimeout;
            const canFlip =
              attempt === 0 &&
              raw.includes("mcp_request_timeout") &&
              lastTimeout?.method === "initialize" &&
              lastTimeout?.stdoutBytes === 0;
            if (!canFlip) throw err;
            this.framingPreference = this.framingPreference === "line" ? "content-length" : "line";
            logger.warn("mcp", "TAQWIN MCP switching client framing after initialize stall", {
              nextFraming: this.framingPreference
            });
            try {
              await client?.stop?.();
            } catch {}
            if (this.client === client) this.client = null;
            client = null;
            this.initialized = false;
            this.toolsCache = null;
            this.toolsCacheAt = null;
          }
        }
        throw lastErr;
      } catch (err) {
        const raw = String((err as any)?.message ?? err);
        this.lastRawError = raw;
        this.lastDebugState = client?.getDebugState?.() ?? null;
        this.lastNormalizedError = this.normalizeError(err).message;
        this.state = "error";
        this.emitStatus();
        try {
          await client?.stop?.();
        } catch {}
        if (this.client === client) this.client = null;
        this.initialized = false;
        this.toolsCache = null;
        this.toolsCacheAt = null;
        this.consecutiveFailures = Math.min(20, this.consecutiveFailures + 1);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();
    return this.initPromise;
  }

  private shouldRetry(err: any): boolean {
    const msg = String(err?.message ?? err);
    return /mcp_process_closed_|mcp_not_started|mcp_request_timeout/i.test(msg);
  }

  private normalizeError(err: any): Error {
    const raw = String(err?.message ?? err);

    if (/mcp_unavailable_non_tauri/i.test(raw)) {
      return new Error("TAQWIN tools require the desktop app (Tauri).");
    }

    if (/mcp_config_missing/i.test(raw)) {
      return new Error("TAQWIN MCP is not configured. Open TAQWIN Tools → MCP Config and paste a servers JSON config.");
    }

    if (/mcp_custom_config_windows_only/i.test(raw)) {
      return new Error("Custom MCP server configs are currently supported on Windows only.");
    }

    if (/mcp_config_missing_command|mcp_config_missing_cwd/i.test(raw)) {
      return new Error(`Invalid MCP config: ${raw}`);
    }

    if (/ModuleNotFoundError:\s*No module named 'config'|No module named 'config'/i.test(raw)) {
      return new Error("TAQWIN MCP failed to start (Python module path/config issue).");
    }

    if (/mcp_stdin_write_denied/i.test(raw)) {
      return new Error("TAQWIN MCP blocked: stdin_write permission denied in Tauri capabilities.");
    }

    if (/mcp_request_timeout/i.test(raw)) {
      const dbg = this.lastDebugState ?? this.client?.getDebugState?.() ?? null;
      const m = String(dbg?.lastTimeout?.method ?? "").trim();
      const pid = dbg?.childPid ?? dbg?.pid ?? null;
      const framing = String(dbg?.requestFraming ?? this.framingPreference);
      const tail = String(dbg?.stderrTail ?? dbg?.stdoutTail ?? "").trim();
      const shortTail = tail ? tail.split(/\r?\n/).slice(-4).join(" | ").slice(-220) : "";
      const suffix = shortTail ? ` Last MCP output: ${shortTail}` : "";
      const meta = ` method=${m || "unknown"} framing=${framing}${pid ? ` pid=${pid}` : ""}`;
      return new Error(`TAQWIN MCP request timed out (${meta}). Open MCP Logs.${suffix}`);
    }

    if (/mcp_process_closed_/i.test(raw)) {
      const m = raw.match(/mcp_process_closed_([^\s:]+)(?::\s*([\s\S]*))?/i);
      const code = m?.[1] ?? "unknown";
      const tail = (m?.[2] ?? "").trim();
      const detail = tail ? ` Details: ${tail}` : "";
      return new Error(`TAQWIN MCP closed unexpectedly (code ${code}). Please retry.${detail}`);
    }

    return err instanceof Error ? err : new Error(raw);
  }

  getStatus() {
    const debug = this.lastDebugState ?? this.client?.getDebugState?.() ?? null;
    return {
      state: this.state,
      processAlive: !!this.client,
      lastStartAt: this.lastStartAt,
      lastOkAt: this.lastOkAt,
      framing: (debug as any)?.requestFraming ?? this.framingPreference,
      lastError: this.lastNormalizedError ?? this.lastRawError,
      running: !!this.client && this.initialized,
      initialized: this.initialized,
      consecutiveFailures: this.consecutiveFailures,
      lastRawError: this.lastRawError,
      lastNormalizedError: this.lastNormalizedError,
      debug,
    };
  }

  async start(restart = false) {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      if (restart) {
        await this.stopInternal();
      }
      await this.getClient();
      return this.getStatus();
    });
  }

  private async stopInternal() {
    this.generation++;
    await this.awaitInitSettled();
    try {
      await this.client?.stop();
    } catch {}
    this.client = null;
    this.initialized = false;
    this.toolsCache = null;
    this.toolsCacheAt = null;
    this.state = "down";
    this.emitStatus();
  }

  async stop() {
    return this.enqueue(async () => {
      await this.stopInternal();
    });
  }

  async listTools(forceRefresh = false): Promise<McpToolDefinition[]> {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      if (this.toolsCache && !forceRefresh && this.toolsCacheAt && Date.now() - this.toolsCacheAt < this.toolsCacheTtlMs) {
        return this.toolsCache;
      }
      const startedAt = performance.now();
      try {
        const client = await this.getClient();
        const tools = await client.listTools();
        this.toolsCache = tools;
        this.toolsCacheAt = Date.now();
        const durationMs = Math.round(performance.now() - startedAt);
        this.lastOkAt = Date.now();
        this.emitStatus();
        logger.info("mcp", "TAQWIN MCP tools/list ok", { durationMs, tools: tools.length });
        logger.info("mcp_audit", "tools/list", { ok: true, durationMs, tools: tools.length });
        return tools;
      } catch (err) {
        if (!this.shouldRetry(err)) throw err;
        await this.backoffDelay();
        try {
          const dbg = this.client?.getDebugState?.() ?? this.lastDebugState;
          const lastTimeout = dbg?.lastTimeout;
          if (
            String((err as any)?.message ?? err).includes("mcp_request_timeout") &&
            lastTimeout?.method === "tools/list" &&
            lastTimeout?.stdoutBytes === 0
          ) {
            this.framingPreference = this.framingPreference === "line" ? "content-length" : "line";
            logger.warn("mcp", "TAQWIN MCP switching client framing after tools/list stall", {
              nextFraming: this.framingPreference
            });
          }
        } catch {}
        logger.warn("mcp", "TAQWIN MCP listTools failed; restarting and retrying", { error: String((err as any)?.message ?? err) });
        await this.stopInternal();
        try {
          const client = await this.getClient();
          const tools = await client.listTools();
          this.toolsCache = tools;
          this.toolsCacheAt = Date.now();
          const durationMs = Math.round(performance.now() - startedAt);
          this.lastOkAt = Date.now();
          this.emitStatus();
          logger.info("mcp", "TAQWIN MCP tools/list ok (after retry)", { durationMs, tools: tools.length });
          logger.info("mcp_audit", "tools/list", { ok: true, durationMs, tools: tools.length, afterRetry: true });
          return tools;
        } catch (err2) {
          const durationMs = Math.round(performance.now() - startedAt);
          logger.error("mcp", "TAQWIN MCP listTools failed after retry", { error: String((err2 as any)?.message ?? err2) });
          logger.error("mcp", "TAQWIN MCP tools/list audit", { durationMs, ok: false });
          logger.error("mcp_audit", "tools/list", { ok: false, durationMs, error: String((err2 as any)?.message ?? err2), afterRetry: true });
          const normalized = this.normalizeError(err2);
          this.lastRawError = String((err2 as any)?.message ?? err2);
          this.lastNormalizedError = normalized.message;
          this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
          throw normalized;
        }
      }
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      const startedAt = performance.now();
      try {
        const client = await this.getClient();
        const res = await client.callTool(name, args);
        const durationMs = Math.round(performance.now() - startedAt);
        this.lastOkAt = Date.now();
        this.emitStatus();
        const bytes = (() => {
          try { return JSON.stringify(res).length; } catch { return null; }
        })();
        const argsBytes = (() => {
          try { return JSON.stringify(args ?? {}).length; } catch { return null; }
        })();
        logger.info("mcp", "TAQWIN MCP tools/call ok", { tool: name, durationMs, bytes });
        logger.info("mcp_audit", "tools/call", { ok: true, tool: name, durationMs, argsBytes, resultBytes: bytes });
        return res;
      } catch (err) {
        if (!this.shouldRetry(err)) throw err;
        await this.backoffDelay();
        logger.warn("mcp", "TAQWIN MCP callTool failed; restarting and retrying", {
          tool: name,
          error: String((err as any)?.message ?? err)
        });
        await this.stopInternal();
        try {
          const client = await this.getClient();
          const res = await client.callTool(name, args);
          const durationMs = Math.round(performance.now() - startedAt);
          this.lastOkAt = Date.now();
          this.emitStatus();
          const bytes = (() => {
            try { return JSON.stringify(res).length; } catch { return null; }
          })();
          const argsBytes = (() => {
            try { return JSON.stringify(args ?? {}).length; } catch { return null; }
          })();
          logger.info("mcp", "TAQWIN MCP tools/call ok (after retry)", { tool: name, durationMs, bytes });
          logger.info("mcp_audit", "tools/call", { ok: true, tool: name, durationMs, argsBytes, resultBytes: bytes, afterRetry: true });
          return res;
        } catch (err2) {
          const durationMs = Math.round(performance.now() - startedAt);
          logger.error("mcp", "TAQWIN MCP callTool failed after retry", {
            tool: name,
            error: String((err2 as any)?.message ?? err2)
          });
          logger.error("mcp", "TAQWIN MCP tools/call audit", { tool: name, durationMs, ok: false });
          logger.error("mcp_audit", "tools/call", { ok: false, tool: name, durationMs, error: String((err2 as any)?.message ?? err2), afterRetry: true });
          const normalized = this.normalizeError(err2);
          this.lastRawError = String((err2 as any)?.message ?? err2);
          this.lastNormalizedError = normalized.message;
          this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
          throw normalized;
        }
      }
    });
  }

  async activateTaqwin(opts: { sessionId?: string; knezEndpoint?: string; checkpoint?: string } = {}) {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      const tools = await this.listTools(true);
      const tool = resolveTaqwinActivationToolName(tools);
      if (tool === "taqwin_activate") {
        const sid = opts.sessionId ?? "";
        const endpoint = opts.knezEndpoint ?? "";
        const cp = opts.checkpoint ?? "CP01_MCP_REGISTRY";
        return await this.callTool(tool, { session_id: sid, knez_endpoint: endpoint, checkpoint: cp });
      }
      if (tool === "activate_taqwin_unified_consciousness") {
        return await this.callTool(tool, {
          level: "superintelligence",
          enable_learning: true,
          enable_insights: true,
          enable_delegation: true,
          enable_performance_monitoring: true,
          enable_superintelligence: true,
          enable_council: true,
          enable_fallbacks: true,
          performance_mode: "optimized",
          delegation_strategy: "adaptive",
          persistent_mode: true,
          memory_depth: 50,
        });
      }
      throw new Error("taqwin_activate_tool_missing");
    });
  }

  async selfTest() {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const steps: { step: string; ok: boolean; durationMs?: number; detail?: any }[] = [];
    const startedAt = performance.now();
    try {
      const t0 = performance.now();
      await this.start(true);
      steps.push({ step: "start", ok: true, durationMs: Math.round(performance.now() - t0) });

      const t1 = performance.now();
      const tools = await this.listTools(true);
      const names = tools.map((t) => t.name);
      steps.push({
        step: "tools/list",
        ok: tools.length > 0,
        durationMs: Math.round(performance.now() - t1),
        detail: { tools: tools.length, names: names.slice(0, 12) }
      });

      const t2 = performance.now();
      const status = await this.callTool("get_server_status", { force_refresh: true, include_db_analysis: false });
      steps.push({ step: "tools/call get_server_status", ok: true, durationMs: Math.round(performance.now() - t2), detail: status });

      const t3 = performance.now();
      const dbg = await this.callTool("debug_test", { message: "mcp_self_test" });
      steps.push({ step: "tools/call debug_test", ok: true, durationMs: Math.round(performance.now() - t3), detail: dbg });

      return { ok: steps.every((s) => s.ok), durationMs: Math.round(performance.now() - startedAt), steps };
    } catch (e: any) {
      steps.push({ step: "error", ok: false, detail: String(e?.message ?? e) });
      return { ok: false, durationMs: Math.round(performance.now() - startedAt), steps };
    }
  }
}

export const taqwinMcpService = new TaqwinMcpService();
