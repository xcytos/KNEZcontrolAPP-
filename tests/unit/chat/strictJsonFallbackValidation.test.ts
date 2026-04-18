import { describe, expect, it, vi } from "vitest";

describe("Strict JSON fallback validation", () => {
  it("ignores prose + JSON tool_call mixes", async () => {
    vi.resetModules();

    const callTool = vi.fn(async () => ({ result: { ok: true }, durationMs: 5 }));
    const chatCompletionsNonStreamRaw = vi.fn(async () => ({
      id: "1",
      object: "chat.completion",
      choices: [
        {
          message: {
            role: "assistant",
            content: 'Here is what I will do: {"tool_call":{"name":"taqwin__debug_test","arguments":{"message":"ping"}}}'
          }
        }
      ]
    }));

    vi.doMock("../../../src/services/SessionDatabase", () => ({
      sessionDatabase: {
        saveMessages: async () => {},
        updateMessage: async () => {},
        listOutgoing: async () => [],
        getOutgoing: async () => null,
        updateOutgoing: async () => {},
        removeOutgoing: async () => {},
        getMessage: async () => null,
      },
    }));
    vi.doMock("../../../src/services/SessionController", () => ({
      sessionController: { getSessionId: () => "sid", subscribe: () => () => {}, createNewSession: () => "sid" },
    }));
    vi.doMock("../../../src/services/PersistenceService", () => ({ persistenceService: { loadChat: async () => [] } }));
    vi.doMock("../../../src/services/ExtractionService", () => ({ extractionService: {} }));
    vi.doMock("../../../src/services/TabErrorStore", () => ({ tabErrorStore: { set: () => {}, mark: () => {} } }));
    vi.doMock("../../../src/utils/observer", () => ({ observe: (_fn: any) => {} }));
    vi.doMock("../../../src/services/KnezClient", () => ({ knezClient: { chatCompletionsNonStreamRaw, emitEvent: async () => {} } }));
    vi.doMock("../../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, pid: 1, framing: "line", generation: null, allowed_tools: [], blocked_tools: [] }),
        getServerTools: () => [{ name: "debug_test" }],
        callTool,
      }
    }));
    vi.doMock("../../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getToolsForModel: () => [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }],
        getToolByName: () => ({
          name: "taqwin__debug_test",
          description: "ping",
          parameters: { type: "object" },
          serverId: "taqwin",
          originalName: "debug_test",
          authority: "rust",
          riskLevel: "low",
          category: "taqwin",
          schemaHash: "h"
        }),
        getCatalog: () => [],
      }
    }));
    vi.doMock("../../../src/services/GovernanceService", () => ({ governanceService: { decideTool: async () => ({ allowed: true }) } }));
    vi.doMock("../../../src/utils/health", () => ({ selectPrimaryBackend: () => null }));
    vi.doMock("../../../src/services/LogService", () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

    const mod = await import("../../../src/services/ChatService");
    const svc = new mod.ChatService();
    const out = await (svc as any).runPromptToolLoop(
      "sid",
      [{ role: "user", content: "hi" }],
      "assistant",
      [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }]
    );

    expect(out).toContain('{"tool_call"');
    expect(callTool).not.toHaveBeenCalled();
  });

  it("rejects JSON tool_call with extra root keys", async () => {
    vi.resetModules();

    const callTool = vi.fn(async () => ({ result: { ok: true }, durationMs: 5 }));
    const chatCompletionsNonStreamRaw = vi.fn(async () => ({
      id: "1",
      object: "chat.completion",
      choices: [
        {
          message: {
            role: "assistant",
            content: '{"tool_call":{"name":"taqwin__debug_test","arguments":{"message":"ping"}},"x":1}'
          }
        }
      ]
    }));

    vi.doMock("../../../src/services/SessionDatabase", () => ({
      sessionDatabase: {
        saveMessages: async () => {},
        updateMessage: async () => {},
        listOutgoing: async () => [],
        getOutgoing: async () => null,
        updateOutgoing: async () => {},
        removeOutgoing: async () => {},
        getMessage: async () => null,
      },
    }));
    vi.doMock("../../../src/services/SessionController", () => ({
      sessionController: { getSessionId: () => "sid", subscribe: () => () => {}, createNewSession: () => "sid" },
    }));
    vi.doMock("../../../src/services/PersistenceService", () => ({ persistenceService: { loadChat: async () => [] } }));
    vi.doMock("../../../src/services/ExtractionService", () => ({ extractionService: {} }));
    vi.doMock("../../../src/services/TabErrorStore", () => ({ tabErrorStore: { set: () => {}, mark: () => {} } }));
    vi.doMock("../../../src/utils/observer", () => ({ observe: (_fn: any) => {} }));
    vi.doMock("../../../src/services/KnezClient", () => ({ knezClient: { chatCompletionsNonStreamRaw, emitEvent: async () => {} } }));
    vi.doMock("../../../src/services/ToolExposureService", () => ({
      toolExposureService: {
        getToolsForModel: () => [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }],
        getToolByName: () => ({
          name: "taqwin__debug_test",
          description: "ping",
          parameters: { type: "object" },
          serverId: "taqwin",
          originalName: "debug_test",
          authority: "rust",
          riskLevel: "low",
          category: "taqwin",
          schemaHash: "h"
        }),
        getCatalog: () => [],
      }
    }));
    vi.doMock("../../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, pid: 1, framing: "line", generation: null, allowed_tools: [], blocked_tools: [] }),
        getServerTools: () => [{ name: "debug_test" }],
        callTool,
      }
    }));
    vi.doMock("../../../src/services/GovernanceService", () => ({ governanceService: { decideTool: async () => ({ allowed: true }) } }));
    vi.doMock("../../../src/utils/health", () => ({ selectPrimaryBackend: () => null }));
    vi.doMock("../../../src/services/LogService", () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

    const mod = await import("../../../src/services/ChatService");
    const svc = new mod.ChatService();
    const out = await (svc as any).runPromptToolLoop(
      "sid",
      [{ role: "user", content: "hi" }],
      "assistant",
      [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }]
    );

    expect(out).toContain('"tool_call"');
    expect(callTool).not.toHaveBeenCalled();
  });
});
