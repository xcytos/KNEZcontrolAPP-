import { describe, expect, it, vi } from "vitest";

describe.skip("MCP boot init (skipped - incomplete mock)", () => {
  it("loads MCP config exactly once on app boot init", async () => {
    vi.resetModules();
    const loadConfig = vi.fn(async () => {});
    vi.doMock("../../../src/mcp/inspector/McpInspectorService", () => ({
      mcpInspectorService: { loadConfig, subscribe: () => () => {}, getStatusById: () => new Map(), getServers: () => [] }
    }));

    const { initMcpBoot } = await import("../../../src/mcp/mcpBoot");
    await initMcpBoot();
    await initMcpBoot();
    expect(loadConfig).toHaveBeenCalledTimes(1);
  });
});

