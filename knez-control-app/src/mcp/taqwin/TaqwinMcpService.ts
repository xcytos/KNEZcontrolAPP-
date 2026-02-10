import { McpToolDefinition } from "../../services/McpTypes";
import { logger } from "../../services/LogService";
import { knezClient } from "../../services/KnezClient";
import { redactAny } from "../../utils/redact";
import { mcpHostConfigService } from "../config/McpHostConfigService";
import { normalizeTaqwinMcpServer } from "../config/McpHostConfig";
import { mcpInspectorService } from "../inspector/McpInspectorService";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function newHexId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }
}

function safePreview(value: any, maxChars: number): string | undefined {
  try {
    const redacted = redactAny(value);
    const raw = JSON.stringify(redacted);
    if (!raw) return undefined;
    if (raw.length <= maxChars) return raw;
    return raw.slice(0, maxChars) + "…";
  } catch {
    return undefined;
  }
}

export function resolveTaqwinActivationToolName(
  tools: Array<{ name: string }>
): "activate_taqwin_unified_consciousness" | "taqwin_activate" | null {
  const names = new Set((tools ?? []).map((t) => t.name));
  if (names.has("activate_taqwin_unified_consciousness")) return "activate_taqwin_unified_consciousness";
  if (names.has("taqwin_activate")) return "taqwin_activate";
  return null;
}

type McpLifecycleState = "IDLE" | "STARTING" | "INITIALIZED" | "DISCOVERING" | "READY" | "ERROR";
type McpTrust = "untrusted" | "trusted";
type CapabilityTrust = "unknown" | "pending" | "trusted" | "failed";

class TaqwinMcpService {
  private client: import("../client/McpStdioClient").McpStdioClient | null = null;
  private initialized = false;
  private serverId: string | null = null;
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
  private framingPreference: "line" | "content-length" = "line";
  private lifecycle: McpLifecycleState = "IDLE";
  private lastStartAt: number | null = null;
  private lastOkAt: number | null = null;
  private mcpTrust: McpTrust = "untrusted";
  private capabilityTrust: CapabilityTrust = "unknown";
  private toolsPending = false;
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

