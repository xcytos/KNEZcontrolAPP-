// ─── MessageService.ts ────────────────────────────────────────────────
// Phase 2 Week 4-5: Message Operations Consolidation
// Responsibilities: Message creation, finalization, updates, persistence
// Wraps MessageStore and provides high-level message operations
// ─────────────────────────────────────────────────────────────────────────────

import { ChatMessage, AssistantMessage, Block, MessageState } from "../../../domain/DataContracts";
import { sessionDatabase } from "../../session/SessionDatabase";
import { logger } from "../../utils/LogService";
import { MessageIdGenerator } from "../utils/MessageIdGenerator";

export interface MessageCallbacks {
  onMessagesUpdated: (messages: ChatMessage[]) => void;
  onAssistantMessagesUpdated: (messages: AssistantMessage[]) => void;
  notify: () => void;
}

export interface CreateMessageResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  assistantBlock: AssistantMessage;
}

export class MessageService {
  private sessionId: string;
  private callbacks: MessageCallbacks;
  private messageIdGenerator: MessageIdGenerator;
  
  // In-memory state mirrors
  private messages: ChatMessage[] = [];
  private assistantMessages: AssistantMessage[] = [];

  constructor(sessionId: string, callbacks: MessageCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.messageIdGenerator = new MessageIdGenerator();
  }

  // ─── Message Creation ─────────────────────────────────────────────────

  createUserMessage(text: string): ChatMessage {
    const id = this.messageIdGenerator.generateUserMessageId();
    const message: ChatMessage = {
      id,
      sessionId: this.sessionId,
      from: "user",
      text,
      createdAt: new Date().toISOString(),
      deliveryStatus: "queued",
      isPartial: false
    };
    
    this.messages = [...this.messages, message];
    this.callbacks.onMessagesUpdated(this.messages);
    
    return message;
  }

  createAssistantMessage(userMessageId: string): { chatMessage: ChatMessage; assistantBlock: AssistantMessage } {
    const id = this.messageIdGenerator.generateAssistantMessageId(userMessageId);
    
    const chatMessage: ChatMessage = {
      id,
      sessionId: this.sessionId,
      from: "knez",
      text: "",
      createdAt: new Date().toISOString(),
      deliveryStatus: "queued",
      isPartial: true,
      replyToMessageId: userMessageId,
      correlationId: userMessageId
    };

    const assistantBlock: AssistantMessage = {
      id,
      sessionId: this.sessionId,
      role: "assistant",
      state: MessageState.CREATED,
      createdAt: Date.now(),
      blocks: []
    };

    this.messages = [...this.messages, chatMessage];
    this.assistantMessages = [...this.assistantMessages, assistantBlock];
    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);

    return { chatMessage, assistantBlock };
  }

  // ─── Message Updates ────────────────────────────────────────────────────

  appendToMessage(messageId: string, text: string): void {
    this.messages = this.messages.map(m =>
      m.id === messageId ? { ...m, text: (m.text || "") + text, isPartial: true } : m
    );
    
    // Also update assistant message blocks
    this.assistantMessages = this.assistantMessages.map(am => {
      if (am.id === messageId) {
        const textBlockIndex = am.blocks.findIndex(b => b.type === "text");
        if (textBlockIndex >= 0) {
          const updatedBlocks = [...am.blocks];
          const textBlock = updatedBlocks[textBlockIndex] as { type: "text"; content: string };
          updatedBlocks[textBlockIndex] = {
            ...textBlock,
            content: textBlock.content + text
          };
          return { ...am, blocks: updatedBlocks };
        } else {
          const newBlock: Block = { type: "text", content: text };
          return { ...am, blocks: [...am.blocks, newBlock] };
        }
      }
      return am;
    });

    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  finalizeMessage(messageId: string, finalText: string): void {
    this.messages = this.messages.map(m =>
      m.id === messageId
        ? { ...m, text: finalText, isPartial: false, deliveryStatus: "delivered" as const }
        : m
    );

    this.assistantMessages = this.assistantMessages.map(am =>
      am.id === messageId ? { ...am, state: MessageState.FINAL } : am
    );

    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  markMessageFailed(messageId: string, error: string): void {
    this.messages = this.messages.map(m =>
      m.id === messageId
        ? { ...m, deliveryStatus: "failed" as const, deliveryError: error, isPartial: false }
        : m
    );

    this.assistantMessages = this.assistantMessages.map(am =>
      am.id === messageId ? { ...am, state: MessageState.ERROR } : am
    );

    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  // ─── Block Management ───────────────────────────────────────────────────

  appendBlockToAssistantMessage(messageId: string, block: Block): void {
    this.assistantMessages = this.assistantMessages.map(am =>
      am.id === messageId ? { ...am, blocks: [...am.blocks, block] } : am
    );
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  updateBlockInAssistantMessage(messageId: string, blockIndex: number, block: Block): void {
    this.assistantMessages = this.assistantMessages.map(am => {
      if (am.id === messageId) {
        const updatedBlocks = [...am.blocks];
        updatedBlocks[blockIndex] = block;
        return { ...am, blocks: updatedBlocks };
      }
      return am;
    });
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  async persistMessage(message: ChatMessage): Promise<void> {
    await sessionDatabase.saveMessages(this.sessionId, [message]);
    logger.debug("message_service", "message_persisted", { messageId: message.id });
  }

  async updateMessage(messageId: string, patch: Partial<ChatMessage>): Promise<void> {
    await sessionDatabase.updateMessage(messageId, patch as any);
    this.messages = this.messages.map(m => m.id === messageId ? { ...m, ...patch } : m);
    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.notify();
  }

  async loadMessages(): Promise<ChatMessage[]> {
    const messages = await sessionDatabase.loadMessages(this.sessionId);
    this.messages = messages.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
    this.callbacks.onMessagesUpdated(this.messages);
    return this.messages;
  }

  // ─── Retry Operations ───────────────────────────────────────────────────

  async resetMessageForRetry(messageId: string): Promise<void> {
    await sessionDatabase.updateMessage(messageId, {
      deliveryStatus: "queued",
      deliveryError: undefined,
      text: "",
      isPartial: true
    });

    this.messages = this.messages.map(m =>
      m.id === messageId
        ? { ...m, deliveryStatus: "queued", deliveryError: undefined, text: "", isPartial: true }
        : m
    );

    this.assistantMessages = this.assistantMessages.map(am =>
      am.id === messageId ? { ...am, state: MessageState.CREATED } : am
    );

    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
    this.callbacks.notify();
  }

  // ─── Getters ────────────────────────────────────────────────────────────

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getAssistantMessages(): AssistantMessage[] {
    return [...this.assistantMessages];
  }

  findMessage(messageId: string): ChatMessage | undefined {
    return this.messages.find(m => m.id === messageId);
  }

  findAssistantMessage(messageId: string): AssistantMessage | undefined {
    return this.assistantMessages.find(am => am.id === messageId);
  }

  getLastUserMessage(): ChatMessage | undefined {
    return this.messages.filter(m => m.from === "user").pop();
  }

  // ─── State Management ───────────────────────────────────────────────────

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  clear(): void {
    this.messages = [];
    this.assistantMessages = [];
    this.callbacks.onMessagesUpdated(this.messages);
    this.callbacks.onAssistantMessagesUpdated(this.assistantMessages);
  }
}
