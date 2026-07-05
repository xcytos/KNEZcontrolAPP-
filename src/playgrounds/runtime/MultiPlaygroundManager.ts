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

export interface PlaygroundSessionConfig {
  maxSessions: number;
  autoSave: boolean;
  autoCleanup: boolean;
  sessionTimeout: number;
  enablePersistence: boolean;
}

import { sortByOldest } from '../../utils/sort';

export class MultiPlaygroundManager {
  private sessions: Map<string, PlaygroundSession> = new Map();
  private config: PlaygroundSessionConfig;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<PlaygroundSessionConfig> = {}) {
    this.config = {
      maxSessions: 10,
      autoSave: true,
      autoCleanup: true,
      sessionTimeout: 300000, // 5 minutes
      enablePersistence: true,
      ...config
    };
  }

  // Session management
  createSession(name: string, type: PlaygroundSession['type']): PlaygroundSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: PlaygroundSession = {
      id: sessionId,
      name,
      type,
      playgrounds: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        workspacePath: process.cwd(),
        environment: 'development'
      }
    };

    this.sessions.set(sessionId, session);
    this.emitEvent('session_created', { sessionId, session });
    
    console.log(`[MultiPlaygroundManager] Created session: ${sessionId} (${type})`);
    return session;
  }

  getSession(sessionId: string): PlaygroundSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): PlaygroundSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): PlaygroundSession | undefined {
    return Array.from(this.sessions.values()).find(session => session.activePlaygroundId);
  }

  // Playground management within sessions
  addPlaygroundToSession(sessionId: string, playgroundId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.playgrounds.includes(playgroundId)) {
      session.playgrounds.push(playgroundId);
      session.lastActivity = new Date();
      
      this.sessions.set(sessionId, session);
      this.emitEvent('playground_added', { sessionId, playgroundId });
      
      console.log(`[MultiPlaygroundManager] Added playground ${playgroundId} to session ${sessionId}`);
    }
  }

  removePlaygroundFromSession(sessionId: string, playgroundId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const index = session.playgrounds.indexOf(playgroundId);
    if (index > -1) {
      session.playgrounds.splice(index, 1);
      session.lastActivity = new Date();
      
      // If removed playground was active, clear activePlaygroundId
      if (session.activePlaygroundId === playgroundId) {
        session.activePlaygroundId = undefined;
      }
      
      this.sessions.set(sessionId, session);
      this.emitEvent('playground_removed', { sessionId, playgroundId });
      
      console.log(`[MultiPlaygroundManager] Removed playground ${playgroundId} from session ${sessionId}`);
    }
  }

  setActivePlayground(_sessionId: string, playgroundId: string): void {
    // Find session containing the playground
    const sessionEntry = Array.from(this.sessions.entries()).find(([_, session]) => 
      session.playgrounds.includes(playgroundId)
    );

    if (sessionEntry) {
      const [sessionId, session] = sessionEntry;
      session.activePlaygroundId = playgroundId;
      session.lastActivity = new Date();
      
      this.sessions.set(sessionId, session);
      this.emitEvent('active_playground_changed', { sessionId, playgroundId });
      
      console.log(`[MultiPlaygroundManager] Set active playground ${playgroundId} in session ${sessionId}`);
    } else {
      throw new Error(`Playground ${playgroundId} not found in any session`);
    }
  }

  getActivePlaygroundId(): string | undefined {
    const activeSession = this.getActiveSession();
    return activeSession?.activePlaygroundId;
  }

  // Session lifecycle
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clean up all playgrounds in session
    session.playgrounds.forEach(playgroundId => {
      this.emitEvent('playground_closed', { sessionId, playgroundId });
    });

    session.playgrounds = [];
    session.activePlaygroundId = undefined;
    session.lastActivity = new Date();
    
    this.sessions.set(sessionId, session);
    this.emitEvent('session_closed', { sessionId });
    
    console.log(`[MultiPlaygroundManager] Closed session: ${sessionId}`);
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clean up all playgrounds in session
    session.playgrounds.forEach(playgroundId => {
      this.emitEvent('playground_deleted', { sessionId, playgroundId });
    });

    this.sessions.delete(sessionId);
    this.emitEvent('session_deleted', { sessionId });
    
    console.log(`[MultiPlaygroundManager] Deleted session: ${sessionId}`);
  }

  // Session persistence
  async saveSessions(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const sessionsData = JSON.stringify(Array.from(this.sessions.entries()));
      localStorage.setItem('playground_sessions', sessionsData);
      console.log(`[MultiPlaygroundManager] Saved ${this.sessions.size} sessions to localStorage`);
    } catch (error) {
      console.error('[MultiPlaygroundManager] Failed to save sessions:', error);
    }
  }

  async loadSessions(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const sessionsData = localStorage.getItem('playground_sessions');
      if (sessionsData) {
        const sessions = JSON.parse(sessionsData);
        this.sessions.clear();
        
        sessions.forEach((sessionData: any) => {
          this.sessions.set(sessionData.id, {
            ...sessionData,
            createdAt: new Date(sessionData.createdAt),
            lastActivity: new Date(sessionData.lastActivity)
          });
        });
        
        console.log(`[MultiPlaygroundManager] Loaded ${sessions.length} sessions from localStorage`);
      }
    } catch (error) {
      console.error('[MultiPlaygroundManager] Failed to load sessions:', error);
    }
  }

  // Session cleanup and maintenance
  cleanupInactiveSessions(): void {
    const now = new Date();
    const timeout = this.config.sessionTimeout;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > timeout && session.playgrounds.length === 0) {
        console.log(`[MultiPlaygroundManager] Cleaning up inactive session: ${sessionId}`);
        this.closeSession(sessionId);
      }
    }
  }

  enforceMaxSessions(): void {
    const sessions = Array.from(this.sessions.values());
    
    if (sessions.length > this.config.maxSessions) {
      const sortedSessions = sortByOldest(sessions, 'lastActivity');
      
      const sessionsToRemove = sortedSessions.slice(0, sessions.length - this.config.maxSessions);
      
      sessionsToRemove.forEach(session => {
        console.log(`[MultiPlaygroundManager] Removing session to enforce max sessions: ${session.id}`);
        this.deleteSession(session.id);
      });
    }
  }

  // Statistics and monitoring
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    sessionsByType: Record<string, number>;
    averagePlaygroundsPerSession: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(session => session.playgrounds.length > 0);
    
    const sessionsByType = sessions.reduce((acc, session) => {
      acc[session.type] = (acc[session.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averagePlaygroundsPerSession = sessions.length > 0 
      ? sessions.reduce((sum, session) => sum + session.playgrounds.length, 0) / sessions.length 
      : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      sessionsByType,
      averagePlaygroundsPerSession
    };
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
          console.error(`Error in MultiPlaygroundManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Auto-cleanup and maintenance
  startAutoCleanup(): void {
    if (!this.config.autoCleanup) {
      return;
    }

    // Clean up inactive sessions every minute
    setInterval(() => {
      this.cleanupInactiveSessions();
      this.enforceMaxSessions();
    }, 60000); // 1 minute

    // Auto-save sessions every 30 seconds
    if (this.config.autoSave) {
      setInterval(() => {
        this.saveSessions();
      }, 30000);
    }

    console.log('[MultiPlaygroundManager] Auto-cleanup started');
  }

  stopAutoCleanup(): void {
    // Note: In a real implementation, you'd store interval IDs and clear them
    console.log('[MultiPlaygroundManager] Auto-cleanup stopped');
  }
}

// Singleton instance
let globalMultiPlaygroundManager: MultiPlaygroundManager | null = null;

export function getMultiPlaygroundManager(): MultiPlaygroundManager {
  if (!globalMultiPlaygroundManager) {
    globalMultiPlaygroundManager = new MultiPlaygroundManager();
  }
  return globalMultiPlaygroundManager;
}
