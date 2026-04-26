
import Dexie, { Table } from 'dexie';
import { ChatMessage, AssistantMessage, Block, MessageState } from '../../domain/DataContracts';
import { logger } from '../utils/LogService';

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  outcome?: string;
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  from: 'user' | 'assistant' | 'tool_execution' | 'tool_result' | 'system' | 'knez';
  text: string;
  createdAt: string;
  metrics?: any;
  toolCall?: any;
  refusal?: boolean;
  isPartial?: boolean;
  deliveryStatus?: "queued" | "pending" | "delivered" | "failed";
  deliveryError?: string;
  replyToMessageId?: string;
  correlationId?: string;
  sequenceNumber?: number;
}

export interface StoredAssistantMessage {
  id: string;
  sessionId: string;
  role: "assistant";
  state: MessageState; // ADD 1: Add state field
  blocks: Block[];
  createdAt: number; // ADD 1: Change to number timestamp
  finalizedAt?: number; // ADD 1: Add finalizedAt field
  sequenceNumber?: number;
}

export interface OutgoingQueueItem {
  id: string;
  sessionId: string;
  text: string;
  searchEnabled: boolean;
  createdAt: string;
  status: "pending" | "in_flight" | "failed";
  attempts: number;
  nextRetryAt: string;
  lastError?: string;
}

export class KnezDatabase extends Dexie {
  sessions!: Table<Session>;
  messages!: Table<StoredMessage>;
  assistantMessages!: Table<StoredAssistantMessage>;
  outgoingQueue!: Table<OutgoingQueueItem>;

  constructor() {
    super('KnezDatabase');
    this.version(1).stores({
      sessions: 'id, name, createdAt, updatedAt',
      messages: 'id, sessionId, from, createdAt' // Indexes
    });
    this.version(2).stores({
      sessions: 'id, name, createdAt, updatedAt',
      messages: 'id, sessionId, from, createdAt, deliveryStatus',
      outgoingQueue: 'id, sessionId, createdAt, status, nextRetryAt'
    }).upgrade(async (tx) => {
      const messages = tx.table<StoredMessage, string>("messages");
      await messages.toCollection().modify((m) => {
        if (!m.deliveryStatus) m.deliveryStatus = "delivered";
      });
    });
    this.version(3).stores({
      sessions: 'id, name, createdAt, updatedAt, outcome',
      messages: 'id, sessionId, from, createdAt, deliveryStatus',
      outgoingQueue: 'id, sessionId, createdAt, status, nextRetryAt'
    }).upgrade(async (tx) => {
      const sessions = tx.table<Session, string>("sessions");
      await sessions.toCollection().modify((s) => {
        if (!Array.isArray((s as any).tags)) (s as any).tags = [];
        if (typeof (s as any).outcome !== "string") (s as any).outcome = "";
      });
    });
    this.version(4).stores({
      sessions: 'id, name, createdAt, updatedAt, outcome',
      messages: 'id, sessionId, from, createdAt, deliveryStatus',
      assistantMessages: 'id, sessionId, createdAt, sequenceNumber',
      outgoingQueue: 'id, sessionId, createdAt, status, nextRetryAt'
    });
  }
}

export const db = new KnezDatabase();

// Service Wrapper
export class SessionDatabase {
  async saveSession(id: string, name: string): Promise<void> {
     const now = new Date().toISOString();
     await db.sessions.put({ id, name, createdAt: now, updatedAt: now, tags: [], outcome: "" }, id);
  }

  async getSessions(): Promise<Session[]> {
    return await db.sessions.orderBy('updatedAt').reverse().toArray();
  }

  async getSession(id: string): Promise<Session | undefined> {
    return await db.sessions.get(id);
  }

  async updateSessionName(id: string, name: string): Promise<void> {
    await db.sessions.update(id, { name, updatedAt: new Date().toISOString() });
  }

  async updateSessionTags(id: string, tags: string[]): Promise<void> {
    await db.sessions.update(id, { tags, updatedAt: new Date().toISOString() });
  }

