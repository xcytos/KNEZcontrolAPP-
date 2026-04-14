import { Command, Child } from "@tauri-apps/plugin-shell";
import { McpToolDefinition } from "../../services/McpTypes";
import { logger } from "../../services/LogService";
import { isStdioServer, type McpServerConfig, type McpStdioServerConfig } from "../config/McpHostConfig";
import type { McpTrafficEvent } from "../inspector/McpTraffic";
import { getMcpAuthority } from "../authority";
import { classifyMcpTimeout } from "./classifyTimeout";
import { inferInitializeTimeoutMs, inferStdioPreferredFraming } from "./stdioHeuristics";

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
  logTimeoutLevel?: "error" | "warn" | "debug" | "none";
  logTimeoutMessage?: string;
  silentResponseLog?: boolean;
};

type StartedWith =
  | { mode: "program"; programName: string }
  | { mode: "config"; serverId: string; command: string }
  | null;

export class McpStdioClient {
  private child: Child | null = null;
  private stdoutBuffer = new Uint8Array(0);
  private nextId = 1;
  private pending = new Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: any) => void;
      method: string;
      silentResponseLog: boolean;
      pidAtSend: number | null;
      startedWithAtSend: StartedWith;
      framingAtSend: "content-length" | "line";
    }
  >();
  private requestChain: Promise<void> = Promise.resolve();
  private stderrLines: string[] = [];
  private lastExitCode: number | null = null;
  private lastCloseTail: string | null = null;
  private lastError: string | null = null;
  private decoder = new TextDecoder("utf-8");
  private encoder = new TextEncoder();
  private stdoutTail = "";
  private traffic: McpTrafficEvent[] = [];
  private trafficLimit = 800;
  private lastConfig: McpStdioServerConfig | null = null;
  private startedWith: StartedWith = null;
  private requestFraming: "content-length" | "line" = "content-length";
  private hasWrittenRequest = false;
  private lockedRequestFraming: "content-length" | "line" | null = null;
  private initializeCompleted = false;
  private initializedNotificationSent = false;
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

  private setRequestFraming(next: "content-length" | "line") {
    if (this.hasWrittenRequest) return;
    this.requestFraming = next;
  }

  async start(programName: string): Promise<void> {
    if (this.child) return;
    this.stdoutBuffer = new Uint8Array(0);
    this.stderrLines = [];
    this.nextId = 1;
    this.lastExitCode = null;
    this.lastCloseTail = null;
    this.lastError = null;
    this.stdoutTail = "";
    this.traffic = [];
    this.requestFraming = "content-length";
    this.hasWrittenRequest = false;
    this.lockedRequestFraming = null;
    this.initializeCompleted = false;
    this.initializedNotificationSent = false;
    this.lastTimeout = null;
    this.lastWrite = null;
    this.startedWith = { mode: "program", programName };
    this.lastConfig = null;
    const cmd = Command.create(programName, [], { encoding: "raw" });
    cmd.stdout.on("data", (chunk) => this.onStdout(chunk));
    cmd.stderr.on("data", (chunk) => this.onStderr(chunk));
    cmd.on("close", (evt) => {
      const stderrTail = this.stderrLines.slice(-12).join("");
      this.lastExitCode = typeof evt.code === "number" ? evt.code : null;
      this.lastCloseTail = stderrTail ? stderrTail.trim() : null;
      this.lastError = `mcp_process_closed_${evt.code ?? "null"}${stderrTail ? `: ${stderrTail.trim()}` : ""}`;
      this.pushTraffic({ kind: "process_closed", at: Date.now(), code: this.lastExitCode });
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
      this.pushTraffic({ kind: "spawn_error", at: Date.now(), message: this.lastError });
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

  async startWithConfig(server: McpServerConfig): Promise<void> {
    if (this.child) return;
    if (getMcpAuthority() === "rust") throw new Error("mcp_authority_rust_enabled");
    const _w = window as any;
    if (!_w.__TAURI_INTERNALS__ && !_w.__TAURI__ && !_w.__TAURI_IPC__) {
      throw new Error("mcp_unavailable_non_tauri");
    }
    const ua = navigator.userAgent.toLowerCase();
    const isWin = ua.includes("windows");
    
    if (!isStdioServer(server)) throw new Error("mcp_config_invalid_type: expected stdio");
    if (!server.command) throw new Error("mcp_config_missing_command");
    
    const args = Array.isArray(server.args) ? server.args : [];
    const command = server.command;

    this.stdoutBuffer = new Uint8Array(0);
    this.stderrLines = [];
    this.nextId = 1;
    this.lastExitCode = null;
    this.lastCloseTail = null;
    this.lastError = null;
    this.stdoutTail = "";
    this.traffic = [];
    this.hasWrittenRequest = false;
    this.lockedRequestFraming = null;
    this.initializeCompleted = false;
    this.initializedNotificationSent = false;
    this.lastConfig = { ...server, args: args.slice(), env: { ...(server.env ?? {}) } };
    this.setRequestFraming(inferStdioPreferredFraming({ command: server.command, args, env: server.env ?? null }));
    this.lastTimeout = null;
    this.lastWrite = null;
    this.startedWith = { mode: "config", serverId: server.id, command: server.command };

    const cmd = isWin
      ? Command.create("cmd", ["/d", "/s", "/c", command, ...args], { encoding: "raw", cwd: server.cwd, env: server.env })
      : Command.create("sh", ["-lc", [command, ...args].map((s) => String(s ?? "")).join(" ")], {
          encoding: "raw",
          cwd: server.cwd,
          env: server.env
        });
    cmd.stdout.on("data", (chunk) => this.onStdout(chunk));
    cmd.stderr.on("data", (chunk) => this.onStderr(chunk));
    cmd.on("close", (evt) => {
      const stderrTail = this.stderrLines.slice(-12).join("");
      this.lastExitCode = typeof evt.code === "number" ? evt.code : null;
      this.lastCloseTail = stderrTail ? stderrTail.trim() : null;
      this.lastError = `mcp_process_closed_${evt.code ?? "null"}${stderrTail ? `: ${stderrTail.trim()}` : ""}`;
      this.pushTraffic({ kind: "process_closed", at: Date.now(), code: this.lastExitCode });
      const err = new Error(
        `mcp_process_closed_${evt.code ?? "null"}${stderrTail ? `: ${stderrTail.trim()}` : ""}`
      );
      logger.error("mcp", "MCP process closed", { code: evt.code ?? null, stderrTail: stderrTail.trim() || null });
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.child = null;
      this.initializeCompleted = false;
      this.initializedNotificationSent = false;
    });
    cmd.on("error", (err) => {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      this.pushTraffic({ kind: "spawn_error", at: Date.now(), message: this.lastError });
      logger.error("mcp", "MCP spawn error", { error: this.lastError });
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
      this.child = null;
      this.initializeCompleted = false;
      this.initializedNotificationSent = false;
    });
    try {
      this.child = await cmd.spawn();
      logger.info("mcp", "MCP process started", {
        programName: "cmd",
        serverId: server.id,
        cwd: server.cwd,
        command: server.command,
        pid: this.child.pid
      });
    } catch (err) {
      const e = this.asMcpError(err);
      this.lastError = String(e?.message ?? e);
      logger.error("mcp", "MCP spawn failed", {
        programName: "cmd",
        serverId: server.id,
        cwd: server.cwd,
        error: this.lastError
      });
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    const pid = this.child.pid ?? null;
    if (this.pending.size > 0) {
      const leak = this.pending.size;
      this.lastError = `mcp_pending_leak_detected:${leak}`;
      try {
        logger.warn("mcp", "MCP pending leak detected on stop", { pid, startedWith: this.startedWith, pending: leak });
      } catch {}
    }
    try {
      logger.info("mcp", "MCP process stopping", { pid, startedWith: this.startedWith });
    } catch {}
    try {
      await this.request("shutdown", {}, { timeoutMs: 1200, stopOnTimeout: false, logTimeoutLevel: "none", silentResponseLog: true });
    } catch {}
    try {
      const msg = { jsonrpc: "2.0", method: "exit", params: {} };
      const payload = this.buildPayload(msg);
      logger.debug("mcp", "MCP notify exit", { framing: this.requestFraming });
      await this.child.write(Array.from(payload));
    } catch {}
    try {
      await this.child.kill();
      this.child = null;
      this.initializeCompleted = false;
      this.initializedNotificationSent = false;
      return;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      this.lastError = msg;
      const isWin = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent ?? "");
      if (pid && isWin) {
        try {
          const res = await Command.create("exec", ["/PID", String(pid), "/T", "/F"], { encoding: "utf-8" }).execute();
          const code = Number((res as any)?.code ?? 1);
          if (code === 0) {
            this.child = null;
            this.initializeCompleted = false;
            this.initializedNotificationSent = false;
            return;
          }
        } catch {}
      }
      try {
        logger.warn("mcp", "MCP stop failed", { pid, error: msg });
      } catch {}
      return;
    }
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
    const decoded = (() => {
      try {
        return this.decoder.decode(bytes);
      } catch {
        return "";
      }
    })();
    if (decoded) this.pushTraffic({ kind: "raw_stdout", at: Date.now(), text: decoded });
    try {
      const preview = (() => {
        try {
          return this.decoder.decode(bytes.slice(0, Math.min(200, bytes.length))).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        } catch {
          return "";
        }
      })();
      logger.debugThrottled("mcp_stdout_chunk", 250, "mcp", "MCP stdout chunk", { bytes: bytes.length, preview });
    } catch {}
    this.appendStdout(bytes);
    while (true) {
      const clPrefix = new Uint8Array([67, 111, 110, 116, 101, 110, 116, 45, 76, 101, 110, 103, 116, 104, 58]); // "Content-Length:"
      const clAt = this.indexOfBytes(this.stdoutBuffer, clPrefix);
      if (clAt > 0) {
        this.consume(clAt);
        continue;
      }

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
        } catch (e) {
          try {
            const preview = (() => {
              try {
                return this.decoder.decode(bodyBytes.slice(0, Math.min(240, bodyBytes.length))).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
              } catch {
                return "";
              }
            })();
            logger.warn("mcp", "MCP response parse failed", { framing: "content-length", bytes: bodyBytes.length, preview });
            this.pushTraffic({
              kind: "parse_error",
              at: Date.now(),
              framing: "content-length",
              detail: "JSON.parse failed",
              preview
            });
          } catch {}
          continue;
        }
        continue;
      }

      const nl = 10;
      const lineEnd = this.stdoutBuffer.indexOf(nl);
      if (lineEnd < 0) {
        if (this.stdoutBuffer.length > 0 && this.stdoutBuffer.length <= 200000) {
          const whole = this.decoder.decode(this.stdoutBuffer).trim();
          if ((whole.startsWith("{") && whole.endsWith("}")) || (whole.startsWith("[") && whole.endsWith("]"))) {
            try {
              const parsed = JSON.parse(whole) as McpResponse;
              this.consume(this.stdoutBuffer.length);
              this.onMessage(parsed);
              continue;
            } catch {}
          }
        }
        return;
      }
      let lineBytes = this.stdoutBuffer.slice(0, lineEnd);
      this.consume(lineEnd + 1);
      if (lineBytes.length > 0 && lineBytes[lineBytes.length - 1] === 13) {
        lineBytes = lineBytes.slice(0, -1);
      }
      let line = this.decoder.decode(lineBytes).trim();
      if (!line) continue;
      if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
      if (!line.startsWith("{") && !line.startsWith("[")) {
        const braceAt = line.indexOf("{");
        const arrAt = line.indexOf("[");
        const startAt = braceAt >= 0 && arrAt >= 0 ? Math.min(braceAt, arrAt) : braceAt >= 0 ? braceAt : arrAt;
        if (startAt < 0) continue;
        line = line.slice(startAt);
        if (!line.startsWith("{") && !line.startsWith("[")) continue;
      }
      try {
        const parsed = JSON.parse(line) as McpResponse;
        this.onMessage(parsed);
      } catch {
        try {
          logger.warn("mcp", "MCP response parse failed", { framing: "line", bytes: lineBytes.length, preview: line.slice(0, 240) });
          this.pushTraffic({
            kind: "parse_error",
            at: Date.now(),
            framing: "line",
            detail: "JSON.parse failed",
            preview: line.slice(0, 240)
          });
        } catch {}
        continue;
      }
    }
  }

  private onStderr(chunk: any) {
    const text = typeof chunk === "string" ? chunk : this.decoder.decode(chunk);
    if (text) this.pushTraffic({ kind: "raw_stderr", at: Date.now(), text });
    this.stderrLines.push(text);
    if (this.stderrLines.length > 200) this.stderrLines.splice(0, this.stderrLines.length - 200);
    const tail = this.stderrLines.slice(-30).join("").trim();
    if (tail) {
      logger.debugThrottled("mcp_stderr_tail", 500, "mcp", "TAQWIN MCP stderr", { tail });
    }
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const obj = JSON.parse(trimmed);
        logger.info("mcp_server_log", "Server Internal Log", obj);
      }
    } catch {}
  }

  private onMessage(msg: McpResponse) {
    const id = (msg as any).id;
    const key = id === undefined || id === null ? null : String(id);
    const slot = key ? this.pending.get(key) : undefined;
    if (!slot) {
      this.pushTraffic({ kind: "unsolicited", at: Date.now(), id: key, ok: !("error" in msg), json: msg });
      if ("error" in msg) logger.warn("mcp", "MCP unsolicited error", { id: key, code: msg.error.code, message: msg.error.message });
      else logger.warn("mcp", "MCP unsolicited response", { id: key });
      return;
    }
    if (key) this.pending.delete(key);
    if (!slot.silentResponseLog) {
      logger.debug("mcp", "MCP response", {
        id: key,
        ok: !("error" in msg),
        hasResult: "result" in msg,
        hasError: "error" in msg,
        method: slot.method
      });
    }
    if (key) this.pushTraffic({ kind: "response", at: Date.now(), id: key, ok: !("error" in msg), json: msg });
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
    if (!this.child) throw new Error("mcp_not_started");
    if (!this.lockedRequestFraming) this.lockedRequestFraming = this.requestFraming;
    const timeoutMs = typeof options === "number" ? options : (options.timeoutMs ?? 30000);
    const stopOnTimeout = typeof options === "number" ? true : (options.stopOnTimeout ?? true);
    const logTimeoutLevel = typeof options === "number" ? "error" : (options.logTimeoutLevel ?? "error");
    const logTimeoutMessage =
      typeof options === "number" ? "MCP request timed out" : (options.logTimeoutMessage ?? "MCP request timed out");
    const silentResponseLog = typeof options === "number" ? false : (options.silentResponseLog ?? false);
    const id = String(this.nextId++);
    const req: McpRequest = { jsonrpc: "2.0", id, method, params };
    this.pushTraffic({ kind: "request", at: Date.now(), id, method, json: req });
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
      this.pending.set(id, {
        resolve,
        reject,
        method,
        silentResponseLog,
        pidAtSend: this.child?.pid ?? null,
        startedWithAtSend: this.startedWith,
        framingAtSend: this.requestFraming
      });
      timeoutId = window.setTimeout(() => {
        const slot = this.pending.get(id);
        if (!slot) return;
        this.pending.delete(id);
        if (stopOnTimeout) this.stop().catch(() => {});
        const classified = classifyMcpTimeout(method);
        this.lastError = classified;
        const stderrTail = this.stderrLines.slice(-30).join("").trim();
        const stdoutTail = this.stdoutTail.trim();
        this.lastTimeout = {
          at: Date.now(),
          method,
          timeoutMs,
          framing: slot.framingAtSend,
          stdoutBytes: this.stdoutBuffer.length,
          stderrTail: stderrTail ? stderrTail.slice(-800) : null,
          stdoutTail: stdoutTail ? stdoutTail.slice(-800) : null
        };
        if (logTimeoutLevel !== "none") {
          const payload = {
            pid: slot.pidAtSend,
            startedWith: slot.startedWithAtSend,
            method,
            timeoutMs,
            framing: slot.framingAtSend,
            stdoutBytes: this.stdoutBuffer.length,
            lastWrite: this.lastWrite,
            stderrTail: stderrTail ? stderrTail.slice(-800) : null,
            stdoutTail: stdoutTail ? stdoutTail.slice(-800) : null
          };
          if (logTimeoutLevel === "debug") logger.debug("mcp", logTimeoutMessage, payload);
          else if (logTimeoutLevel === "warn") logger.warn("mcp", logTimeoutMessage, payload);
          else logger.error("mcp", logTimeoutMessage, payload);
        }
        reject(new Error(classified));
      }, Math.max(1, timeoutMs));
    }).finally(() => {
      if (typeof timeoutId === "number") clearTimeout(timeoutId);
    });

    const run = async (): Promise<void> => {
      try {
        const paramsKeys =
          params && typeof params === "object" && !Array.isArray(params) ? Object.keys(params).slice(0, 12) : [];
        logger.debug("mcp", `MCP request ${method}`, { id, method, paramsKeys, framing: this.requestFraming, bytes: payload.length });
        if (!this.hasWrittenRequest) this.hasWrittenRequest = true;
        await this.child!.write(Array.from(payload));
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
    };

    const chained = this.requestChain.then(run, run);
    this.requestChain = chained.then(
      () => {},
      () => {}
    );
    return p;
  }

  private async restartWithFraming(next: "content-length" | "line"): Promise<void> {
    const cfg = this.lastConfig;
    if (!cfg) throw new Error("mcp_restart_unavailable");
    try {
      await this.stop();
    } catch {}
    const env = { ...(cfg.env ?? {}), KNEZ_MCP_CLIENT_FRAMING: next };
    await this.startWithConfig({ ...cfg, env });
  }

  async initialize(): Promise<any> {
    if (this.initializeCompleted) throw new Error("mcp_duplicate_initialize");
    const startedAt = performance.now();
    const preferredFraming = this.requestFraming;
    const framings: Array<"content-length" | "line"> = [
      preferredFraming,
      preferredFraming === "line" ? "content-length" : "line"
    ];
    const protocolVersions = ["2024-11-05", "1.0"];
    const initTimeoutMs = inferInitializeTimeoutMs({ command: this.lastConfig?.command ?? null, args: this.lastConfig?.args ?? null });

    let firstAttempt = true;
    let lastErr: any = null;
    for (const framing of framings) {
      for (const protocolVersion of protocolVersions) {
        try {
          const attemptStartedAt = performance.now();
          if (!firstAttempt) await this.restartWithFraming(framing);
          firstAttempt = false;
          const params = {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: "knez-control-app", version: "dev" }
          };
          const res = await this.request("initialize", params, { timeoutMs: initTimeoutMs, stopOnTimeout: false, logTimeoutLevel: "debug" });
          logger.info("mcp", "MCP initialize ok", {
            framing: this.requestFraming,
            protocolVersion,
            attemptDurationMs: Math.round(performance.now() - attemptStartedAt),
            totalDurationMs: Math.round(performance.now() - startedAt)
          });
          this.initializeCompleted = true;
          return res;
        } catch (e: any) {
          lastErr = e;
        }
      }
    }
    throw lastErr ?? new Error("mcp_initialize_failed");
  }

  async notifyInitialized(): Promise<void> {
    if (!this.child) throw new Error("mcp_not_started");
    if (!this.initializeCompleted) throw new Error("mcp_not_initialized");
    if (this.initializedNotificationSent) return;
    const msg = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
    const payload = this.buildPayload(msg);
    logger.debug("mcp", "MCP notify initialized", { framing: this.requestFraming });
    await this.child.write(Array.from(payload));
    this.initializedNotificationSent = true;
  }

  async listTools(opts?: { cursor?: string | null; timeoutMs?: number; logTimeoutLevel?: McpRequestOptions["logTimeoutLevel"] }): Promise<McpToolDefinition[]> {
    const cursor = typeof opts?.cursor === "string" ? opts.cursor : null;
    const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : 60000;
    const params = cursor ? { cursor } : {};
    const logTimeoutLevel = opts?.logTimeoutLevel ?? "debug";
    const logTimeoutMessage = "MCP tools/list timed out";

    try {
      const res = await this.request<{ tools?: McpToolDefinition[] }>(
        "tools/list",
        params,
        { timeoutMs, stopOnTimeout: false, logTimeoutLevel, logTimeoutMessage }
      );
      return Array.isArray(res?.tools) ? res.tools : [];
    } catch (e: any) {
      throw e;
    }
  }

  async callTool(name: string, args: any, opts?: { timeoutMs?: number }): Promise<any> {
    const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : 180000;
    return await this.request("tools/call", { name, arguments: args ?? {} }, { timeoutMs, stopOnTimeout: false });
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

  getTraffic(): McpTrafficEvent[] {
    return this.traffic.slice();
  }

  private pushTraffic(evt: McpTrafficEvent) {
    this.traffic.push(evt);
    if (this.traffic.length > this.trafficLimit) this.traffic.splice(0, this.traffic.length - this.trafficLimit);
  }
}
