import { knezClient } from "./KnezClient";
import { mcpOrchestrator, type ServerRuntime } from "../mcp/McpOrchestrator";
import type { McpToolDefinition } from "./McpTypes";
import type { McpAuthority } from "../mcp/authority";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ToolPermission = {
  allowed: boolean;
  reason?: string;
};

export type ExposedToolMeta = {
  name: string;
  description: string;
  parameters: any;
  serverId: string;
  originalName: string;
  authority: McpAuthority;
  riskLevel: ToolRiskLevel;
  category: string;
  permission: ToolPermission;
  schemaHash: string;
};

export type ToolExposureSnapshot = {
  tools: ExposedToolMeta[];
  toolsForModel: Array<{ name: string; description: string; parameters: any }>;
};

function namespaceToolName(serverId: string, originalName: string): string {
  const raw = `${serverId}__${originalName}`;
  return raw.replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 128);
}

export function parseNamespacedToolName(name: string): { serverId: string; originalName: string } | null {
  const raw = String(name ?? "");
  const idx = raw.indexOf("__");
  if (idx <= 0) return null;
  const serverId = raw.slice(0, idx);
  const originalName = raw.slice(idx + 2);
  if (!serverId || !originalName) return null;
  return { serverId, originalName };
}

function stableHash(value: any): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(Date.now());
  }
}

function normalizeParameters(inputSchema: any): any {
  const schema = inputSchema ?? { type: "object", properties: {} };
  if (typeof schema !== "object" || schema === null) {
    return { type: "object", properties: {} };
  }
  if (!("type" in schema)) {
    return { type: "object", ...(schema as any) };
  }
  return schema;
}

function riskForTool(originalName: string, serverId: string): ToolRiskLevel {
  const name = `${serverId}:${originalName}`.toLowerCase();
  if (/(delete|remove|rm|wipe|drop|kill|shutdown|stop|terminate)/i.test(name)) return "high";
  if (/(scan_database|scan|scrape|web_intelligence|upload|download|write|create|update)/i.test(name)) return "medium";
  return "low";
}

function categoryForTool(originalName: string, serverId: string): string {
  const name = `${serverId}:${originalName}`.toLowerCase();
  if (name.includes("chrome") || name.includes("devtools")) return "browser";
  if (name.includes("github")) return "github";
  if (name.includes("taqwin")) return "taqwin";
  if (name.includes("web_") || name.includes("search") || name.includes("extract")) return "web";
  return "mcp";
}

function permissionForTool(originalName: string, runtime: ServerRuntime): ToolPermission {
  const allow = Array.isArray(runtime.allowed_tools) ? runtime.allowed_tools : [];
  const block = Array.isArray(runtime.blocked_tools) ? runtime.blocked_tools : [];
  if (block.includes("*") || block.includes(originalName)) {
    return { allowed: false, reason: "blocked_by_config" };
  }
  if (allow.length > 0 && !allow.includes("*") && !allow.includes(originalName)) {
    return { allowed: false, reason: "not_in_allowlist" };
  }
  const riskyByName = new Set([
    "delete_file",
    "scan_database",
    "web_intelligence",
    "mcp_taqwin_scan_database",
    "mcp_taqwin_web_intelligence",
  ]);
  const trust = knezClient.getProfile().trustLevel;
  const risk = riskForTool(originalName, runtime.serverId);
  if (trust !== "verified" && (riskyByName.has(originalName) || risk === "high")) {
    return { allowed: false, reason: "unverified_knez_profile" };
  }
  return { allowed: true };
}

function toolToMeta(tool: McpToolDefinition, runtime: ServerRuntime): ExposedToolMeta {
  const originalName = String(tool?.name ?? "").trim();
  const name = namespaceToolName(runtime.serverId, originalName);
  const description = String(tool?.description ?? "").trim();
  const parameters = normalizeParameters(tool?.inputSchema);
  const riskLevel = riskForTool(originalName, runtime.serverId);
  const category = categoryForTool(originalName, runtime.serverId);
  const permission = permissionForTool(originalName, runtime);
  const schemaHash = stableHash({ serverId: runtime.serverId, originalName, parameters, description });
  return {
    name,
    description,
    parameters,
    serverId: runtime.serverId,
    originalName,
    authority: runtime.authority,
    riskLevel,
    category,
    permission,
    schemaHash
  };
}

export class ToolExposureService {
  private snapshot: ToolExposureSnapshot = { tools: [], toolsForModel: [] };
  private subscribers = new Set<() => void>();

  constructor() {
    mcpOrchestrator.subscribe(() => {
      this.rebuild();
    });
    this.rebuild();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  getSnapshot(): ToolExposureSnapshot {
    return this.snapshot;
  }

  getCatalog(): ExposedToolMeta[] {
    return this.snapshot.tools.slice();
  }

  getToolsForModel(): Array<{ name: string; description: string; parameters: any }> {
    return this.snapshot.toolsForModel.slice();
  }

  getToolByName(namespacedName: string): ExposedToolMeta | null {
    return this.snapshot.tools.find((t) => t.name === namespacedName) ?? null;
  }

  private emit() {
    for (const fn of this.subscribers) {
      try {
        fn();
      } catch {}
    }
  }

  private rebuild() {
    const { servers } = mcpOrchestrator.getSnapshot();
    const tools: ExposedToolMeta[] = [];

    for (const runtime of Object.values(servers)) {
      if (runtime.state !== "READY") continue;
      for (const t of runtime.tools ?? []) {
        if (!t?.name) continue;
        tools.push(toolToMeta(t, runtime));
      }
    }

    tools.sort((a, b) => a.name.localeCompare(b.name));

    const toolsForModel = tools
      .filter((t) => t.permission.allowed)
      .map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }));

    this.snapshot = { tools, toolsForModel };
    this.emit();
  }
}

export const toolExposureService = new ToolExposureService();
