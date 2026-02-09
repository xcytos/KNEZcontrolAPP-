import { Command, Child } from "@tauri-apps/plugin-shell";
import { McpToolDefinition } from "../../services/McpTypes";
import { logger } from "../../services/LogService";
import type { McpServerConfig } from "../config/McpHostConfig";

type McpRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: any;
};

type McpResponse =
  | { jsonrpc: "2.0"; id: string; result: any }
  | { jsonrpc: "2.0"; id: string; error: { code: number; message: string; data?: any } };

type McpRequestOptions = {
  timeoutMs?: number;
  stopOnTimeout?: boolean;
};

export class McpStdioClient {
  private child: Child | null = null;
  private stdoutBuffer = new Uint8Array(0);
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private requestChain: Promise<void> = Promise.resolve();
  private stderrLines: string[] = [];
  private lastExitCode: number | null = null;
  private lastCloseTail: string | null = null;
  private lastError: string | null = null;
  private decoder = new TextDecoder("utf-8");
  private encoder = new TextEncoder();
  private stdoutTail = "";
  private startedWith: { mode: "program"; programName: string } | { mode: "config"; serverId: string; command: string } | null = null;
  private requestFraming: "content-length" | "line" = "content-length";
  private lastTimeout:
    | {
        at: number;
        method: string;
        timeoutMs: number;
        framing: "content-length" | "line";
        stdoutBytes: number;
        stderrTail: string | null;
        stdoutTail: string | null;
      }
    | null = null;
  private lastWrite:
    | {
        at: number;
        id: string;
        method: string;
        framing: "content-length" | "line";
        bytes: number;
        preview: string;
        ok: boolean;
        error: string | null;
      }
    | null = null;

