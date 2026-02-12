import { describe, expect, it, vi } from "vitest";

describe("ToolExecutionService", () => {
  it("denies tool execution when governance blocks the tool", async () => {
    vi.resetModules();

    vi.doMock("../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getCatalog: () => [],
        getToolByName: () => ({
          name: "taqwin__scan_database",
          serverId: "taqwin",
          originalName: "scan_database",
          riskLevel: "high",
          permission: { allowed: true }
        }),
      },
    }));
    vi.doMock("../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: false, reason: "blocked_by_governance" }),
      }
    }));
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ state: "READY", running: true }),
      },
    }));

    const mod = await import("../../src/services/ToolExecutionService");
    const out = await mod.toolExecutionService.executeNamespacedTool("taqwin__scan_database", { q: 1 });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("mcp_permission_denied");
    }
  });
});

