import { McpToolDefinition } from "./McpTypes";
import { logger } from "./LogService";
import { mcpHostConfigService } from "./McpHostConfigService";
import { normalizeTaqwinMcpServer } from "./McpHostConfig";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

class TaqwinMcpService {
  private client: import("./McpStdioClient").McpStdioClient | null = null;
  private initialized = false;
  private toolsCache: McpToolDefinition[] | null = null;
  private toolsCacheAt: number | null = null;
  private toolsCacheTtlMs = 30000;
  private initPromise: Promise<import("./McpStdioClient").McpStdioClient> | null = null;
  private opChain: Promise<void> = Promise.resolve();
  private consecutiveFailures = 0;
  private lastRawError: string | null = null;
  private lastNormalizedError: string | null = null;
  private lastDebugState: any | null = null;
  private generation = 0;

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

  private async getClient(): Promise<import("./McpStdioClient").McpStdioClient> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    if (this.initPromise) return this.initPromise;
    const gen = this.generation;
    this.initPromise = (async () => {
      let client = this.client;
      try {
        if (!client) {
          const { McpStdioClient } = await import("./McpStdioClient");
          client = new McpStdioClient();
          this.client = client;
          const loaded = await mcpHostConfigService.load();
          const effective = loaded ?? mcpHostConfigService.getDefault();
          const selected =
            effective.config.mcpServers["taqwin"] ??
            Object.values(effective.config.mcpServers)[0];
          const server = normalizeTaqwinMcpServer(selected);
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
        this.consecutiveFailures = 0;
        this.lastRawError = null;
        this.lastNormalizedError = null;
        this.lastDebugState = client.getDebugState?.() ?? null;
        return client;
      } catch (err) {
        const raw = String((err as any)?.message ?? err);
        this.lastRawError = raw;
        this.lastDebugState = client?.getDebugState?.() ?? null;
        this.lastNormalizedError = this.normalizeError(err).message;
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
      return new Error("TAQWIN MCP is not configured. Open TAQWIN Tools → MCP Config and paste an mcpServers JSON config.");
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
      const tail = String(dbg?.stderrTail ?? dbg?.stdoutTail ?? "").trim();
      const shortTail = tail ? tail.split(/\r?\n/).slice(-4).join(" | ").slice(-220) : "";
      const suffix = shortTail ? ` Last MCP output: ${shortTail}` : "";
      return new Error(`TAQWIN MCP request timed out. Open MCP Logs.${suffix}`);
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
    return {
      running: !!this.client && this.initialized,
      initialized: this.initialized,
      consecutiveFailures: this.consecutiveFailures,
      lastRawError: this.lastRawError,
      lastNormalizedError: this.lastNormalizedError,
      debug: this.lastDebugState ?? this.client?.getDebugState?.() ?? null,
    };
  }

  async start(restart = false) {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      if (restart) {
        await this.stop();
      }
      await this.getClient();
      return this.getStatus();
    });
  }

  async stop() {
    return this.enqueue(async () => {
      this.generation++;
      await this.awaitInitSettled();
      try {
        await this.client?.stop();
      } catch {}
      this.client = null;
      this.initialized = false;
      this.toolsCache = null;
      this.toolsCacheAt = null;
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
        logger.info("mcp", "TAQWIN MCP tools/list ok", { durationMs, tools: tools.length });
        return tools;
      } catch (err) {
        if (!this.shouldRetry(err)) throw err;
        await this.backoffDelay();
        logger.warn("mcp", "TAQWIN MCP listTools failed; restarting and retrying", { error: String((err as any)?.message ?? err) });
        await this.stop();
        try {
          const client = await this.getClient();
          const tools = await client.listTools();
          this.toolsCache = tools;
          this.toolsCacheAt = Date.now();
          const durationMs = Math.round(performance.now() - startedAt);
          logger.info("mcp", "TAQWIN MCP tools/list ok (after retry)", { durationMs, tools: tools.length });
          return tools;
        } catch (err2) {
          const durationMs = Math.round(performance.now() - startedAt);
          logger.error("mcp", "TAQWIN MCP listTools failed after retry", { error: String((err2 as any)?.message ?? err2) });
          logger.error("mcp", "TAQWIN MCP tools/list audit", { durationMs, ok: false });
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
        const bytes = (() => {
          try { return JSON.stringify(res).length; } catch { return null; }
        })();
        logger.info("mcp", "TAQWIN MCP tools/call ok", { tool: name, durationMs, bytes });
        return res;
      } catch (err) {
        if (!this.shouldRetry(err)) throw err;
        await this.backoffDelay();
        logger.warn("mcp", "TAQWIN MCP callTool failed; restarting and retrying", {
          tool: name,
          error: String((err as any)?.message ?? err)
        });
        await this.stop();
        try {
          const client = await this.getClient();
          const res = await client.callTool(name, args);
          const durationMs = Math.round(performance.now() - startedAt);
          const bytes = (() => {
            try { return JSON.stringify(res).length; } catch { return null; }
          })();
          logger.info("mcp", "TAQWIN MCP tools/call ok (after retry)", { tool: name, durationMs, bytes });
          return res;
        } catch (err2) {
          const durationMs = Math.round(performance.now() - startedAt);
          logger.error("mcp", "TAQWIN MCP callTool failed after retry", {
            tool: name,
            error: String((err2 as any)?.message ?? err2)
          });
          logger.error("mcp", "TAQWIN MCP tools/call audit", { tool: name, durationMs, ok: false });
          const normalized = this.normalizeError(err2);
          this.lastRawError = String((err2 as any)?.message ?? err2);
          this.lastNormalizedError = normalized.message;
          this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
          throw normalized;
        }
      }
    });
  }

  async selfTest() {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const steps: { step: string; ok: boolean; detail?: any }[] = [];
    const startedAt = performance.now();
    try {
      await this.start(true);
      steps.push({ step: "start", ok: true });

      const tools = await this.listTools(true);
      const names = tools.map((t) => t.name);
      steps.push({ step: "tools/list", ok: tools.length > 0, detail: { tools: tools.length, names: names.slice(0, 12) } });

      const status = await this.callTool("get_server_status", { force_refresh: true, include_db_analysis: false });
      steps.push({ step: "tools/call get_server_status", ok: true, detail: status });

      const dbg = await this.callTool("debug_test", { message: "mcp_self_test" });
      steps.push({ step: "tools/call debug_test", ok: true, detail: dbg });

      return { ok: steps.every((s) => s.ok), durationMs: Math.round(performance.now() - startedAt), steps };
    } catch (e: any) {
      steps.push({ step: "error", ok: false, detail: String(e?.message ?? e) });
      return { ok: false, durationMs: Math.round(performance.now() - startedAt), steps };
    }
  }
}

export const taqwinMcpService = new TaqwinMcpService();
