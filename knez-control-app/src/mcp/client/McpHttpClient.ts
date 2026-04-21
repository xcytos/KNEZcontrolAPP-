import { McpToolDefinition } from "../../services/mcp/McpTypes";
import { logger, LogLevel } from '../../services/utils/LogService';
import type { McpServerConfig } from "../config/McpHostConfig";
import { classifyMcpTimeout } from "./classifyTimeout";
import type { McpTrafficEvent } from "../inspector/McpTraffic";
import { MCP_LOG_METHODS, MCP_LOG_CATEGORIES } from "../inspector/McpLoggingConstants";
import { extractConnectionParams, formatJsonRpcPayload } from "../inspector/McpLoggingHelpers";

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
};

function asRecord(v: any): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!k) continue;
    if (val === null || val === undefined) continue;
    out[String(k)] = String(val);
  }
  return out;
}

function isTruthyHeaderValue(v: string): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["false", "f", "no", "n", "0", "off"].includes(s)) return false;
  return true;
}

export class McpHttpClient {
  private url: string | null = null;
  private headers: Record<string, string> = {};
  private sessionId: string | null = null;
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private requestChain: Promise<void> = Promise.resolve();
  private traffic: McpTrafficEvent[] = [];
  private trafficLimit = 800;
  private lastError: string | null = null;
  private lastTimeout:
    | {
        at: number;
        method: string;
        timeoutMs: number;
        url: string;
      }
    | null = null;
  private lastWrite:
    | {
        at: number;
        id: string;
        method: string;
        url: string;
        bytes: number;
        ok: boolean;
        error: string | null;
      }
    | null = null;
  private serverId: string | null = null;
  private debugMode: boolean = false;

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  async startWithConfig(server: McpServerConfig): Promise<void> {
    if ((server as any)?.type !== "http") {
      throw new Error("mcp_http_expected");
    }
    const url = String((server as any)?.url ?? "").trim();
    if (!url) throw new Error("mcp_http_missing_url");

    this.serverId = server.id;
    const category = MCP_LOG_CATEGORIES.PREFIX_LOCAL(server.id);
    const params = extractConnectionParams(server);

    // Log connection start
    await logger.writeServerLog(server.id, LogLevel.INFO, category, MCP_LOG_METHODS.SERVER_START, {
      message: "Connecting with config...",
      ...params
    });

    // Log client start
    await logger.writeServerLog(server.id, LogLevel.INFO, category, MCP_LOG_METHODS.CLIENT_START, {
      message: "Start With HttpServerParameters",
      ...params
    });

    this.url = url;
    this.headers = asRecord((server as any)?.headers);
    this.sessionId = null;
    this.nextId = 1;
    this.pending.clear();
    this.traffic = [];
    this.lastError = null;
    this.lastTimeout = null;
    this.lastWrite = null;

    await logger.writeServerLog(server.id, LogLevel.INFO, category, MCP_LOG_METHODS.SERVER_START, {
      message: "Connected.",
      url: this.url
    });
  }

  async stop(): Promise<void> {
    const category = this.serverId ? MCP_LOG_CATEGORIES.PREFIX_LOCAL(this.serverId) : MCP_LOG_CATEGORIES.GENERIC;
    
    await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.INFO, category, MCP_LOG_METHODS.CLIENT_STOP, {
      message: "MCPClient#stop"
    });
    
