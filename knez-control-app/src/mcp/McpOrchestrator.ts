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
  type: "stdio" | "http";
  tags: string[];
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line" | "http";
  generation: number;
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

  constructor() {
    mcpInspectorService.subscribe(() => {
      this.rebuildFromInspector();
    });
    this.rebuildFromInspector();
    void this.maybeAttachRustEventListeners();
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

  getServerTools(serverId: string): McpToolDefinition[] {
    return (this.snapshot.servers[serverId]?.tools ?? []).slice();
  }

  async refreshTools(serverId: string, opts?: { timeoutMs?: number; waitForResult?: boolean }): Promise<McpToolDefinition[]> {
    const tools = await mcpInspectorService.listTools(serverId, { timeoutMs: opts?.timeoutMs, waitForResult: opts?.waitForResult });
    return tools.slice();
  }

  async callTool(serverId: string, name: string, args: any, opts?: { timeoutMs?: number }): Promise<{ result: any; durationMs: number }> {
    const timeoutMs = opts?.timeoutMs ?? 180000;
    return await mcpInspectorService.callTool(serverId, name, args, timeoutMs);
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
    const out: Record<string, ServerRuntime> = {};

    for (const [serverId, status] of Object.entries(statusById)) {
      const tools = mcpInspectorService.getTools(serverId);
      const toolsHash = tools.length ? stableToolsHash(tools) : null;
      const generation = this.rustGenerationByServerId.get(serverId) ?? 0;
      out[serverId] = this.buildRuntime(authority, status, tools, toolsHash, generation);
    }

    this.snapshot = { servers: out };
    this.emit();
  }

  private buildRuntime(
    authority: McpAuthority,
    status: McpInspectorServerStatus,
    tools: McpToolDefinition[],
    toolsHash: string | null,
    generation: number
  ): ServerRuntime {
    return {
      serverId: status.id,
      authority,
      enabled: status.enabled,
      type: status.type,
      tags: status.tags,
      state: status.state,
      pid: status.pid ?? null,
      running: Boolean(status.running),
      framing: status.framing,
      generation,
      lastError: status.lastError ?? null,
      tools: tools.slice(),
      toolsHash,
      toolsCacheAt: status.toolsCacheAt ?? null,
      toolsPending: Boolean(status.toolsPending)
    };
  }

  private async maybeAttachRustEventListeners(): Promise<void> {
    if (!isTauriRuntime()) return;
    if (getMcpAuthority() !== "rust") return;

    await listen("mcp://state", (e) => {
      const p = asObj(e.payload);
      const kind = String(p.kind ?? "");
      const serverId = String(p.serverId ?? p.server_id ?? p.id ?? "").trim();
      if (!serverId) return;

      const genRaw = p.generation;
      const generation = typeof genRaw === "number" ? genRaw : Number(genRaw ?? 0);
      if (Number.isFinite(generation) && generation >= 0) {
        this.rustGenerationByServerId.set(serverId, generation);
      }

      if (kind === "stdout_error" || kind === "stderr_error") {
        logger.warn("mcp", "MCP rust stream error", { serverId, kind, error: String(p.error ?? "") });
      }

      this.rebuildFromInspector();
    });
  }
}

export const mcpOrchestrator = new McpOrchestrator();
