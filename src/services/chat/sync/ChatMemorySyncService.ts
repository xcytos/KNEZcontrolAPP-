/**
 * Chat Memory Sync Service
 * 
 * Analyzes chat data to extract conversational memories that are not in the memory system.
 * Provides candidates for memory injection based on chat patterns.
 */

import { sessionDatabase, Session, StoredMessage } from './session/SessionDatabase';
import { MemoryEventSourcingService } from './MemoryEventSourcingService';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryCandidate {
  id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  title: string;
  content: string;
  domain: string;
  tags: string[];
  metadata: Record<string, unknown>;
  sourceSessionId: string;
  sourceSessionName: string;
  sourceMessageIds: string[];
  confidence: number; // 0.0 - 1.0
  extractedAt: string;
}

export interface SyncAnalysisResult {
  totalSessions: number;
  totalMessages: number;
  existingMemories: number;
  candidates: MemoryCandidate[];
  summary: {
    learnings: number;
    mistakes: number;
    decisions: number;
    patterns: number;
  };
}

export class ChatMemorySyncService {
  private memoryService: MemoryEventSourcingService;

  constructor() {
    this.memoryService = new MemoryEventSourcingService();
  }

  /**
   * Analyze all chat data and extract memory candidates
   */
  async analyzeAllChats(): Promise<SyncAnalysisResult> {
    const sessions = await sessionDatabase.getSessions();
    const existingMemories = this.memoryService.getAllMemories();
    const existingMemoryTitles = new Set(existingMemories.map(m => m.title.toLowerCase()));
    const candidates: MemoryCandidate[] = [];
    let totalMessages = 0;

    for (const session of sessions) {
      const messages = await sessionDatabase.loadMessages(session.id);
      totalMessages += messages.length;
      
      const sessionCandidates = this.extractMemoryCandidates(session, messages);
      
      // Filter out candidates that already exist in memories
      const newCandidates = sessionCandidates.filter(
        candidate => !existingMemoryTitles.has(candidate.title.toLowerCase())
      );
      
      candidates.push(...newCandidates);
    }

    const summary = {
      learnings: candidates.filter(c => c.type === 'learning').length,
      mistakes: candidates.filter(c => c.type === 'mistake').length,
      decisions: candidates.filter(c => c.type === 'decision').length,
      patterns: candidates.filter(c => c.type === 'pattern').length,
    };

    return {
      totalSessions: sessions.length,
      totalMessages,
      existingMemories: existingMemories.length,
      candidates,
      summary,
    };
  }

