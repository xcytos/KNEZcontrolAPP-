export interface SessionData {
  sessions: Record<string, PlaygroundSession>;
  activeSessionId?: string;
  lastSaved: Date;
}

export interface PlaygroundSession {
  id: string;
  name: string;
  type: 'chat' | 'opencode' | 'claudecode' | 'shell' | 'mcp' | 'research' | 'agent';
  playgrounds: string[];
  activePlaygroundId?: string;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export class SessionPersistence {
  private data: SessionData;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.data = {
      sessions: {},
      lastSaved: new Date()
    };
  }

  // Session data management
  loadSessionData(): SessionData {
    try {
      const stored = localStorage.getItem('playground_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastSaved: new Date(parsed.lastSaved)
        };
      }
      return this.data;
    } catch (error) {
      console.error('[SessionPersistence] Failed to load session data:', error);
      return this.data;
    }
  }

  saveSessionData(): void {
    try {
      const sessionData = {
        ...this.data,
        lastSaved: new Date()
      };
      localStorage.setItem('playground_sessions', JSON.stringify(sessionData));
      console.log('[SessionPersistence] Session data saved');
    } catch (error) {
      console.error('[SessionPersistence] Failed to save session data:', error);
    }
  }

  // Session operations
  addSession(session: PlaygroundSession): void {
    this.data.sessions[session.id] = session;
    this.data.lastSaved = new Date();
    this.saveSessionData();
    this.emitEvent('session_added', { sessionId: session.id, session });
  }

  updateSession(sessionId: string, updates: Partial<PlaygroundSession>): void {
    const session = this.data.sessions[sessionId];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date()
    };

    this.data.sessions[sessionId] = updatedSession;
    this.data.lastSaved = new Date();
    this.saveSessionData();
    this.emitEvent('session_updated', { sessionId, session: updatedSession });
  }

  removeSession(sessionId: string): void {
    const session = this.data.sessions[sessionId];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    delete this.data.sessions[sessionId];
    
    // If this was the active session, clear it
    if (this.data.activeSessionId === sessionId) {
      this.data.activeSessionId = undefined;
    }

    this.data.lastSaved = new Date();
    this.saveSessionData();
    this.emitEvent('session_removed', { sessionId, session });
  }

  setActiveSession(sessionId: string): void {
    if (!this.data.sessions[sessionId]) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.data.activeSessionId = sessionId;
    this.data.lastSaved = new Date();
    this.saveSessionData();
    this.emitEvent('active_session_changed', { sessionId });
  }

  getActiveSessionId(): string | undefined {
    return this.data.activeSessionId;
  }

  getSession(sessionId: string): PlaygroundSession | undefined {
    return this.data.sessions[sessionId];
  }

  getAllSessions(): PlaygroundSession[] {
    return Object.values(this.data.sessions);
  }

  // Event handling
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in SessionPersistence event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Singleton instance
let globalSessionPersistence: SessionPersistence | null = null;

export function getSessionPersistence(): SessionPersistence {
  if (!globalSessionPersistence) {
    globalSessionPersistence = new SessionPersistence();
  }
  return globalSessionPersistence;
}
