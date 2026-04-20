
import { knezClient } from "./KnezClient";
import { extractionService } from "./ExtractionService";
import { persistenceService } from "./PersistenceService";
import { ChatMessage, ToolCallMessage, AssistantMessage, Block, MessageState } from "../domain/DataContracts";
import { AppError, asErrorMessage } from "../domain/Errors";
import { observe } from "../utils/observer";
import { sessionDatabase } from "./SessionDatabase";
import { sessionController } from "./SessionController";
import { logger } from "./LogService";
import { tabErrorStore } from "./TabErrorStore";
import { selectPrimaryBackend } from "../utils/health";
import { toolExposureService } from "./ToolExposureService";
import { mcpOrchestrator } from "../mcp/McpOrchestrator";
import { toolExecutionService } from "./ToolExecutionService";
import { memoryInjectionService } from "./MemoryInjectionService";
import { governanceService } from "./GovernanceService";
import { interpretOutput, canClassifyEarly, OutputClass } from "./OutputInterpreter";
import { validateToolResult } from "./ToolResultValidator";
import { getTimeoutConfig, adaptiveTimeoutManager } from "./TimeoutConfig";
import { agentLoopService } from "./agent/AgentLoopService";
import { failureClassifier } from "./agent/FailureClassifier";
import { agentOrchestrator } from "./agent/AgentOrchestrator";
import { getMemoryEventSourcingService } from "./MemoryEventSourcingService";
import { StreamController } from "./StreamController";

export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "tool_running"
  | "streaming"
  | "finalizing"
  | "done"
  | "error";

export type EventType =
  | "USER_SEND"
  | "MODEL_CALL_START"
  | "FIRST_TOKEN"
  | "TOOL_START"
  | "TOOL_END"
  | "STREAM_END"
  | "ERROR";

// ADD 6: Strict phase transition rules
const PHASE_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking", "error"],
  thinking: ["tool_running", "streaming", "error"],
  tool_running: ["thinking", "streaming", "error"],
  streaming: ["finalizing", "error"],
  finalizing: ["done", "error"],
  done: ["idle"],
  error: ["idle"]
};

export interface ChatState {
  messages: ChatMessage[];
  assistantMessages: AssistantMessage[]; // New block-based assistant messages
  phase: ChatPhase;
  currentStreamId: string | null;
  activeTools: { search: boolean };
  searchProvider: "off" | "taqwin" | "proxy";
  pendingToolApproval: { id: string; toolName: string; args: Record<string, any> } | null;
  responseStart?: number;
  responseEnd?: number;
  sequenceCounter: number; // Counter for generating sequenceNumber per session
}

export type StateListener = (state: ChatState) => void;

