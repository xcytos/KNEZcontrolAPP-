// ─── MessageStore.ts ───────────────────────────────────────────────────
// Single source of truth for messages
// Responsibilities: message CRUD + in-memory sync
// ─────────────────────────────────────────────────────────────────────────────

import { ChatMessage, AssistantMessage, Block, MessageState } from "../../../domain/DataContracts";
import { sessionDatabase } from "../../session/SessionDatabase";
import { logger } from "../../utils/LogService";

export class MessageStore {
  private messages: Map<string, ChatMessage> = new Map();
  private assistantMessages: Map<string, AssistantMessage> = new Map();
  private sessionId: string;
  private sequenceCounter: number = 0;

  constructor(sessionId: string, initialSequenceCounter: number = 0) {
    this.sessionId = sessionId;
    this.sequenceCounter = initialSequenceCounter;
  }

  async load(): Promise<void> {
    const loaded = await sessionDatabase.loadMessages(this.sessionId);
    const loadedAssistant = await sessionDatabase.loadAssistantMessages(this.sessionId);
    
    this.messages.clear();
    this.assistantMessages.clear();
    
    loaded.forEach((msg: ChatMessage) => this.messages.set(msg.id, msg));
    loadedAssistant.forEach((msg: AssistantMessage) => this.assistantMessages.set(msg.id, msg));
    
    this.sequenceCounter = Math.max(
      ...loaded.map((m: ChatMessage) => m.sequenceNumber ?? 0),
      ...loadedAssistant.map((m: AssistantMessage) => m.sequenceNumber ?? 0)
    ) + 1;
  }

  createMessage(message: ChatMessage): void {
    if (!message.sequenceNumber) {
      message.sequenceNumber = this.getNextSequenceNumber();
    }
    this.messages.set(message.id, message);
    // Persist to database
    void sessionDatabase.saveMessages(this.sessionId, [message]);
    logger.debug("message_store", "message_created", { messageId: message.id });
  }

  getMessageById(id: string): ChatMessage | undefined {
    return this.messages.get(id);
  }

  getAssistantMessageById(id: string): AssistantMessage | undefined {
    return this.assistantMessages.get(id);
  }

  getAllAssistantMessages(): AssistantMessage[] {
    return Array.from(this.assistantMessages.values()).sort((a, b) => {
      const timeDiff = a.createdAt - b.createdAt;
      // Use sequenceNumber as secondary sort for deterministic ordering when timestamps are close (within 1 second)
      if (Math.abs(timeDiff) < 1000) {
        return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
      }
      return timeDiff;
    });
  }

  getAllMessages(): ChatMessage[] {
    return Array.from(this.messages.values()).sort((a, b) => {
      const timeDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      // Use sequenceNumber as secondary sort for deterministic ordering when timestamps are close (within 1 second)
      if (Math.abs(timeDiff) < 1000) {
        return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
      }
      return timeDiff;
    });
  }

  clear(): void {
    this.messages.clear();
    this.assistantMessages.clear();
    this.sequenceCounter = 0;
    logger.debug("message_store", "cleared", { sessionId: this.sessionId });
  }

  updateMessage(id: string, updates: Partial<ChatMessage>): void {
    const msg = this.messages.get(id);
    if (!msg) {
      throw new Error(`Message not found: ${id}`);
    }
    Object.assign(msg, updates);
    logger.debug("message_store", "message_updated", { messageId: id });
  }

  createAssistantMessage(assistantId: string, initialBlocks: Block[] = [], sequenceNumber?: number): AssistantMessage {
    const msg: AssistantMessage = {
      id: assistantId,
      sessionId: this.sessionId,
      role: "assistant",
      state: MessageState.CREATED,
      blocks: initialBlocks,
      createdAt: Date.now(),
      sequenceNumber: sequenceNumber ?? this.getNextSequenceNumber()
    };
    this.assistantMessages.set(assistantId, msg);
    // Persist to database
    void sessionDatabase.saveAssistantMessage(this.sessionId, msg);
    logger.debug("message_store", "assistant_message_created", { assistantId });
    return msg;
  }

  appendToAssistantMessage(assistantId: string, block: Block): void {
    const msg = this.assistantMessages.get(assistantId);
    if (!msg) {
      throw new Error(`Assistant message not found: ${assistantId} - appendToAssistantMessage MUST NEVER fail silently`);
    }
    msg.blocks.push(block);
    logger.debug("message_store", "block_appended", { assistantId, blockType: block.type, totalBlocks: msg.blocks.length });
  }

  updateAssistantMessage(id: string, updates: Partial<AssistantMessage>): void {
    const msg = this.assistantMessages.get(id);
    if (!msg) {
      throw new Error(`Assistant message not found: ${id}`);
    }
    Object.assign(msg, updates);
    // Persist to database
    void sessionDatabase.saveAssistantMessage(this.sessionId, msg);
    logger.debug("message_store", "assistant_message_updated", { assistantId: id });
  }

  private getNextSequenceNumber(): number {
    const seq = this.sequenceCounter;
    this.sequenceCounter += 1;
    return seq;
  }
}