  async updateSessionOutcome(id: string, outcome: string): Promise<void> {
    await db.sessions.update(id, { outcome, updatedAt: new Date().toISOString() });
  }

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
     if (!sessionId) {
       logger.error("session_database", "save_messages_failed", { error: "sessionId is null or undefined" });
       return;
     }
     if (!messages || messages.length === 0) {
       logger.warn("session_database", "save_messages_empty", { sessionId });
       return;
     }
     // Batch put
     const rows: StoredMessage[] = messages.map(m => ({
       id: m.id,
       sessionId,
       from: m.from,
       text: m.text,
       createdAt: m.createdAt,
       metrics: m.metrics,
       toolCall: m.toolCall,
       refusal: m.refusal,
       isPartial: m.isPartial,
       deliveryStatus: m.deliveryStatus,
       deliveryError: m.deliveryError,
       replyToMessageId: m.replyToMessageId,
       correlationId: m.correlationId,
       sequenceNumber: m.sequenceNumber
     }));
     await db.messages.bulkPut(rows);
     // Update session timestamp
     await db.sessions.update(sessionId, { updatedAt: new Date().toISOString() });
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
     const rows = await db.messages.where('sessionId').equals(sessionId).toArray();
     // Sort by sequenceNumber for deterministic ordering (not createdAt which can be the same for rapid messages)
     rows.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
     return rows.map(r => ({
       id: r.id,
       sessionId: r.sessionId,
       from: r.from,
       text: r.text,
       createdAt: r.createdAt,
       metrics: r.metrics,
       toolCall: r.toolCall,
       refusal: r.refusal,
       isPartial: r.isPartial,
       deliveryStatus: r.deliveryStatus,
       deliveryError: r.deliveryError,
       replyToMessageId: r.replyToMessageId,
       correlationId: r.correlationId,
       sequenceNumber: r.sequenceNumber
     }));
  }

  async getMessage(id: string): Promise<StoredMessage | undefined> {
    return await db.messages.get(id);
  }

  async updateMessage(id: string, update: Partial<StoredMessage>): Promise<void> {
    await db.messages.update(id, update);
  }

  async saveAssistantMessage(sessionId: string, assistantMessage: AssistantMessage): Promise<void> {
    const row: StoredAssistantMessage = {
      id: assistantMessage.id,
      sessionId,
      role: assistantMessage.role,
      state: assistantMessage.state, // ADD 1: Include state
      blocks: assistantMessage.blocks,
      createdAt: assistantMessage.createdAt,
      finalizedAt: assistantMessage.finalizedAt, // ADD 1: Include finalizedAt
      sequenceNumber: assistantMessage.sequenceNumber
    };
    await db.assistantMessages.put(row);
    await db.sessions.update(sessionId, { updatedAt: new Date().toISOString() });
  }

  async loadAssistantMessages(sessionId: string): Promise<AssistantMessage[]> {
    const rows = await db.assistantMessages.where('sessionId').equals(sessionId).toArray();
    // Sort by sequenceNumber for deterministic ordering (not createdAt which can be the same for rapid messages)
    rows.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
    return rows.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      state: r.state, // ADD 1: Include state
      blocks: r.blocks,
      createdAt: r.createdAt,
      finalizedAt: r.finalizedAt, // ADD 1: Include finalizedAt
      sequenceNumber: r.sequenceNumber
    }));
  }

  async updateAssistantMessage(id: string, update: Partial<StoredAssistantMessage>): Promise<void> {
    await db.assistantMessages.update(id, update);
  }

  async enqueueOutgoing(item: Omit<OutgoingQueueItem, "attempts" | "status" | "nextRetryAt"> & { attempts?: number; status?: OutgoingQueueItem["status"]; nextRetryAt?: string }): Promise<void> {
    const now = new Date().toISOString();
    await db.outgoingQueue.put({
      id: item.id,
      sessionId: item.sessionId,
      text: item.text,
      searchEnabled: item.searchEnabled,
      createdAt: item.createdAt,
      status: item.status ?? "pending",
      attempts: item.attempts ?? 0,
      nextRetryAt: item.nextRetryAt ?? now,
      lastError: item.lastError
    });
  }

  async listOutgoing(status?: OutgoingQueueItem["status"]): Promise<OutgoingQueueItem[]> {
    if (!status) {
      return await db.outgoingQueue.orderBy("createdAt").toArray();
    }
    return await db.outgoingQueue.where("status").equals(status).toArray();
  }

  async getOutgoing(id: string): Promise<OutgoingQueueItem | undefined> {
    return await db.outgoingQueue.get(id);
  }

  async updateOutgoing(id: string, update: Partial<OutgoingQueueItem>): Promise<void> {
    await db.outgoingQueue.update(id, update);
  }

  async removeOutgoing(id: string): Promise<void> {
    await db.outgoingQueue.delete(id);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.messages, db.outgoingQueue, async () => {
      await db.messages.where("sessionId").equals(sessionId).delete();
      await db.outgoingQueue.where("sessionId").equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
  }
}

export const sessionDatabase = new SessionDatabase();
