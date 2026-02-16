import { describe, expect, it, vi } from "vitest";

describe("MCP authority: process crash flips READY to ERROR", () => {
  it("flips orchestrator snapshot to ERROR on next poll tick", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    (globalThis as any).window = (globalThis as any).window ?? ({} as any);
    (globalThis as any).window.setInterval = (globalThis as any).window.setInterval ?? setInterval;
    (globalThis as any).window.clearInterval = (globalThis as any).window.clearInterval ?? clearInterval;
    (globalThis as any).window.setTimeout = (globalThis as any).window.setTimeout ?? setTimeout;
    (globalThis as any).window.clearTimeout = (globalThis as any).window.clearTimeout ?? clearTimeout;

    vi.doMock("../../src/mcp/client/McpStdioClient", () => {
      class McpStdioClient {
        running = false;
        pid = 123;
        lastError: string | null = null;
        requestFraming: "content-length" | "line" = "content-length";
        async startWithConfig() {
          this.running = true;
        }
        async stop() {
          this.running = false;
          this.lastError = this.lastError ?? "mcp_process_crashed";
        }
        async initialize() {
          return { ok: true };
        }
        async listTools() {
          return [{ name: "debug_test", description: "ping", inputSchema: { type: "object", properties: {} } }];
        }
        async callTool() {
          return { ok: true };
        }
        getDebugState() {
          return {
            running: this.running,
            pid: this.pid,
            requestFraming: this.requestFraming,
            stdoutTail: null,
            stderrTail: null,
            lastError: this.lastError
          };
        }
        getTraffic() {
          return [];
        }
        __setRunning(next: boolean) {
          this.running = next;
          if (!next) this.lastError = this.lastError ?? "mcp_process_crashed";
        }
      }
      return { McpStdioClient };
    });
    vi.doMock("../../src/mcp/client/McpHttpClient", () => ({ McpHttpClient: class {} }));
    vi.doMock("../../src/mcp/client/McpRustClient", () => ({ McpRustClient: class {} }));
    vi.doMock("../../src/mcp/authority", () => ({ getMcpAuthority: () => "stdio" }));
    vi.doMock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
    vi.doMock("../../src/services/LogService", () => ({ logger: { info: () => {}, warn: () => {}, debug: () => {} } }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        getProfile: () => ({ endpoint: "http://localhost:8000", trustLevel: "verified" }),
        health: async () => ({ ok: true }),
        emitEvent: async () => {},
      }
    }));

    const { mcpInspectorService } = await import("../../src/mcp/inspector/McpInspectorService");
    const { McpOrchestrator } = await import("../../src/mcp/McpOrchestrator");

    mcpInspectorService.applyConfig(
      JSON.stringify({
        schema_version: "1",
        inputs: [],
        servers: {
          taqwin: {
            command: "python",
            args: ["-u", "x.py"],
            env: { PYTHONUNBUFFERED: "1" },
            enabled: true,
            start_on_boot: false,
          }
        }
      })
    );

    await mcpInspectorService.handshake("taqwin", { toolsListTimeoutMs: 2000 });
    const orch = new McpOrchestrator();
    expect(orch.getServer("taqwin")?.state).toBe("READY");

    const client: any = mcpInspectorService.getClientInstance("taqwin");
    client.__setRunning(false);

    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();

    expect(orch.getServer("taqwin")?.state).toBe("ERROR");
  });
});

