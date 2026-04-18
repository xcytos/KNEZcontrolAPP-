import { describe, expect, it, vi } from "vitest";

describe("ToolExecutionService", () => {
  it("denies tool execution when governance blocks the tool", async () => {
    vi.resetModules();

    vi.doMock("../../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getCatalog: () => [],
        getToolByName: () => ({
          name: "taqwin__scan_database",
          serverId: "taqwin",
          originalName: "scan_database",
          riskLevel: "high",
          category: "taqwin",
          authority: "rust",
          description: "",
          parameters: { type: "object", properties: {} },
          schemaHash: "h"
        }),
      },
    }));
    vi.doMock("../../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: false, reason: "blocked_by_governance" }),
      }
    }));
    vi.doMock("../../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, allowed_tools: [], blocked_tools: [] }),
      },
    }));

    const mod = await import("../../../src/services/ToolExecutionService");
    const out = await mod.toolExecutionService.executeNamespacedTool("taqwin__scan_database", { q: 1 });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("mcp_permission_denied");
    }
  });

  it("returns mcp_not_ready when server is not READY", async () => {
    vi.resetModules();

    vi.doMock("../../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getCatalog: () => [],
        getToolByName: () => ({
          name: "taqwin__debug_test",
          serverId: "taqwin",
          originalName: "debug_test",
          riskLevel: "low",
          category: "taqwin",
          authority: "rust",
          description: "",
          parameters: { type: "object", properties: {} },
          schemaHash: "h"
        }),
      },
    }));
    vi.doMock("../../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: true }),
      }
    }));
    vi.doMock("../../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "IDLE", running: false, allowed_tools: [], blocked_tools: [] }),
        getServerTools: () => [],
      },
    }));

    const mod = await import("../../../src/services/ToolExecutionService");
    const out = await mod.toolExecutionService.executeNamespacedTool("taqwin__debug_test", {});
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("mcp_not_ready");
    }
  });
});
