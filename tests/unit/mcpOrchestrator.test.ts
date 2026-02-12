import { describe, expect, it, vi } from "vitest";

describe("McpOrchestrator", () => {
  it("invalidates tools when Rust generation changes", async () => {
    vi.resetModules();
    (globalThis as any).window = (globalThis as any).window ?? ({} as any);
    (globalThis as any).window.__TAURI_INTERNALS__ = {};

    const statusById: Record<string, any> = {
      taqwin: {
        id: "taqwin",
        enabled: true,
        tags: [],
        type: "stdio",
        state: "READY",
        pid: 1,
        running: true,
        framing: "content-length",
        lastOkAt: Date.now(),
        initializedAt: Date.now(),
        initializeDurationMs: 10,
        toolsListDurationMs: 10,
        lastError: null,
        toolsCached: 2,
        toolsCacheAt: Date.now(),
        toolsPending: false,
        stdoutTail: null,
        stderrTail: null,
      }
    };
    let tools: any[] = [{ name: "debug_test" }, { name: "get_server_status" }];
    const subs = new Set<() => void>();

    vi.doMock("../../src/mcp/inspector/McpInspectorService", () => ({
      mcpInspectorService: {
        subscribe: (fn: () => void) => {
          subs.add(fn);
          return () => subs.delete(fn);
        },
        getStatusById: () => statusById,
        getTools: (_id: string) => tools,
        getServers: () => [{ id: "taqwin", enabled: true, type: "stdio", tags: [], start_on_boot: false, allowed_tools: [], blocked_tools: [] }],
        listTools: async () => tools,
        callTool: async () => ({ result: { ok: true }, durationMs: 1 }),
        start: async () => {},
        stop: async () => {},
        restart: async () => {},
        handshake: async () => tools,
      }
    }));
    vi.doMock("../../src/mcp/authority", () => ({
      getMcpAuthority: () => "rust",
    }));

    let stateListener: any = null;
    vi.doMock("@tauri-apps/api/event", () => ({
      listen: async (_event: string, fn: any) => {
        stateListener = fn;
        return () => {};
      }
    }));
    vi.doMock("../../src/services/LogService", () => ({
      logger: { info: () => {}, warn: () => {}, debug: () => {} }
    }));

    const mod = await import("../../src/mcp/McpOrchestrator");
    const orch = new mod.McpOrchestrator();

    stateListener?.({ payload: { kind: "state", serverId: "taqwin", generation: 1 } });
    subs.forEach((fn) => fn());

    const snap1 = orch.getSnapshot();
    expect(snap1.servers.taqwin.generation).toBe(1);
    expect(snap1.servers.taqwin.state).toBe("READY");
    expect(snap1.servers.taqwin.tools.length).toBe(2);

    stateListener?.({ payload: { kind: "state", serverId: "taqwin", generation: 2 } });
    subs.forEach((fn) => fn());

    const snap2 = orch.getSnapshot();
    expect(snap2.servers.taqwin.generation).toBe(2);
    expect(snap2.servers.taqwin.state).toBe("INITIALIZED");
    expect(snap2.servers.taqwin.tools.length).toBe(0);
  });

  it("auto-starts enabled servers with start_on_boot", async () => {
    vi.resetModules();
    (globalThis as any).window = (globalThis as any).window ?? ({} as any);
    (globalThis as any).window.__TAURI_INTERNALS__ = {};

    const handshake = vi.fn(async () => [{ name: "debug_test" }]);
    const subs = new Set<() => void>();
    const statusById: Record<string, any> = {
      taqwin: {
        id: "taqwin",
        enabled: true,
        tags: [],
        type: "stdio",
        state: "IDLE",
        pid: null,
        running: false,
        framing: "content-length",
        lastOkAt: null,
        initializedAt: null,
        initializeDurationMs: null,
        toolsListDurationMs: null,
        lastError: null,
        toolsCached: 0,
        toolsCacheAt: null,
        toolsPending: false,
        stdoutTail: null,
        stderrTail: null,
      }
    };

    vi.doMock("../../src/mcp/inspector/McpInspectorService", () => ({
      mcpInspectorService: {
        subscribe: (fn: () => void) => {
          subs.add(fn);
          return () => subs.delete(fn);
        },
        getStatusById: () => statusById,
        getTools: () => [],
        getServers: () => [{ id: "taqwin", enabled: true, type: "stdio", tags: [], start_on_boot: true, allowed_tools: [], blocked_tools: [] }],
        handshake,
        listTools: async () => [],
        callTool: async () => ({ result: { ok: true }, durationMs: 1 }),
        start: async () => {},
        stop: async () => {},
        restart: async () => {},
      }
    }));
    vi.doMock("../../src/mcp/authority", () => ({
      getMcpAuthority: () => "rust",
    }));
    vi.doMock("@tauri-apps/api/event", () => ({
      listen: async () => () => {}
    }));
    vi.doMock("../../src/services/LogService", () => ({
      logger: { info: () => {}, warn: () => {}, debug: () => {} }
    }));

    const mod = await import("../../src/mcp/McpOrchestrator");
    new mod.McpOrchestrator();

    await Promise.resolve();
    expect(handshake).toHaveBeenCalled();
  });
});

