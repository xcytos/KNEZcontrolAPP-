import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const sessionDatabaseMock = {
  getSession: vi.fn(async () => ({ id: "sid1" })),
  saveSession: vi.fn(async () => {}),
  saveMessages: vi.fn(async () => {}),
  listOutgoing: vi.fn(async () => []),
  enqueueOutgoing: vi.fn(async () => {}),
  removeOutgoing: vi.fn(async () => {}),
  updateMessage: vi.fn(async () => {}),
  getMessage: vi.fn(async (id: string) => ({ id, sessionId: "sid1", from: "user", text: "x", createdAt: new Date().toISOString() })),
};

const knezClientMock = {
  emitEvent: vi.fn(async () => {}),
};

vi.mock("../../src/services/SessionDatabase", () => ({
  sessionDatabase: sessionDatabaseMock,
}));

vi.mock("../../src/services/KnezClient", () => ({
  knezClient: knezClientMock,
}));

vi.mock("../../src/services/ExtractionService", () => ({
  extractionService: {},
}));

vi.mock("../../src/services/PersistenceService", () => ({
  persistenceService: {
    loadChat: vi.fn(async () => []),
  },
}));

vi.mock("../../src/utils/observer", () => ({
  observe: vi.fn(),
}));

vi.mock("../../src/services/SessionController", () => ({
  sessionController: {
    getSessionId: () => "sid1",
    subscribe: () => () => {},
    useSession: vi.fn(),
  },
}));

vi.mock("../../src/services/TaqwinToolPermissions", () => ({
  isTaqwinToolAllowed: () => false,
}));

vi.mock("../../src/services/TaqwinMcpService", () => ({
  taqwinMcpService: {},
}));

vi.mock("../../src/services/LogService", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/services/TabErrorStore", () => ({
  tabErrorStore: { mark: vi.fn() },
}));

vi.mock("../../src/utils/health", () => ({
  selectPrimaryBackend: () => ({ mode: "off" }),
}));

describe("CP02 persistence pairing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionDatabaseMock.getSession.mockResolvedValue(null);
    sessionDatabaseMock.saveMessages.mockClear();
    sessionDatabaseMock.enqueueOutgoing.mockClear();
    sessionDatabaseMock.removeOutgoing.mockClear();
    sessionDatabaseMock.updateMessage.mockClear();
    sessionDatabaseMock.getMessage.mockClear();
    sessionDatabaseMock.saveSession.mockClear();
    knezClientMock.emitEvent.mockClear();
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-3333-4444-555555555555" });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("persists exactly one user/assistant pair with stable IDs", async () => {
    const { ChatService } = await import("../../src/services/ChatService");
    const svc = new ChatService() as any;
    svc.flushOutgoingQueue = vi.fn(async () => {});

    await svc.sendMessage("hello");

    const userId = "11111111222233334444555555555555";
    const assistantId = `${userId}-assistant`;

    expect(sessionDatabaseMock.saveSession).toHaveBeenCalledWith("sid1", expect.any(String));
    expect(sessionDatabaseMock.saveMessages).toHaveBeenCalledTimes(1);
    const [, msgs] = sessionDatabaseMock.saveMessages.mock.calls[0];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe(userId);
    expect(msgs[0].from).toBe("user");
    expect(msgs[1].id).toBe(assistantId);
    expect(msgs[1].from).toBe("knez");
    expect(msgs[1].replyToMessageId).toBe(userId);
    expect(msgs[1].correlationId).toBe(userId);
    expect(sessionDatabaseMock.enqueueOutgoing).toHaveBeenCalledWith(expect.objectContaining({ id: userId, sessionId: "sid1" }));
    expect(knezClientMock.emitEvent).toHaveBeenCalledWith(expect.objectContaining({ event_name: "chat_user_message" }));
  });

  it("edit/resend reuses the same paired IDs (no duplicates)", async () => {
    const { ChatService } = await import("../../src/services/ChatService");
    const svc = new ChatService() as any;
    svc.flushOutgoingQueue = vi.fn(async () => {});

    sessionDatabaseMock.getMessage.mockImplementation(async (id: string) => {
      if (id.endsWith("-assistant")) return { id, sessionId: "sid1", from: "knez", text: "", createdAt: new Date().toISOString() };
      return { id, sessionId: "sid1", from: "user", text: "old", createdAt: new Date().toISOString() };
    });

    await svc.editUserMessageAndResend("u1", "new text");

    expect(sessionDatabaseMock.updateMessage).toHaveBeenCalledWith("u1", expect.objectContaining({ text: "new text" }));
    expect(sessionDatabaseMock.updateMessage).toHaveBeenCalledWith("u1-assistant", expect.objectContaining({ deliveryStatus: "queued", text: "" }));
    expect(sessionDatabaseMock.removeOutgoing).toHaveBeenCalledWith("u1");
    expect(sessionDatabaseMock.enqueueOutgoing).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", sessionId: "sid1", text: "new text" }));
  });
});

