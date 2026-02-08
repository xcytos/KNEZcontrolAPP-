import { Command, Child } from "@tauri-apps/plugin-shell";
import { McpToolDefinition } from "./McpTypes";
import { logger } from "./LogService";

type McpRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: any;
};

type McpResponse =
  | { jsonrpc: "2.0"; id: string; result: any }
  | { jsonrpc: "2.0"; id: string; error: { code: number; message: string; data?: any } };

export class McpStdioClient {
  private child: Child | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private stderrLines: string[] = [];
  private lastExitCode: number | null = null;
  private lastCloseTail: string | null = null;
  private lastError: string | null = null;

  async start(programName: string): Promise<void> {
    if (this.child) return;
    this.buffer = "";
    this.stderrLines = [];
    this.nextId = 1;
    this.lastExitCode = null;
    this.lastCloseTail = null;
    this.lastError = null;
    const cmd = Command.create(programName);
    cmd.stdout.on("data", (chunk) => this.onStdout(String(chunk)));
    cmd.stderr.on("data", (chunk) => this.onStderr(String(chunk)));
    cmd.on("close", (evt) => {
      const stderrTail = this.stderrLines.slice(-12).join("");
      this.lastExitCode = typeof evt.code === "number" ? evt.code : null;
      this.lastCloseTail = stderrTail ? stderrTail.trim() : null;
      this.lastError = `mcp_process_closed_${evt.code ?? "null"}${stderrTail ? `: ${stderrTail.trim()}` : ""}`;
      const err = new Error(
        `mcp_process_closed_${evt.code ?? "null"}${stderrTail ? `: ${stderrTail.trim()}` : ""}`
      );
      logger.error("mcp", "MCP process closed", { code: evt.code ?? null, stderrTail: stderrTail.trim() || null });
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.child = null;
    });
    cmd.on("error", (err) => {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      logger.error("mcp", "MCP spawn error", { error: this.lastError });
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
      this.child = null;
    });
    try {
      this.child = await cmd.spawn();
      logger.info("mcp", "MCP process started", { programName });
    } catch (err) {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      logger.error("mcp", "MCP spawn failed", { programName, error: this.lastError });
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    await this.child.kill();
    this.child = null;
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const headerBlock = this.buffer.slice(0, headerEnd);
      const m = headerBlock.match(/content-length:\s*(\d+)/i);
      if (!m) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + len;
      if (this.buffer.length < bodyEnd) return;
      const body = this.buffer.slice(bodyStart, bodyEnd);
      this.buffer = this.buffer.slice(bodyEnd);
      try {
        const parsed = JSON.parse(body) as McpResponse;
        this.onMessage(parsed);
      } catch {
        continue;
      }
    }
  }

  private onStderr(chunk: string) {
    this.stderrLines.push(chunk);
    if (this.stderrLines.length > 200) this.stderrLines.splice(0, this.stderrLines.length - 200);
    const tail = this.stderrLines.slice(-30).join("").trim();
    if (tail) {
      logger.debugThrottled("mcp_stderr_tail", 500, "mcp", "TAQWIN MCP stderr", { tail });
    }
  }

  private onMessage(msg: McpResponse) {
    const slot = this.pending.get(msg.id);
    if (!slot) return;
    this.pending.delete(msg.id);
    if ("error" in msg) {
      slot.reject(new Error(msg.error.message));
    } else {
      slot.resolve(msg.result);
    }
  }

  private asMcpError(err: any): Error {
    const msg = String(err?.message ?? err);
    if (/stdin[_-]?write.*not allowed/i.test(msg) || /allow-stdin-write/i.test(msg)) {
      return new Error(`mcp_stdin_write_denied: ${msg}`);
    }
    return new Error(msg);
  }

  private async request<T = any>(method: string, params?: any, timeoutMs = 30000): Promise<T> {
    if (!this.child) throw new Error("mcp_not_started");
    const id = String(this.nextId++);
    const req: McpRequest = { jsonrpc: "2.0", id, method, params };
    const body = JSON.stringify(req);
    const header = `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n`;
    const payload = header + body;
    let timeoutId: number | undefined;
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      timeoutId = window.setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        this.stop().catch(() => {});
        this.lastError = "mcp_request_timeout";
        logger.error("mcp", "MCP request timeout", { method, timeoutMs });
        reject(new Error("mcp_request_timeout"));
      }, Math.max(1, timeoutMs));
    }).finally(() => {
      if (typeof timeoutId === "number") clearTimeout(timeoutId);
    });
    try {
      logger.debug("mcp", "MCP request", { id, method });
      await this.child.write(payload);
    } catch (err) {
      const slot = this.pending.get(id);
      if (slot) {
        this.pending.delete(id);
        const e = this.asMcpError(err);
        this.lastError = String(e?.message ?? e);
        logger.error("mcp", "MCP stdin write failed", { method, error: this.lastError });
        slot.reject(e);
      }
    }
    return p;
  }

  async initialize(): Promise<any> {
    return await this.request("initialize", {}, 15000);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const res = await this.request<{ tools?: McpToolDefinition[] }>("tools/list", {}, 20000);
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.request("tools/call", { name, arguments: args ?? {} }, 120000);
  }

  getDebugState() {
    return {
      running: !!this.child,
      lastExitCode: this.lastExitCode,
      lastCloseTail: this.lastCloseTail,
      lastError: this.lastError,
      stderrTail: this.stderrLines.slice(-60).join("").trim() || null,
    };
  }
}
