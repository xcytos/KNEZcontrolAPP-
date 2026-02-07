
import { sessionDatabase } from './SessionDatabase';
import { ChatMessage } from '../domain/DataContracts';

export class PersistenceService {
  
  async saveChat(sessionId: string, messages: ChatMessage[]): Promise<void> {
    // CP14: Use IndexedDB
    try {
      // Ensure session exists
      const existing = await sessionDatabase.getSession(sessionId);
      if (!existing) {
        await sessionDatabase.saveSession(sessionId, `Session ${sessionId.substring(0,6)}`);
      }
      await sessionDatabase.saveMessages(sessionId, messages);
    } catch (e) {
      console.error("DB Save Failed", e);
    }
  }

  async loadChat(sessionId: string): Promise<ChatMessage[] | null> {
    try {
      const msgs = await sessionDatabase.loadMessages(sessionId);
      return msgs.length > 0 ? msgs : null;
    } catch (e) {
      console.error("DB Load Failed", e);
      return null;
    }
  }

  async listSessions(): Promise<string[]> {
    const sessions = await sessionDatabase.getSessions();
    return sessions.map(s => s.id);
  }
}

export const persistenceService = new PersistenceService();
