import { mcpOrchestrator } from "../../mcp/McpOrchestrator";
import { classifyMcpError, type McpErrorClassification } from "../../mcp/McpErrorTaxonomy";
import { toolExposureService, type ExposedToolMeta } from '../mcp/ToolExposureService';
import { governanceService } from "../governance/GovernanceService";

export type ToolExecutionDenied = {
  ok: false;
  kind: "denied";
  error: McpErrorClassification;
  tool: { namespacedName: string; serverId?: string; originalName?: string };
};

export type ToolExecutionFailed = {
  ok: false;
  kind: "failed";
  error: McpErrorClassification;
  tool: { namespacedName: string; serverId?: string; originalName?: string };
  durationMs?: number;
};

export type ToolExecutionSucceeded = {
  ok: true;
  kind: "succeeded";
  tool: { namespacedName: string; serverId: string; originalName: string };
  durationMs: number;
  result: any;
};

export type ToolExecutionOutcome = ToolExecutionDenied | ToolExecutionFailed | ToolExecutionSucceeded;

export class ToolExecutionService {
  resolveNamespacedName(serverId: string, originalName: string): string | null {
    const found =
      toolExposureService.getCatalog().find((t) => t.serverId === serverId && t.originalName === originalName) ?? null;
    return found?.name ?? null;
  }

  private validateNamespacedName(namespacedName: string): boolean {
    const raw = String(namespacedName ?? "");
    if (!raw) return false;
    if (raw.length > 128) return false;
    if (raw.includes(" ") || raw.includes("\n") || raw.includes("\r") || raw.includes("\t")) return false;
    const m = raw.match(/^([a-zA-Z0-9_-]{1,64})__([a-zA-Z0-9_:-]{1,64})$/);
    return Boolean(m && m[1] && m[2]);
  }

  private getMeta(namespacedName: string): ExposedToolMeta | null {
    return toolExposureService.getToolByName(namespacedName);
  }

  async executeNamespacedTool(
    namespacedName: string,
    args: any,
    opts?: { timeoutMs?: number; traceId?: string; toolCallId?: string; correlationId?: string }
  ): Promise<ToolExecutionOutcome> {
    const toolName = String(namespacedName ?? "");
    if (!this.validateNamespacedName(toolName)) {
      return {
        ok: false,
        kind: "denied",
        error: { code: "mcp_tool_not_found", message: "tool_name_not_namespaced" },
        tool: { namespacedName: toolName }
      };
    }

    const meta = this.getMeta(toolName);
    if (!meta) {
      return {
        ok: false,
        kind: "denied",
        error: { code: "mcp_tool_not_found", message: "tool_not_in_catalog" },
        tool: { namespacedName: toolName }
      };
    }

    const runtime = mcpOrchestrator.getServer(meta.serverId);
    if (!runtime) {
      return {
        ok: false,
        kind: "denied",
        error: { code: "mcp_not_started", message: "server_not_registered" },
        tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName }
      };
    }

    const gov = await governanceService.decideTool(meta, runtime);
    if (!gov.allowed) {
      return {
        ok: false,
        kind: "denied",
        error: { code: "mcp_permission_denied", message: gov.reason ?? "blocked_by_governance" },
        tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName }
      };
    }

    try {
      if (runtime.state !== "READY") {
        return {
          ok: false,
          kind: "denied",
          error: { code: "mcp_not_ready", message: runtime.state },
          tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName }
        };
      }

      const tools = mcpOrchestrator.getServerTools(meta.serverId);
      if (!tools.some((t) => t?.name === meta.originalName)) {
        return {
          ok: false,
          kind: "denied",
          error: { code: "mcp_tool_not_found", message: meta.originalName },
          tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName }
        };
      }

      const timeoutMs = opts?.timeoutMs ?? 180000;
      const callOpts: {
        timeoutMs: number;
        traceId?: string;
        toolCallId?: string;
        correlationId?: string;
      } = { timeoutMs };
      if (typeof opts?.traceId === "string" && opts.traceId.trim()) callOpts.traceId = opts.traceId.trim();
      if (typeof opts?.toolCallId === "string" && opts.toolCallId.trim()) callOpts.toolCallId = opts.toolCallId.trim();
      if (typeof opts?.correlationId === "string" && opts.correlationId.trim()) callOpts.correlationId = opts.correlationId.trim();
      const res = await mcpOrchestrator.callTool(meta.serverId, meta.originalName, args, callOpts);
      return {
        ok: true,
        kind: "succeeded",
        tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName },
        durationMs: res.durationMs,
        result: res.result
      };
    } catch (e: any) {
      const classified = classifyMcpError(String(e?.message ?? e));
      return {
        ok: false,
        kind: "failed",
        error: classified,
        tool: { namespacedName: toolName, serverId: meta.serverId, originalName: meta.originalName }
      };
    }
  }
}

export const toolExecutionService = new ToolExecutionService();
