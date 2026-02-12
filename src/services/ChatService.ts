
import { knezClient } from "./KnezClient";
import { extractionService } from "./ExtractionService";
import { persistenceService } from "./PersistenceService";
import { ChatMessage, ToolCallMessage } from "../domain/DataContracts";
import { asErrorMessage } from "../domain/Errors";
import { observe } from "../utils/observer";
import { sessionDatabase } from "./SessionDatabase";
import { sessionController } from "./SessionController";
import { isTaqwinToolAllowed } from "./TaqwinToolPermissions";
import { taqwinMcpService } from "../mcp/taqwin/TaqwinMcpService";
import { logger } from "./LogService";
import { tabErrorStore } from "./TabErrorStore";
import { selectPrimaryBackend } from "../utils/health";
import { toolExposureService, parseNamespacedToolName } from "./ToolExposureService";
import { mcpOrchestrator } from "../mcp/McpOrchestrator";
import { classifyMcpError } from "../mcp/McpErrorTaxonomy";

export interface ChatState {
  messages: ChatMessage[];
  sending: boolean;
  activeTools: { search: boolean };
  searchProvider: "off" | "taqwin" | "proxy";
}

export type StateListener = (state: ChatState) => void;

export class ChatService {
  private listeners: StateListener[] = [];
  private state: ChatState = {
    messages: [],
    sending: false,
    activeTools: { search: false },
    searchProvider: "off"
  };
  private sessionId: string;
  private queueFlushInFlight = false;
  private activeDelivery:
    | {
        sessionId: string;
        outgoingId: string;
        assistantId: string;
        controller: AbortController;
        stopRequested: boolean;
      }
    | null = null;
  private maxOutgoingAttempts = 6;
  private maxOutgoingAgeMs = 10 * 60 * 1000;
  private firstTokenTimeoutMs = 12000;
  private maxOutgoingPerSession = 5;
  private streamIdleTimeoutMs = 20000;
  private streamTotalTimeoutMs = 180000;
  
  private async tryEmit(event_name: string, payload: Record<string, any>, sessionId: string) {
    try {
      await knezClient.emitEvent({
        session_id: sessionId,
        event_type: "PERSISTENCE",
        event_name,
        source: "tool",
        severity: "INFO",
        payload,
        tags: ["chat"],
      });
    } catch {}
  }

  constructor() {
    this.sessionId = sessionController.getSessionId();
    void this.load(this.sessionId);
    sessionController.subscribe(({ sessionId }) => {
      this.sessionId = sessionId;
      const stored = localStorage.getItem(`chat_search_enabled:${sessionId}`);
      const enabled = stored === "1";
      this.state.activeTools = { search: enabled };
      this.state.searchProvider = this.resolveSearchProvider(enabled);
      void this.load(sessionId);
      void this.flushOutgoingQueue();
    });
    window.setInterval(() => {
      void this.flushOutgoingQueue();
    }, 500);
  }

