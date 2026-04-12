import { listen } from "@tauri-apps/api/event";
import type { McpInspectorLifecycle, McpInspectorServerStatus } from "./inspector/McpInspectorService";
import { mcpInspectorService } from "./inspector/McpInspectorService";
import type { McpToolDefinition } from "../services/McpTypes";
import { getMcpAuthority, type McpAuthority } from "./authority";
import { logger } from "../services/LogService";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function asObj(v: unknown): Record<string, any> {
  return typeof v === "object" && v !== null ? (v as any) : {};
}

export type ServerRuntime = {
  serverId: string;
  authority: McpAuthority;
  enabled: boolean;
  start_on_boot: boolean;
  allowed_tools: string[];
  blocked_tools: string[];
  type: "stdio" | "http";
  tags: string[];
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line" | "http";
  generation: number;
  lastOkAt: number | null;
  initializedAt: number | null;
  initializeDurationMs: number | null;
  toolsListDurationMs: number | null;
  lastError: string | null;
  tools: McpToolDefinition[];
  toolsHash: string | null;
  toolsCacheAt: number | null;
  toolsPending: boolean;
};

export type McpOrchestratorSnapshot = {
  servers: Record<string, ServerRuntime>;
};

function stableToolsHash(tools: McpToolDefinition[]): string {
  try {
    const normalized = tools.map((t) => ({
      name: String(t?.name ?? ""),
      description: t?.description ? String(t.description) : "",
      inputSchema: t?.inputSchema ?? null
    }));
    normalized.sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(normalized);
  } catch {
    return String(Date.now());
  }
}

export class McpOrchestrator {
  private snapshot: McpOrchestratorSnapshot = { servers: {} };
  private subscribers = new Set<() => void>();
  private rustGenerationByServerId = new Map<string, number>();
  private toolsInvalidatedAtByServerId = new Map<string, number>();
  private autoStartInFlight = new Set<string>();
  private autoStartBackoffUntilByServerId = new Map<string, number>();
  private autoStartAttemptsByServerId = new Map<string, number>();

