import { describe, expect, it, vi } from "vitest";

describe("ChatService tool loop", () => {
  it("executes tool_calls and returns final assistant content", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const saveMessages = vi.fn(async () => {});
    const updateMessage = vi.fn(async () => {});
    const callTool = vi.fn(async (_serverId: string, _name: string, _args: any) => ({ result: { ok: true }, durationMs: 5 }));

    let callIndex = 0;
    const chatCompletionsNonStreamRaw = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return {
          id: "1",
          object: "chat.completion",
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "tc_1",
                    type: "function",
                    function: { name: "taqwin__debug_test", arguments: "{\"message\":\"ping\"}" }
                  }
                ]
              }
            }
          ]
        };
      }
      return {
        id: "2",
        object: "chat.completion",
        choices: [
          {
            message: {
              role: "assistant",
              content: "done"
            }
          }
        ]
      };
    });

    vi.doMock("../../src/services/SessionDatabase", () => ({
      sessionDatabase: {
        saveMessages,
        updateMessage,
        listOutgoing: async () => [],
        getOutgoing: async () => null,
        updateOutgoing: async () => {},
        removeOutgoing: async () => {},
        getMessage: async () => null,
      },
    }));
    vi.doMock("../../src/services/SessionController", () => ({
      sessionController: {
        getSessionId: () => "sid",
        subscribe: () => () => {},
        createNewSession: () => "sid",
      },
    }));
    vi.doMock("../../src/services/PersistenceService", () => ({
      persistenceService: {
        loadChat: async () => [],
      },
    }));
    vi.doMock("../../src/services/ExtractionService", () => ({
      extractionService: {},
    }));
    vi.doMock("../../src/services/TabErrorStore", () => ({
      tabErrorStore: { set: () => {} },
    }));
    vi.doMock("../../src/utils/observer", () => ({
      observe: (_fn: any) => {},
    }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        chatCompletionsNonStreamRaw,
        emitEvent: async () => {},
      },
    }));
    vi.doMock("../../src/services/ToolExposureService", () => ({
      toolExposureService: {
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
      },
    }));
    vi.doMock("../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: true }),
      }
    }));
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, pid: 1, framing: "line", generation: null, allowed_tools: [], blocked_tools: [] }),
        callTool,
        getServerTools: () => [{ name: "debug_test" }],
      },
    }));
    vi.doMock("../../src/utils/health", () => ({
      selectPrimaryBackend: () => null,
    }));

    const mod = await import("../../src/services/ChatService");
    const svc = new mod.ChatService();

    const text = await (svc as any).runNativeToolLoop(
      "sid",
      [{ role: "user", content: "hi" }],
      "assistant",
      [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }]
    );

    expect(text).toBe("done");
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith(
      "taqwin",
      "debug_test",
      { message: "ping" },
      expect.objectContaining({ timeoutMs: 180000 })
    );
    expect(saveMessages).toHaveBeenCalled();
    expect(updateMessage).toHaveBeenCalled();
  });

  it("invokes tools manually and updates tool trace", async () => {
    vi.resetModules();

    let saved: any[] = [];
    const saveMessages = vi.fn(async (_sid: string, msgs: any[]) => {
      saved = msgs;
    });
    const updateMessage = vi.fn(async () => {});

    const callTool = vi.fn(async () => ({ result: { ok: true } }));

    vi.doMock("../../src/services/SessionDatabase", () => ({
      sessionDatabase: {
        saveMessages,
        updateMessage,
        listOutgoing: async () => [],
        getOutgoing: async () => null,
        updateOutgoing: async () => {},
        removeOutgoing: async () => {},
        getMessage: async () => null,
      },
    }));
    vi.doMock("../../src/services/SessionController", () => ({
      sessionController: {
        getSessionId: () => "sid",
        subscribe: () => () => {},
        createNewSession: () => "sid",
      },
    }));
    vi.doMock("../../src/services/PersistenceService", () => ({
      persistenceService: { loadChat: async () => [] },
    }));
    vi.doMock("../../src/services/ExtractionService", () => ({ extractionService: {} }));
    vi.doMock("../../src/services/TabErrorStore", () => ({ tabErrorStore: { set: () => {} } }));
    vi.doMock("../../src/utils/observer", () => ({ observe: (_fn: any) => {} }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: { emitEvent: async () => {} },
    }));
    vi.doMock("../../src/services/ToolExposureService", () => ({
      toolExposureService: {
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
      },
    }));
    vi.doMock("../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: true }),
      }
    }));
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, pid: 1, framing: "line", generation: null, allowed_tools: [], blocked_tools: [] }),
        getServerTools: () => [{ name: "debug_test" }],
        callTool,
      },
    }));
    vi.doMock("../../src/utils/health", () => ({ selectPrimaryBackend: () => null }));

    const mod = await import("../../src/services/ChatService");
    const svc = new mod.ChatService();
    await svc.invokeToolManually("sid", "taqwin__debug_test", { message: "ping" });

    expect(saveMessages).toHaveBeenCalled();
    expect(saved[0]?.toolCall?.status).toBe("calling");
    expect(callTool).toHaveBeenCalledWith(
      "taqwin",
      "debug_test",
      { message: "ping" },
      expect.objectContaining({ timeoutMs: 180000 })
    );
    expect(updateMessage).toHaveBeenCalled();
  });

  it("executes strict JSON fallback tool_call protocol", async () => {
    vi.resetModules();

    const saveMessages = vi.fn(async () => {});
    const updateMessage = vi.fn(async () => {});
    const callTool = vi.fn(async () => ({ result: { ok: true }, durationMs: 5 }));

    let callIndex = 0;
    const chatCompletionsNonStreamRaw = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return {
          id: "1",
          object: "chat.completion",
          choices: [
            {
              message: {
                role: "assistant",
                content: "{\"tool_call\":{\"name\":\"taqwin__debug_test\",\"arguments\":{\"message\":\"ping\"}}}"
              }
            }
          ]
        };
      }
      return {
        id: "2",
        object: "chat.completion",
        choices: [
          {
            message: {
              role: "assistant",
              content: "done"
            }
          }
        ]
      };
    });

    vi.doMock("../../src/services/SessionDatabase", () => ({
      sessionDatabase: {
        saveMessages,
        updateMessage,
        listOutgoing: async () => [],
        getOutgoing: async () => null,
        updateOutgoing: async () => {},
        removeOutgoing: async () => {},
        getMessage: async () => null,
      },
    }));
    vi.doMock("../../src/services/SessionController", () => ({
      sessionController: {
        getSessionId: () => "sid",
        subscribe: () => () => {},
        createNewSession: () => "sid",
      },
    }));
    vi.doMock("../../src/services/PersistenceService", () => ({
      persistenceService: { loadChat: async () => [] },
    }));
    vi.doMock("../../src/services/ExtractionService", () => ({ extractionService: {} }));
    vi.doMock("../../src/services/TabErrorStore", () => ({ tabErrorStore: { set: () => {} } }));
    vi.doMock("../../src/utils/observer", () => ({ observe: (_fn: any) => {} }));
    vi.doMock("../../src/services/KnezClient", () => ({
      knezClient: {
        chatCompletionsNonStreamRaw,
        emitEvent: async () => {},
      },
    }));
    vi.doMock("../../src/services/ToolExposureService", () => ({
      toolExposureService: {
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
        getToolsForModel: () => [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }],
      },
    }));
    vi.doMock("../../src/services/GovernanceService", () => ({
      governanceService: {
        decideTool: async () => ({ allowed: true }),
      }
    }));
    vi.doMock("../../src/mcp/McpOrchestrator", () => ({
      mcpOrchestrator: {
        getServer: () => ({ serverId: "taqwin", state: "READY", running: true, pid: 1, framing: "line", generation: null, allowed_tools: [], blocked_tools: [] }),
        getServerTools: () => [{ name: "debug_test" }],
        callTool,
      },
    }));
    vi.doMock("../../src/utils/health", () => ({ selectPrimaryBackend: () => null }));

    const mod = await import("../../src/services/ChatService");
    const svc = new mod.ChatService();

    const text = await (svc as any).runPromptToolLoop(
      "sid",
      [{ role: "user", content: "hi" }],
      "assistant",
      [{ name: "taqwin__debug_test", description: "ping", parameters: { type: "object" } }]
    );

    expect(text).toBe("done");
    expect(callTool).toHaveBeenCalledWith(
      "taqwin",
      "debug_test",
      { message: "ping" },
      expect.objectContaining({ timeoutMs: 180000 })
    );
    expect(saveMessages).toHaveBeenCalled();
    expect(updateMessage).toHaveBeenCalled();
  });
});