  async start(programName: string): Promise<void> {
    if (this.child) return;
    this.stdoutBuffer = new Uint8Array(0);
    this.stderrLines = [];
    this.nextId = 1;
    this.lastExitCode = null;
    this.lastCloseTail = null;
    this.lastError = null;
    this.stdoutTail = "";
    this.requestFraming = "content-length";
    this.lastTimeout = null;
    this.lastWrite = null;
    this.startedWith = { mode: "program", programName };
    const cmd = Command.create(programName, [], { encoding: "raw" });
    cmd.stdout.on("data", (chunk) => this.onStdout(chunk));
    cmd.stderr.on("data", (chunk) => this.onStderr(chunk));
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
      logger.info("mcp", "MCP process started", { programName, pid: this.child.pid });
    } catch (err) {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      logger.error("mcp", "MCP spawn failed", { programName, error: this.lastError });
      throw e;
    }
  }

  private cmdQuote(s: string): string {
    const v = String(s);
    return `"${v.replace(/"/g, '""')}"`;
  }

  async startWithConfig(server: McpServerConfig): Promise<void> {
    if (this.child) return;
    const isWin = navigator.userAgent.toLowerCase().includes("windows");
    if (!isWin) throw new Error("mcp_custom_config_windows_only");
    if (!server?.command) throw new Error("mcp_config_missing_command");
    if (!server?.cwd) throw new Error("mcp_config_missing_cwd");
    const args = Array.isArray(server.args) ? server.args : [];
    const command = server.command;
    const base = command.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const looksLikePython = base === "python.exe" || base === "python";
    const isBareCommand = !/[\\/]/.test(command);
    const envKeys = Object.keys(server.env ?? {});
    const onlyPyUnbuffered =
      envKeys.length === 0 || (envKeys.length === 1 && envKeys[0].toUpperCase() === "PYTHONUNBUFFERED");

    this.stdoutBuffer = new Uint8Array(0);
    this.stderrLines = [];
    this.nextId = 1;
    this.lastExitCode = null;
    this.lastCloseTail = null;
    this.lastError = null;
    this.stdoutTail = "";
    const framingHint = String((server.env as any)?.KNEZ_MCP_CLIENT_FRAMING ?? "").trim().toLowerCase();
    if (framingHint === "line") this.requestFraming = "line";
    else if (framingHint === "content-length" || framingHint === "content_length") this.requestFraming = "content-length";
    else this.requestFraming = "content-length";
    this.lastTimeout = null;
    this.lastWrite = null;
    this.startedWith = { mode: "config", serverId: server.id, command: server.command };

    const cmd = (() => {
      if (looksLikePython && onlyPyUnbuffered && isBareCommand) {
        return Command.create("python", args, { encoding: "raw", cwd: server.cwd, env: server.env });
      }
      const cmdArgs = args.map((a) => this.cmdQuote(a)).join(" ");
      const baseCmd = `${this.cmdQuote(command)}${cmdArgs ? ` ${cmdArgs}` : ""}`.trim();
      return Command.create("cmd", ["/d", "/s", "/c", baseCmd], { encoding: "raw", cwd: server.cwd, env: server.env });
    })();
    cmd.stdout.on("data", (chunk) => this.onStdout(chunk));
    cmd.stderr.on("data", (chunk) => this.onStderr(chunk));
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
      logger.info("mcp", "MCP process started", {
        programName: looksLikePython && onlyPyUnbuffered ? "python" : "cmd",
        serverId: server.id,
        cwd: server.cwd,
        command: server.command,
        pid: this.child.pid
      });
    } catch (err) {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      logger.error("mcp", "MCP spawn failed", {
        programName: looksLikePython && onlyPyUnbuffered ? "python" : "cmd",
        serverId: server.id,
        cwd: server.cwd,
        error: this.lastError
      });
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      logger.info("mcp", "MCP process stopping", { pid: this.child.pid, startedWith: this.startedWith });
    } catch {}
    await this.child.kill();
    this.child = null;
  }

  private appendStdout(bytes: Uint8Array) {
    if (bytes.length === 0) return;
    const next = new Uint8Array(this.stdoutBuffer.length + bytes.length);
    next.set(this.stdoutBuffer, 0);
    next.set(bytes, this.stdoutBuffer.length);
    this.stdoutBuffer = next;
    try {
      this.stdoutTail += this.decoder.decode(bytes);
      if (this.stdoutTail.length > 8000) this.stdoutTail = this.stdoutTail.slice(-8000);
    } catch {}
  }

  private indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
    if (needle.length === 0) return 0;
    if (haystack.length < needle.length) return -1;
    outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  private consume(n: number) {
    if (n <= 0) return;
    if (n >= this.stdoutBuffer.length) {
      this.stdoutBuffer = new Uint8Array(0);
      return;
    }
    this.stdoutBuffer = this.stdoutBuffer.slice(n);
  }

  private onStdout(chunk: any) {
    const bytes =
      typeof chunk === "string" ? this.encoder.encode(chunk) : chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    this.appendStdout(bytes);
    while (true) {
      const headerDelimCrlf = new Uint8Array([13, 10, 13, 10]);
      const headerDelimLf = new Uint8Array([10, 10]);
      const headerEndCrlf = this.indexOfBytes(this.stdoutBuffer, headerDelimCrlf);
      const headerEndLf = headerEndCrlf < 0 ? this.indexOfBytes(this.stdoutBuffer, headerDelimLf) : -1;
      const headerEnd = headerEndCrlf >= 0 ? headerEndCrlf : headerEndLf;
      const sepLen = headerEndCrlf >= 0 ? 4 : headerEndLf >= 0 ? 2 : 0;

      if (headerEnd < 0 && this.stdoutBuffer.length >= 8) {
        const probe = this.decoder.decode(this.stdoutBuffer.slice(0, Math.min(32, this.stdoutBuffer.length))).toLowerCase();
        if (probe.startsWith("content-length:")) return;
      }

      if (headerEnd >= 0) {
        const headerBytes = this.stdoutBuffer.slice(0, headerEnd);
        const headerText = this.decoder.decode(headerBytes);
        const m = headerText.match(/content-length:\s*(\d+)/i);
        if (!m) {
          this.consume(headerEnd + sepLen);
          continue;
        }
        const len = Number(m[1]);
        const bodyStart = headerEnd + sepLen;
        const bodyEnd = bodyStart + len;
        if (this.stdoutBuffer.length < bodyEnd) return;
        const bodyBytes = this.stdoutBuffer.slice(bodyStart, bodyEnd);
        this.consume(bodyEnd);
        try {
          const bodyText = this.decoder.decode(bodyBytes);
          const parsed = JSON.parse(bodyText) as McpResponse;
          this.onMessage(parsed);
        } catch {
          continue;
        }
        continue;
      }

      const nl = 10;
      const lineEnd = this.stdoutBuffer.indexOf(nl);
      if (lineEnd < 0) return;
      let lineBytes = this.stdoutBuffer.slice(0, lineEnd);
      this.consume(lineEnd + 1);
      if (lineBytes.length > 0 && lineBytes[lineBytes.length - 1] === 13) {
        lineBytes = lineBytes.slice(0, -1);
      }
      const line = this.decoder.decode(lineBytes).trim();
      if (!line) continue;
      if (!line.startsWith("{") && !line.startsWith("[")) continue;
      try {
        const parsed = JSON.parse(line) as McpResponse;
        this.onMessage(parsed);
      } catch {
        continue;
      }
    }
  }

  private onStderr(chunk: any) {
    const text = typeof chunk === "string" ? chunk : this.decoder.decode(chunk);
    this.stderrLines.push(text);
    if (this.stderrLines.length > 200) this.stderrLines.splice(0, this.stderrLines.length - 200);
    const tail = this.stderrLines.slice(-30).join("").trim();
    if (tail) {
      logger.debugThrottled("mcp_stderr_tail", 500, "mcp", "TAQWIN MCP stderr", { tail });
    }
  }

  private onMessage(msg: McpResponse) {
    const id = (msg as any).id;
    const key = id === undefined || id === null ? null : String(id);
    const slot = key ? this.pending.get(key) : undefined;
    if (!slot) {
      if ("error" in msg) {
        logger.warn("mcp", "MCP unsolicited error", { id: key, code: msg.error.code, message: msg.error.message });
      }
      return;
    }
    if (key) this.pending.delete(key);
    logger.debug("mcp", "MCP response", {
      id: key,
      ok: !("error" in msg),
      hasResult: "result" in msg,
      hasError: "error" in msg
    });
    if ("error" in msg) {
      const code = (msg as any)?.error?.code;
      const message = String((msg as any)?.error?.message ?? "mcp_error");
      slot.reject(new Error(code !== undefined ? `mcp_error_${code}: ${message}` : message));
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

  private buildPayload(obj: any): Uint8Array {
    const bodyText = JSON.stringify(obj);
    if (this.requestFraming === "line") {
      return this.encoder.encode(bodyText + "\n");
    }
    const bodyBytes = this.encoder.encode(bodyText);
    const headerBytes = this.encoder.encode(`Content-Length: ${bodyBytes.length}\r\n\r\n`);
    const payload = new Uint8Array(headerBytes.length + bodyBytes.length);
    payload.set(headerBytes, 0);
    payload.set(bodyBytes, headerBytes.length);
    return payload;
  }

  private async request<T = any>(method: string, params?: any, options: number | McpRequestOptions = 30000): Promise<T> {
    const run = async (): Promise<T> => {
      if (!this.child) throw new Error("mcp_not_started");
      const timeoutMs = typeof options === "number" ? options : (options.timeoutMs ?? 30000);
      const stopOnTimeout = typeof options === "number" ? true : (options.stopOnTimeout ?? true);
      const id = String(this.nextId++);
      const req: McpRequest = { jsonrpc: "2.0", id, method, params };
      const payload = this.buildPayload(req);
      const previewBytes = payload.slice(0, Math.min(160, payload.length));
      const preview = (() => {
        try {
          return this.decoder.decode(previewBytes).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        } catch {
          return "";
        }
      })();
      this.lastWrite = {
        at: Date.now(),
        id,
        method,
        framing: this.requestFraming,
        bytes: payload.length,
        preview,
        ok: false,
        error: null
      };
      let timeoutId: number | undefined;
      const p = new Promise<T>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        timeoutId = window.setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.pending.delete(id);
          if (stopOnTimeout) this.stop().catch(() => {});
          this.lastError = "mcp_request_timeout";
          const stderrTail = this.stderrLines.slice(-30).join("").trim();
          const stdoutTail = this.stdoutTail.trim();
          this.lastTimeout = {
            at: Date.now(),
            method,
            timeoutMs,
            framing: this.requestFraming,
            stdoutBytes: this.stdoutBuffer.length,
            stderrTail: stderrTail ? stderrTail.slice(-800) : null,
            stdoutTail: stdoutTail ? stdoutTail.slice(-800) : null
          };
          logger.error("mcp", "MCP request timeout", {
            pid: this.child?.pid ?? null,
            startedWith: this.startedWith,
            method,
            timeoutMs,
            framing: this.requestFraming,
            stdoutBytes: this.stdoutBuffer.length,
            lastWrite: this.lastWrite,
            stderrTail: stderrTail ? stderrTail.slice(-800) : null,
            stdoutTail: stdoutTail ? stdoutTail.slice(-800) : null
          });
          reject(new Error("mcp_request_timeout"));
        }, Math.max(1, timeoutMs));
      }).finally(() => {
        if (typeof timeoutId === "number") clearTimeout(timeoutId);
      });
      try {
        const paramsKeys =
          params && typeof params === "object" && !Array.isArray(params) ? Object.keys(params).slice(0, 12) : [];
        logger.debug("mcp", "MCP request", { id, method, paramsKeys, framing: this.requestFraming, bytes: payload.length });
        await this.child.write(Array.from(payload));
        if (this.lastWrite && this.lastWrite.id === id) this.lastWrite.ok = true;
      } catch (err) {
        const slot = this.pending.get(id);
        if (this.lastWrite && this.lastWrite.id === id) {
          this.lastWrite.ok = false;
          this.lastWrite.error = String((err as any)?.message ?? err);
        }
        if (slot) {
          this.pending.delete(id);
          const e = this.asMcpError(err);
          this.lastError = String(e?.message ?? e);
          logger.error("mcp", "MCP stdin write failed", { method, error: this.lastError });
          slot.reject(e);
        }
      }
      return p;
    };

    const chained = this.requestChain.then(run, run);
    this.requestChain = chained.then(
      () => {},
      () => {}
    );
    return chained;
  }

  async initialize(): Promise<any> {
    const res = await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "knez-control-app", version: "dev" }
      },
      { timeoutMs: 90000, stopOnTimeout: true }
    );
    logger.info("mcp", "MCP initialize ok", { framing: this.requestFraming });
    return res;
  }

  async notifyInitialized(): Promise<void> {
    if (!this.child) throw new Error("mcp_not_started");
    const msg = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
    const payload = this.buildPayload(msg);
    await this.child.write(Array.from(payload));
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const res = await this.request<{ tools?: McpToolDefinition[] }>("tools/list", {}, { timeoutMs: 60000, stopOnTimeout: true });
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.request("tools/call", { name, arguments: args ?? {} }, { timeoutMs: 180000, stopOnTimeout: true });
  }

  getDebugState() {
    return {
      running: !!this.child,
      pid: this.child?.pid ?? null,
      startedWith: this.startedWith,
      requestFraming: this.requestFraming,
      lastExitCode: this.lastExitCode,
      lastCloseTail: this.lastCloseTail,
      lastError: this.lastError,
      lastTimeout: this.lastTimeout,
      lastWrite: this.lastWrite,
      stderrTail: this.stderrLines.slice(-60).join("").trim() || null,
      stdoutTail: this.stdoutTail.trim() || null,
    };
  }
}
