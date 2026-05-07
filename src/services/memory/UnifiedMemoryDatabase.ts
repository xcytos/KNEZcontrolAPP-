import { getMemoryEventSourcingService, MemoryState } from './storage/MemoryEventSourcingService';
import { sessionDatabase } from '../session/SessionDatabase';

export interface SessionMemoryInfo {
  sessionId: string;
  sessionName: string;
  messageCount: number;
  memoryCount: number;
  lastActivity: string;
  lastSynced?: string;
  hasUnprocessedContent: boolean;
  memories: MemoryState[];
}

export interface MemoryStatistics {
  totalSessions: number;
  totalMemories: number;
  totalMessages: number;
  unprocessedSessions: number;
  memoriesByType: Record<string, number>;
  memoriesByDomain: Record<string, number>;
}

export class UnifiedMemoryDatabase {
  private eventSourcingService = getMemoryEventSourcingService();

  /**
   * Get comprehensive session information with memory statistics
   */
  async getSessionMemoryInfo(sessionId?: string): Promise<SessionMemoryInfo[]> {
    const sessions = sessionId 
      ? [await sessionDatabase.getSession(sessionId)].filter(Boolean)
      : await sessionDatabase.getSessions();
    
    const allMemories = this.eventSourcingService.getAllMemories();
    
    // Group memories by session
    const memoriesBySession = new Map<string, MemoryState[]>();
    allMemories.forEach(memory => {
      const memorySessionId = memory.metadata?.sourceSessionId as string;
      if (memorySessionId) {
        if (!memoriesBySession.has(memorySessionId)) {
          memoriesBySession.set(memorySessionId, []);
        }
        memoriesBySession.get(memorySessionId)!.push(memory);
      }
    });
    
    // Build session information
    const sessionResults = await Promise.all(
      sessions.map(async (session) => {
        if (!session) return null;
        const messages = await sessionDatabase.loadMessages(session.id);
        const sessionMemories = memoriesBySession.get(session.id) || [];
        
        return {
          sessionId: session.id,
          sessionName: session.name,
          messageCount: messages.length,
          memoryCount: sessionMemories.length,
          lastActivity: messages.length > 0 
            ? messages[messages.length - 1].createdAt 
            : session.createdAt || new Date().toISOString(),
          lastSynced: sessionMemories.length > 0 
            ? sessionMemories[sessionMemories.length - 1].createdAt 
            : undefined,
          hasUnprocessedContent: messages.length > 0 && sessionMemories.length === 0,
          memories: sessionMemories
        };
      })
    );
    const sessionInfos = sessionResults.filter((info): info is NonNullable<typeof info> => info !== null);
    
    return sessionInfos;
  }

  /**
   * Get overall memory statistics
   */
  async getMemoryStatistics(): Promise<MemoryStatistics> {
    const sessionInfos = await this.getSessionMemoryInfo();
    const allMemories = this.eventSourcingService.getAllMemories();
    
    const memoriesByType: Record<string, number> = {};
    const memoriesByDomain: Record<string, number> = {};
    
    allMemories.forEach(memory => {
      memoriesByType[memory.type] = (memoriesByType[memory.type] || 0) + 1;
      memoriesByDomain[memory.domain] = (memoriesByDomain[memory.domain] || 0) + 1;
    });
    
    return {
      totalSessions: sessionInfos.length,
      totalMemories: allMemories.length,
      totalMessages: sessionInfos.reduce((sum, s) => sum + s.messageCount, 0),
      unprocessedSessions: sessionInfos.filter(s => s.hasUnprocessedContent).length,
      memoriesByType,
      memoriesByDomain
    };
  }

  /**
   * Get memories for a specific session
   */
  async getSessionMemories(sessionId: string): Promise<MemoryState[]> {
    const allMemories = this.eventSourcingService.getAllMemories();
    return allMemories.filter(memory => 
      memory.metadata?.sourceSessionId === sessionId
    );
  }

