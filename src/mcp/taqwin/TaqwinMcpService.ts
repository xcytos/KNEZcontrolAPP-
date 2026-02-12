import type { McpToolDefinition } from "../../services/McpTypes";
import { mcpOrchestrator } from "../McpOrchestrator";

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

type TaqwinServiceState = "IDLE" | "STARTING" | "INITIALIZED" | "DISCOVERING" | "READY" | "ERROR";

class TaqwinMcpService {
  private consecutiveFailures = 0;
  private lastRawError: string | null = null;
  private lastNormalizedError: string | null = null;
  private lastStartAt: number | null = null;
  private lastOkAt: number | null = null;
  private listeners = new Set<(status: ReturnType<TaqwinMcpService["getStatus"]>) => void>();
  private unsubOrchestrator: (() => void) | null = null;

  subscribe(listener: (status: ReturnType<TaqwinMcpService["getStatus"]>) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getStatus());
    } catch {}
    if (!this.unsubOrchestrator) {
      this.unsubOrchestrator = mcpOrchestrator.subscribe(() => this.emitStatus());
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.unsubOrchestrator) {
        try {
          this.unsubOrchestrator();
        } catch {}
        this.unsubOrchestrator = null;
      }
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

  private toServiceState(orchestratorState: string): TaqwinServiceState {
    if (orchestratorState === "LISTING_TOOLS") return "DISCOVERING";
    if (orchestratorState === "STARTING") return "STARTING";
    if (orchestratorState === "INITIALIZED") return "INITIALIZED";
    if (orchestratorState === "READY") return "READY";
    if (orchestratorState === "ERROR") return "ERROR";
    return "IDLE";
  }

  getStatus() {
    const runtime = mcpOrchestrator.getServer("taqwin");
    const state = this.toServiceState(runtime?.state ?? "IDLE");
    const debug = {
      running: runtime?.running ?? false,
      pid: runtime?.pid ?? null,
      requestFraming: runtime?.framing ?? null,
      stdoutTail: null,
      stderrTail: null,
      lastError: runtime?.lastError ?? null
    };
    const trust = state === "READY" || state === "INITIALIZED" ? "trusted" : "untrusted";
    const capabilityTrust =
      state === "READY" ? "trusted" :
      state === "DISCOVERING" ? "pending" :
      state === "ERROR" ? "failed" :
      "unknown";
    return {
      state,
      processAlive: Boolean(runtime?.running || runtime?.pid),
      lastStartAt: this.lastStartAt,
      lastOkAt: this.lastOkAt,
      serverId: runtime?.serverId ?? "taqwin",
      trust,
      mcpTrust: trust,
      capabilityTrust,
      framing: runtime?.framing ?? null,
      toolsCached: runtime?.tools?.length ?? 0,
      toolsCacheAt: runtime?.toolsCacheAt ?? null,
      lastError: this.lastNormalizedError ?? this.lastRawError ?? runtime?.lastError ?? null,
      running: runtime?.running ?? false,
      initialized: Boolean(runtime?.initializedAt),
      consecutiveFailures: this.consecutiveFailures,
      lastRawError: this.lastRawError,
      lastNormalizedError: this.lastNormalizedError,
      toolsPending: runtime?.toolsPending ?? false,
      debug
    };
  }

  async start(restart = false) {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    this.lastStartAt = Date.now();
    if (restart) {
      await mcpOrchestrator.restartServer("taqwin");
    }
    await mcpOrchestrator.ensureStarted("taqwin");
    this.lastOkAt = Date.now();
    this.lastRawError = null;
    this.lastNormalizedError = null;
    this.consecutiveFailures = 0;
    this.emitStatus();
    return this.getStatus();
  }

  async stop() {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    await mcpOrchestrator.stopServer("taqwin");
    this.emitStatus();
  }

  async listTools(forceRefresh = false, opts?: { waitForResult?: boolean; timeoutMs?: number }): Promise<McpToolDefinition[]> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    await mcpOrchestrator.ensureStarted("taqwin");
    if (!forceRefresh) {
      const snap = mcpOrchestrator.getServer("taqwin");
      const ageOk = snap?.toolsCacheAt && Date.now() - snap.toolsCacheAt < 30000;
      if (ageOk && (snap?.tools?.length ?? 0) > 0) {
        return mcpOrchestrator.getServerTools("taqwin");
      }
    }
    const timeoutMs = typeof opts?.timeoutMs === "number" ? opts.timeoutMs : opts?.waitForResult ? 15000 : 60000;
    const tools = await mcpOrchestrator.refreshTools("taqwin", { timeoutMs, waitForResult: opts?.waitForResult });
    this.lastOkAt = Date.now();
    this.lastRawError = null;
    this.lastNormalizedError = null;
    this.emitStatus();
    return tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    try {
      await mcpOrchestrator.ensureStarted("taqwin");
      const { result } = await mcpOrchestrator.callTool("taqwin", name, args, { timeoutMs: 180000 });
      this.lastOkAt = Date.now();
      this.lastRawError = null;
      this.lastNormalizedError = null;
      this.consecutiveFailures = 0;
      this.emitStatus();
      return result;
    } catch (e: any) {
      const raw = String(e?.message ?? e);
      this.lastRawError = raw;
      this.lastNormalizedError = raw;
      this.consecutiveFailures = Math.min(20, this.consecutiveFailures + 1);
      this.emitStatus();
      throw e;
    }
  }

  async activateTaqwin(opts: { sessionId?: string; knezEndpoint?: string; checkpoint?: string } = {}) {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    await mcpOrchestrator.ensureStarted("taqwin");
    const tools = mcpOrchestrator.getServerTools("taqwin");
    const tool = resolveTaqwinActivationToolName(tools);
    if (!tool) throw new Error("taqwin_activate_tool_missing");
    if (tool === "taqwin_activate") {
      return await this.callTool(tool, {
        session_id: opts.sessionId ?? "",
        knez_endpoint: opts.knezEndpoint ?? "",
        checkpoint: opts.checkpoint ?? "CP01_MCP_REGISTRY"
      });
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
  }

  async selfTest() {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const steps: { step: string; ok: boolean; durationMs?: number; detail?: any }[] = [];
    const startedAt = performance.now();
    try {
      const t0 = performance.now();
      await this.start(false);
      steps.push({ step: "start", ok: true, durationMs: Math.round(performance.now() - t0) });

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