  constructor() {
    mcpInspectorService.subscribe(() => {
      this.rebuildFromInspector();
    });
    this.rebuildFromInspector();
    void this.maybeAttachRustEventListeners();
    // [FIX #15] Ensure MCP servers bootstrap on app start
    void this.ensureStartedAll({ onlyEnabled: true, startOnBootOnly: true }).catch((e) => {
      logger.warn("mcp", "MCP bootstrap failed on startup", { error: String(e?.message ?? e) });
    });
    void this.maybeAutoStartServers();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  getSnapshot(): McpOrchestratorSnapshot {
    return this.snapshot;
  }

  getServer(serverId: string): ServerRuntime | null {
    return this.snapshot.servers[serverId] ?? null;
  }

  getServers(): ServerRuntime[] {
    const list = Object.values(this.snapshot.servers);
    list.sort((a, b) => a.serverId.localeCompare(b.serverId));
    return list;
  }

  getServerTools(serverId: string): McpToolDefinition[] {
    return (this.snapshot.servers[serverId]?.tools ?? []).slice();
  }

  getTools(serverId: string): McpToolDefinition[] {
    return this.getServerTools(serverId);
  }

  async startServer(serverId: string): Promise<void> {
    await mcpInspectorService.start(serverId);
  }

  async stopServer(serverId: string): Promise<void> {
    await mcpInspectorService.stop(serverId);
  }

  async restartServer(serverId: string): Promise<void> {
    await mcpInspectorService.restart(serverId);
  }

  async handshake(serverId: string, opts?: { toolsListTimeoutMs?: number }): Promise<McpToolDefinition[]> {
    return await mcpInspectorService.handshake(serverId, { toolsListTimeoutMs: opts?.toolsListTimeoutMs });
  }

  async ensureStarted(serverId: string): Promise<McpToolDefinition[]> {
    return await this.handshake(serverId);
  }

  async ensureStartedAll(opts?: { onlyEnabled?: boolean; startOnBootOnly?: boolean }): Promise<void> {
    const onlyEnabled = opts?.onlyEnabled ?? true;
    const startOnBootOnly = opts?.startOnBootOnly ?? false;
    const servers = this.getServers()
      .filter((s) => (onlyEnabled ? s.enabled : true))
      .filter((s) => (startOnBootOnly ? s.start_on_boot : true));
    for (const s of servers) {
      try {
        await this.ensureStarted(s.serverId);
      } catch (e: any) {
        logger.warn("mcp", "MCP ensureStartedAll server failed", {
          serverId: s.serverId,
          error: String(e?.message ?? e)
        });
      }
    }
  }

  async refreshTools(serverId: string, opts?: { timeoutMs?: number; waitForResult?: boolean }): Promise<McpToolDefinition[]> {
    const tools = await mcpInspectorService.listTools(serverId, { timeoutMs: opts?.timeoutMs, waitForResult: opts?.waitForResult });
    return tools.slice();
  }

  async callTool(
    serverId: string,
    name: string,
    args: any,
    opts?: { timeoutMs?: number; traceId?: string; toolCallId?: string; correlationId?: string }
  ): Promise<{ result: any; durationMs: number }> {
    return await mcpInspectorService.callTool(serverId, name, args, {
      timeoutMs: opts?.timeoutMs ?? 180000,
      traceId: opts?.traceId,
      toolCallId: opts?.toolCallId,
      correlationId: opts?.correlationId
    });
  }

  private emit() {
    for (const fn of this.subscribers) {
      try {
        fn();
      } catch {}
    }
  }

  private rebuildFromInspector() {
    const authority = getMcpAuthority();
    const statusById = mcpInspectorService.getStatusById();
    const startOnBootById = new Map<string, boolean>();
    const allowedToolsById = new Map<string, string[]>();
    const blockedToolsById = new Map<string, string[]>();
    for (const s of mcpInspectorService.getServers()) {
      startOnBootById.set(s.id, Boolean(s.start_on_boot));
      allowedToolsById.set(s.id, Array.isArray(s.allowed_tools) ? s.allowed_tools.slice() : []);
      blockedToolsById.set(s.id, Array.isArray(s.blocked_tools) ? s.blocked_tools.slice() : []);
    }
    const out: Record<string, ServerRuntime> = {};

    for (const [serverId, status] of Object.entries(statusById)) {
      const tools = mcpInspectorService.getTools(serverId);
      const toolsHash = tools.length ? stableToolsHash(tools) : null;
      const generation = this.rustGenerationByServerId.get(serverId) ?? 0;
      const invalidatedAt = this.toolsInvalidatedAtByServerId.get(serverId) ?? null;
      const toolsCacheAt = status.toolsCacheAt ?? null;
      const invalidated = invalidatedAt !== null && (Number(toolsCacheAt ?? 0) < invalidatedAt);
      if (!invalidated && invalidatedAt !== null && Number(toolsCacheAt ?? 0) >= invalidatedAt) {
        this.toolsInvalidatedAtByServerId.delete(serverId);
      }
      out[serverId] = this.buildRuntime(
        authority,
        status,
        tools,
        toolsHash,
        generation,
        invalidated,
        startOnBootById.get(serverId) ?? false,
        allowedToolsById.get(serverId) ?? [],
        blockedToolsById.get(serverId) ?? []
      );
    }

    this.snapshot = { servers: out };
    this.emit();
    void this.maybeAutoStartServers();
  }

  private buildRuntime(
    authority: McpAuthority,
    status: McpInspectorServerStatus,
    tools: McpToolDefinition[],
    toolsHash: string | null,
    generation: number,
    generationChanged: boolean,
    startOnBoot: boolean,
    allowedTools: string[],
    blockedTools: string[]
  ): ServerRuntime {
    const effectiveState = generationChanged && status.state === "READY" ? "INITIALIZED" : status.state;
    const effectiveTools = generationChanged ? [] : tools.slice();
    const effectiveToolsHash = generationChanged ? null : toolsHash;
    const effectiveToolsCacheAt = generationChanged ? null : status.toolsCacheAt ?? null;
    return {
      serverId: status.id,
      authority,
      enabled: status.enabled,
      start_on_boot: startOnBoot,
      allowed_tools: allowedTools.slice(),
      blocked_tools: blockedTools.slice(),
      type: status.type,
      tags: status.tags,
      state: effectiveState,
      pid: status.pid ?? null,
      running: Boolean(status.running),
      framing: status.framing,
      generation,
      lastOkAt: status.lastOkAt ?? null,
      initializedAt: status.initializedAt ?? null,
      initializeDurationMs: status.initializeDurationMs ?? null,
      toolsListDurationMs: status.toolsListDurationMs ?? null,
      lastError: status.lastError ?? null,
      tools: effectiveTools,
      toolsHash: effectiveToolsHash,
      toolsCacheAt: effectiveToolsCacheAt,
      toolsPending: generationChanged ? false : Boolean(status.toolsPending)
    };
  }

  private async maybeAutoStartServers(): Promise<void> {
    const authority = getMcpAuthority();
    const isTauri = isTauriRuntime();
    const servers = this.getServers();
    const stdioAutoStarts = servers.filter((s) => s.enabled && s.start_on_boot && s.type === "stdio");
    if (authority === "rust" && stdioAutoStarts.length > 1) {
      for (const s of stdioAutoStarts.slice(1)) {
        this.autoStartBackoffUntilByServerId.set(s.serverId, Date.now() + 60000);
      }
    }

    for (const s of servers) {
      if (!s.enabled || !s.start_on_boot) continue;
      if (!isTauri && s.type !== "http") continue;
      if (authority === "rust" && s.type === "stdio" && stdioAutoStarts.length > 1 && s.serverId !== stdioAutoStarts[0]?.serverId) continue;
      if (s.state === "READY") continue;

      const backoffUntil = this.autoStartBackoffUntilByServerId.get(s.serverId) ?? 0;
      if (backoffUntil && Date.now() < backoffUntil) continue;
      if (this.autoStartInFlight.has(s.serverId)) continue;

      this.autoStartInFlight.add(s.serverId);
      logger.info("mcp", "MCP auto-start attempt", { serverId: s.serverId });
      void this.ensureStarted(s.serverId)
        .then(() => {
          const next = this.getServer(s.serverId);
          logger.info("mcp", "MCP auto-start handshake complete", { serverId: s.serverId, state: next?.state ?? null, pid: next?.pid ?? null });
        })
        .catch((e: any) => {
          const attempts = (this.autoStartAttemptsByServerId.get(s.serverId) ?? 0) + 1;
          this.autoStartAttemptsByServerId.set(s.serverId, attempts);
          const delayMs = Math.min(60000, 2000 * Math.pow(2, Math.min(6, attempts - 1)));
          this.autoStartBackoffUntilByServerId.set(s.serverId, Date.now() + delayMs);
          logger.warn("mcp", "MCP auto-start failed", { serverId: s.serverId, error: String(e?.message ?? e), delayMs });
        })
        .finally(() => {
          this.autoStartInFlight.delete(s.serverId);
        });
    }
  }

  private async maybeAttachRustEventListeners(): Promise<void> {
    if (!isTauriRuntime()) return;
    if (getMcpAuthority() !== "rust") return;

    try {
      await listen("mcp://state", (e) => {
        const p = asObj(e.payload);
        const kind = String(p.kind ?? "");
        const serverId = String(p.serverId ?? p.server_id ?? p.id ?? "").trim();
        if (!serverId) return;

        const genRaw = p.generation;
        const generation = typeof genRaw === "number" ? genRaw : Number(genRaw ?? 0);
        if (Number.isFinite(generation) && generation >= 0) {
          const prev = this.rustGenerationByServerId.get(serverId);
          if (prev !== undefined && prev !== generation) {
            this.toolsInvalidatedAtByServerId.set(serverId, Date.now());
          }
          this.rustGenerationByServerId.set(serverId, generation);
        }

        if (kind === "stdout_error" || kind === "stderr_error") {
          logger.warn("mcp", "MCP rust stream error", { serverId, kind, error: String(p.error ?? "") });
        }

        this.rebuildFromInspector();
      });
    } catch (e: any) {
      const log = (logger as any).warn ?? (logger as any).info ?? (() => {});
      log("mcp", "MCP rust event listener unavailable", { error: String(e?.message ?? e) });
    }
  }
}

export const mcpOrchestrator = new McpOrchestrator();
