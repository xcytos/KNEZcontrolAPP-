import { mcpOrchestrator, type ServerRuntime } from "../mcp/McpOrchestrator";
import type { McpToolDefinition } from "./McpTypes";
import type { McpAuthority } from "../mcp/authority";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ExposedToolMeta = {
  name: string;
  description: string;
  parameters: any;
  serverId: string;
  originalName: string;
  authority: McpAuthority;
  riskLevel: ToolRiskLevel;
  category: string;
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

function toolToMeta(tool: McpToolDefinition, runtime: ServerRuntime): ExposedToolMeta {
  const originalName = String(tool?.name ?? "").trim();
  const name = namespaceToolName(runtime.serverId, originalName);
  const description = String(tool?.description ?? "").trim();
  const parameters = normalizeParameters(tool?.inputSchema);
  const riskLevel = riskForTool(originalName, runtime.serverId);
  const category = categoryForTool(originalName, runtime.serverId);
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