    await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.INFO, category, MCP_LOG_METHODS.SERVER_STOP, {
      message: "Disconnected."
    });
    
    this.url = null;
    this.headers = {};
    this.sessionId = null;
    for (const p of this.pending.values()) {
      try {
        p.reject(new Error("mcp_stopped"));
      } catch {}
    }
    this.pending.clear();
  }

  private pushTraffic(evt: McpTrafficEvent) {
    this.traffic.push(evt);
    if (this.traffic.length > this.trafficLimit) this.traffic.splice(0, this.traffic.length - this.trafficLimit);
  }

  getTraffic(): McpTrafficEvent[] {
    return this.traffic.slice();
  }

  getDebugState() {
    return {
      running: !!this.url,
      pid: null,
      startedWith: this.url ? { mode: "http", url: this.url } : null,
      requestFraming: "http",
      lastError: this.lastError,
      lastTimeout: this.lastTimeout,
      lastWrite: this.lastWrite,
      stdoutTail: null,
      stderrTail: null,
    };
  }

  private async parseSse(body: ReadableStream<Uint8Array>, onJson: (obj: any) => void): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let dataLines: string[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const nl = buffer.indexOf("\n");
        if (nl < 0) break;
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (!line) {
          if (dataLines.length) {
            const data = dataLines.join("\n");
            dataLines = [];
            const trimmed = data.trim();
            if (trimmed) {
              try {
                onJson(JSON.parse(trimmed));
              } catch (e: any) {
                this.pushTraffic({
                  kind: "parse_error",
                  at: Date.now(),
                  framing: "line",
                  detail: "SSE JSON.parse failed",
                  preview: trimmed.slice(0, 240),
                });
              }
            }
          }
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
  }

  private async request<T = any>(method: string, params?: any, options: number | McpRequestOptions = 30000): Promise<T> {
    const url = this.url;
    if (!url) throw new Error("mcp_not_started");
    const timeoutMs = typeof options === "number" ? options : (options.timeoutMs ?? 30000);
    const stopOnTimeout = typeof options === "number" ? true : (options.stopOnTimeout ?? true);
    const logTimeoutLevel = typeof options === "number" ? "error" : (options.logTimeoutLevel ?? "error");
    const logTimeoutMessage =
      typeof options === "number" ? "MCP HTTP request timed out" : (options.logTimeoutMessage ?? "MCP HTTP request timed out");

    const id = String(this.nextId++);
    const req: McpRequest = { jsonrpc: "2.0", id, method, params };
    this.pushTraffic({ kind: "request", at: Date.now(), id, method, json: req });
    
    // Log JSON-RPC request payload in debug mode
    if (this.debugMode) {
      const category = this.serverId ? MCP_LOG_CATEGORIES.PREFIX_LOCAL(this.serverId) : MCP_LOG_CATEGORIES.GENERIC;
      await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.DEBUG, category, MCP_LOG_METHODS.REQUEST, {
        message: `Sending request: ${method}`,
        id,
        jsonrpc_payload: formatJsonRpcPayload(req)
      });
    }

    const bodyText = JSON.stringify(req);
    const bytes = (() => {
      try {
        return new TextEncoder().encode(bodyText).length;
      } catch {
        return bodyText.length;
      }
    })();
    this.lastWrite = { at: Date.now(), id, method, url, bytes, ok: false, error: null };

    let timeoutId: number | undefined;
    const controller = new AbortController();
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      timeoutId = window.setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        if (stopOnTimeout) controller.abort();
        const classified = classifyMcpTimeout(method);
        this.lastError = classified;
        this.lastTimeout = { at: Date.now(), method, timeoutMs, url };
        if (logTimeoutLevel !== "none") {
          const payload = { url, method, timeoutMs, lastWrite: this.lastWrite, lastTimeout: this.lastTimeout };
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
        const accept = "application/json, text/event-stream";
        const headers: Record<string, string> = { Accept: accept, "Content-Type": "application/json", ...this.headers };
        if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
        const res = await fetch(url, { method: "POST", headers, body: bodyText, signal: controller.signal });
        const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();
        const returnedSessionId = String(res.headers.get("Mcp-Session-Id") ?? "").trim();
        if (returnedSessionId) this.sessionId = returnedSessionId;
        
        // Log detailed HTTP metrics
        const durationMs = Date.now() - (this.lastWrite?.at ?? Date.now());
        logger.debug("mcp", "MCP HTTP response", {
          id,
          method,
          status: res.status,
          contentType,
          sessionId: this.sessionId,
          durationMs
        });

        if (!res.ok) {
          const safeDetail =
            res.status === 401 || res.status === 403
              ? "unauthorized"
              : await res.text().then((t) => t.slice(0, 240)).catch(() => "");
          const msg = `mcp_http_${res.status}${safeDetail ? `: ${safeDetail}` : ""}`;
          // Redact potential secrets in error message
          const redactedMsg = msg.replace(/Bearer\s+[a-zA-Z0-9\-\._~+/]+=*/gi, "Bearer ***");
          this.lastError = redactedMsg;
          this.pushTraffic({ kind: "spawn_error", at: Date.now(), message: redactedMsg });
          const slot = this.pending.get(id);
          if (slot) {
            this.pending.delete(id);
            if (this.lastWrite && this.lastWrite.id === id) {
              this.lastWrite.ok = false;
              this.lastWrite.error = redactedMsg;
            }
            slot.reject(new Error(redactedMsg));
          }
          return;
        }

        if (contentType.includes("text/event-stream") && res.body) {
          await this.parseSse(res.body, (obj: any) => {
            const msgId = obj?.id === undefined || obj?.id === null ? null : String(obj.id);
            
            // Log JSON-RPC response payload in debug mode
            if (this.debugMode && msgId) {
              const category = this.serverId ? MCP_LOG_CATEGORIES.PREFIX_LOCAL(this.serverId) : MCP_LOG_CATEGORIES.GENERIC;
              logger.writeServerLog(this.serverId ?? "unknown", LogLevel.DEBUG, category, MCP_LOG_METHODS.RESPONSE, {
                message: `Received response: ${method}`,
                id: msgId,
                ok: !("error" in obj),
                jsonrpc_payload: formatJsonRpcPayload(obj)
              }).catch(() => {});
            }
            
            if (msgId) {
              const slot = this.pending.get(msgId);
              this.pushTraffic({
                kind: "response",
                at: Date.now(),
                id: msgId,
                ok: !("error" in (obj ?? {})),
                json: obj,
              });
              if (slot) {
                this.pending.delete(msgId);
                if (this.lastWrite && this.lastWrite.id === msgId) this.lastWrite.ok = true;
                if ("error" in obj) {
                  const code = obj?.error?.code;
                  const message = String(obj?.error?.message ?? "mcp_error");
                  slot.reject(new Error(code !== undefined ? `mcp_error_${code}: ${message}` : message));
                } else {
                  slot.resolve(obj?.result);
                }
              }
            } else {
              this.pushTraffic({
                kind: "response",
                at: Date.now(),
                id: id,
                ok: true,
                json: obj,
              });
            }
          });
          return;
        }

        const json = (await res.json().catch(async () => {
          const text = await res.text().catch(() => "");
          throw new Error(`mcp_http_invalid_json: ${text.slice(0, 240)}`);
        })) as McpResponse;

        const msgId = json?.id === undefined || json?.id === null ? null : String((json as any).id);
        this.pushTraffic({ kind: "response", at: Date.now(), id: msgId ?? id, ok: !("error" in json), json });
        const slot = msgId ? this.pending.get(msgId) : this.pending.get(id);
        if (slot) {
          if (msgId) this.pending.delete(msgId);
          else this.pending.delete(id);
          if (this.lastWrite && (this.lastWrite.id === msgId || this.lastWrite.id === id)) this.lastWrite.ok = true;
          if ("error" in json) {
            const code = (json as any)?.error?.code;
            const message = String((json as any)?.error?.message ?? "mcp_error");
            slot.reject(new Error(code !== undefined ? `mcp_error_${code}: ${message}` : message));
          } else {
            slot.resolve((json as any).result);
          }
        }
      } catch (err: any) {
        const slot = this.pending.get(id);
        const msg = String(err?.message ?? err);
        this.lastError = msg;
        this.pushTraffic({ kind: "spawn_error", at: Date.now(), message: msg });
        if (this.lastWrite && this.lastWrite.id === id) {
          this.lastWrite.ok = false;
          this.lastWrite.error = msg;
        }
        if (slot) {
          this.pending.delete(id);
          slot.reject(new Error(msg));
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

  async initialize(): Promise<any> {
    const category = this.serverId ? MCP_LOG_CATEGORIES.PREFIX_LOCAL(this.serverId) : MCP_LOG_CATEGORIES.GENERIC;
    const protocolVersions = ["2024-11-05", "1.0"];
    let lastErr: any = null;
    for (const protocolVersion of protocolVersions) {
      const attemptStartedAt = performance.now();
      try {
        await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.INFO, category, MCP_LOG_METHODS.INITIALIZE_ATTEMPT, {
          message: "Initialize attempt starting",
          protocolVersion,
          url: this.url
        });
        const params = {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: "knez-control-app", version: "dev" },
        };
        const res = await this.request("initialize", params, { timeoutMs: 8000, stopOnTimeout: false, logTimeoutLevel: "debug" });
        
        await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.INFO, category, MCP_LOG_METHODS.INITIALIZE, {
          message: "Initialize succeeded",
          protocolVersion,
          attemptDurationMs: Math.round(performance.now() - attemptStartedAt)
        });
        
        return res;
      } catch (e: any) {
        await logger.writeServerLog(this.serverId ?? "unknown", LogLevel.ERROR, category, MCP_LOG_METHODS.INITIALIZE_ATTEMPT, {
          message: "Initialize attempt failed",
          protocolVersion,
          error: String(e?.message ?? e),
          attemptDurationMs: Math.round(performance.now() - attemptStartedAt)
        });
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("mcp_initialize_failed");
  }

  async listTools(opts?: { cursor?: string | null; timeoutMs?: number; logTimeoutLevel?: McpRequestOptions["logTimeoutLevel"] }): Promise<McpToolDefinition[]> {
    const cursor = typeof opts?.cursor === "string" ? opts.cursor : null;
    const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : 60000;
    const res = await this.request<{ tools?: McpToolDefinition[] }>(
      "tools/list",
      cursor ? { cursor } : undefined,
      { timeoutMs, stopOnTimeout: false, logTimeoutLevel: opts?.logTimeoutLevel ?? "debug", logTimeoutMessage: "MCP tools/list timed out" }
    );
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: any, opts?: { timeoutMs?: number }): Promise<any> {
    const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : 180000;
    return await this.request("tools/call", { name, arguments: args ?? {} }, { timeoutMs, stopOnTimeout: false });
  }

  getReadonlyHint(): boolean {
    const v = this.headers["X-MCP-Readonly"] ?? this.headers["x-mcp-readonly"] ?? "";
    return isTruthyHeaderValue(String(v ?? ""));
  }
}