export class ChatService {
  private listeners: StateListener[] = [];
  private state: ChatState = {
    messages: [],
    assistantMessages: [],
    phase: "idle",
    currentStreamId: null,
    activeTools: { search: false },
    searchProvider: "off",
    pendingToolApproval: null,
    sequenceCounter: 0
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
  private maxOutgoingAttempts = 3;
  private maxOutgoingAgeMs = 300000;
  private maxOutgoingPerSession = 1;
  private lastMcpSignatureBySessionId = new Map<string, string>();
  // ADD 5: Single Active Request Lock
  private activeRequestLock: { sessionId: string; requestId: string } | null = null;

  // ADD 2: Stream Controller
  private streamController = new StreamController();

  private async acquireRequestLock(sessionId: string, requestId: string): Promise<boolean> {
    if (this.activeRequestLock) {
      logger.warn("chat_service", "request_rejected_active", { 
        activeSession: this.activeRequestLock.sessionId,
        activeRequest: this.activeRequestLock.requestId,
        newSession: sessionId,
        newRequest: requestId
      });
      return false; // Reject overlapping requests
    }
    this.activeRequestLock = { sessionId, requestId };
    return true;
  }

  private releaseRequestLock(sessionId: string, requestId: string): void {
    if (this.activeRequestLock?.sessionId === sessionId && this.activeRequestLock?.requestId === requestId) {
      this.activeRequestLock = null;
    }
  }
  private static get MCP_ENABLED(): boolean {
    try {
      const stored = localStorage.getItem("knez_mcp_enabled");
      // Enable by default, but respect user override if set to "0"
      return stored === "0" ? false : true;
    } catch { return true; }
  }
  static setMcpEnabled(enabled: boolean): void {
    try { localStorage.setItem("knez_mcp_enabled", enabled ? "1" : "0"); } catch {}
  }
  // Manual approval removed - approvalResolvers removed
  private _pendingNotify = false;
  private _notifyTimer: number | null = null;
  
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
    } catch (e) {
      logger.warn("chat_service", "tryEmit_failed", { event_name, error: String(e) });
    }
  }

  private async updateSearchProvider(searchEnabled: boolean) {
    this.state.searchProvider = await this.resolveSearchProvider(searchEnabled);
    this.notify();
  }

  constructor() {
    this.sessionId = sessionController.getSessionId();
    void this.load(this.sessionId);
    sessionController.subscribe(({ sessionId }) => {
      const previousSessionId = this.sessionId;
      // T7: Cancel previous session queue when switching sessions
      if (previousSessionId && previousSessionId !== sessionId) {
        void this.forceStopForSession(previousSessionId);
      }
      this.sessionId = sessionId;
      // P5.2 T12: Reset to idle on session change for state isolation
      this.resetToIdle();
      const stored = localStorage.getItem(`chat_search_enabled:${sessionId}`);
      const enabled = stored === "1";
      this.state.activeTools = { search: enabled };
      void this.updateSearchProvider(enabled);
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
    if (this.state.phase === "streaming") {
      if (!this._pendingNotify) {
        this._pendingNotify = true;
        this._notifyTimer = window.setTimeout(() => {
          this._pendingNotify = false;
          this._notifyTimer = null;
          this.listeners.forEach(l => l(this.state));
        }, 33);
      }
    } else {
      if (this._notifyTimer !== null) {
        clearTimeout(this._notifyTimer);
        this._notifyTimer = null;
        this._pendingNotify = false;
      }
      this.listeners.forEach(l => l(this.state));
    }
  }

  // P5.2 T2: Event-driven state engine
  // ADD 6: Updated to use new phase names with strict transition validation
  private setPhase(event: EventType): void {
    const phaseTransition: Record<EventType, ChatPhase> = {
      USER_SEND: "sending",
      MODEL_CALL_START: "thinking",
      FIRST_TOKEN: "streaming",
      TOOL_START: "tool_running",
      TOOL_END: "thinking",
      STREAM_END: "finalizing",
      ERROR: "error"
    };

    const newPhase = phaseTransition[event];
    if (!newPhase) {
      logger.warn("chat_service", "invalid_phase_transition", { event });
      return;
    }

    // ADD 6: Validate phase transition
    const currentPhase = this.state.phase;
    const allowedTransitions = PHASE_TRANSITIONS[currentPhase];
    if (!allowedTransitions.includes(newPhase)) {
      logger.error("chat_service", "invalid_phase_transition", { 
        from: currentPhase, 
        to: newPhase,
        allowed: allowedTransitions,
        event
      });
      throw new Error(`Invalid phase transition: ${currentPhase} → ${newPhase}`);
    }

    this.state.phase = newPhase;

    // Response time measurement (P5.2 T10)
    if (event === "USER_SEND") {
      this.state.responseStart = Date.now();
    }
    if (event === "STREAM_END" || event === "ERROR") {
      this.state.responseEnd = Date.now();
      // ADD 6: Auto-reset to idle after finalizing or error
      setTimeout(() => {
        if (this.state.phase === "done" || this.state.phase === "error") {
          this.resetToIdle();
        }
      }, 150);
    }

    logger.info("chat_service", "phase_transition", {
      event,
      from: currentPhase,
      to: newPhase
    });

    this.notify();
  }

  // Helper to reset to idle
  private resetToIdle(): void {
    this.state.phase = "idle";
    this.state.currentStreamId = null;
    this.state.responseStart = undefined;
    this.state.responseEnd = undefined;
    this.notify();
  }

  // Block-based assistant message methods
  private createAssistantMessage(sessionId: string, initialBlocks: Block[] = [], id?: string): AssistantMessage {
    return {
      id: id || newMessageId(),
      sessionId,
      role: "assistant",
      state: MessageState.CREATED, // ADD 1: Initialize with CREATED state
      blocks: initialBlocks,
      createdAt: Date.now() // ADD 1: Use number timestamp
    };
  }

  private appendBlockToAssistantMessage(assistantId: string, block: Block): void {
    const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
    if (assistantMsg) {
      assistantMsg.blocks.push(block);
      logger.info("assistant_message", "block_appended", { assistantId, blockType: block.type, totalBlocks: assistantMsg.blocks.length });
      this.notify();
      // Persist to database
      void sessionDatabase.updateAssistantMessage(assistantId, { blocks: assistantMsg.blocks });
    } else {
      logger.warn("assistant_message", "not_found", { assistantId, availableIds: this.state.assistantMessages.map(m => m.id) });
    }
  }

  private updateBlockInAssistantMessage(assistantId: string, blockIndex: number, updatedBlock: Block): void {
    const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
    if (assistantMsg && assistantMsg.blocks[blockIndex]) {
      assistantMsg.blocks[blockIndex] = updatedBlock;
      this.notify();
      // Persist to database
      void sessionDatabase.updateAssistantMessage(assistantId, { blocks: assistantMsg.blocks });
    }
  }

  private findLastMcpCallBlockIndex(assistantId: string): number | null {
    const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
    if (!assistantMsg) return null;
    for (let i = assistantMsg.blocks.length - 1; i >= 0; i--) {
      if (assistantMsg.blocks[i].type === 'mcp_call') {
        return i;
      }
    }
    return null;
  }

  // Helper to generate sequence number for deterministic ordering
  private getNextSequenceNumber(): number {
    const seq = this.state.sequenceCounter;
    this.state.sequenceCounter += 1;
    return seq;
  }

  async load(sessionId: string) {
    const loaded = await persistenceService.loadChat(sessionId);
    const loadedAssistantMessages = await sessionDatabase.loadAssistantMessages(sessionId);
    if (loaded && loaded.length > 0) {
      this.state.messages = loaded;
      this.state.assistantMessages = loadedAssistantMessages;
      this.state.sequenceCounter = Math.max(...loaded.map(m => m.sequenceNumber ?? 0), ...loadedAssistantMessages.map(m => m.sequenceNumber ?? 0)) + 1;
    } else {
      // Clear state for new session
      this.state.messages = [];
      this.state.assistantMessages = [];
      this.state.sequenceCounter = 0;
    }
    this.notify();
  }

  setActiveTools(tools: { search: boolean }) {
    this.state.activeTools = tools;
    void this.updateSearchProvider(tools.search);
    localStorage.setItem(`chat_search_enabled:${this.sessionId}`, tools.search ? "1" : "0");
    this.notify();
  }

  async sendMessage(text: string, forceContext?: string): Promise<void> {
    if (!text.trim()) return;

    try {
      // Stop any current delivery for this session to prioritize new message
      if (this.activeDelivery && this.activeDelivery.sessionId === this.sessionId) {
        logger.info("chat", "stopping_current_delivery_for_new_message", { sessionId: this.sessionId });
        this.activeDelivery.stopRequested = true;
        this.activeDelivery.controller.abort();
      }

      const now = new Date().toISOString();
      const userId = newMessageId();
      const assistantId = `${userId}-assistant`;

      const userMsg: ChatMessage = {
        id: userId,
        sessionId: this.sessionId,
        from: "user",
        text: text,
        createdAt: now,
        sequenceNumber: this.getNextSequenceNumber(),
        deliveryStatus: "delivered",
        correlationId: userId
      };

      // Create AssistantMessage with blocks instead of regular ChatMessage
      const assistantMsg = this.createAssistantMessage(this.sessionId, [], assistantId);

      this.state.messages = [...this.state.messages, userMsg];
      this.state.assistantMessages = [...this.state.assistantMessages, assistantMsg];
      this.notify();
      observe("chat_send_attempt", { sessionId: this.sessionId, message: text });
      await this.ensureSessionExists(this.sessionId);
      await sessionDatabase.saveMessages(this.sessionId, [userMsg]);
      await sessionDatabase.saveAssistantMessage(this.sessionId, assistantMsg);
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
        // Update assistant message with error block
        this.appendBlockToAssistantMessage(assistantId, { type: "final", content: `⚠️ ${errorMsg}` });
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
    } catch (error) {
      logger.error("chat", "send_message_failed", { error: String(error), sessionId: this.sessionId });
      // Add error block to assistant message if it exists
      const assistantId = `${this.state.messages[this.state.messages.length - 1]?.id || newMessageId()}-assistant`;
      this.appendBlockToAssistantMessage(assistantId, {
        type: "final",
        content: `⚠️ Failed to send message: ${String(error)}`
      });
      this.resetToIdle();
    }
  }

  async sendMessageForSession(
    sessionId: string,
    text: string,
    options?: { searchEnabled?: boolean; forceContext?: string }
  ): Promise<string> {
    if (!text.trim()) return "";

    // T8: System readiness guard - check KNEZ health before first message
    const sessionMessages = await persistenceService.loadChat(sessionId);
    if (!sessionMessages || sessionMessages.length === 0) {
      try {
        logger.info("system_readiness", "checking_knez_health", { sessionId });
        await knezClient.health({ timeoutMs: 5000 });
        logger.info("system_readiness", "knez_healthy", { sessionId });
      } catch (error) {
        logger.error("system_readiness", "knez_unhealthy", { sessionId, error });
        throw new Error("System is not ready. KNEZ backend is not responding. Please try again later.");
      }
    }

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
      metrics: { totalTokens: 0, fallbackTriggered: false },
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
      await sessionDatabase.updateMessage(assistantId, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: "⚠️ Failed to generate response" });
      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, refusal: true, text: "⚠️ Failed to generate response" } : m);
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

  // ADD 4: Tool → Model Bridge - ensures model is called after tool execution
  // Note: The agent loop already handles Tool → Model bridge by pushing tool results to conversation
  // This method is available for direct tool calls outside the agent loop
  // @ts-ignore — intentionally retained as reference; never called
  private async executeToolAndInterpret(toolName: string, args: any): Promise<string> {
    const result = await toolExecutionService.executeNamespacedTool(toolName, args, { timeoutMs: 30000 });
    
    if (!result.ok) {
      throw new Error(`Tool execution failed: ${result.error.message}`);
    }

    // Return the result - the agent loop will handle interpretation
    // For non-agent contexts, this returns the raw result which can be interpreted by the caller
    return JSON.stringify(result.result);
  }

  // ADD 7: Final Response Guarantee - ensure every request ends with FINAL state message
  private async ensureFinalResponse(assistantId: string): Promise<void> {
    const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
    if (!assistantMsg) {
      logger.warn("chat_service", "ensure_final_response_assistant_not_found", { assistantId });
      return;
    }

    // If message is already in FINAL state, nothing to do
    if (assistantMsg.state === MessageState.FINAL || assistantMsg.state === MessageState.LOCKED) {
      return;
    }

    // If message has content, finalize it
    if (assistantMsg.blocks.length > 0) {
      assistantMsg.state = MessageState.FINAL;
      assistantMsg.finalizedAt = Date.now();
      await sessionDatabase.updateAssistantMessage(assistantId, {
        state: MessageState.FINAL,
        finalizedAt: Date.now()
      });
      logger.info("chat_service", "assistant_message_finalized", { assistantId, blockCount: assistantMsg.blocks.length });
    } else {
      // No content - generate fallback
      assistantMsg.state = MessageState.ERROR;
      assistantMsg.finalizedAt = Date.now();
      assistantMsg.blocks.push({ type: "text", content: "⚠️ No response generated. Please try again." });
      await sessionDatabase.updateAssistantMessage(assistantId, {
        state: MessageState.ERROR,
        finalizedAt: Date.now(),
        blocks: assistantMsg.blocks
      });
      logger.warn("chat_service", "assistant_message_fallback_generated", { assistantId });
    }
    this.notify();
  }

  appendToMessage(messageId: string, text: string) {
    const msgs = this.state.messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      logger.warn("chat_service", "append_message_not_found", { messageId });
      return;
    }

    // ADD 2: Validate stream ownership
    const activeStream = this.streamController.getActiveStream();
    if (activeStream && !this.streamController.append(messageId, activeStream)) {
      logger.error("chat_service", "append_stream_ownership_violation", { messageId, activeStream });
      throw new Error(`Stream ownership violation: message ${messageId} cannot append to stream ${activeStream}`);
    }
    const msg = msgs[idx];
    const isFirstToken = !msg.hasReceivedFirstToken;
    this.state.messages = msgs.map((m, i) =>
      i === idx
        ? { ...m, text: (m.text ?? "") + text, hasReceivedFirstToken: true }
        : m
    );
    // T5: Clear first-token watchdog on first token received
    if (isFirstToken) {
      const timer = (this as any).firstTokenTimer;
      if (timer) {
        window.clearTimeout(timer);
        (this as any).firstTokenTimer = undefined;
      }
    }
    this.notify();
  }
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

    // Clear ALL outgoing messages for this session to ensure queue priority
    const allOutgoing = await sessionDatabase.listOutgoing();
    const sessionOutgoing = allOutgoing.filter((x) => x.sessionId === sessionId);
    for (const msg of sessionOutgoing) {
      await sessionDatabase.removeOutgoing(msg.id);
    }

    const inState = this.state.messages.find((m) => m.id === assistantId);
    const persisted = await sessionDatabase.getMessage(assistantId);
    const text = (inState?.text ?? persisted?.text ?? "").toString();
    const totalTokens =
      (inState?.metrics as any)?.totalTokens ??
      (persisted?.metrics as any)?.totalTokens ??
      0;
    const modelId = (inState?.metrics as any)?.modelId ?? (persisted?.metrics as any)?.modelId;
    const backendStatus = (inState?.metrics as any)?.backendStatus ?? (persisted?.metrics as any)?.backendStatus;

    const toolExecutionTime = (inState?.metrics as any)?.toolExecutionTime ?? (persisted?.metrics as any)?.toolExecutionTime;
    const fallbackTriggered = (inState?.metrics as any)?.fallbackTriggered ?? (persisted?.metrics as any)?.fallbackTriggered ?? false;
    const metrics = { finishReason: "stopped", totalTokens, modelId, backendStatus, fallbackTriggered, ...(toolExecutionTime !== undefined ? { toolExecutionTime } : {}) };

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
      if (this.sessionId === sessionId) {
        this.setPhase("STREAM_END");
      }
    }
  }

  private async ensureSessionExists(sessionId: string) {
    const existing = await sessionDatabase.getSession(sessionId);
    if (existing) return;
    await sessionDatabase.saveSession(sessionId, `Session ${sessionId.substring(0, 6)}`);
  }

  private async flushOutgoingQueue(forceContexts?: Record<string, string>) {
    if (this.queueFlushInFlight) return;
    if (this.state.phase === "streaming") return;
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


  private async executeToolDeterministic(input: {
    sessionId: string;
    assistantId: string;
    toolCallId: string;
    toolName: string;
    args: any;
    traceId: string;
  }): Promise<{
    ok: boolean;
    payload: any;
    errorMsg?: string;
    errorCode?: string;
    serverId?: string;
    originalName?: string;
    durationMs?: number;
  }> {
    const toolName = String(input.toolName ?? "").trim();
    const idx = toolName.indexOf("__");
    const serverIdHint = idx > 0 ? toolName.slice(0, idx) : undefined;
    const originalNameHint = idx > 0 && idx < toolName.length - 2 ? toolName.slice(idx + 2) : undefined;
    const runtimeHint = serverIdHint ? mcpOrchestrator.getServer(serverIdHint) : null;
    const startedAt = performance.now();

    // P5.2 T5: Trigger TOOL_START event
    if (this.sessionId === input.sessionId) {
      this.setPhase("TOOL_START");
    }

    void this.tryEmit(
      "tool_call_started",
      {
        trace_id: input.traceId,
        tool_call_id: input.toolCallId,
        tool: toolName,
        server_id: serverIdHint ?? null,
        original_name: originalNameHint ?? null,
        pid: runtimeHint?.pid ?? null,
        framing: runtimeHint?.framing ?? null,
        generation: runtimeHint?.generation ?? null,
        status: "started",
        correlation_id: input.assistantId
      },
      input.sessionId
    );
    logger.info("mcp_audit", "tool_call_started", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      tool: toolName,
      serverId: serverIdHint ?? null,
      originalName: originalNameHint ?? null,
      pid: runtimeHint?.pid ?? null,
      framing: runtimeHint?.framing ?? null,
      generation: runtimeHint?.generation ?? null,
      status: "started",
      correlationId: input.assistantId
    });

    logger.info("mcp_loop", "entering_tool_execution", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      correlationId: input.assistantId,
      tool: toolName
    });

    // T6: Get adaptive timeout configuration for this tool
    const timeoutConfig = getTimeoutConfig(toolName);
    const adaptiveTimeout = adaptiveTimeoutManager.getAdaptiveTimeout(toolName, timeoutConfig);

    const exec = await toolExecutionService.executeNamespacedTool(toolName, input.args, {
      timeoutMs: adaptiveTimeout,
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      correlationId: input.assistantId
    });
    const serverId = exec.tool.serverId;
    const originalName = exec.tool.originalName;
    const runtime = serverId ? mcpOrchestrator.getServer(serverId) : null;
    const durationMs = exec.ok
      ? (typeof exec.durationMs === "number" ? exec.durationMs : Math.round(performance.now() - startedAt))
      : Math.round(performance.now() - startedAt);

    if (exec.ok) {
      // P5.2 T5: Trigger TOOL_END event on success
      if (this.sessionId === input.sessionId) {
        this.setPhase("TOOL_END");
      }

      void this.tryEmit(
        "tool_call_completed",
        {
          trace_id: input.traceId,
          tool_call_id: input.toolCallId,
          tool: toolName,
          server_id: serverId ?? null,
          original_name: originalName ?? null,
          pid: runtime?.pid ?? null,
          framing: runtime?.framing ?? null,
          generation: runtime?.generation ?? null,
          duration_ms: durationMs,
          durationMs,
          status: "succeeded",
          correlation_id: input.assistantId,
          execution_time_ms: durationMs
        },
        input.sessionId
      );
      logger.info("mcp_audit", "tool_call_completed", {
        traceId: input.traceId,
        toolCallId: input.toolCallId,
        tool: toolName,
        serverId: serverId ?? null,
        originalName: originalName ?? null,
        pid: runtime?.pid ?? null,
        framing: runtime?.framing ?? null,
        generation: runtime?.generation ?? null,
        durationMs,
        status: "succeeded",
        correlationId: input.assistantId
      });
      return {
        ok: true,
        payload: exec.result,
        serverId,
        originalName,
        durationMs
      };
    }

    const errorMsg = `${exec.error.code}:${exec.error.message}`;
    // P5.2 T5: Trigger TOOL_END event
    if (this.sessionId === input.sessionId) {
      this.setPhase("TOOL_END");
    }

    void this.tryEmit(
      "tool_call_failed",
      {
        trace_id: input.traceId,
        tool_call_id: input.toolCallId,
        tool: toolName,
        server_id: serverId ?? null,
        original_name: originalName ?? null,
        pid: runtime?.pid ?? null,
        framing: runtime?.framing ?? null,
        generation: runtime?.generation ?? null,
        duration_ms: durationMs,
        durationMs,
        error_code: exec.error.code,
        status: exec.kind === "denied" ? "denied" : "failed",
        correlation_id: input.assistantId
      },
      input.sessionId
    );
    logger.warn("mcp_audit", "tool_call_failed", {
      traceId: input.traceId,
      toolCallId: input.toolCallId,
      tool: toolName,
      serverId: serverId ?? null,
      originalName: originalName ?? null,
      pid: runtime?.pid ?? null,
      framing: runtime?.framing ?? null,
      generation: runtime?.generation ?? null,
      durationMs,
      errorCode: exec.error.code,
      status: exec.kind === "denied" ? "denied" : "failed",
      correlationId: input.assistantId
    });
    return {
      ok: false,
      payload: { ok: false, error: exec.error },
      errorMsg,
      errorCode: exec.error.code,
      serverId,
      originalName,
      durationMs
    };
  }

  private async persistToolTrace(sessionId: string, msg: ChatMessage): Promise<void> {
    await sessionDatabase.saveMessages(sessionId, [msg]);
    if (this.sessionId === sessionId) {
      this.state.messages = [...this.state.messages, msg].sort((a, b) => {
        const timeDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        // Use sequenceNumber as secondary sort for deterministic ordering when timestamps are close (within 1 second)
        if (Math.abs(timeDiff) < 1000) {
          return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
        }
        return timeDiff;
      });
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

  // ─── P6.2 T12: AGENT ORCHESTRATOR INTEGRATION ─────────────────────────
  /**
   * Run agent via AgentOrchestrator (hard cutover)
   * This replaces the old runPromptToolLoop with the new controlled agent system
   */
  private async runAgentViaOrchestrator(
    sessionId: string,
    userInput: string,
    assistantId: string,
    _onMeta?: (meta: { model?: string }) => void
  ): Promise<string> {
    let finalOutput = "";
    let currentToolMessageId: string | null = null;

    // Retrieve relevant memories from memory system
    let memoryContext = "";
    try {
      const memoryService = getMemoryEventSourcingService();
      const relevantMemories = memoryService.searchMemories(userInput);
      if (relevantMemories.length > 0) {
        memoryContext = "\n\n[RELEVANT MEMORIES]\n";
        relevantMemories.forEach(mem => {
          memoryContext += `- ${mem.title}: ${mem.content.slice(0, 200)}...\n`;
        });
        memoryContext += "\nUse these memories to inform your response if relevant.\n";
        logger.info("memory_retrieval", "memories_found", { count: relevantMemories.length, sessionId });
      }
    } catch (error) {
      logger.warn("memory_retrieval", "failed", { error: String(error) });
    }

    // Use AgentOrchestrator for standard flow
    await agentOrchestrator.runAgent(sessionId, userInput, {
      onThinking: () => {
        // Phase is set by other callbacks (MODEL_CALL_START, FIRST_TOKEN, etc.)
      },
      onStreamingChunk: (chunk) => {
        // Filter out tool_call JSON, reasoning, logs
        if (chunk && !chunk.includes('"tool_call"') && !chunk.startsWith('{')) {
          // Update or create text block in assistant message
          const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
          if (assistantMsg) {
            // Find existing text block or create new one
            const textBlockIndex = assistantMsg.blocks.findIndex(b => b.type === 'text');
            if (textBlockIndex >= 0) {
              assistantMsg.blocks[textBlockIndex] = {
                type: 'text',
                content: (assistantMsg.blocks[textBlockIndex] as any).content + chunk
              };
            } else {
              assistantMsg.blocks.push({ type: 'text', content: chunk });
            }
            this.notify();
            // Persist to database
            void sessionDatabase.updateAssistantMessage(assistantId, { blocks: assistantMsg.blocks });
          }
          this.setPhase("FIRST_TOKEN");
        }
      },
      onToolStart: (toolName, args) => {
        this.setPhase("TOOL_START");
        const traceMessageId = `${assistantId}-tool-${Date.now()}`;
        currentToolMessageId = traceMessageId;

        // Append mcp_call block to assistant message instead of creating separate tool execution message
        this.appendBlockToAssistantMessage(assistantId, {
          type: "mcp_call",
          tool: toolName,
          args,
          status: "running"
        });
      },
      onToolEnd: (toolName, result, success) => {
        this.setPhase("TOOL_END");
        if (currentToolMessageId) {
          const finishedAt = new Date().toISOString();
          // Calculate execution time
          const executionTimeMs = Math.max(0, Date.parse(finishedAt) - Date.parse(new Date().toISOString()));
          // Estimate MCP latency as 30% of execution time (actual MCP latency requires deeper instrumentation)
          const mcpLatencyMs = Math.round(executionTimeMs * 0.3);

          // Update the last mcp_call block with result and final status
          const blockIndex = this.findLastMcpCallBlockIndex(assistantId);
          if (blockIndex !== null) {
            this.updateBlockInAssistantMessage(assistantId, blockIndex, {
              type: "mcp_call",
              tool: toolName,
              args: {}, // Args already set in onToolStart
              status: success ? "success" : "failed",
              result: success ? result : undefined,
              error: success ? undefined : String(result),
              executionTimeMs,
              mcpLatencyMs
            });
          }
        }
      },
      onFinal: (output) => {
        finalOutput = output;
        this.setPhase("STREAM_END");
        // Remove text blocks to prevent duplication with final block
        const assistantMsg = this.state.assistantMessages.find(m => m.id === assistantId);
        if (assistantMsg) {
          assistantMsg.blocks = assistantMsg.blocks.filter(b => b.type !== 'text');
        }
        // Add final block with assistant's answer
        this.appendBlockToAssistantMessage(assistantId, { type: "final", content: output });
      }
    });

    if (!finalOutput.trim()) {
      throw new AppError("KNEZ_STREAM_EMPTY", "Agent produced no output — model returned an empty response");
    }
    return finalOutput;
  }

  // @ts-ignore — intentionally retained as reference; never called
  private async appendSyntheticToolError(input: {
    sessionId: string;
    assistantId: string;
    step: number;
    toolCallId: string;
    toolName: string;
    errorCode: string;
    errorMessage: string;
    conversation: any[];
  }): Promise<void> {
    const startedAt = new Date().toISOString();
    const finishedAt = new Date().toISOString();
    const traceId = newMessageId();
    const traceMessageId = `${input.assistantId}-tool-${input.step}-error`;
    const errorPayload = { ok: false, error: { code: input.errorCode, message: input.errorMessage } };
    const toolCall: ToolCallMessage = {
      tool: input.toolName,
      args: {},
      status: "calling",
      startedAt
    };
    await this.persistToolTrace(input.sessionId, {
      id: traceMessageId,
      sessionId: input.sessionId,
      from: "tool_execution" as any,
      text: "",
      createdAt: startedAt,
      traceId,
      toolCallId: input.toolCallId,
      toolCall,
      deliveryStatus: "delivered",
      replyToMessageId: input.assistantId,
      correlationId: input.assistantId
    });
    const toolContent = this.stringifyToolPayload(errorPayload, 20000);
    const executionTimeMs = Date.now() - new Date(startedAt).getTime();
    const mcpLatencyMs = Math.round(executionTimeMs * 0.3); // Estimate MCP latency as 30% of execution time
    await this.updateToolTrace(input.sessionId, traceMessageId, {
      text: toolContent,
      toolCall: {
        ...toolCall,
        status: "failed",
        error: `${input.errorCode}:${input.errorMessage}`,
        finishedAt,
        executionTimeMs,
        mcpLatencyMs
      }
    });
    input.conversation.push({ role: "tool", tool_call_id: input.toolCallId, content: toolContent });
  }

  // runNativeToolLoop removed — superseded by runPromptToolLoop + OutputInterpreter routing.
  // Tool execution path: deliverQueueItem → interpretOutput → runPromptToolLoop (maxSteps=3)
  // @ts-ignore — intentionally retained as reference; never called
  private async runNativeToolLoop_REMOVED_SEE_runPromptToolLoop(
    sessionId: string,
    baseMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    toolsForModel: Array<{ name: string; description: string; parameters: any }>,
    onMeta?: (meta: { model?: string }) => void
  ): Promise<string> {
    logger.info("mcp_model", "model_call_prepare", {
      mode: "native_tool_calls",
      toolsCount: toolsForModel.length,
      toolChoice: toolsForModel.length ? "auto" : "none"
    });
    const conversation: any[] = baseMessages.map((m) => ({ role: m.role, content: m.content }));
    const maxSteps = 5;
    for (let step = 0; step < maxSteps; step++) {
      const res = await knezClient.chatCompletionsNonStreamRaw(conversation, sessionId, {
        tools: toolsForModel,
        toolChoice: toolsForModel.length ? "auto" : "none",
        onMeta
      });
      const msg = res?.choices?.[0]?.message as any;
      const toolCalls: any[] = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
      const assistantContent = String(msg?.content ?? "");
      logger.info("mcp_loop", "native_model_output", {
        assistantId,
        step,
        toolCallCount: toolCalls.length,
        hasAssistantContent: assistantContent.length > 0
      });
      if (assistantContent) {
        conversation.push({ role: "assistant", content: assistantContent, tool_calls: toolCalls.length ? toolCalls : undefined });
      } else if (toolCalls.length) {
        conversation.push({ role: "assistant", content: "", tool_calls: toolCalls });
      }

      if (!toolCalls.length) {
        // Guard: native loop should never surface raw JSON that looks like a prompt-mode tool call
        if (
          assistantContent.trim().startsWith("{") &&
          assistantContent.includes('"tool_call"')
        ) {
          logger.warn("mcp_loop", "native_raw_tool_json_blocked", { assistantId, step });
          // Attempt to parse plain text tool JSON and convert to native format
          try {
            const parsed = JSON.parse(assistantContent);
            if (parsed && parsed.tool_call) {
              // Convert prompt-mode tool_call to native tool_calls format
              const toolCall = parsed.tool_call;
              if (toolCall.function && toolCall.function.name) {
                // Create synthetic tool_calls array from parsed tool_call
                const syntheticToolCalls = [{
                  id: `call_${Date.now()}`,
                  type: "function",
                  function: toolCall.function
                }];
                logger.info("mcp_loop", "native_raw_tool_json_converted", { assistantId, step });
                // Process the synthetic tool calls directly
                for (let i = 0; i < syntheticToolCalls.length; i++) {
                  const tc = syntheticToolCalls[i] ?? {};
                  const toolCallId = String(tc?.id ?? `${assistantId}:tool:${step}:${i}`);
                  const fn = tc?.function ?? {};
                  const toolName = String(fn?.name ?? "");
                  const argsRaw = String(fn?.arguments ?? "");
                  let args: any;
                  let argsParseError: string | undefined;
                  try {
                    args = argsRaw ? JSON.parse(argsRaw) : {};
                  } catch (e: any) {
                    argsParseError = String(e?.message ?? e);
                    args = {};
                  }

                  const startedAt = new Date().toISOString();
                  const traceId = newMessageId();
                  const traceMessageId = `${assistantId}-tool-${step}-${i}`;
                  const toolCallMessage: ToolCallMessage = { tool: toolName, args, status: "calling", startedAt };
                  await this.persistToolTrace(sessionId, {
                    id: traceMessageId,
                    sessionId,
                    from: "knez",
                    text: "",
                    createdAt: startedAt,
                    traceId,
                    toolCallId,
                    toolCall: toolCallMessage,
                    deliveryStatus: "delivered",
                    replyToMessageId: assistantId,
                    correlationId: assistantId
                  });

                  let result: any;
                  let ok = false;
                  let errorMsg: string | undefined;
                  if (argsParseError) {
                    errorMsg = `mcp_invalid_tool_arguments_json:${argsParseError}`;
                    result = { ok: false, error: { code: "mcp_invalid_tool_arguments_json", message: argsParseError } };
                    logger.warn("mcp_loop", "native_tool_args_parse_failed", { assistantId, step, toolCallId, tool: toolName, error: argsParseError });
                  } else {
                    const exec = await this.executeToolDeterministic({
                      sessionId,
                      assistantId,
                      toolCallId,
                      toolName,
                      args,
                      traceId
                    });
                    ok = exec.ok;
                    errorMsg = exec.errorMsg;
                    result = exec.payload;
                  }

                  const finishedAt = new Date().toISOString();
                  const executionTimeMs = Date.now() - new Date(startedAt).getTime();
                  const mcpLatencyMs = Math.round(executionTimeMs * 0.3); // Estimate MCP latency as 30% of execution time
                  const toolContent = this.stringifyToolPayload(result, 20000);
                  await this.updateToolTrace(sessionId, traceMessageId, {
                    text: toolContent,
                    toolCall: { ...toolCallMessage, status: ok ? "succeeded" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt, executionTimeMs, mcpLatencyMs }
                  });

                  conversation.push({
                    role: "tool",
                    content: toolContent,
                    tool_call_id: toolCallId,
                    tool_name: toolName,
                  });
                }
                continue;
              }
            }
          } catch (e) {
            logger.warn("mcp_loop", "native_raw_tool_json_parse_failed", { assistantId, step, error: String(e) });
          }
          // If conversion failed, add system message and continue
          conversation.push({
            role: "system",
            content: "Tool protocol violation: do not output tool_call JSON as plain text. Use the native tool_calls format only."
          });
          continue;
        }
        return assistantContent;
      }

      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i] ?? {};
        const toolCallId = String(tc?.id ?? `${assistantId}:tool:${step}:${i}`);
        const fn = tc?.function ?? {};
        const toolName = String(fn?.name ?? "");
        const argsRaw = String(fn?.arguments ?? "");
        let args: any;
        let argsParseError: string | undefined;
        try {
          args = argsRaw ? JSON.parse(argsRaw) : {};
        } catch (e: any) {
          argsParseError = String(e?.message ?? e);
          args = {};
        }

        const startedAt = new Date().toISOString();
        const traceId = newMessageId();
        const traceMessageId = `${assistantId}-tool-${step}-${i}`;
        const toolCall: ToolCallMessage = { tool: toolName, args, status: "pending", startedAt };
        await this.persistToolTrace(sessionId, {
          id: traceMessageId,
          sessionId,
          from: "tool_execution" as any,
          text: "",
          createdAt: startedAt,
          traceId,
          toolCallId,
          toolCall,
          deliveryStatus: "delivered",
          replyToMessageId: assistantId,
          correlationId: assistantId
        });

        // Transition to running after short delay for UI update
        setTimeout(() => {
          this.updateToolTrace(sessionId, traceMessageId, { toolCall: { ...toolCall, status: "running" } });
        }, 50);

        let result: any;
        let ok = false;
        let errorMsg: string | undefined;
        if (argsParseError) {
          // [FIX G1] — Invalid JSON args: do NOT break loop; append error and continue
          errorMsg = `mcp_invalid_tool_arguments_json:${argsParseError}`;
          result = { ok: false, error: { code: "mcp_invalid_tool_arguments_json", message: argsParseError } };
          logger.warn("mcp_loop", "native_tool_args_parse_failed", { assistantId, step, toolCallId, tool: toolName, error: argsParseError });
        } else {
          const exec = await this.executeToolDeterministic({
            sessionId,
            assistantId,
            toolCallId,
            toolName,
            args,
            traceId
          });
          ok = exec.ok;
          errorMsg = exec.errorMsg;
          result = exec.payload;
        }

        const finishedAt = new Date().toISOString();
        const executionTimeMs = Date.now() - new Date(startedAt).getTime();
        const toolContent = this.stringifyToolPayload(result, 20000);
        await this.updateToolTrace(sessionId, traceMessageId, {
          text: toolContent,
          toolCall: { ...toolCall, status: ok ? "completed" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt, executionTimeMs }
        });

        conversation.push({ role: "tool", tool_call_id: toolCallId, content: toolContent });
      }
    }
    throw new Error("tool_loop_limit_reached");
  }

  private parsePromptToolRequest(text: string): { name: string; arguments: any } | null {
    const raw = String(text ?? "").trim();
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
      const rootKeys = Object.keys(obj);
      if (rootKeys.length !== 1 || rootKeys[0] !== "tool_call") return null;
      const tc = (obj as any).tool_call;
      if (!tc || typeof tc !== "object" || Array.isArray(tc)) return null;
      const tcKeys = Object.keys(tc);
      if (tcKeys.length !== 2 || !tcKeys.includes("name") || !tcKeys.includes("arguments")) return null;

      const name = typeof (tc as any).name === "string" ? String((tc as any).name).trim() : "";
      if (!name) return null;
      const canonical = /^([a-zA-Z0-9_-]{1,64})__([a-zA-Z0-9_:-]{1,64})$/;
      if (!canonical.test(name)) return null;

      const args = (tc as any).arguments ?? {};
      if (!args || typeof args !== "object" || Array.isArray(args)) return null;
      return { name, arguments: args };
    } catch {
      return null;
    }
  }

  // @ts-ignore — intentionally retained as reference; never called
  private async runPromptToolLoop(
    sessionId: string,
    baseMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    toolsForModel: Array<{ name: string; description: string; parameters: any }>,
    onMeta?: (meta: { model?: string }) => void
  ): Promise<string> {
    // Initialize agent context via AgentLoopService
    const userGoal = baseMessages.find(m => m.role === "user")?.content || "unknown";
    agentLoopService.initializeContext(sessionId, userGoal);

    const toolNames = toolsForModel.map((t) => t.name).slice(0, 80);
    
    // Get context summary for model via AgentLoopService
    const contextSummary = agentLoopService.getContextSummary(sessionId);
    
    const protocol =
      `\n\n[SYSTEM: TOOL_PROTOCOL]\n` +
      `CRITICAL: Only call a tool if the user's request EXPLICITLY requires a tool action.\n` +
      `Simple messages (greetings, questions, conversation) MUST receive direct plain-text replies.\n` +
      `Do NOT call tools on messages like "hi", "hello", "how are you", "what can you do" etc.\n` +
      `\n` +
      `${contextSummary}\n` +
      `\n` +
      `STRICT JSON SCHEMA REQUIREMENT:\n` +
      `You MUST respond in one of two formats ONLY:\n` +
      `\n` +
      `Format 1 - Plain Text Response:\n` +
      `For normal conversation, greetings, or questions that don't require tools:\n` +
      `Reply directly with natural language text. No JSON. No special formatting.\n` +
      `Example: "Hello! How can I help you today?"\n` +
      `\n` +
      `Format 2 - Tool Call:\n` +
      `When a tool action is required, reply with JSON ONLY and NOTHING ELSE:\n` +
      `{"tool_call":{"name":"<allowed_tool_name>","arguments":{...}}}\n` +
      `\n` +
      `STRICT REQUIREMENTS:\n` +
      `- If tool_call is required: DO NOT ask for permission.\n` +
      `- If tool_call is required: DO NOT explain.\n` +
      `- If tool_call is required: DO NOT simulate.\n` +
      `- If tool_call is required: OUTPUT ONLY JSON.\n` +
      `- Entire message must be valid JSON.\n` +
      `- Root must be exactly {"tool_call":{...}} with no extra keys.\n` +
      `- "tool_call" must contain EXACTLY "name" and "arguments" (no extra keys).\n` +
      `- Do not wrap in markdown or backticks.\n` +
      `- Do not include explanations.\n` +
      `- Use ONLY tool names from the Allowed Tool Names list.\n` +
      `\n` +
      `Allowed tool names:\n${toolNames.map((n) => `- ${n}`).join("\n")}\n` +
      `\n` +
      `T4: MULTI-STEP WORKFLOW GUIDANCE\n` +
      `For complex multi-step tasks, follow this pattern:\n` +
      `1. Navigate to target URL (playwright_browser_navigate)\n` +
      `2. Wait for page load and content to render\n` +
      `3. Click navigation elements (playwright_browser_click) if needed\n` +
      `4. Extract content (playwright_browser_snapshot or similar)\n` +
      `5. Analyze and summarize results\n` +
      `\n` +
      `WORKFLOW EXAMPLES:\n` +
      `- "List all blogs on a site": navigate → click "Blog" → snapshot → extract headings/links\n` +
      `- "Find product information": navigate → search → click product → extract details\n` +
      `- "Get documentation": navigate → find docs section → extract content\n` +
      `\n` +
      `TOOL EXECUTION BEST PRACTICES:\n` +
      `- Always use the full URL including https://\n` +
      `- Use specific selectors when clicking (ref from snapshot)\n` +
      `- Allow time for dynamic content to load (use waitFor if available)\n` +
      `- Extract structured data (headings, links, content) for analysis\n` +
      `- If a tool fails, retry with different parameters or alternative approach\n` +
      `\n` +
      `Otherwise, reply normally with plain text.`;

    const conversation: any[] = baseMessages.map((m, idx) => {
      if (idx === baseMessages.length - 1 && m.role === "user") {
        return { role: m.role, content: String(m.content ?? "") + protocol };
      }
      return { role: m.role, content: m.content };
    });
    const allowedToolNames = new Set(toolNames);

    const maxSteps = 5;
    let consecutiveFailures = 0;
    const toolHistory: Array<{ name: string; args: any }> = [];
    let toolRetryCount = 0;

    for (let step = 0; step < maxSteps; step++) {
      agentLoopService.incrementStep(sessionId);
      logger.info("mcp_loop", "loop_iteration_start", { assistantId, step, maxSteps });

      const res = await knezClient.chatCompletionsNonStreamRaw(conversation, sessionId, {
        tools: toolsForModel,
        toolChoice: toolsForModel.length ? "auto" : "none",
        onMeta
      });
      const msg = res?.choices?.[0]?.message as any;
      const assistantContent = String(msg?.content ?? "");
      conversation.push({ role: "assistant", content: assistantContent });
      const req = this.parsePromptToolRequest(assistantContent);
      logger.info("mcp_loop", "prompt_model_output", {
        assistantId,
        step,
        rawModelOutput: assistantContent.slice(0, 2000),
        parseResult: req ? "tool_call" : "none",
        toolDetected: Boolean(req)
      });
      if (!req) {
        // No tool call detected and content is safe — return final assistant answer
        return assistantContent;
      }

      const toolName = String(req.name ?? "");
      const args = req.arguments ?? {};
      if (!allowedToolNames.has(toolName)) {
        logger.warn("mcp_loop", "non_canonical_tool_name", { assistantId, step, toolName });
      }

      // T3: Enforce snapshot-first execution for click tools
      if (toolName.includes("click") || toolName.includes("type")) {
        const hasRecentSnapshot = toolHistory.some(h => h.name.includes("snapshot"));
        if (!hasRecentSnapshot) {
          logger.warn("mcp_loop", "snapshot_first_violation", { assistantId, step, toolName });
          conversation.push({
            role: "system",
            content: "ERROR: You must take a snapshot before clicking or typing. Take a snapshot first to get element refs, then use those refs to interact."
          });
          continue;
        }
        // T3: Validate that click uses ref from snapshot, not element name
        if (args.element && typeof args.element === "string" && !args.element.startsWith("ref=")) {
          logger.warn("mcp_loop", "click_without_ref", { assistantId, step, toolName });
          conversation.push({
            role: "system",
            content: "ERROR: You must use element refs from snapshot (e.g., ref=abc123) instead of element names. Take a snapshot, extract the ref, and use it."
          });
          continue;
        }
      }

      // T4: Tool argument validation - reject vague inputs
      if (toolName.includes("click") || toolName.includes("type") || toolName.includes("snapshot")) {
        // Check for vague element names (capitalized words that look like labels)
        if (args.element && typeof args.element === "string") {
          const vaguePatterns = /^[A-Z][a-z]+$/; // Single capitalized word like "Blog", "Menu", etc.
          if (vaguePatterns.test(args.element)) {
            logger.warn("mcp_loop", "vague_element_name", { assistantId, step, element: args.element });
            conversation.push({
              role: "system",
              content: `ERROR: Element "${args.element}" is too vague. Use the ref from snapshot (e.g., ref=abc123) to precisely identify the element. Take a snapshot and extract the actual element reference.`
            });
            continue;
          }
        }
        // Check for missing required arguments
        if (toolName.includes("navigate") && !args.url) {
          logger.warn("mcp_loop", "missing_required_arg", { assistantId, step, toolName });
          conversation.push({
            role: "system",
            content: "ERROR: Navigate tool requires a 'url' argument. Provide the full URL including https://."
          });
          continue;
        }
      }

      // Phase 6: Detect redundant tool invocations
      const argsStr = JSON.stringify(args);
      const isRedundant = toolHistory.some(h => h.name === toolName && JSON.stringify(h.args) === argsStr);
      if (isRedundant) {
        logger.warn("mcp_loop", "redundant_tool_invocation", { assistantId, step, toolName });
        consecutiveFailures++;
        if (consecutiveFailures >= 2) {
          logger.error("mcp_loop", "too_many_consecutive_failures", { assistantId, step, consecutiveFailures });
          break;
        }
        conversation.push({
          role: "system",
          content: "You attempted to call the same tool with identical arguments. This indicates a loop. Please either use the result to answer the user or try a different approach."
        });
        continue;
      }
      toolHistory.push({ name: toolName, args });
      consecutiveFailures = 0; // Reset on successful tool invocation

      const startedAt = new Date().toISOString();
      const traceId = newMessageId();
      const traceMessageId = `${assistantId}-tool-${step}-0`;
      const toolCall: ToolCallMessage = { tool: toolName, args, status: "pending", startedAt };
      await this.persistToolTrace(sessionId, {
        id: traceMessageId,
        sessionId,
        from: "tool_execution" as any,
        text: "",
        createdAt: startedAt,
        traceId,
        toolCallId: traceMessageId,
        toolCall,
        deliveryStatus: "delivered",
        replyToMessageId: assistantId,
        correlationId: assistantId
      });

      // Transition to running after short delay for UI update
      setTimeout(() => {
        this.updateToolTrace(sessionId, traceMessageId, { toolCall: { ...toolCall, status: "running" } });
      }, 50);

      let result: any;
      let ok = false;
      let errorMsg: string | undefined;
      let durationMs: number | undefined;
      let mcpLatencyMs: number | undefined;

      // Phase 8: Graceful error handling - tool execution errors should not break the loop
      try {
        const mcpStart = performance.now();
        const exec = await this.executeToolDeterministic({
          sessionId,
          assistantId,
          toolCallId: traceMessageId,
          toolName,
          args,
          traceId
        });
        const mcpEnd = performance.now();
        mcpLatencyMs = mcpEnd - mcpStart;
        ok = exec.ok;
        errorMsg = exec.errorMsg;
        result = exec.payload;
        durationMs = exec.durationMs;
        
        // Record successful tool execution via AgentLoopService
        agentLoopService.recordToolExecution(sessionId, toolName, args, result, ok);
      } catch (toolErr: any) {
        logger.error("mcp_loop", "tool_execution_exception", { assistantId, step, toolName, error: String(toolErr) });
        ok = false;
        errorMsg = `tool_execution_exception:${String(toolErr?.message ?? toolErr)}`;
        result = { error: errorMsg };
        
        // Record failed tool execution and error via AgentLoopService
        agentLoopService.recordToolExecution(sessionId, toolName, args, result, false);
        agentLoopService.recordError(sessionId, "tool_execution_exception", errorMsg, step);
      }

      const finishedAt = new Date().toISOString();
      const toolContent = this.stringifyToolPayload(result, 20000);

      // T1: Validate tool result — detect 404, empty, missing data
      const validation = ok ? validateToolResult(toolName, args, result) : null;
      if (ok && validation && !validation.isValid) {
        // T1+T3: Invalid result — inject retry hint and STRUCTURED_CONTEXT
        logger.warn("mcp_loop", "tool_result_invalid", { assistantId, step, toolName, reasons: validation.reasons });
        await this.updateToolTrace(sessionId, traceMessageId, {
          text: toolContent,
          toolCall: { ...toolCall, status: "failed", result: undefined, error: validation.reasons.join(","), finishedAt, executionTimeMs: durationMs, mcpLatencyMs }
        });
        conversation.push({ role: "tool", tool_call_id: traceMessageId, content: toolContent });
        conversation.push({ role: "system", content: validation.structuredContext });
        conversation.push({ role: "system", content: validation.retryHint });
        toolRetryCount++;
        
        // T5: Use FailureClassifier for intelligent retry decisions
        const classification = failureClassifier.classify({ error: validation.reasons.join(",") }, toolName, args);
        if (!failureClassifier.shouldRetry(classification, toolRetryCount)) {
          logger.warn("mcp_loop", "failure_classifier_abort", { assistantId, step, toolName, classification });
          break;
        }
        
        if (toolRetryCount >= 2) {
          logger.warn("mcp_loop", "tool_retry_limit_reached", { assistantId, step, toolName });
          break;
        }
        continue;
      }
      
      // T5: Handle tool execution failures with FailureClassifier
      if (!ok) {
        const classification = failureClassifier.classify({ error: errorMsg || "unknown" }, toolName, args);
        logger.warn("mcp_loop", "tool_failure_classified", { assistantId, step, toolName, classification });
        
        // Record failure via AgentLoopService
        agentLoopService.recordError(sessionId, classification.type, errorMsg || "unknown", step);
        
        // Check if should retry
        if (failureClassifier.shouldRetry(classification, toolRetryCount)) {
          conversation.push({ role: "tool", tool_call_id: traceMessageId, content: toolContent });
          conversation.push({ role: "system", content: classification.suggestedAction || "Tool failed. Retry with corrected parameters." });
          toolRetryCount++;
          
          if (toolRetryCount >= 2) {
            logger.warn("mcp_loop", "tool_retry_limit_reached", { assistantId, step, toolName });
            break;
          }
          continue;
        }
      }

      await this.updateToolTrace(sessionId, traceMessageId, {
        text: toolContent,
        toolCall: { ...toolCall, status: ok ? "succeeded" : "failed", result: ok ? result : undefined, error: ok ? undefined : errorMsg, finishedAt, executionTimeMs: durationMs, mcpLatencyMs }
      });

      conversation.push({ role: "tool", tool_call_id: traceMessageId, content: toolContent });
      // FIX C: Force model interpretation of tool result
      // The model MUST interpret the tool result and generate a natural language response
      // Do NOT return raw JSON to the user
      const interpretationHint = validation && validation.isValid
        ? `Tool executed successfully. Result: ${JSON.stringify(result).slice(0, 500)}...\n\n${validation.structuredContext}\n\nIMPORTANT: You MUST interpret this tool result and provide a natural language explanation to the user. Do NOT show raw JSON.`
        : `Tool executed. Result: ${JSON.stringify(result).slice(0, 500)}...\n\nIMPORTANT: You MUST interpret this tool result and provide a natural language explanation to the user. Do NOT show raw JSON.`;
      conversation.push({ role: "system", content: interpretationHint });
    }
    
    // Finalize agent context when loop completes
    agentLoopService.finalizeContext(sessionId);
    
    // FIX D: Ensure final response guarantee inside loop termination
    await this.ensureFinalResponse(assistantId);
    
    // ADD 3: Agent Loop Guarantee - ensure loop exits with final answer or structured failure
    logger.warn("mcp_loop", "loop_limit_reached_generating_fallback", { assistantId, maxSteps });
    const lastAssistantContent = conversation.filter(m => m.role === "assistant").pop()?.content || "";
    if (lastAssistantContent && lastAssistantContent.trim()) {
      return lastAssistantContent; // Return last assistant content if available
    }
    
    // Generate fallback answer if no content available
    const userRequest = baseMessages.find(m => m.role === "user")?.content || "your request";
    return `I was unable to complete your request within the allowed number of steps. Please try rephrasing your request or breaking it down into smaller steps. Your original request: "${userRequest.slice(0, 100)}..."`;
  }

  private sanitizeOutput(text: string): string {
    // Interpreter has already classified this as plain_text.
    // No regex. No structured removal. Trim only.
    return text.trim();
  }

  // ─── P2.4 PHASE 3: INTENT CLASSIFIER REMOVED ───────────────────────────
  // Intent classification removed to allow AI model to decide when to use tools
  // instead of blocking tool execution based on keyword matching

  // Manual approval removed - tools auto-approve (requestToolApproval and approveToolExecution removed)

  // ─── P2.6 PHASE 5: RECOVERY RESPONSE ───────────────────────────────
  private async generateFinalAnswer(input: {
    sessionId: string;
    baseMessages: Array<{ role: string; content: string }>;
    assistantId: string;
    streamId: string;
    controller: AbortController;
    onMeta?: (meta: { model?: string }) => void;
  }): Promise<string> {
    const { sessionId, baseMessages, assistantId, streamId, controller, onMeta } = input;
    const finalMessages = [
      ...baseMessages,
      { role: "user", content: "Summarize the tool results and provide a clear, complete answer to the user's question. Do not output tool calls. Do NOT include raw tool output, JSON, or technical details. Focus on meaning and natural language. Plain text only." },
    ];
    this.state.messages = this.state.messages.map((m) =>
      m.id === assistantId ? { ...m, text: "", hasReceivedFirstToken: false } : m
    );
    this.notify();

    let finalBuffer = "";
    let finalClass: OutputClass | null = null;
    let firstTokenReceived = false;
    try {
      for await (const chunk of knezClient.chatCompletionsStream(finalMessages as any, sessionId, { signal: controller.signal, onMeta })) {
        if (streamId !== this.state.currentStreamId) break;
        if (controller.signal.aborted) break;

        // P5.2 T3/T4: Trigger FIRST_TOKEN event on first chunk
        if (!firstTokenReceived && chunk.trim()) {
          firstTokenReceived = true;
          this.setPhase("FIRST_TOKEN");
        }

        if (finalClass === null) {
          finalBuffer += chunk;
          if (canClassifyEarly(finalBuffer)) {
            const interp = interpretOutput(finalBuffer);
            finalClass = interp.classification;
            if (finalClass === "plain_text") {
              this.appendToMessage(assistantId, finalBuffer);
              finalBuffer = "";
            } else {
              break;
            }
          }
        } else if (finalClass === "plain_text") {
          this.appendToMessage(assistantId, chunk);
        }
      }
    } catch (err) {
      logger.warn("output_interpreter", "final_answer_stream_failed", { error: String(err) });
    }
    if (finalClass === null && finalBuffer) {
      const interp = interpretOutput(finalBuffer);
      finalClass = interp.classification;
      if (finalClass === "plain_text") {
        this.appendToMessage(assistantId, finalBuffer);
      }
    }
    if (finalClass === "plain_text") {
      const accText = this.state.messages.find((m) => m.id === assistantId)?.text ?? "";
      return accText.trim() || "⚠️ Unable to generate a final summary. Please try again.";
    }
    logger.warn("output_interpreter", "final_answer_also_non_plain", { classification: finalClass, preview: finalBuffer.slice(0, 80) });
    return "⚠️ Unable to generate a final summary. Please try again.";
  }

  private async generateRecoveryResponse(input: {
    sessionId: string;
    baseMessages: Array<{ role: string; content: string }>;
    assistantId: string;
    streamId: string;
    controller: AbortController;
    onMeta?: (meta: { model?: string }) => void;
  }): Promise<string> {
    const { sessionId, baseMessages, assistantId, streamId, controller, onMeta } = input;
    const recoveryMessages = [
      ...baseMessages,
      { role: "user", content: "Provide a clean human-readable answer to the previous question. No JSON. No tool calls. Plain text only." },
    ];
    this.state.messages = this.state.messages.map((m) =>
      m.id === assistantId ? { ...m, text: "", hasReceivedFirstToken: false } : m
    );
    this.notify();
    // Buffer and classify recovery stream — Law #2: ALL model output must be interpreted
    let recoveryBuffer = "";
    let recoveryClass: OutputClass | null = null;
    try {
      for await (const chunk of knezClient.chatCompletionsStream(recoveryMessages as any, sessionId, { signal: controller.signal, onMeta })) {
        if (streamId !== this.state.currentStreamId) break;
        if (controller.signal.aborted) break;
        if (recoveryClass === null) {
          recoveryBuffer += chunk;
          if (canClassifyEarly(recoveryBuffer)) {
            const interp = interpretOutput(recoveryBuffer);
            recoveryClass = interp.classification;
            if (recoveryClass === "plain_text") {
              this.appendToMessage(assistantId, recoveryBuffer);
              recoveryBuffer = "";
            } else {
              break;
            }
          }
        } else if (recoveryClass === "plain_text") {
          this.appendToMessage(assistantId, chunk);
        }
      }
    } catch (err) {
      logger.warn("output_interpreter", "recovery_stream_failed", { error: String(err) });
    }
    if (recoveryClass === null && recoveryBuffer) {
      const interp = interpretOutput(recoveryBuffer);
      recoveryClass = interp.classification;
      if (recoveryClass === "plain_text") {
        this.appendToMessage(assistantId, recoveryBuffer);
      }
    }
    if (recoveryClass === "plain_text") {
      const accText = this.state.messages.find((m) => m.id === assistantId)?.text ?? "";
      return accText.trim() || "⚠️ Unable to generate a proper response. Please try again.";
    }
    logger.warn("output_interpreter", "recovery_also_non_plain", { classification: recoveryClass, preview: recoveryBuffer.slice(0, 80) });
    return "⚠️ Unable to generate a proper response. Please try again.";
  }

  private async deliverQueueItem(id: string, forceContext?: string) {
    const item = await sessionDatabase.getOutgoing(id);
    if (!item) return;
    
    // ADD 5: Acquire request lock to prevent overlapping requests
    const lockAcquired = await this.acquireRequestLock(item.sessionId, id);
    if (!lockAcquired) {
      logger.warn("chat_service", "deliver_queue_item_lock_failed", { sessionId: item.sessionId, id });
      await sessionDatabase.removeOutgoing(id);
      return;
    }

    const responseStart = Date.now();

    try {
      // T4: Pre-flight health check — block if KNEZ is not ready
      const health = await knezClient.health({ timeoutMs: 2000 });
      if (!health || health.status !== "ok") {
        logger.warn("chat", "pre_flight_health_check_failed", { sessionId: item.sessionId, health });
        const errorMsg = "KNEZ not ready. Please wait for connection.";
        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
        await sessionDatabase.updateMessage(`${id}-assistant`, {
          deliveryStatus: "failed",
          deliveryError: errorMsg,
          isPartial: false,
          text: "⚠️ KNEZ not ready. Please wait for connection.",
          refusal: true
        });
        await sessionDatabase.removeOutgoing(id);
        if (this.sessionId === item.sessionId) {
          this.state.messages = this.state.messages.map((m) => {
            if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
            if (m.id === `${id}-assistant`) {
              return { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: "⚠️ KNEZ not ready. Please wait for connection.", refusal: true };
            }
            return m;
          });
          // P5.2 T11: Set ERROR phase on health check failure
          this.setPhase("ERROR");
        }
        return;
      }
    } catch (healthErr) {
      logger.warn("chat", "pre_flight_health_check_exception", { sessionId: item.sessionId, error: String(healthErr) });
      const errorMsg = "KNEZ not ready. Please wait for connection.";
      await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
      await sessionDatabase.updateMessage(`${id}-assistant`, {
        deliveryStatus: "failed",
        deliveryError: errorMsg,
        isPartial: false,
        text: "⚠️ KNEZ not ready. Please wait for connection.",
        refusal: true
      });
      await sessionDatabase.removeOutgoing(id);
      if (this.sessionId === item.sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
          if (m.id === `${id}-assistant`) {
            return { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: "⚠️ KNEZ not ready. Please wait for connection.", refusal: true };
          }
          return m;
        });
        // P5.2 T11: Set ERROR phase on health check exception
        this.setPhase("ERROR");
      }
      return;
    }

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
        text: item.lastError ? `⚠️ Failed to generate response — ${item.lastError.replace(/^\[.*?\]\s*/, "")}` : "⚠️ Failed to generate response",
        refusal: true
      });
      await sessionDatabase.removeOutgoing(id);
      const failText = item.lastError ? `⚠️ Failed to generate response — ${item.lastError.replace(/^\[.*?\]\s*/, "")}` : "⚠️ Failed to generate response";
      if (this.sessionId === item.sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
          if (m.id === `${id}-assistant`) {
            return { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: failText, refusal: true };
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
      // P5.2 T8: Readiness checks before USER_SEND
      await this.ensureSessionExists(sessionId);
      const existing = await sessionDatabase.getSession(sessionId);
      if (!existing) {
        logger.error("chat_service", "session_not_initialized", { sessionId });
        this.setPhase("ERROR");
        return;
      }
      this.setPhase("USER_SEND");
    }

    const searchContext = await this.buildSearchContext({
      text: item.text,
      searchEnabled: item.searchEnabled,
      forceContext
    });

    const assistantId = `${id}-assistant`;
    const completionMessages = this.buildCompletionMessages(messages, id, assistantId, searchContext);
    const injected = await memoryInjectionService.inject(completionMessages as any, { sessionId, userText: item.text });
    const priorSig = this.lastMcpSignatureBySessionId.get(sessionId);
    const signatureChanged = Boolean(priorSig && priorSig !== injected.signature);
    this.lastMcpSignatureBySessionId.set(sessionId, injected.signature);
    const injectedMessages = signatureChanged
      ? ([{ role: "system", content: "MCP generation changed; tool catalog refreshed." }, ...injected.messages] as any)
      : (injected.messages as any);

    // Transition to model_thinking immediately after initial setup to prevent "Sending prompt..." from lingering
    if (this.sessionId === sessionId) {
      this.setPhase("MODEL_CALL_START");
    }

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
      }
      this.notify();
    }

    let streamId: string | undefined;
    let firstTokenTimer: number | undefined;
    let watchdogId: number | undefined;
    const toolsForModel = toolExposureService.getToolsForModel();
    try {
      let toolModelId: string | undefined = modelId;
      let streamedTokenCount = 0;
      const onMeta = (meta: { model?: string; totalTokens?: number }) => {
        const next = meta?.model?.trim();
        if (next) toolModelId = next;
        if (meta?.totalTokens) streamedTokenCount = meta.totalTokens;
      };

      // FIX A: Detect simple queries for fast path (direct model stream)
      // Simple query: short, no URLs, no tool-related keywords
      const userText = item.text.toLowerCase();
      const hasUrl = /https?:\/\//.test(userText);
      const hasToolKeyword = /navigate|click|type|screenshot|snapshot|search|find|extract|scrape/.test(userText);
      const isSimpleQuery = !hasUrl && !hasToolKeyword && userText.length < 100;
      
      // Use fast path for simple queries, agent loop for complex requests
      const shouldForceToolLoop = !isSimpleQuery && ChatService.MCP_ENABLED && toolsForModel.length > 0;

      if (shouldForceToolLoop) {
        logger.info("mcp_routing", "skipping_streaming_for_tool_loop", { toolsCount: toolsForModel.length, userText: item.text.slice(0, 100) });
        // Skip streaming entirely, go directly to tool loop
        streamId = newMessageId();
        const controller = new AbortController();
        this.activeDelivery = { sessionId, outgoingId: id, assistantId, controller, stopRequested: false };
        // FIX B: Enforce stream ownership
        if (!this.streamController.start(assistantId, streamId)) {
          throw new Error("Cannot start stream - ownership conflict");
        }
        if (this.sessionId === sessionId) {
          this.state.currentStreamId = streamId;
        }

        let processedText = "";
        let toolExecutionTime: number | undefined;
        try {
          const toolLoopStart = Date.now();
          // P6.2 T12: Use AgentOrchestrator instead of runPromptToolLoop
          const userText = item.text;
          processedText = await this.runAgentViaOrchestrator(sessionId, userText, assistantId, onMeta);
          toolExecutionTime = Date.now() - toolLoopStart;
        } catch (mcpErr) {
          logger.warn("mcp_execution", "tool_execution_failed", { error: String(mcpErr) });
          processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
          if (processedText.startsWith("\u26a0")) {
            throw new AppError("KNEZ_STREAM_EMPTY", processedText);
          }
        }

        if (!processedText.trim()) {
          logger.error("response_guarantee", "empty_response_after_tool_loop", { sessionId, assistantId });
          // T10: Check if we had successful tool executions
          const hadSuccessfulTools = this.state.messages.some(
            (m) => m.toolCall?.status === "succeeded" || m.toolCall?.status === "completed"
          );
          if (hadSuccessfulTools) {
            // Force final answer from model
            processedText = await this.generateFinalAnswer({
              sessionId,
              baseMessages: injectedMessages as any,
              assistantId,
              streamId: streamId!,
              controller,
              onMeta
            });
          } else {
            throw new AppError("KNEZ_STREAM_EMPTY", "Agent produced no output");
          }
        }

        const responseTimeMs = Date.now() - responseStart;
        const existingFallbackTriggered = (this.state.messages.find((m) => m.id === assistantId)?.metrics as any)?.fallbackTriggered ?? false;
        const finalAssistant: Partial<ChatMessage> = {
          isPartial: false,
          text: processedText,
          deliveryStatus: "delivered",
          refusal: false,
          metrics: { finishReason: "completed", totalTokens: streamedTokenCount, modelId: toolModelId ?? modelId, backendStatus, responseTimeMs, ...(toolExecutionTime !== undefined ? { toolExecutionTime } : {}), fallbackTriggered: existingFallbackTriggered } as any
        };

        await sessionDatabase.removeOutgoing(id);
        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered" });
        await sessionDatabase.updateMessage(assistantId, {
          deliveryStatus: "delivered",
          text: processedText,
          metrics: finalAssistant.metrics,
          isPartial: false,
          refusal: false
        });
        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => {
            if (m.id === id) return { ...m, deliveryStatus: "delivered" };
            if (m.id === assistantId) return { ...m, ...finalAssistant };
            return m;
          });
          this.state.currentStreamId = null;
          this.setPhase("STREAM_END");
        }
        // FIX B: Cleanup stream ownership
        this.streamController.end(assistantId, streamId!);
        return;
      }

      const support = await knezClient.getToolCallingSupport().catch(() => "unsupported" as const);
      logger.info("mcp_model", "tool_calling_support", {
        support,
        toolsCount: toolsForModel.length,
        toolChoice: support === "supported" && toolsForModel.length ? "auto" : "none"
      });

      streamId = newMessageId();
      const controller = new AbortController();
      this.activeDelivery = { sessionId, outgoingId: id, assistantId, controller, stopRequested: false };
      // FIX B: Enforce stream ownership for normal streaming path
      if (!this.streamController.start(assistantId, streamId)) {
        throw new Error("Cannot start stream - ownership conflict");
      }
      if (this.sessionId === sessionId) {
        this.state.currentStreamId = streamId;
        this.setPhase("MODEL_CALL_START");
      }

      logger.info("streaming", "stream_start", { streamId, sessionId, assistantId });

      // T5: First-token watchdog — abort stream if no token received within 20s
      firstTokenTimer = window.setTimeout(() => {
        logger.warn("streaming", "first_token_timeout", { streamId, assistantId });
        controller.abort();
      }, 20000);

      // ─── P2.6 PHASES 1-5: buffer → classify → route ──────────────────────
      let interpretBuffer = "";
      let outputClass: OutputClass | null = null;

      for await (const chunk of knezClient.chatCompletionsStream(injectedMessages as any, sessionId, { signal: controller.signal, onMeta })) {
        if (streamId !== this.state.currentStreamId) {
          logger.warn("streaming", "stream_aborted_mismatch", { streamId, currentStreamId: this.state.currentStreamId });
          return;
        }
        if (controller.signal.aborted) {
          logger.info("streaming", "stream_aborted", { streamId });
          return;
        }

        if (outputClass === null) {
          interpretBuffer += chunk;
          if (canClassifyEarly(interpretBuffer)) {
            const interp = interpretOutput(interpretBuffer);
            outputClass = interp.classification;
            logger.info("streaming", "classification_decided", { streamId, outputClass });
            if (outputClass === "plain_text") {
              this.appendToMessage(assistantId, interpretBuffer);
              interpretBuffer = ""; // free buffer after flush
            } else {
              logger.info("streaming", "stream_stop_non_plain_text", { streamId, outputClass });
              break;
            }
          }
        } else if (outputClass === "plain_text") {
          this.appendToMessage(assistantId, chunk);
        }
      }

      if (controller.signal.aborted) {
        logger.info("streaming", "stream_aborted_post_loop", { streamId });
        return;
      }

      if (outputClass === null) {
        const interp = interpretOutput(interpretBuffer);
        outputClass = interp.classification;
        if (outputClass === "plain_text") {
          this.appendToMessage(assistantId, interpretBuffer);
        }
      }

      let processedText = "";
      let toolExecutionTime: number | undefined;

      if (outputClass === "plain_text") {
        processedText = this.sanitizeOutput(this.state.messages.find((m) => m.id === assistantId)?.text ?? "");
        if (!processedText.trim()) {
          processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
        }
      } else if (outputClass === "tool_call" && ChatService.MCP_ENABLED) {
        const interp = interpretOutput(interpretBuffer);
        if (interp.toolCall) {
          // Auto-approve all tool calls - no manual approval required
          try {
            const toolLoopStart = Date.now();
            // P6.2 T12: Use AgentOrchestrator instead of runPromptToolLoop
            const userText = item.text;
            processedText = await this.runAgentViaOrchestrator(sessionId, userText, assistantId, onMeta);
            toolExecutionTime = Date.now() - toolLoopStart;
          } catch (mcpErr) {
            logger.warn("mcp_execution", "tool_execution_failed", { toolName: interp.toolCall.name, error: String(mcpErr) });
            processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
          }
        } else {
          processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
        }
      } else if (outputClass === "system_payload") {
        logger.warn("output_interpreter", "system_payload_blocked", { preview: interpretBuffer.slice(0, 80) });
        processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
      } else {
        if (outputClass === "tool_call") {
          logger.info("output_interpreter", "tool_call_mcp_disabled", { preview: interpretBuffer.slice(0, 80) });
        }
        processedText = await this.generateRecoveryResponse({ sessionId, baseMessages: injectedMessages as any, assistantId, streamId: streamId!, controller, onMeta });
      }

      if (!processedText.trim()) {
        logger.error("response_guarantee", "empty_response_after_recovery", { sessionId, assistantId });
        processedText = "⚠️ Failed to generate response. The AI did not produce a valid output.";
      }

      const responseTimeMs = Date.now() - responseStart;

      const existingFallbackTriggered = (this.state.messages.find((m) => m.id === assistantId)?.metrics as any)?.fallbackTriggered ?? false;
      const finalAssistant: Partial<ChatMessage> = {
        isPartial: false,
        text: processedText,
        deliveryStatus: "delivered",
        refusal: false,
        metrics: { finishReason: "completed", totalTokens: streamedTokenCount, modelId: toolModelId ?? modelId, backendStatus, responseTimeMs, ...(toolExecutionTime !== undefined ? { toolExecutionTime } : {}), fallbackTriggered: existingFallbackTriggered } as any
      };

      await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered" });
      await sessionDatabase.updateMessage(assistantId, {
        deliveryStatus: "delivered",
        text: processedText,
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
        if (streamId === this.state.currentStreamId) {
          this.state.currentStreamId = null;
          this.setPhase("STREAM_END");
        }
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
    } catch (err: any) {
      const stopRequested =
        this.activeDelivery?.sessionId === sessionId &&
        this.activeDelivery?.outgoingId === id &&
        this.activeDelivery.stopRequested === true;

      const abortName = String(err?.name ?? "");
      const abortMsg = asErrorMessage(err);
      if (stopRequested && (abortName === "AbortError" || abortMsg === "Request cancelled")) {
        const existingMetrics = (this.state.messages.find((m) => m.id === assistantId)?.metrics as any) ?? {};
        const finalAssistant: Partial<ChatMessage> = {
          isPartial: false,
          text: this.state.messages.find((m) => m.id === assistantId)?.text ?? "",
          deliveryStatus: "delivered",
          metrics: {
            finishReason: "stopped",
            totalTokens: existingMetrics.totalTokens ?? 0,
            modelId,
            backendStatus,
            fallbackTriggered: existingMetrics.fallbackTriggered ?? false,
            ...(existingMetrics.toolExecutionTime !== undefined ? { toolExecutionTime: existingMetrics.toolExecutionTime } : {})
          }
        };

        const persisted = await sessionDatabase.getMessage(assistantId);
        const persistedText = persisted?.text ?? "";
        const persistedTokens = (persisted?.metrics as any)?.totalTokens ?? 0;
        const persistedToolExecutionTime = (persisted?.metrics as any)?.toolExecutionTime;
        const persistedFallbackTriggered = (persisted?.metrics as any)?.fallbackTriggered ?? false;

        await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered", deliveryError: undefined });
        await sessionDatabase.updateMessage(assistantId, {
          deliveryStatus: "delivered",
          deliveryError: undefined,
          isPartial: false,
          refusal: false,
          text: persistedText,
          metrics: { finishReason: "stopped", totalTokens: persistedTokens, modelId, backendStatus, fallbackTriggered: persistedFallbackTriggered, ...(persistedToolExecutionTime !== undefined ? { toolExecutionTime: persistedToolExecutionTime } : {}) }
        });
        await sessionDatabase.removeOutgoing(id);

        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => {
            if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
            if (m.id === assistantId) {
              return { ...m, ...finalAssistant, text: persistedText, metrics: { finishReason: "stopped", totalTokens: persistedTokens, modelId, backendStatus, fallbackTriggered: persistedFallbackTriggered, ...(persistedToolExecutionTime !== undefined ? { toolExecutionTime: persistedToolExecutionTime } : {}) } };
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
        /^\[(KNEZ_TIMEOUT|KNEZ_FETCH_FAILED|KNEZ_HEALTH_FAILED|KNEZ_STREAM_FAILED|KNEZ_STREAM_EMPTY)\]/.test(errorMsg) ||
        /failed to fetch|networkerror|econnrefused|enotfound/i.test(errorMsg) ||
        // Retry server-side errors (5xx) from the completion endpoint
        (/^\[KNEZ_COMPLETION_FAILED\]/.test(errorMsg) && /[56]\d{2}/.test(errorMsg));
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
        await sessionDatabase.updateMessage(`${id}-assistant`, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `⚠️ Failed to generate response — ${errorMsg.replace(/^\[.*?\]\s*/, "")}`, refusal: true });
      }

      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered", deliveryError: undefined };
          if (m.id === `${id}-assistant`) {
            return isTransient
              ? { ...m, deliveryStatus: "queued", deliveryError: errorMsg, isPartial: false, refusal: false }
              : { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `⚠️ Failed to generate response — ${errorMsg.replace(/^\[.*?\]\s*/, "")}`, refusal: true };
          }
          return m;
        });
      }
    } finally {
      // ADD 5: Release request lock
      this.releaseRequestLock(item.sessionId, id);

      // ADD 7: Ensure final response is in FINAL state
      if (assistantId) {
        void this.ensureFinalResponse(assistantId);
      }
      
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
        if (streamId !== undefined && streamId === this.state.currentStreamId) {
          this.state.currentStreamId = null;
          this.setPhase("STREAM_END");
        }
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
      const provider = await this.resolveSearchProvider(true);
      if (provider === "taqwin") {
        const toolArgs = {
          action: "get_content",
          url: urlMatch[0],
          analysis_type: "standard",
          agent_context: "taqwin"
        };
        const t0 = performance.now();
        try {
          const namespaced =
            toolExecutionService.resolveNamespacedName("taqwin", "web_intelligence") ??
            (await (async () => {
              try {
                await mcpOrchestrator.ensureStarted("taqwin");
              } catch {}
              return toolExecutionService.resolveNamespacedName("taqwin", "web_intelligence");
            })());
          if (!namespaced) throw new Error("mcp_tool_not_found");
          const exec = await withTimeout(toolExecutionService.executeNamespacedTool(namespaced, toolArgs, { timeoutMs: 1200 }), Math.min(1200, timeLeftMs()));
          if (!exec.ok) throw new Error(`${exec.error.code}:${exec.error.message}`);
          await emitToolAuditMessage("web_intelligence", toolArgs, "succeeded", { durationMs: Math.round(performance.now() - t0) });
          const text = extractMcpText(exec.result);
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

    const provider = await this.resolveSearchProvider(true);
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
        const namespaced =
          toolExecutionService.resolveNamespacedName("taqwin", "web_intelligence") ??
          (await (async () => {
            try {
              await mcpOrchestrator.ensureStarted("taqwin");
            } catch {}
            return toolExecutionService.resolveNamespacedName("taqwin", "web_intelligence");
          })());
        if (!namespaced) throw new Error("mcp_tool_not_found");
        const exec = await withTimeout(toolExecutionService.executeNamespacedTool(namespaced, toolArgs, { timeoutMs: 1200 }), Math.min(1200, timeLeftMs()));
        if (!exec.ok) throw new Error(`${exec.error.code}:${exec.error.message}`);
        await emitToolAuditMessage("web_intelligence", toolArgs, "succeeded", { durationMs: Math.round(performance.now() - t0) });
        const text = extractMcpText(exec.result);
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

  private async resolveSearchProvider(searchEnabled: boolean): Promise<"off" | "taqwin" | "proxy"> {
    if (!searchEnabled) return "off";
    const w = window as any;
    const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;

    const proxyAllowed = await governanceService.isExternalFetchAllowed();
    if (!isTauri) return proxyAllowed ? "proxy" : "off";

    const serverId = "taqwin";
    const originalName = "web_intelligence";
    const tryResolve = () => toolExecutionService.resolveNamespacedName(serverId, originalName);

    let namespaced = tryResolve();
    if (!namespaced) {
      try {
        await mcpOrchestrator.ensureStarted(serverId);
      } catch {}
      namespaced = tryResolve();
    }
    if (namespaced) {
      const meta = toolExposureService.getToolByName(namespaced);
      const runtime = mcpOrchestrator.getServer(serverId);
      if (meta && runtime) {
        const decision = await governanceService.decideTool(meta, runtime);
        if (decision.allowed) return "taqwin";
      }
    }

    return proxyAllowed ? "proxy" : "off";
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
