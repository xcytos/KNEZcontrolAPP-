import { describe, expect, it, vi } from "vitest";

describe("ChatService MCP signature drift guard", () => {
  it("prepends a refresh system message when MCP signature changes mid-session", async () => {
    vi.resetModules();

    (globalThis as any).window = (globalThis as any).window ?? ({} as any);
    (globalThis as any).window.setInterval = () => 0;
    (globalThis as any).window.clearInterval = () => {};
    (globalThis as any).window.setTimeout = (globalThis as any).window.setTimeout ?? setTimeout;
    (globalThis as any).window.clearTimeout = (globalThis as any).window.clearTimeout ?? clearTimeout;
    (globalThis as any).localStorage = (globalThis as any).localStorage ?? {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };

    const chatCompletionsStream = vi.fn(async function* () {
      yield "ok";
    });

    let injectCall = 0;
    vi.doMock("../../src/services/MemoryInjectionService", () => ({
      memoryInjectionService: {
        inject: async () => {
          injectCall++;
          const sig = injectCall === 1 ? "sig_a" : "sig_b";
          return { signature: sig, messages: [{ role: "system", content: `sig=${sig}` }, { role: "user", content: "hi" }] };
        }
      }
    }));

    vi.doMock("../../src/services/SessionDatabase", () => {
      const out: any = {
        u1: { id: "u1", sessionId: "sid", createdAt: new Date().toISOString(), attempts: 0, status: "queued", text: "hello", searchEnabled: false },
        u2: { id: "u2", sessionId: "sid", createdAt: new Date().toISOString(), attempts: 0, status: "queued", text: "hello2", searchEnabled: false },
      };
      return {
        sessionDatabase: {
          getOutgoing: async (id: string) => out[id] ?? null,
          updateOutgoing: async () => {},
          removeOutgoing: async () => {},
          saveMessages: async () => {},
          updateMessage: async () => {},
        }
      };
    });
    vi.doMock("../../src/services/PersistenceService", () => ({
      persistenceService: {
        loadChat: async (sessionId: string) => [
          { id: "u1", sessionId, from: "user", text: "hello", createdAt: new Date().toISOString(), deliveryStatus: "delivered" },
          { id: "u1-assistant", sessionId, from: "knez", text: "", createdAt: new Date().toISOString(), deliveryStatus: "pending", isPartial: true }
        ]
      }
    }));
    vi.doMock("../../src/services/SessionController", () => ({
      sessionController: {
        getSessionId: () => "sid",
        subscribe: () => () => {},
      }
    }));
    vi.doMock("../../src/services/ExtractionService", () => ({ extractionService: {} }));
    vi.doMock("../../src/services/TabErrorStore", () => ({ tabErrorStore: { set: () => {}, mark: () => {} } }));
    vi.doMock("../../src/utils/observer", () => ({ observe: () => {} }));
    vi.doMock("../../src/utils/health", () => ({ selectPrimaryBackend: () => null }));
    vi.doMock("../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getToolsForModel: () => [],
        getToolByName: () => null,
        getCatalog: () => [],
      }
    }));
    vi.doMock("../../src/services/GovernanceService", () => ({
      governanceService: {
        isExternalFetchAllowed: async () => false,
        decideTool: async () => ({ allowed: true }),
        getSnapshot: async () => ({ snapshot: null, combinedSha256: null })
      }
    }));
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => null,
        getSnapshot: () => ({ servers: {} }),
      }
    }));
    vi.doMock("../../src/services/ToolExecutionService", () => ({
      toolExecutionService: {
        executeNamespacedTool: async () => ({ ok: false, kind: "denied", error: { code: "mcp_tool_not_found", message: "x" }, tool: { namespacedName: "x" } }),
        resolveNamespacedName: () => null,
      }
    }));
    vi.doMock("../../src/services/LogService", () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        chatCompletionsStream,
        health: async () => ({ ok: true, backends: [] }),
        emitEvent: async () => {},
        getToolCallingSupport: async () => "supported",
      }
    }));

    const { ChatService } = await import("../../src/services/ChatService");
    const svc = new ChatService();

    await (svc as any).deliverQueueItem("u1");
    await (svc as any).deliverQueueItem("u2");

    const secondCallMessages = chatCompletionsStream.mock.calls[1][0] as Array<{ role: string; content: string }>;
    expect(secondCallMessages[0]?.role).toBe("system");
    expect(secondCallMessages[0]?.content).toBe("MCP generation changed; tool catalog refreshed.");
  });
});
