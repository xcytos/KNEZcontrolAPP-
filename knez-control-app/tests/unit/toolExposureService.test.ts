import { describe, expect, it, vi } from "vitest";

type MockRuntime = {
  serverId: string;
  authority: "rust" | "ts";
  enabled: boolean;
  start_on_boot: boolean;
  allowed_tools: string[];
  blocked_tools: string[];
  type: "stdio" | "http";
  tags: string[];
  state: "READY" | "IDLE" | "ERROR" | "INITIALIZED" | "STARTING" | "LISTING_TOOLS";
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line" | "http";
  generation: number;
  lastOkAt: number | null;
  initializedAt: number | null;
  initializeDurationMs: number | null;
  toolsListDurationMs: number | null;
  lastError: string | null;
  tools: Array<{ name: string; description?: string; inputSchema?: any }>;
  toolsHash: string | null;
  toolsCacheAt: number | null;
  toolsPending: boolean;
};

describe("ToolExposureService", () => {
  it("namespaces tools, normalizes parameters, and filters risky tools when unverified", async () => {
    vi.resetModules();

    let trustLevel: "verified" | "untrusted" = "untrusted";
    const snapshot: { servers: Record<string, MockRuntime> } = {
      servers: {
        taqwin: {
          serverId: "taqwin",
          authority: "rust",
          enabled: true,
          start_on_boot: false,
          allowed_tools: [],
          blocked_tools: [],
          type: "stdio",
          tags: [],
          state: "READY",
          pid: 1,
          running: true,
          framing: "content-length",
          generation: 1,
          lastOkAt: Date.now(),
          initializedAt: Date.now(),
          initializeDurationMs: 10,
          toolsListDurationMs: 10,
          lastError: null,
          tools: [
            { name: "debug_test", description: "ping", inputSchema: {} },
            { name: "delete_file", description: "danger", inputSchema: { type: "object", properties: { file_paths: { type: "array" } } } },
          ],
          toolsHash: "h",
          toolsCacheAt: Date.now(),
          toolsPending: false,
        },
      },
    };

    const subs = new Set<() => void>();
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        subscribe: (fn: () => void) => {
          subs.add(fn);
          return () => subs.delete(fn);
        },
        getSnapshot: () => snapshot,
      },
    }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        getProfile: () => ({ trustLevel }),
      },
    }));

    const mod = await import("../../src/services/ToolExposureService");
    const svc = new mod.ToolExposureService();

    const catalog = svc.getCatalog();
    expect(catalog.some((t) => t.name === "taqwin__debug_test")).toBe(true);
    expect(catalog.some((t) => t.name === "taqwin__delete_file")).toBe(true);

    const debug = catalog.find((t) => t.name === "taqwin__debug_test")!;
    expect(debug.parameters?.type).toBe("object");

    const blocked = catalog.find((t) => t.name === "taqwin__delete_file")!;
    expect(blocked.permission.allowed).toBe(false);

    const toolsForModel = svc.getToolsForModel();
    expect(toolsForModel.some((t) => t.name === "taqwin__debug_test")).toBe(true);
    expect(toolsForModel.some((t) => t.name === "taqwin__delete_file")).toBe(false);

    trustLevel = "verified";
    subs.forEach((fn) => fn());
    const toolsForModel2 = svc.getToolsForModel();
    expect(toolsForModel2.some((t) => t.name === "taqwin__delete_file")).toBe(true);
  });

  it("parses namespaced tool names", async () => {
    const mod = await import("../../src/services/ToolExposureService");
    expect(mod.parseNamespacedToolName("taqwin__debug_test")).toEqual({ serverId: "taqwin", originalName: "debug_test" });
    expect(mod.parseNamespacedToolName("badname")).toBeNull();
  });

  it("enforces per-server allowed_tools and blocked_tools", async () => {
    vi.resetModules();
    const snapshot: { servers: Record<string, MockRuntime> } = {
      servers: {
        taqwin: {
          serverId: "taqwin",
          authority: "rust",
          enabled: true,
          start_on_boot: false,
          allowed_tools: ["debug_test"],
          blocked_tools: ["delete_file"],
          type: "stdio",
          tags: [],
          state: "READY",
          pid: 1,
          running: true,
          framing: "content-length",
          generation: 1,
          lastOkAt: Date.now(),
          initializedAt: Date.now(),
          initializeDurationMs: 10,
          toolsListDurationMs: 10,
          lastError: null,
          tools: [
            { name: "debug_test", description: "ping", inputSchema: {} },
            { name: "delete_file", description: "danger", inputSchema: { type: "object", properties: {} } },
          ],
          toolsHash: "h",
          toolsCacheAt: Date.now(),
          toolsPending: false,
        },
      },
    };

    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        subscribe: () => () => {},
        getSnapshot: () => snapshot,
      },
    }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        getProfile: () => ({ trustLevel: "verified" }),
      },
    }));

    const mod = await import("../../src/services/ToolExposureService");
    const svc = new mod.ToolExposureService();
    const catalog = svc.getCatalog();
    expect(catalog.find((t) => t.name === "taqwin__debug_test")?.permission.allowed).toBe(true);
    expect(catalog.find((t) => t.name === "taqwin__delete_file")?.permission.allowed).toBe(false);
  });
});