  subscribe(listener: StateListener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  async load(sessionId: string) {
    const loaded = await persistenceService.loadChat(sessionId);
    if (loaded && loaded.length > 0) {
      this.state.messages = loaded;
    } else {
      this.state.messages = [];
    }
    this.notify();
  }

  setActiveTools(tools: { search: boolean }) {
    this.state.activeTools = tools;
    this.state.searchProvider = this.resolveSearchProvider(tools.search);
    localStorage.setItem(`chat_search_enabled:${this.sessionId}`, tools.search ? "1" : "0");
    this.notify();
  }

  async invokeToolManually(sessionId: string, namespacedToolName: string, args: any): Promise<void> {
    const sid = sessionId || this.sessionId;
    if (!sid) throw new Error("no_session");

    const startedAt = new Date().toISOString();
    const traceMessageId = `${newMessageId()}-manual-tool`;
    const toolCall: ToolCallMessage = { tool: namespacedToolName, args, status: "calling", startedAt };
    await this.persistToolTrace(sid, {
      id: traceMessageId,
      sessionId: sid,
      from: "knez",
      text: "",
      createdAt: startedAt,
      toolCall,
      deliveryStatus: "delivered",
      correlationId: traceMessageId
    });

    let result: any;
    let ok = false;
    let errorMsg: string | undefined;
    let serverId: string | undefined;
    let originalName: string | undefined;
    try {
      const meta = toolExposureService.getToolByName(namespacedToolName);
      if (!meta) throw new Error("mcp_tool_not_found");
      if (!meta.permission.allowed) throw new Error(`mcp_permission_denied:${meta.permission.reason ?? "blocked"}`);
      const parsed = parseNamespacedToolName(namespacedToolName);
      serverId = parsed?.serverId ?? meta.serverId;
      originalName = parsed?.originalName ?? meta.originalName;

      const runtime = mcpOrchestrator.getServer(serverId);
      if (!runtime || runtime.state !== "READY") {
        await mcpOrchestrator.ensureStarted(serverId);
      }

      void this.tryEmit(
        "tool_call_started",
        { tool: namespacedToolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId, mode: "manual" },
        sid
      );
      logger.info("mcp_audit", "tool_call_started", { tool: namespacedToolName, serverId, originalName, toolCallId: traceMessageId, mode: "manual" });

      const execStartedAt = performance.now();
      const callRes = await mcpOrchestrator.callTool(serverId, originalName, args, { timeoutMs: 180000 });
      const durationMs = Math.round(performance.now() - execStartedAt);
      result = callRes.result;
      ok = true;

      void this.tryEmit(
        "tool_call_completed",
        { tool: namespacedToolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId, duration_ms: durationMs, mode: "manual" },
        sid
      );
      logger.info("mcp_audit", "tool_call_completed", { tool: namespacedToolName, serverId, originalName, toolCallId: traceMessageId, durationMs, mode: "manual" });
    } catch (e: any) {
      const classified = this.classifyToolError(String(e?.message ?? e));
      errorMsg = `${classified.code}:${classified.message}`;
      result = { ok: false, error: classified };
      void this.tryEmit(
        "tool_call_failed",
        { tool: namespacedToolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId, error_code: classified.code, mode: "manual" },
        sid
      );
      logger.warn("mcp_audit", "tool_call_failed", { tool: namespacedToolName, serverId, originalName, toolCallId: traceMessageId, errorCode: classified.code, mode: "manual" });
    }

    const finishedAt = new Date().toISOString();
    await this.updateToolTrace(sid, traceMessageId, {
      toolCall: { ...toolCall, status: ok ? "succeeded" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt }
    });
  }

  async sendMessage(text: string, forceContext?: string): Promise<void> {
    if (!text.trim()) return;

    const now = new Date().toISOString();
    const userId = newMessageId();
    const assistantId = `${userId}-assistant`;

    const userMsg: ChatMessage = {
      id: userId,
      sessionId: this.sessionId,
      from: "user",
      text: text,
      createdAt: now,
      deliveryStatus: "delivered",
      correlationId: userId
    };

    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId: this.sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: false,
      metrics: { totalTokens: 0 },
      deliveryStatus: "queued",
      replyToMessageId: userId,
      correlationId: userId
    };

    this.state.messages = [...this.state.messages, userMsg, assistantMsg];
    this.notify();
    observe("chat_send_attempt", { sessionId: this.sessionId, message: text });
    await this.ensureSessionExists(this.sessionId);
    await sessionDatabase.saveMessages(this.sessionId, [userMsg, assistantMsg]);
    void this.tryEmit(
      "chat_user_message",
      { message_id: userId, from: "user", correlation_id: userId },
      this.sessionId
    );
    const existing = (await sessionDatabase.listOutgoing()).filter((x) => x.sessionId === this.sessionId);
    if (existing.length >= this.maxOutgoingPerSession) {
      const errorMsg = `Queue limit reached (${this.maxOutgoingPerSession}). Wait for the current responses to finish.`;
      logger.warn("chat", "Queue limit reached", { sessionId: this.sessionId });
      tabErrorStore.mark("chat");
      tabErrorStore.mark("logs");
      await sessionDatabase.updateMessage(assistantId, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: `Error: ${errorMsg}` });
      this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: `Error: ${errorMsg}` } : m);
      this.notify();
      return;
    }
    await sessionDatabase.enqueueOutgoing({
      id: userId,
      sessionId: this.sessionId,
      text,
      searchEnabled: this.state.activeTools.search,
      createdAt: now
    });
    void this.flushOutgoingQueue(forceContext ? { [userId]: forceContext } : undefined);
  }

  async sendMessageForSession(
    sessionId: string,
    text: string,
    options?: { searchEnabled?: boolean; forceContext?: string }
  ): Promise<string> {
    if (!text.trim()) return "";
    const now = new Date().toISOString();
    const userId = newMessageId();
    const assistantId = `${userId}-assistant`;

    const userMsg: ChatMessage = {
      id: userId,
      sessionId,
      from: "user",
      text,
      createdAt: now,
      deliveryStatus: "delivered",
      correlationId: userId
    };

    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: false,
      metrics: { totalTokens: 0 },
      deliveryStatus: "queued",
      replyToMessageId: userId,
      correlationId: userId
    };

    if (this.sessionId === sessionId) {
      this.state.messages = [...this.state.messages, userMsg, assistantMsg];
      this.notify();
    }

    await this.ensureSessionExists(sessionId);
    await sessionDatabase.saveMessages(sessionId, [userMsg, assistantMsg]);
    void this.tryEmit(
      "chat_user_message",
      { message_id: userId, from: "user", correlation_id: userId },
      sessionId
    );
    const existing = (await sessionDatabase.listOutgoing()).filter((x) => x.sessionId === sessionId);
    if (existing.length >= this.maxOutgoingPerSession) {
      const errorMsg = `Queue limit reached (${this.maxOutgoingPerSession}). Wait for the current responses to finish.`;
      logger.warn("chat", "Queue limit reached", { sessionId });
      tabErrorStore.mark("chat");
      tabErrorStore.mark("logs");
      await sessionDatabase.updateMessage(assistantId, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: `Error: ${errorMsg}` });
      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: `Error: ${errorMsg}` } : m);
        this.notify();
      }
      return userId;
    }
    await sessionDatabase.enqueueOutgoing({
      id: userId,
      sessionId,
      text,
      searchEnabled: options?.searchEnabled ?? false,
      createdAt: now
    });
    void this.flushOutgoingQueue(options?.forceContext ? { [userId]: options.forceContext } : undefined);
    return userId;
  }

  // Exposed for Tests
  getMessages() { return this.state.messages; }
  clear() { this.state.messages = []; this.notify(); }
  stopCurrentResponse() {
    void this.forceStopForSession(this.sessionId);
  }

  stopResponseForSession(sessionId: string) {
    void this.forceStopForSession(sessionId);
  }

  stopByAssistantMessageId(assistantId: string) {
    if (!assistantId) return;
    const msg = this.state.messages.find(m => m.id === assistantId);
    if (!msg) return;
    // If it's the active delivery, use controller
    if (this.activeDelivery && this.activeDelivery.assistantId === assistantId) {
      this.activeDelivery.stopRequested = true;
      this.activeDelivery.controller.abort();
      return;
    }
    // Otherwise force cleanup
    void this.forceStopForSession(msg.sessionId);
  }

  async retryByAssistantMessageId(assistantId: string) {
    const assistant = await sessionDatabase.getMessage(assistantId);
    if (!assistant || assistant.from !== "knez") return;
    const userId = assistant.replyToMessageId || assistant.correlationId;
    if (!userId) return;
    
    // Reset assistant message
    await sessionDatabase.updateMessage(assistantId, {
      deliveryStatus: "queued",
      deliveryError: undefined,
      text: "",
      isPartial: true,
      refusal: false,
      metrics: undefined
    });

    // Re-enqueue user message
    const userMsg = await sessionDatabase.getMessage(userId);
    if (!userMsg) return;

    // Remove any existing queue item first
    await sessionDatabase.removeOutgoing(userId);
    
    await sessionDatabase.enqueueOutgoing({
      id: userId,
      sessionId: assistant.sessionId,
      text: userMsg.text,
      searchEnabled: this.state.activeTools.search,
      createdAt: new Date().toISOString()
    });

    // Update state if current session
    if (this.sessionId === assistant.sessionId) {
      const messages = await persistenceService.loadChat(assistant.sessionId);
      if (messages) {
        this.state.messages = messages;
        this.notify();
      }
    }
    
    void this.flushOutgoingQueue();
  }

  async editUserMessageAndResend(userId: string, newText: string) {
    const userMsg = await sessionDatabase.getMessage(userId);
    if (!userMsg) return;

    const assistantId = `${userId}-assistant`;
    
    // Update user message
    await sessionDatabase.updateMessage(userId, { text: newText });
    
    // Reset assistant message
    await sessionDatabase.updateMessage(assistantId, {
      deliveryStatus: "queued",
      deliveryError: undefined,
      text: "",
      isPartial: true,
      refusal: false,
      metrics: undefined
    });

    // Remove any existing queue item
    await sessionDatabase.removeOutgoing(userId);

    // Re-enqueue
    await sessionDatabase.enqueueOutgoing({
      id: userId,
      sessionId: userMsg.sessionId,
      text: newText,
      searchEnabled: this.state.activeTools.search,
      createdAt: new Date().toISOString()
    });

    // Update state
    if (this.sessionId === userMsg.sessionId) {
      const messages = await persistenceService.loadChat(userMsg.sessionId);
      if (messages) {
        this.state.messages = messages;
        this.notify();
      }
    }

    void this.flushOutgoingQueue();
  }

  async forceStopForSession(sessionId: string) {
    let outgoingId: string | null = null;
    let assistantId: string | null = null;

    if (this.activeDelivery && this.activeDelivery.sessionId === sessionId) {
      outgoingId = this.activeDelivery.outgoingId;
      assistantId = this.activeDelivery.assistantId;
      this.activeDelivery.stopRequested = true;
      this.activeDelivery.controller.abort();
    } else {
      const all = await sessionDatabase.listOutgoing();
      const scoped = all.filter((x) => x.sessionId === sessionId);
      const inFlight = scoped.find((x) => x.status === "in_flight");
      const pending = scoped.find((x) => x.status === "pending");
      const failed = scoped.find((x) => x.status === "failed");
      const pick = inFlight ?? pending ?? failed ?? null;
      if (pick) {
        outgoingId = pick.id;
        assistantId = `${pick.id}-assistant`;
      }
    }

    if (!outgoingId || !assistantId) return;

    await sessionDatabase.removeOutgoing(outgoingId);

    const inState = this.state.messages.find((m) => m.id === assistantId);
    const persisted = await sessionDatabase.getMessage(assistantId);
    const text = (inState?.text ?? persisted?.text ?? "").toString();
    const totalTokens =
      (inState?.metrics as any)?.totalTokens ??
      (persisted?.metrics as any)?.totalTokens ??
      0;
    const modelId = (inState?.metrics as any)?.modelId ?? (persisted?.metrics as any)?.modelId;
    const backendStatus = (inState?.metrics as any)?.backendStatus ?? (persisted?.metrics as any)?.backendStatus;

    const metrics = { finishReason: "stopped", totalTokens, modelId, backendStatus };

    await sessionDatabase.updateMessage(outgoingId, { deliveryStatus: "delivered", deliveryError: undefined });
    await sessionDatabase.updateMessage(assistantId, {
      deliveryStatus: "delivered",
      deliveryError: undefined,
      isPartial: false,
      refusal: false,
      text,
      metrics
    });

    if (this.sessionId === sessionId) {
      this.state.messages = this.state.messages.map((m) => {
        if (m.id === outgoingId) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
        if (m.id === assistantId) {
          return { ...m, deliveryStatus: "delivered", deliveryError: undefined, isPartial: false, refusal: false, text, metrics };
        }
        return m;
      });
      this.state.sending = false;
      this.notify();
    }
  }

  private async ensureSessionExists(sessionId: string) {
    const existing = await sessionDatabase.getSession(sessionId);
    if (existing) return;
    await sessionDatabase.saveSession(sessionId, `Session ${sessionId.substring(0, 6)}`);
  }

  private async flushOutgoingQueue(forceContexts?: Record<string, string>) {
    if (this.queueFlushInFlight) return;
    this.queueFlushInFlight = true;
    try {
      const now = Date.now();
      const all = await sessionDatabase.listOutgoing();
      const eligible = all
        .filter((x) => x.status !== "in_flight" && Date.parse(x.nextRetryAt) <= now)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

      const currentSessionId = this.sessionId;
      const current = currentSessionId ? eligible.filter((x) => x.sessionId === currentSessionId) : [];
      const others = currentSessionId ? eligible.filter((x) => x.sessionId !== currentSessionId) : eligible;

      const othersBySession = new Map<string, typeof eligible>();
      for (const x of others) {
        const arr = othersBySession.get(x.sessionId) ?? [];
        arr.push(x);
        othersBySession.set(x.sessionId, arr);
      }

      const pickOthers: typeof eligible = [];
      for (const arr of othersBySession.values()) {
        arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        pickOthers.push(arr[0]);
      }
      pickOthers.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

      const toProcess = [...current, ...pickOthers].slice(0, 1);
      for (const item of toProcess) {
        await this.deliverQueueItem(item.id, forceContexts?.[item.id]);
      }
    } finally {
      this.queueFlushInFlight = false;
    }
  }

  private buildCompletionMessages(
    messages: ChatMessage[],
    currentUserMessageId: string,
    assistantPlaceholderId: string,
    searchContext: string
  ) {
    const base = messages.filter((m) => m.id !== assistantPlaceholderId);
    const userMessages = base.filter((m) => m.from === "user");
    const currentUserIdx = userMessages.findIndex((m) => m.id === currentUserMessageId);
    const sliceStart = Math.max(0, (currentUserIdx >= 0 ? currentUserIdx : userMessages.length) - 3);
    const selectedUsers = userMessages.slice(sliceStart, currentUserIdx >= 0 ? currentUserIdx + 1 : userMessages.length);

    const selected: ChatMessage[] = [];
    for (const u of selectedUsers) {
      selected.push(u);
      const a =
        base.find((m) => m.from === "knez" && m.replyToMessageId === u.id) ??
        base.find((m) => m.from === "knez" && m.correlationId && m.correlationId === u.id);
      if (a) selected.push(a);
    }

    return selected.map((m) => {
      let content = m.text;
      if (m.id === currentUserMessageId && searchContext) content += searchContext;
      return { role: m.from === "user" ? "user" : "assistant", content } as const;
    });
  }

  private stringifyToolPayload(value: any, maxChars: number): string {
    try {
      const raw = JSON.stringify(value ?? null);
      if (raw.length <= maxChars) return raw;
      return raw.slice(0, maxChars) + "…";
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      return JSON.stringify({ error: "tool_result_unserializable", message: msg }).slice(0, maxChars);
    }
  }

  private classifyToolError(rawError: string): { code: string; message: string } {
    return classifyMcpError(rawError);
  }

  private async persistToolTrace(sessionId: string, msg: ChatMessage): Promise<void> {
    await sessionDatabase.saveMessages(sessionId, [msg]);
    if (this.sessionId === sessionId) {
      this.state.messages = [...this.state.messages, msg].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      this.notify();
    }
  }

  private async updateToolTrace(sessionId: string, messageId: string, patch: Partial<ChatMessage>): Promise<void> {
    await sessionDatabase.updateMessage(messageId, patch as any);
    if (this.sessionId === sessionId) {
      this.state.messages = this.state.messages.map((m) => m.id === messageId ? { ...m, ...patch } : m);
      this.notify();
    }
  }

  private async runNativeToolLoop(
    sessionId: string,
    baseMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    toolsForModel: Array<{ name: string; description: string; parameters: any }>,
    onMeta?: (meta: { model?: string }) => void
  ): Promise<string> {
    const conversation: any[] = baseMessages.map((m) => ({ role: m.role, content: m.content }));
    const maxSteps = 8;
    for (let step = 0; step < maxSteps; step++) {
      const res = await knezClient.chatCompletionsNonStreamRaw(conversation, sessionId, {
        tools: toolsForModel,
        toolChoice: toolsForModel.length ? "auto" : "none",
        onMeta
      });
      const msg = res?.choices?.[0]?.message as any;
      const toolCalls: any[] = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
      const assistantContent = String(msg?.content ?? "");
      if (assistantContent) {
        conversation.push({ role: "assistant", content: assistantContent, tool_calls: toolCalls.length ? toolCalls : undefined });
      } else if (toolCalls.length) {
        conversation.push({ role: "assistant", content: "", tool_calls: toolCalls });
      }
      if (!toolCalls.length) {
        return assistantContent;
      }

      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i] ?? {};
        const toolCallId = String(tc?.id ?? `${assistantId}:tool:${step}:${i}`);
        const fn = tc?.function ?? {};
        const toolName = String(fn?.name ?? "");
        const argsRaw = String(fn?.arguments ?? "");
        let args: any = {};
        try {
          args = argsRaw ? JSON.parse(argsRaw) : {};
        } catch {
          args = { _raw: argsRaw };
        }

        const startedAt = new Date().toISOString();
        const traceMessageId = `${assistantId}-tool-${step}-${i}`;
        const toolCall: ToolCallMessage = { tool: toolName, args, status: "calling", startedAt };
        await this.persistToolTrace(sessionId, {
          id: traceMessageId,
          sessionId,
          from: "knez",
          text: "",
          createdAt: startedAt,
          toolCall,
          deliveryStatus: "delivered",
          replyToMessageId: assistantId,
          correlationId: assistantId
        });

        let result: any;
        let ok = false;
        let errorMsg: string | undefined;
        let serverId: string | undefined;
        let originalName: string | undefined;
        try {
          const meta = toolExposureService.getToolByName(toolName);
          if (!meta) {
            throw new Error("mcp_tool_not_found");
          }
          if (!meta.permission.allowed) {
            throw new Error(`mcp_permission_denied:${meta.permission.reason ?? "blocked"}`);
          }
          const parsed = parseNamespacedToolName(toolName);
          serverId = parsed?.serverId ?? meta.serverId;
          originalName = parsed?.originalName ?? meta.originalName;
          void this.tryEmit(
            "tool_call_started",
            { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: toolCallId },
            sessionId
          );
          logger.info("mcp_audit", "tool_call_started", { tool: toolName, serverId, originalName, toolCallId });
          const execStartedAt = performance.now();
          const callRes = await mcpOrchestrator.callTool(serverId, originalName, args, { timeoutMs: 180000 });
          const durationMs = Math.round(performance.now() - execStartedAt);
          result = callRes.result;
          ok = true;
          void this.tryEmit(
            "tool_call_completed",
            { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: toolCallId, duration_ms: durationMs },
            sessionId
          );
          logger.info("mcp_audit", "tool_call_completed", { tool: toolName, serverId, originalName, toolCallId, durationMs });
        } catch (e: any) {
          const classified = this.classifyToolError(String(e?.message ?? e));
          errorMsg = `${classified.code}:${classified.message}`;
          result = { ok: false, error: classified };
          void this.tryEmit(
            "tool_call_failed",
            { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: toolCallId, error_code: classified.code },
            sessionId
          );
          logger.warn("mcp_audit", "tool_call_failed", { tool: toolName, serverId, originalName, toolCallId, errorCode: classified.code });
        }

        const finishedAt = new Date().toISOString();
        await this.updateToolTrace(sessionId, traceMessageId, {
          toolCall: { ...toolCall, status: ok ? "succeeded" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt }
        });

        const toolContent = this.stringifyToolPayload(result, 20000);
        conversation.push({ role: "tool", tool_call_id: toolCallId, content: toolContent });
      }
    }
    throw new Error("tool_loop_limit_reached");
  }

  private parsePromptToolRequest(text: string): { tool: string; arguments: any } | null {
    const raw = String(text ?? "").trim();
    if (!raw) return null;
    const direct = (() => {
      try {
        const obj = JSON.parse(raw);
        return obj && typeof obj.tool === "string" ? obj : null;
      } catch {
        return null;
      }
    })();
    if (direct) return { tool: String(direct.tool), arguments: direct.arguments ?? {} };
    const fence = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        const obj = JSON.parse(fence[1]);
        if (obj && typeof obj.tool === "string") return { tool: String(obj.tool), arguments: obj.arguments ?? {} };
      } catch {}
    }
    return null;
  }

  private async runPromptToolLoop(
    sessionId: string,
    baseMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    toolsForModel: Array<{ name: string; description: string; parameters: any }>,
    onMeta?: (meta: { model?: string }) => void
  ): Promise<string> {
    const toolNames = toolsForModel.map((t) => t.name).slice(0, 80);
    const protocol =
      `\n\n[SYSTEM: TOOL_PROTOCOL]\n` +
      `If you need to use a tool, reply ONLY with JSON: {"tool":"<name>","arguments":{...}}.\n` +
      `Allowed tool names:\n${toolNames.map((n) => `- ${n}`).join("\n")}\n` +
      `Otherwise, reply normally.\n`;

    const conversation: any[] = baseMessages.map((m, idx) => {
      if (idx === baseMessages.length - 1 && m.role === "user") {
        return { role: m.role, content: String(m.content ?? "") + protocol };
      }
      return { role: m.role, content: m.content };
    });

    const maxSteps = 8;
    for (let step = 0; step < maxSteps; step++) {
      const res = await knezClient.chatCompletionsNonStreamRaw(conversation, sessionId, { onMeta });
      const msg = res?.choices?.[0]?.message as any;
      const assistantContent = String(msg?.content ?? "");
      conversation.push({ role: "assistant", content: assistantContent });
      const req = this.parsePromptToolRequest(assistantContent);
      if (!req) return assistantContent;

      const toolName = String(req.tool ?? "");
      const args = req.arguments ?? {};

      const startedAt = new Date().toISOString();
      const traceMessageId = `${assistantId}-tool-${step}-0`;
      const toolCall: ToolCallMessage = { tool: toolName, args, status: "calling", startedAt };
      await this.persistToolTrace(sessionId, {
        id: traceMessageId,
        sessionId,
        from: "knez",
        text: "",
        createdAt: startedAt,
        toolCall,
        deliveryStatus: "delivered",
        replyToMessageId: assistantId,
        correlationId: assistantId
      });

      let result: any;
      let ok = false;
      let errorMsg: string | undefined;
      let serverId: string | undefined;
      let originalName: string | undefined;
      try {
        const meta = toolExposureService.getToolByName(toolName);
        if (!meta) throw new Error("mcp_tool_not_found");
        if (!meta.permission.allowed) throw new Error(`mcp_permission_denied:${meta.permission.reason ?? "blocked"}`);
        const parsed = parseNamespacedToolName(toolName);
        serverId = parsed?.serverId ?? meta.serverId;
        originalName = parsed?.originalName ?? meta.originalName;
        void this.tryEmit(
          "tool_call_started",
          { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId },
          sessionId
        );
        logger.info("mcp_audit", "tool_call_started", { tool: toolName, serverId, originalName, toolCallId: traceMessageId });
        const execStartedAt = performance.now();
        const callRes = await mcpOrchestrator.callTool(serverId, originalName, args, { timeoutMs: 180000 });
        const durationMs = Math.round(performance.now() - execStartedAt);
        result = callRes.result;
        ok = true;
        void this.tryEmit(
          "tool_call_completed",
          { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId, duration_ms: durationMs },
          sessionId
        );
        logger.info("mcp_audit", "tool_call_completed", { tool: toolName, serverId, originalName, toolCallId: traceMessageId, durationMs });
      } catch (e: any) {
        const classified = this.classifyToolError(String(e?.message ?? e));
        errorMsg = `${classified.code}:${classified.message}`;
        result = { ok: false, error: classified };
        void this.tryEmit(
          "tool_call_failed",
          { tool: toolName, server_id: serverId, original_name: originalName, tool_call_id: traceMessageId, error_code: classified.code },
          sessionId
        );
        logger.warn("mcp_audit", "tool_call_failed", { tool: toolName, serverId, originalName, toolCallId: traceMessageId, errorCode: classified.code });
      }

      const finishedAt = new Date().toISOString();
      await this.updateToolTrace(sessionId, traceMessageId, {
        toolCall: { ...toolCall, status: ok ? "succeeded" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt }
      });

      const toolContent = this.stringifyToolPayload(result, 20000);
      conversation.push({ role: "tool", content: toolContent });
    }
    throw new Error("tool_loop_limit_reached");
  }

  private async deliverQueueItem(id: string, forceContext?: string) {
    const item = await sessionDatabase.getOutgoing(id);
    if (!item) return;

    const ageMs = Date.now() - Date.parse(item.createdAt);
    if (item.attempts >= this.maxOutgoingAttempts || ageMs > this.maxOutgoingAgeMs) {
      const errorMsg =
        item.attempts >= this.maxOutgoingAttempts
          ? `Retry limit reached after ${item.attempts} attempts`
          : `Delivery expired after ${Math.round(ageMs / 1000)}s`;
      await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
      await sessionDatabase.updateMessage(`${id}-assistant`, {
        deliveryStatus: "failed",
        deliveryError: errorMsg,
        isPartial: false,
        text: `Error: ${errorMsg}`,
        refusal: true
      });
      await sessionDatabase.removeOutgoing(id);
      if (this.sessionId === item.sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
          if (m.id === `${id}-assistant`) {
            return { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `Error: ${errorMsg}`, refusal: true };
          }
          return m;
        });
        this.notify();
      }
      return;
    }

    const attempt = item.attempts + 1;
    await sessionDatabase.updateOutgoing(id, { status: "in_flight", attempts: attempt, lastError: undefined });
    await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
    await sessionDatabase.updateMessage(`${id}-assistant`, { deliveryStatus: "pending", deliveryError: undefined, isPartial: true, refusal: false });

    const sessionId = item.sessionId;
    const messages = (await persistenceService.loadChat(sessionId)) ?? [];

    const userIdx = messages.findIndex((m) => m.id === id);
    if (userIdx >= 0) {
      messages[userIdx] = { ...messages[userIdx], deliveryStatus: "delivered", deliveryError: undefined };
    }
    const assistantIdx = messages.findIndex((m) => m.id === `${id}-assistant`);
    if (assistantIdx >= 0) {
      messages[assistantIdx] = { ...messages[assistantIdx], deliveryStatus: "pending", deliveryError: undefined, refusal: false, isPartial: true, text: "" };
    }

    if (this.sessionId === sessionId) {
      this.state.messages = messages;
      this.state.sending = true;
      this.notify();
    }

    const searchContext = await this.buildSearchContext({
      text: item.text,
      searchEnabled: item.searchEnabled,
      forceContext
    });

    const assistantId = `${id}-assistant`;
    const completionMessages = this.buildCompletionMessages(messages, id, assistantId, searchContext);

    let modelId: string | undefined;
    let backendStatus: string | undefined;
    try {
      const health = await knezClient.health({ timeoutMs: 1500 });
      const b = selectPrimaryBackend((health as any)?.backends);
      modelId = b?.model_id;
      backendStatus = b?.status;
    } catch {}
    if (modelId || backendStatus) {
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx >= 0) {
        messages[idx] = {
          ...messages[idx],
          metrics: { ...(messages[idx].metrics ?? {}), modelId, backendStatus }
        };
      }
      await sessionDatabase.updateMessage(assistantId, { metrics: { modelId, backendStatus } });
      if (this.sessionId === sessionId) {
        this.state.messages = messages;
        this.notify();
      }
    }

    let firstTokenTimer: number | undefined;
    let watchdogId: number | undefined;
    try {
      const toolsForModel = toolExposureService.getToolsForModel();
      if (toolsForModel.length > 0) {
        let toolModelId: string | undefined = modelId;
        const onMeta = (meta: { model?: string }) => {
          const next = meta?.model?.trim();
          if (next) toolModelId = next;
        };
        const support = await knezClient.getToolCallingSupport().catch(() => "unsupported" as const);
        const finalText =
          support === "supported"
            ? await this.runNativeToolLoop(sessionId, completionMessages as any, assistantId, toolsForModel, onMeta)
            : await this.runPromptToolLoop(sessionId, completionMessages as any, assistantId, toolsForModel, onMeta);

        if (finalText.trim().length === 0) {
          throw new Error("Empty reply");
        }

        const finalAssistant: Partial<ChatMessage> = {
          isPartial: false,
          text: finalText,
          deliveryStatus: "delivered",
          refusal: false,
          metrics: { finishReason: "completed", totalTokens: 0, modelId: toolModelId ?? modelId, backendStatus }
        };

        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered" });
        await sessionDatabase.updateMessage(assistantId, {
          deliveryStatus: "delivered",
          text: finalText,
          metrics: finalAssistant.metrics,
          isPartial: false,
          refusal: false
        });
        await sessionDatabase.removeOutgoing(id);

        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => {
            if (m.id === id) return { ...m, deliveryStatus: "delivered" };
            if (m.id === assistantId) return { ...m, ...finalAssistant };
            return m;
          });
          this.state.sending = false;
          this.notify();
        }

        void this.tryEmit(
          "chat_assistant_message",
          {
            message_id: assistantId,
            from: "knez",
            reply_to_message_id: id,
            correlation_id: id,
            finish_reason: "completed",
            total_tokens: 0,
          },
          sessionId
        );

        await this.maybeAutoNameSession(sessionId, (await persistenceService.loadChat(sessionId)) ?? []);
        return;
      }

      let collected = "";
      let firstTokenTime: number | undefined;
      const startTime = Date.now();
      let tokenCount = 0;
      let lastPersistAt = 0;
      let lastUiAt = 0;
      const controller = new AbortController();
      this.activeDelivery = { sessionId, outgoingId: id, assistantId, controller, stopRequested: false };
      let metaModelSet = false;
      firstTokenTimer = window.setTimeout(() => {
        if (!firstTokenTime) controller.abort();
      }, this.firstTokenTimeoutMs);
      let lastTokenAt = Date.now();
      watchdogId = window.setInterval(() => {
        const now = Date.now();
        if (now - startTime > this.streamTotalTimeoutMs) {
          controller.abort();
          return;
        }
        if (!firstTokenTime) return;
        if (now - lastTokenAt > this.streamIdleTimeoutMs) {
          controller.abort();
        }
      }, 500);

      const applyAssistantMetrics = async (patch: Partial<NonNullable<ChatMessage["metrics"]>>) => {
        const currentInState = this.state.messages.find((m) => m.id === assistantId);
        const merged = { ...(currentInState?.metrics ?? {}), ...(patch ?? {}) };
        await sessionDatabase.updateMessage(assistantId, { metrics: merged });
        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, metrics: merged } : m);
          this.notify();
        }
      };

      for await (const token of knezClient.chatCompletionsStream(completionMessages, sessionId, {
        signal: controller.signal,
        onMeta: (meta) => {
          const nextModel = meta?.model?.trim();
          if (!nextModel) return;
          if (metaModelSet && nextModel === modelId) return;
          modelId = nextModel;
          metaModelSet = true;
          void applyAssistantMetrics({ modelId });
        }
      })) {
        if (!firstTokenTime) firstTokenTime = Date.now();
        lastTokenAt = Date.now();
        collected += token;
        tokenCount++;
        const patch: Partial<ChatMessage> = {
          text: collected,
          metrics: {
            timeToFirstTokenMs: firstTokenTime - startTime,
            totalTokens: tokenCount,
            modelId,
            backendStatus
          }
        };
        const now = Date.now();
        if (this.sessionId === sessionId && now - lastUiAt > 50) {
          lastUiAt = now;
          this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, ...patch } : m);
          this.notify();
        }
        if (now - lastPersistAt > 650) {
          lastPersistAt = now;
          await sessionDatabase.updateMessage(assistantId, { text: collected, metrics: patch.metrics, isPartial: true });
        }
      }

      if (tokenCount === 0 && collected.trim().length === 0) {
        throw new Error("Empty reply");
      }

      const finalAssistant: Partial<ChatMessage> = {
        isPartial: false,
        text: collected,
        deliveryStatus: "delivered",
        metrics: { finishReason: "completed", totalTokens: tokenCount, modelId, backendStatus }
      };

      await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered" });
      await sessionDatabase.updateMessage(assistantId, { deliveryStatus: "delivered", text: collected, metrics: finalAssistant.metrics, isPartial: false, refusal: false });
      await sessionDatabase.removeOutgoing(id);

      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered" };
          if (m.id === assistantId) return { ...m, ...finalAssistant };
          return m;
        });
      }
      void this.tryEmit(
        "chat_assistant_message",
        {
          message_id: assistantId,
          from: "knez",
          reply_to_message_id: id,
          correlation_id: id,
          finish_reason: "completed",
          total_tokens: tokenCount,
        },
        sessionId
      );

      await this.maybeAutoNameSession(sessionId, (await persistenceService.loadChat(sessionId)) ?? []);
    } catch (err: any) {
      const stopRequested =
        this.activeDelivery?.sessionId === sessionId &&
        this.activeDelivery?.outgoingId === id &&
        this.activeDelivery.stopRequested === true;

      const abortName = String(err?.name ?? "");
      const abortMsg = asErrorMessage(err);
      if (stopRequested && (abortName === "AbortError" || abortMsg === "Request cancelled")) {
        const finalAssistant: Partial<ChatMessage> = {
          isPartial: false,
          text: this.state.messages.find((m) => m.id === assistantId)?.text ?? "",
          deliveryStatus: "delivered",
          metrics: {
            finishReason: "stopped",
            totalTokens: (this.state.messages.find((m) => m.id === assistantId)?.metrics as any)?.totalTokens ?? 0,
            modelId,
            backendStatus
          }
        };

        const persisted = await sessionDatabase.getMessage(assistantId);
        const persistedText = persisted?.text ?? "";
        const persistedTokens = (persisted?.metrics as any)?.totalTokens ?? 0;

        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
        await sessionDatabase.updateMessage(assistantId, {
          deliveryStatus: "delivered",
          deliveryError: undefined,
          isPartial: false,
          refusal: false,
          text: persistedText,
          metrics: { finishReason: "stopped", totalTokens: persistedTokens, modelId, backendStatus }
        });
        await sessionDatabase.removeOutgoing(id);

        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => {
            if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
            if (m.id === assistantId) {
              return { ...m, ...finalAssistant, text: persistedText, metrics: { finishReason: "stopped", totalTokens: persistedTokens, modelId, backendStatus } };
            }
            return m;
          });
        }
        void this.tryEmit(
          "chat_assistant_message",
          {
            message_id: assistantId,
            from: "knez",
            reply_to_message_id: id,
            correlation_id: id,
            finish_reason: "stopped",
            total_tokens: persistedTokens,
          },
          sessionId
        );
        return;
      }

      const errorMsg = abortMsg;
      logger.error("chat", "Delivery failed", { sessionId, messageId: id, error: errorMsg });
      tabErrorStore.mark("chat");
      tabErrorStore.mark("logs");
      const isTransient =
        err?.name === "AbortError" ||
        /^\[(KNEZ_TIMEOUT|KNEZ_FETCH_FAILED|KNEZ_HEALTH_FAILED|KNEZ_STREAM_FAILED)\]/.test(errorMsg) ||
        /failed to fetch|networkerror|econnrefused|enotfound/i.test(errorMsg);
      const nextRetryAt = new Date(Date.now() + Math.min(60000, 1000 * Math.pow(2, Math.min(6, attempt)))).toISOString();
      await sessionDatabase.updateOutgoing(id, { status: "failed", nextRetryAt, lastError: errorMsg });
      if (isTransient) {
        const existingAssistant = this.state.messages.find((m) => m.id === `${id}-assistant`);
        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
        await sessionDatabase.updateMessage(`${id}-assistant`, {
          deliveryStatus: "queued",
          deliveryError: errorMsg,
          isPartial: false,
          refusal: false,
          text: existingAssistant?.text ?? ""
        });
      } else {
        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
        await sessionDatabase.updateMessage(`${id}-assistant`, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `Error: ${errorMsg}`, refusal: true });
      }

      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
          if (m.id === `${id}-assistant`) {
            return isTransient
              ? { ...m, deliveryStatus: "queued", deliveryError: errorMsg, isPartial: false, refusal: false }
              : { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `Error: ${errorMsg}`, refusal: true };
          }
          return m;
        });
      }
    } finally {
      if (this.activeDelivery?.sessionId === sessionId && this.activeDelivery?.outgoingId === id) {
        this.activeDelivery = null;
      }
      if (typeof firstTokenTimer === "number") {
        clearTimeout(firstTokenTimer);
      }
      if (typeof watchdogId === "number") {
        clearInterval(watchdogId);
      }
      if (this.sessionId === sessionId) {
        this.state.sending = false;
        this.notify();
      }
    }
  }

  private async buildSearchContext(opts: { text: string; searchEnabled: boolean; forceContext?: string }): Promise<string> {
    if (opts.forceContext) return opts.forceContext;
    if (!opts.searchEnabled) return "";
    const deadline = Date.now() + 2000;
    const timeLeftMs = () => deadline - Date.now();
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      const ms = Math.max(1, timeoutMs);
      let timeoutId: number | undefined;
      const timeout = new Promise<T>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("timeout")), ms);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        if (typeof timeoutId === "number") clearTimeout(timeoutId);
      }
    };

    const toolAuditEnabled = (() => {
      try {
        return localStorage.getItem("taqwin_chat_audit") === "1";
      } catch {
        return false;
      }
    })();

    const emitToolAuditMessage = async (tool: string, args: any, status: "succeeded" | "failed", extra: { durationMs: number; error?: string }) => {
      if (!toolAuditEnabled) return;
      const now = new Date().toISOString();
      const msg: ChatMessage = {
        id: newMessageId(),
        sessionId: this.sessionId,
        from: "knez",
        text: "",
        createdAt: now,
        toolCall: {
          tool,
          args,
          status,
          startedAt: now,
          finishedAt: now,
          result: status === "succeeded" ? { durationMs: extra.durationMs } : undefined,
          error: status === "failed" ? extra.error : undefined
        },
        deliveryStatus: "delivered"
      };
      try {
        await sessionDatabase.saveMessages(this.sessionId, [msg]);
      } catch {}
      this.state.messages = [...this.state.messages, msg];
      this.notify();
    };

    const urlMatch = opts.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const provider = this.resolveSearchProvider(true);
      if (provider === "taqwin") {
        const toolArgs = {
          action: "get_content",
          url: urlMatch[0],
          analysis_type: "standard",
          agent_context: "taqwin"
        };
        const t0 = performance.now();
        try {
          const res = await withTimeout(taqwinMcpService.callTool("web_intelligence", toolArgs), Math.min(1200, timeLeftMs()));
          await emitToolAuditMessage("web_intelligence", toolArgs, "succeeded", { durationMs: Math.round(performance.now() - t0) });
          const text = extractMcpText(res);
          const parsed = safeJsonParseLocal<any>(text);
          const body = parsed ?? { raw: text };
          return `\n\n[SYSTEM: Web Extraction (TAQWIN)]\nURL: ${urlMatch[0]}\n${truncateString(JSON.stringify(body), 4000)}`;
        } catch (e: any) {
          await emitToolAuditMessage("web_intelligence", toolArgs, "failed", {
            durationMs: Math.round(performance.now() - t0),
            error: String(e?.message ?? e)
          });
        }
      }
      const budget = Math.min(1500, timeLeftMs());
      if (budget <= 0) return "";
      const res = await withTimeout(extractionService.extract(urlMatch[0], "raw", budget), budget + 50).catch(() => ({ error: "timeout" } as any));
      if (!res.error) {
        return `\n\n[SYSTEM: Web Extraction Result for ${urlMatch[0]}]\nSummary: ${res.summary}\nData: ${JSON.stringify(res.data)}`;
      }
      return "";
    }

    const provider = this.resolveSearchProvider(true);
    if (provider === "taqwin") {
      const toolArgs = {
        action: "search_web",
        query: opts.text,
        max_results: 5,
        analysis_type: "standard",
        agent_context: "taqwin"
      };
      const t0 = performance.now();
      try {
        const res = await withTimeout(taqwinMcpService.callTool("web_intelligence", toolArgs), Math.min(1200, timeLeftMs()));
        await emitToolAuditMessage("web_intelligence", toolArgs, "succeeded", { durationMs: Math.round(performance.now() - t0) });
        const text = extractMcpText(res);
        const parsed = safeJsonParseLocal<any>(text);
        const body = parsed ?? { raw: text };
        return `\n\n[SYSTEM: Web Search (TAQWIN)]\nQuery: ${opts.text}\n${truncateString(JSON.stringify(body), 4000)}`;
      } catch (e: any) {
        await emitToolAuditMessage("web_intelligence", toolArgs, "failed", {
          durationMs: Math.round(performance.now() - t0),
          error: String(e?.message ?? e)
        });
        return "";
      }
    }

    const budget = Math.min(1500, timeLeftMs());
    if (budget <= 0) return "";
    const results = await withTimeout(extractionService.search(opts.text, 5, budget), budget + 50).catch(() => []);
    if (results.length === 0) return "";
    const top = results.slice(0, 3);

    return (
      `\n\n[SYSTEM: Web Search Enabled]\n` +
      `Query: ${opts.text}\n` +
      `Top results:\n` +
      top.map((r, idx) => `${idx + 1}. ${r.title}\n${r.url}`).join("\n\n")
    );
  }

  private async maybeAutoNameSession(sessionId: string, messages: ChatMessage[]) {
    const session = await sessionDatabase.getSession(sessionId);
    const defaultName = `Session ${sessionId.substring(0, 6)}`;
    const currentName = session?.name ?? defaultName;
    if (currentName !== defaultName) return;

    const userMessages = messages.filter(m => m.from === "user").slice(0, 5);
    if (userMessages.length === 0) return;

    const title = deriveSessionTitle(userMessages.map(m => m.text));
    if (!title) return;
    await sessionDatabase.updateSessionName(sessionId, title);
  }

  private resolveSearchProvider(searchEnabled: boolean): "off" | "taqwin" | "proxy" {
    if (!searchEnabled) return "off";
    const w = window as any;
    const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
    if (!isTauri) return "proxy";
    if (!isTaqwinToolAllowed("web_intelligence")) return "proxy";
    return "taqwin";
  }
}

export const chatService = new ChatService();

function deriveSessionTitle(inputs: string[]): string | null {
  const stop = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","is","are","was","were","be","been","being",
    "i","you","we","they","he","she","it","my","your","our","their","this","that","these","those",
    "please","help","can","could","would","should","what","how","why","when","where"
  ]);

  const cleaned = inputs
    .map(t => t.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").toLowerCase())
    .join(" ");

  const words = cleaned.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  if (top.length === 0) {
    const fallback = inputs[0].trim();
    if (!fallback) return null;
    const short = fallback.split(/\s+/).slice(0, 6).join(" ");
    return titleCase(short);
  }
  return titleCase(top.join(" "));
}

function extractMcpText(res: any): string {
  const blocks = Array.isArray(res?.content) ? res.content : [];
  const parts = blocks.map((b: any) => (b && typeof b.text === "string" ? b.text : "")).filter(Boolean);
  return parts.join("\n");
}

function truncateString(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen) + "…";
}

function safeJsonParseLocal<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
    .join(" ")
    .trim();
}

function newMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}
