import { McpToolDefinition } from "./McpTypes";
import { logger } from "./LogService";

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
  private consecutiveFailures = 0;

  private async backoffDelay(): Promise<void> {
    const n = Math.min(6, this.consecutiveFailures);
    const base = 250 * Math.pow(2, n);
    const jitter = Math.floor(Math.random() * 200);
    const delay = Math.min(5000, base + jitter);
    await new Promise((r) => setTimeout(r, delay));
  }

  private async getClient(): Promise<import("./McpStdioClient").McpStdioClient> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        if (!this.client) {
          const { McpStdioClient } = await import("./McpStdioClient");
          this.client = new McpStdioClient();
          await this.client.start("taqwin-mcp");
          this.initialized = false;
          this.toolsCache = null;
          this.toolsCacheAt = null;
        }
        if (!this.initialized) {
          await this.client.initialize();
          this.initialized = true;
        }
        this.consecutiveFailures = 0;
        return this.client;
      } catch (err) {
        this.client = null;
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

    if (/ModuleNotFoundError:\s*No module named 'config'|No module named 'config'/i.test(raw)) {
      return new Error("TAQWIN MCP failed to start (Python module path/config issue).");
    }

    if (/mcp_stdin_write_denied/i.test(raw)) {
      return new Error("TAQWIN MCP blocked: stdin_write permission denied in Tauri capabilities.");
    }

    if (/mcp_request_timeout/i.test(raw)) {
      return new Error("TAQWIN MCP request timed out. Please retry.");
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

  async listTools(forceRefresh = false): Promise<McpToolDefinition[]> {
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
      this.client = null;
      this.initialized = false;
      this.toolsCache = null;
      this.toolsCacheAt = null;
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
        throw this.normalizeError(err2);
      }
    }
  }

  async callTool(name: string, args: any): Promise<any> {
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
      this.client = null;
      this.initialized = false;
      this.toolsCache = null;
      this.toolsCacheAt = null;
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
        throw this.normalizeError(err2);
      }
    }
  }
}

export const taqwinMcpService = new TaqwinMcpService();
