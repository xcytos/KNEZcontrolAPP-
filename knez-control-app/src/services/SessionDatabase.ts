
import Dexie, { Table } from 'dexie';
import { ChatMessage } from '../domain/DataContracts';

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  from: 'user' | 'knez';
  text: string;
  createdAt: string;
  metrics?: any;
}

export class KnezDatabase extends Dexie {
  sessions!: Table<Session>;
  messages!: Table<StoredMessage>;

  constructor() {
    super('KnezDatabase');
    this.version(1).stores({
      sessions: 'id, name, createdAt, updatedAt',
      messages: 'id, sessionId, from, createdAt' // Indexes
    });
  }
}

export const db = new KnezDatabase();

// Service Wrapper
export class SessionDatabase {
  async saveSession(id: string, name: string): Promise<void> {
     const now = new Date().toISOString();
     await db.sessions.put({ id, name, createdAt: now, updatedAt: now }, id);
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

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
     // Batch put
     const rows: StoredMessage[] = messages.map(m => ({
       id: m.id,
       sessionId,
       from: m.from,
       text: m.text,
       createdAt: m.createdAt,
       metrics: m.metrics
     }));
     await db.messages.bulkPut(rows);
     // Update session timestamp
     await db.sessions.update(sessionId, { updatedAt: new Date().toISOString() });
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
     const rows = await db.messages.where('sessionId').equals(sessionId).sortBy('createdAt');
     return rows.map(r => ({
       id: r.id,
       sessionId: r.sessionId,
       from: r.from,
       text: r.text,
       createdAt: r.createdAt,
       metrics: r.metrics
     }));
  }
}

export const sessionDatabase = new SessionDatabase();