  /**
   * Extract memory candidates from a single session
   */
  private extractMemoryCandidates(session: Session, messages: StoredMessage[]): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];
    
    // Group messages by conversation turns
    const turns = this.groupIntoTurns(messages);
    
    for (const turn of turns) {
      // Extract learnings from assistant responses
      const learnings = this.extractLearnings(session, turn);
      candidates.push(...learnings);
      
      // Extract mistakes from error patterns
      const mistakes = this.extractMistakes(session, turn);
      candidates.push(...mistakes);
      
      // Extract decisions from tool usage
      const decisions = this.extractDecisions(session, turn);
      candidates.push(...decisions);
      
      // Extract patterns from repeated interactions
      const patterns = this.extractPatterns(session, turn);
      candidates.push(...patterns);
    }
    
    return candidates;
  }

  /**
   * Group messages into conversation turns
   */
  private groupIntoTurns(messages: StoredMessage[]): StoredMessage[][] {
    const turns: StoredMessage[][] = [];
    let currentTurn: StoredMessage[] = [];
    
    for (const message of messages) {
      if (message.from === 'user') {
        if (currentTurn.length > 0) {
          turns.push(currentTurn);
        }
        currentTurn = [message];
      } else {
        currentTurn.push(message);
      }
    }
    
    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }
    
    return turns;
  }

  /**
   * Extract learnings from assistant responses
   */
  private extractLearnings(session: Session, turn: StoredMessage[]): MemoryCandidate[] {
    const learnings: MemoryCandidate[] = [];
    
    const assistantMessages = turn.filter(m => m.from === 'assistant' || m.from === 'knez');
    
    for (const msg of assistantMessages) {
      const text = msg.text;
      
      // Look for learning indicators
      const learningPatterns = [
        /i learned|we learned|learned that/i,
        /important to note|key takeaway|key insight/i,
        /this teaches us|this shows that/i,
        /understanding now|now i understand/i,
        /i realize|we realize|realized that/i,
        /it's clear|it is clear|became clear/i,
        /the key point is|the main point is/i,
        /lesson learned|takeaway from this/i,
        /i now know|we now know/i,
        /this demonstrates|this illustrates/i,
        /noted that|observed that/i,
        /found that|discovered that/i,
        /concluded that|deduced that/i,
      ];
      
      for (const pattern of learningPatterns) {
        const match = text.match(pattern);
        if (match) {
          const title = this.generateLearningTitle(text, match.index!);
          const content = this.extractContext(text, match.index!);
          
          learnings.push({
            id: uuidv4(),
            type: 'learning',
            title,
            content,
            domain: 'conversational',
            tags: ['conversational', 'extracted', 'learning'],
            metadata: {
              sourceType: 'chat',
              extractedFrom: msg.id,
              sessionId: session.id,
              confidence: 0.7,
            },
            sourceSessionId: session.id,
            sourceSessionName: session.name,
            sourceMessageIds: [msg.id],
            confidence: 0.7,
            extractedAt: new Date().toISOString(),
          });
          break; // Only extract one learning per message
        }
      }
    }
    
    return learnings;
  }

  /**
   * Extract mistakes from error patterns
   */
  private extractMistakes(session: Session, turn: StoredMessage[]): MemoryCandidate[] {
    const mistakes: MemoryCandidate[] = [];
    
    // Look for tool execution failures
    const toolFailures = turn.filter(m => 
      m.toolCall && m.toolCall.status === 'failed'
    );
    
    for (const msg of toolFailures) {
      const toolName = msg.toolCall?.tool || 'unknown';
      const error = msg.toolCall?.error || 'Unknown error';
      
      mistakes.push({
        id: uuidv4(),
        type: 'mistake',
        title: `Tool execution failure: ${toolName}`,
        content: `Tool ${toolName} failed with error: ${error}. Context: ${msg.text}`,
        domain: 'conversational',
        tags: ['tool', 'error', 'extracted', 'mistake'],
        metadata: {
          sourceType: 'chat',
          toolName,
          sessionId: session.id,
          extractedFrom: msg.id,
          confidence: 0.9,
        },
        sourceSessionId: session.id,
        sourceSessionName: session.name,
        sourceMessageIds: [msg.id],
        confidence: 0.9,
        extractedAt: new Date().toISOString(),
      });
    }
    
    // Look for error messages in text
    const errorPatterns = [
      /error|failed|failed to|unable to|cannot/i,
      /exception|crash|timeout/i,
      /incorrect|wrong|invalid|malformed/i,
      /denied|forbidden|unauthorized/i,
      /not found|missing|absent/i,
      /unexpected|surprising|unanticipated/i,
      /issue|problem|trouble|difficulty/i,
      /warning|alert|caution/i,
    ];
    
    for (const msg of turn) {
      const text = msg.text;
      
      for (const pattern of errorPatterns) {
        const match = text.match(pattern);
        if (match) {
          mistakes.push({
            id: uuidv4(),
            type: 'mistake',
            title: `Error encountered in conversation`,
            content: this.extractContext(text, match.index!),
            domain: 'conversational',
            tags: ['conversational', 'error', 'extracted', 'mistake'],
            metadata: {
              sourceType: 'chat',
              sessionId: session.id,
              extractedFrom: msg.id,
              confidence: 0.6,
            },
            sourceSessionId: session.id,
            sourceSessionName: session.name,
            sourceMessageIds: [msg.id],
            confidence: 0.6,
            extractedAt: new Date().toISOString(),
          });
          break;
        }
      }
    }
    
    return mistakes;
  }

  /**
   * Extract decisions from tool usage
   */
  private extractDecisions(session: Session, turn: StoredMessage[]): MemoryCandidate[] {
    const decisions: MemoryCandidate[] = [];
    
    // Look for tool calls that represent decisions
    const toolCalls = turn.filter(m => m.toolCall && m.toolCall.status === 'succeeded');
    
    for (const msg of toolCalls) {
      const toolName = msg.toolCall?.tool || 'unknown';
      const args = msg.toolCall?.args || {};
      
      // Only extract significant tool calls
      if (this.isSignificantToolCall(toolName)) {
        decisions.push({
          id: uuidv4(),
          type: 'decision',
          title: `Decision: Execute ${toolName}`,
          content: `Decided to execute tool ${toolName} with args: ${JSON.stringify(args)}. Context: ${msg.text}`,
          domain: 'conversational',
          tags: ['tool', 'decision', 'extracted'],
          metadata: {
            sourceType: 'chat',
            toolName,
            sessionId: session.id,
            extractedFrom: msg.id,
            confidence: 0.8,
          },
          sourceSessionId: session.id,
          sourceSessionName: session.name,
          sourceMessageIds: [msg.id],
          confidence: 0.8,
          extractedAt: new Date().toISOString(),
        });
      }
    }
    
    return decisions;
  }

  /**
   * Extract patterns from repeated interactions
   */
  private extractPatterns(session: Session, turn: StoredMessage[]): MemoryCandidate[] {
    const patterns: MemoryCandidate[] = [];
    
    // Look for repeated user requests
    const userMessages = turn.filter(m => m.from === 'user');
    
    if (userMessages.length > 1) {
      const similarRequests = this.findSimilarRequests(userMessages);
      
      for (const similar of similarRequests) {
        patterns.push({
          id: uuidv4(),
          type: 'pattern',
          title: `Repeated user request pattern`,
          content: `User repeatedly requests similar actions: ${similar.request}. This suggests a pattern in user behavior.`,
          domain: 'conversational',
          tags: ['pattern', 'user-behavior', 'extracted'],
          metadata: {
            sourceType: 'chat',
            patternType: 'repeated-request',
            sessionId: session.id,
            extractedFrom: similar.messageIds,
            confidence: 0.75,
          },
          sourceSessionId: session.id,
          sourceSessionName: session.name,
          sourceMessageIds: similar.messageIds,
          confidence: 0.75,
          extractedAt: new Date().toISOString(),
        });
      }
    }
    
    return patterns;
  }

  /**
   * Check if a tool call is significant enough to be a decision
   */
  private isSignificantToolCall(toolName: string): boolean {
    // Filter out common, low-significance tools
    const lowSignificanceTools = [
      'get_current_time',
      'get_date',
      'echo',
      'ping',
      'get_timezone',
      'get_system_info',
      'list_files',
      'read_file',
      'write_file',
    ];

    // Also filter by namespace patterns
    const lowSignificancePatterns = [
      /^filesystem__/,
      /^datetime__/,
      /^system__/,
    ];

    if (lowSignificanceTools.includes(toolName)) {
      return false;
    }

    for (const pattern of lowSignificancePatterns) {
      if (pattern.test(toolName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find similar user requests in a turn
   */
  private findSimilarRequests(messages: StoredMessage[]): { request: string; messageIds: string[] }[] {
    const patterns: { request: string; messageIds: string[] }[] = [];
    
    // Simple similarity check based on keywords
    const keywordMap = new Map<string, string[]>();
    
    for (const msg of messages) {
      const keywords = this.extractKeywords(msg.text);
      
      for (const keyword of keywords) {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, []);
        }
        keywordMap.get(keyword)!.push(msg.id);
      }
    }
    
    // Find keywords that appear multiple times
    for (const [keyword, messageIds] of keywordMap.entries()) {
      if (messageIds.length >= 2) {
        patterns.push({
          request: keyword,
          messageIds,
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
    
    return words.filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Generate a title for a learning
   */
  private generateLearningTitle(text: string, matchIndex: number): string {
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + 100);
    const snippet = text.substring(start, end).trim();
    
    // Take first sentence as title
    const firstSentence = snippet.split(/[.!?]/)[0];
    return firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
  }

  /**
   * Extract context around a match
   */
  private extractContext(text: string, matchIndex: number): string {
    const start = Math.max(0, matchIndex - 100);
    const end = Math.min(text.length, matchIndex + 200);
    return text.substring(start, end).trim();
  }

  /**
   * Inject selected memory candidates into the memory system
   */
  async injectCandidates(candidates: MemoryCandidate[]): Promise<string[]> {
    const injectedIds: string[] = [];
    
    for (const candidate of candidates) {
      try {
        const memoryId = await this.memoryService.createMemory(
          candidate.type,
          candidate.title,
          candidate.content,
          candidate.domain,
          candidate.tags,
          candidate.metadata
        );
        injectedIds.push(memoryId);
      } catch (error) {
        console.error(`Failed to inject memory candidate ${candidate.id}:`, error);
      }
    }
    
    return injectedIds;
  }
}

// Singleton instance
let syncServiceInstance: ChatMemorySyncService | null = null;

export function getChatMemorySyncService(): ChatMemorySyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ChatMemorySyncService();
  }
  return syncServiceInstance;
}