  /**
   * Search memories across all sessions
   */
  async searchMemories(query: string, filters?: {
    type?: string;
    domain?: string;
    sessionId?: string;
    confidence?: number;
  }): Promise<MemoryState[]> {
    const allMemories = this.eventSourcingService.getAllMemories();
    const lowerQuery = query.toLowerCase();
    
    return allMemories.filter(memory => {
      // Text search
      const textMatch = memory.title.toLowerCase().includes(lowerQuery) ||
                       memory.content.toLowerCase().includes(lowerQuery);
      
      if (!textMatch) return false;
      
      // Apply filters
      if (filters?.type && memory.type !== filters.type) return false;
      if (filters?.domain && memory.domain !== filters.domain) return false;
      if (filters?.sessionId && memory.metadata?.sourceSessionId !== filters.sessionId) return false;
      if (filters?.confidence && (memory.metadata?.confidence as number || 0) < filters.confidence) return false;
      
      return true;
    });
  }

  /**
   * Get related memories for a given memory
   */
  async getRelatedMemories(memoryId: string, limit: number = 10): Promise<MemoryState[]> {
    const targetMemory = this.eventSourcingService.getMemoryState(memoryId);
    if (!targetMemory) return [];
    
    const allMemories = this.eventSourcingService.getAllMemories();
    const targetSessionId = targetMemory.metadata?.sourceSessionId as string;
    
    // Score memories by relevance
    const scoredMemories = allMemories
      .filter(memory => memory.id !== memoryId)
      .map(memory => {
        let score = 0;
        
        // Same session gets higher score
        if (memory.metadata?.sourceSessionId === targetSessionId) {
          score += 3;
        }
        
        // Same type gets bonus
        if (memory.type === targetMemory.type) {
          score += 2;
        }
        
        // Same domain gets bonus
        if (memory.domain === targetMemory.domain) {
          score += 1;
        }
        
        // Tag overlap
        const targetTags = targetMemory.tags || [];
        const memoryTags = memory.tags || [];
        const commonTags = targetTags.filter((tag: string) => memoryTags.includes(tag));
        score += commonTags.length;
        
        return { memory, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
    
    return scoredMemories;
  }

  /**
   * Get memory lineage (which messages created which memories)
   */
  async getMemoryLineage(sessionId: string): Promise<Array<{
    messageId: string;
    memories: MemoryState[];
  }>> {
    const sessionMemories = await this.getSessionMemories(sessionId);
    const messages = await sessionDatabase.loadMessages(sessionId);
    
    const lineage: Array<{ messageId: string; memories: MemoryState[] }> = [];
    
    messages.forEach(message => {
      const relatedMemories = sessionMemories.filter(memory =>
        (memory.metadata?.sourceMessageIds as string[] || []).includes(message.id)
      );
      
      if (relatedMemories.length > 0) {
        lineage.push({
          messageId: message.id,
          memories: relatedMemories
        });
      }
    });
    
    return lineage;
  }

  /**
   * Export memories in various formats
   */
  async exportMemories(format: 'json' | 'csv' | 'markdown', sessionId?: string): Promise<string> {
    const memories = sessionId 
      ? await this.getSessionMemories(sessionId)
      : this.eventSourcingService.getAllMemories();
    
    switch (format) {
      case 'json':
        return JSON.stringify(memories, null, 2);
      
      case 'csv':
        const headers = ['ID', 'Type', 'Title', 'Content', 'Domain', 'Tags', 'Session', 'Created'];
        const rows = memories.map(memory => [
          memory.id,
          memory.type,
          memory.title,
          memory.content,
          memory.domain,
          memory.tags.join(';'),
          memory.metadata?.sourceSessionId || '',
          memory.createdAt
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      
      case 'markdown':
        return memories.map(memory => {
          const tags = memory.tags.map(tag => `#${tag}`).join(' ');
          const session = memory.metadata?.sourceSessionId || 'Unknown';
          return `## ${memory.title}\n\n**Type:** ${memory.type}\n**Domain:** ${memory.domain}\n**Session:** ${session}\n**Tags:** ${tags}\n\n${memory.content}\n---`;
        }).join('\n\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
