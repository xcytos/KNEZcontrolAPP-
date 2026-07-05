import { ChatMessage } from '../../domain/DataContracts';
import { Session, StoredMessage } from './SessionDatabase';
import { sortSessions } from '../../utils/sort';

/**
 * In-memory fallback database for when IndexedDB/Dexie fails
 * Provides basic CRUD operations with session persistence in localStorage
 */
export class InMemoryDatabase {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, StoredMessage[]> = new Map();
  private readonly STORAGE_KEY = 'knez_inmemory_sessions';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.sessions = new Map(data.sessions || []);
        this.messages = new Map(data.messages || []);
        console.log('InMemoryDatabase: Loaded from localStorage');
      }
    } catch (error) {
      console.warn('InMemoryDatabase: Failed to load from localStorage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        sessions: Array.from(this.sessions.entries()),
        messages: Array.from(this.messages.entries())
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('InMemoryDatabase: Failed to save to localStorage:', error);
    }
  }

  async saveSession(id: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    const session: Session = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      tags: [],
      outcome: ""
    };
    
    this.sessions.set(id, session);
    this.saveToStorage();
    console.log(`InMemoryDatabase: Saved session ${id}`);
  }

  async getSessions(): Promise<Session[]> {
    return sortSessions(Array.from(this.sessions.values()));
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateSessionName(id: string, name: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.name = name;
      session.updatedAt = new Date().toISOString();
      this.sessions.set(id, session);
      this.saveToStorage();
    }
  }

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const storedMessages: StoredMessage[] = messages.map((msg, index) => ({
      id: msg.id || `msg_${sessionId}_${index}`,
      sessionId,
      from: msg.from,
      text: msg.text,
      createdAt: msg.createdAt || new Date().toISOString(),
      metrics: msg.metrics || {},
      toolCall: msg.toolCall,
      refusal: msg.refusal,
      isPartial: msg.isPartial || false,
      deliveryStatus: msg.deliveryStatus || 'delivered',
      deliveryError: msg.deliveryError,
      replyToMessageId: msg.replyToMessageId,
      correlationId: msg.correlationId,
      sequenceNumber: index
    }));

    this.messages.set(sessionId, storedMessages);
    this.saveToStorage();
    console.log(`InMemoryDatabase: Saved ${messages.length} messages for session ${sessionId}`);
  }

  async loadMessages(sessionId: string): Promise<StoredMessage[]> {
    const messages = this.messages.get(sessionId) || [];
    console.log(`InMemoryDatabase: Loaded ${messages.length} messages for session ${sessionId}`);
    return messages;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    this.saveToStorage();
    console.log(`InMemoryDatabase: Deleted session ${sessionId}`);
  }

  // Utility methods
  getStats(): { sessions: number; messages: number } {
    const totalMessages = Array.from(this.messages.values())
      .reduce((sum, msgs) => sum + msgs.length, 0);
    
    return {
      sessions: this.sessions.size,
      messages: totalMessages
    };
  }

  clear(): void {
    this.sessions.clear();
    this.messages.clear();
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('InMemoryDatabase: Cleared all data');
  }
}

export const inMemoryDatabase = new InMemoryDatabase();