  private setLifecycle(next: McpLifecycleState) {
    if (this.lifecycle === next) {
      return;
    }
    this.lifecycle = next;
    this.emitStatus();
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
    this.setLifecycle("STARTING");
    this.lastStartAt = Date.now();
    this.initPromise = (async () => {
      let client = this.client;
      try {
        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (!client) {
              if (!mcpInspectorService.hasLoadedConfig()) {
                await mcpInspectorService.loadConfig();
              }
              const loaded = await mcpHostConfigService.load();
              const effective = loaded ?? mcpHostConfigService.getDefault();
              const enabledServers = Object.values(effective.config.servers).filter((s) => s && (s.enabled ?? true));
              const selected =
                (effective.config.servers["taqwin"] && (effective.config.servers["taqwin"].enabled ?? true)
                  ? effective.config.servers["taqwin"]
                  : null) ??
                enabledServers[0] ??
                null;
              if (!selected) throw new Error("mcp_no_enabled_servers");
              const server = normalizeTaqwinMcpServer(selected);
              this.serverId = server.id;
              server.env = {
                ...(server.env ?? {}),
                KNEZ_MCP_CLIENT_FRAMING: this.framingPreference,
                TAQWIN_MCP_OUTPUT_MODE: this.framingPreference,
                TAQWIN_GOVERNANCE_ENFORCE: "1",
                TAQWIN_GOVERNANCE_SNAPSHOT_URL: `${knezClient.getProfile().endpoint.replace(/\/$/, "")}/governance/snapshot`
              };
              mcpInspectorService.patchServer(server.id, {
                command: server.command,
                args: server.args,
                cwd: server.cwd,
                env: server.env
              });
              await mcpInspectorService.start(server.id);
              client = mcpInspectorService.getClientInstance(server.id);
              if (!client) throw new Error("mcp_client_missing");
              this.client = client;
              this.initialized = false;
              this.mcpTrust = "untrusted";
              this.toolsCache = null;
              this.toolsCacheAt = null;
              this.toolsPending = false;
              this.capabilityTrust = "unknown";
            }
            if (!this.initialized) {
              if (gen !== this.generation) throw new Error("mcp_restart_in_progress");
              const initializeStartedAt = performance.now();
              const initializePromise = mcpInspectorService.initialize(this.serverId!);
              const initializeBudgetMs = 100;
              const initializeResult = await Promise.race([
                initializePromise.then(
                  (value) => ({ kind: "ok", value } as const),
                  (error) => ({ kind: "error", error } as const)
                ),
                new Promise<{ kind: "timeout" }>((resolve) => {
                  setTimeout(() => resolve({ kind: "timeout" }), initializeBudgetMs);
                })
              ]);
              if (initializeResult.kind === "error") {
                throw initializeResult.error;
              }
              if (initializeResult.kind === "timeout") {
                await initializePromise;
                this.lastOkAt = Date.now();
                this.initialized = true;
                this.mcpTrust = "trusted";
                this.capabilityTrust = "trusted";
                this.toolsPending = false;
                this.setLifecycle("READY");
                this.consecutiveFailures = 0;
                this.lastRawError = null;
                this.lastNormalizedError = null;
                this.lastDebugState = client.getDebugState?.() ?? null;
                if (this.serverId) {
                  try {
                    await knezClient.reportMcpRuntime({ id: this.serverId, running: true, last_ok: Date.now() / 1000, last_error: null });
                  } catch {}
                }
                return client;
              }
              const initializeDurationMs = Math.round(performance.now() - initializeStartedAt);
              this.initialized = true;
              this.mcpTrust = "trusted";
              this.capabilityTrust = "trusted";
              this.toolsPending = false;
              this.setLifecycle("READY");
              this.lastOkAt = Date.now();
              this.consecutiveFailures = 0;
              this.lastRawError = null;
              this.lastNormalizedError = null;
              this.lastDebugState = client.getDebugState?.() ?? null;
              logger.info("mcp", "TAQWIN MCP initialize ok", { durationMs: initializeDurationMs });
              if (this.serverId) {
                try {
                  await knezClient.reportMcpRuntime({ id: this.serverId, running: true, last_ok: Date.now() / 1000, last_error: null });
                } catch {}
              }
            }
            if (this.toolsCache && this.toolsCache.length > 0) {
              this.capabilityTrust = "trusted";
              this.toolsPending = false;
              this.setLifecycle("READY");
            } else {
              this.capabilityTrust = this.toolsPending ? "pending" : this.initialized ? "trusted" : "unknown";
              this.setLifecycle("READY");
            }
            return client;
          } catch (err) {
            lastErr = err;
            throw err;
          }
        }
        throw lastErr;
      } catch (err) {
        const raw = String((err as any)?.message ?? err);
        this.lastRawError = raw;
        this.lastDebugState = client?.getDebugState?.() ?? null;
        this.lastNormalizedError = this.normalizeError(err).message;
        this.mcpTrust = "untrusted";
        this.capabilityTrust = "failed";
        this.setLifecycle("ERROR");
        try {
          if (this.serverId) await mcpInspectorService.stop(this.serverId);
          else await client?.stop?.();
        } catch {}
        if (this.client === client) this.client = null;
        this.initialized = false;
        this.serverId = null;
        this.toolsCache = null;
        this.toolsCacheAt = null;
        this.toolsPending = false;
        this.consecutiveFailures = Math.min(20, this.consecutiveFailures + 1);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();
    return this.initPromise;
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
      const m = String(dbg?.lastTimeout?.method ?? dbg?.lastWrite?.method ?? "").trim();
      const pid = dbg?.childPid ?? dbg?.pid ?? null;
      const framing = String(dbg?.requestFraming ?? this.framingPreference);
      const timeoutMs = dbg?.lastTimeout?.timeoutMs ?? null;
      const tail = String(dbg?.stderrTail ?? dbg?.stdoutTail ?? "").trim();
      const shortTail = tail ? tail.split(/\r?\n/).slice(-4).join(" | ").slice(-220) : "";
      const suffix = shortTail ? ` Last MCP output: ${shortTail}` : "";
      const meta = ` method=${m || "unknown"} framing=${framing}${pid ? ` pid=${pid}` : ""}${timeoutMs ? ` timeoutMs=${timeoutMs}` : ""}`;
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
      state: this.lifecycle,
      processAlive: !!this.client,
      lastStartAt: this.lastStartAt,
      lastOkAt: this.lastOkAt,
      serverId: this.serverId,
      trust: this.mcpTrust,
      mcpTrust: this.mcpTrust,
      capabilityTrust: this.capabilityTrust,
      framing: (debug as any)?.requestFraming ?? this.framingPreference,
      toolsCached: this.toolsCache?.length ?? 0,
      toolsCacheAt: this.toolsCacheAt,
      lastError: this.lastNormalizedError ?? this.lastRawError,
      running: !!this.client && this.initialized,
      initialized: this.initialized,
      consecutiveFailures: this.consecutiveFailures,
      lastRawError: this.lastRawError,
      lastNormalizedError: this.lastNormalizedError,
      toolsPending: this.toolsPending,
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
    const priorServerId = this.serverId;
    try {
      if (priorServerId) await mcpInspectorService.stop(priorServerId);
      else await this.client?.stop();
    } catch {}
    this.client = null;
    this.initialized = false;
    this.serverId = null;
    this.toolsCache = null;
    this.toolsCacheAt = null;
    this.toolsPending = false;
    this.mcpTrust = "untrusted";
    this.capabilityTrust = "unknown";
    this.setLifecycle("IDLE");
    if (priorServerId) {
      try {
        await knezClient.reportMcpRuntime({ id: priorServerId, running: false, last_ok: null, last_error: null });
      } catch {}
    }
  }

  async stop() {
    return this.enqueue(async () => {
      await this.stopInternal();
    });
  }

  async listTools(forceRefresh = false, opts?: { waitForResult?: boolean; timeoutMs?: number }): Promise<McpToolDefinition[]> {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      if (this.toolsCache && !forceRefresh && this.toolsCacheAt && Date.now() - this.toolsCacheAt < this.toolsCacheTtlMs) {
        return this.toolsCache;
      }
      const startedAt = performance.now();
      const waitForResult = opts?.waitForResult === true;
      try {
        await this.getClient();
        const sid = this.serverId;
        if (!sid) throw new Error("mcp_no_server_id");
        this.toolsPending = true;
        this.capabilityTrust = "pending";
        this.setLifecycle("DISCOVERING");
        const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : (waitForResult ? 15000 : 300000);
        const listPromise = mcpInspectorService.listTools(sid, { timeoutMs, waitForResult });
        if (waitForResult) {
          const tools = await listPromise;
          this.toolsCache = tools;
          this.toolsCacheAt = Date.now();
          const durationMs = Math.round(performance.now() - startedAt);
          this.lastOkAt = Date.now();
          this.toolsPending = false;
          this.capabilityTrust = "trusted";
          this.setLifecycle("READY");
          logger.info("mcp", "TAQWIN MCP tools/list ok", { durationMs, tools: tools.length });
          logger.info("mcp_audit", "tools/list", { ok: true, durationMs, tools: tools.length });
          return tools;
        }

        void listPromise.then(
          (tools) => {
            this.toolsCache = tools;
            this.toolsCacheAt = Date.now();
            this.lastOkAt = Date.now();
            this.toolsPending = false;
            this.capabilityTrust = "trusted";
            this.setLifecycle("READY");
            this.emitStatus();
          },
          (err) => {
            const normalized = this.normalizeError(err);
            this.lastRawError = String((err as any)?.message ?? err);
            this.lastNormalizedError = normalized.message;
            this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
            if (this.initialized) {
              this.toolsPending = false;
              this.capabilityTrust = "failed";
              this.setLifecycle("INITIALIZED");
            } else {
              this.mcpTrust = "untrusted";
              this.toolsPending = false;
              this.capabilityTrust = "failed";
              this.setLifecycle("ERROR");
            }
            this.emitStatus();
          }
        );

        const budgetMs = 50;
        const result = await Promise.race([
          listPromise.then(
            (value) => ({ kind: "ok", value } as const),
            (error) => ({ kind: "error", error } as const)
          ),
          new Promise<{ kind: "timeout" }>((resolve) => {
            setTimeout(() => resolve({ kind: "timeout" }), budgetMs);
          })
        ]);
        if (result.kind === "error") {
          const durationMs = Math.round(performance.now() - startedAt);
          logger.error("mcp", "TAQWIN MCP tools/list failed", { error: String((result.error as any)?.message ?? result.error), durationMs });
          logger.error("mcp_audit", "tools/list", { ok: false, durationMs, error: String((result.error as any)?.message ?? result.error) });
          const normalized = this.normalizeError(result.error);
          this.lastRawError = String((result.error as any)?.message ?? result.error);
          this.lastNormalizedError = normalized.message;
          this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
          this.toolsPending = false;
          if (this.initialized) {
            this.capabilityTrust = "failed";
            this.setLifecycle("INITIALIZED");
          } else {
            this.mcpTrust = "untrusted";
            this.capabilityTrust = "failed";
            this.setLifecycle("ERROR");
          }
          throw normalized;
        }
        if (result.kind === "timeout") {
          this.setLifecycle("READY");
          return this.toolsCache ?? [];
        }
        const tools = result.value;
        this.toolsCache = tools;
        this.toolsCacheAt = Date.now();
        const durationMs = Math.round(performance.now() - startedAt);
        this.lastOkAt = Date.now();
        this.toolsPending = false;
        this.capabilityTrust = "trusted";
        this.setLifecycle("READY");
        logger.info("mcp", "TAQWIN MCP tools/list ok", { durationMs, tools: tools.length });
        logger.info("mcp_audit", "tools/list", { ok: true, durationMs, tools: tools.length });
        return tools;
      } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        logger.error("mcp", "TAQWIN MCP tools/list failed", { error: String((err as any)?.message ?? err), durationMs });
        logger.error("mcp_audit", "tools/list", { ok: false, durationMs, error: String((err as any)?.message ?? err) });
        const normalized = this.normalizeError(err);
        this.lastRawError = String((err as any)?.message ?? err);
        this.lastNormalizedError = normalized.message;
        this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
        if (this.initialized) {
          this.capabilityTrust = "failed";
          this.setLifecycle("INITIALIZED");
        } else {
          this.mcpTrust = "untrusted";
          this.capabilityTrust = "failed";
          this.setLifecycle("ERROR");
        }
        throw normalized;
      }
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.enqueue(async () => {
      if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
      const risky = new Set([
        "delete_file",
        "scan_database",
        "web_intelligence",
        "mcp_taqwin_scan_database",
        "mcp_taqwin_web_intelligence",
      ]);
      if (risky.has(name)) {
        const trust = knezClient.getProfile().trustLevel;
        if (trust !== "verified") {
          throw new Error("mcp_tool_blocked_untrusted_knez");
        }
      }
      const traceId = newHexId();
      const toolCallId = newHexId();
      let sessionId: string | null = null;
      try {
        sessionId = await knezClient.ensureSession();
      } catch {}
      const startedAt = performance.now();
      try {
        const client = await this.getClient();
        const sid = this.serverId;
        const res = sid ? (await mcpInspectorService.callTool(sid, name, args, 180000)).result : await client.callTool(name, args);
        const durationMs = Math.round(performance.now() - startedAt);
        this.lastOkAt = Date.now();
        if (this.initialized) {
          this.capabilityTrust = "trusted";
          this.toolsPending = false;
          this.setLifecycle("READY");
        }
        this.emitStatus();
        const bytes = (() => {
          try { return JSON.stringify(res).length; } catch { return null; }
        })();
        const argsBytes = (() => {
          try { return JSON.stringify(args ?? {}).length; } catch { return null; }
        })();
        logger.info("mcp", "TAQWIN MCP tools/call ok", { tool: name, durationMs, bytes });
        logger.info("mcp_audit", "tools/call", { ok: true, tool: name, durationMs, argsBytes, resultBytes: bytes });
        if (sessionId) {
          try {
            await knezClient.emitTaqwinResponse({
              session_id: sessionId,
              intent: "mcp_tool_call",
              correlation_id: toolCallId,
              trace_id: traceId,
              observations: [
                {
                  type: "mcp_tool_call",
                  summary: `tools/call ${name}`,
                  details: {
                    tool: name,
                    ok: true,
                    duration_ms: durationMs,
                    tool_call_id: toolCallId,
                    trace_id: traceId,
                    args_bytes: argsBytes ?? undefined,
                    result_bytes: bytes ?? undefined,
                    args_preview: safePreview(args, 2000),
                    result_preview: safePreview(res, 2000),
                  },
                },
              ],
            });
          } catch (e: any) {
            logger.warn("mcp_audit", "Failed to mirror tool call to KNEZ", { tool: name, error: String(e?.message ?? e) });
          }
        }
        return res;
      } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        logger.error("mcp", "TAQWIN MCP tools/call failed", { tool: name, durationMs, error: String((err as any)?.message ?? err) });
        logger.error("mcp_audit", "tools/call", { ok: false, tool: name, durationMs, error: String((err as any)?.message ?? err) });
        if (sessionId) {
          try {
            await knezClient.emitTaqwinResponse({
              session_id: sessionId,
              intent: "mcp_tool_call",
              correlation_id: toolCallId,
              trace_id: traceId,
              observations: [
                {
                  type: "mcp_tool_call",
                  summary: `tools/call ${name}`,
                  details: {
                    tool: name,
                    ok: false,
                    duration_ms: durationMs,
                    tool_call_id: toolCallId,
                    trace_id: traceId,
                    args_preview: safePreview(args, 2000),
                    error: String((err as any)?.message ?? err),
                  },
                },
              ],
            });
          } catch (e: any) {
            logger.warn("mcp_audit", "Failed to mirror tool failure to KNEZ", { tool: name, error: String(e?.message ?? e) });
          }
        }
        const normalized = this.normalizeError(err);
        this.lastRawError = String((err as any)?.message ?? err);
        this.lastNormalizedError = normalized.message;
        this.lastDebugState = (this.client as any)?.getDebugState?.() ?? this.lastDebugState;
        this.lifecycle = this.initialized ? this.lifecycle : "ERROR";
        this.emitStatus();
        throw normalized;
      }
    });
  }

  async activateTaqwin(opts: { sessionId?: string; knezEndpoint?: string; checkpoint?: string } = {}) {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const candidates: Array<"activate_taqwin_unified_consciousness" | "taqwin_activate"> = [
      "activate_taqwin_unified_consciousness",
      "taqwin_activate"
    ];
    const sid = opts.sessionId ?? "";
    const endpoint = opts.knezEndpoint ?? "";
    const cp = opts.checkpoint ?? "CP01_MCP_REGISTRY";
    for (const tool of candidates) {
      try {
        if (tool === "taqwin_activate") {
          return await this.callTool(tool, { session_id: sid, knez_endpoint: endpoint, checkpoint: cp });
        }
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
      } catch {}
    }
    throw new Error("taqwin_activate_tool_missing");
  }

  async selfTest() {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const steps: { step: string; ok: boolean; durationMs?: number; detail?: any }[] = [];
    const startedAt = performance.now();
    try {
      const t0 = performance.now();
        await this.start(false);
      steps.push({ step: "start", ok: true, durationMs: Math.round(performance.now() - t0) });

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
