/**
 * Chat Memory Sync Service
 * 
 * Analyzes chat data to extract conversational memories that are not in the memory system.
 * Provides candidates for memory injection based on chat patterns.
 */

import { Session, StoredMessage } from '../../session/SessionDatabase';
import { sessionDatabase } from '../../session/SessionDatabase';
import { getSimpleMemoryStorage } from '../../memory/storage/SimpleMemoryStorage';
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

export interface SyncResult {
  success: boolean;
  memoriesProcessed: number;
  errors?: string[];
  duration?: number;
}

export interface SyncProgress {
  sessionId: string;
  progress: number; // 0-100
  stage: string;
  isSyncing: boolean;
  startTime: number;
  errors: string[];
}

export class ChatMemorySyncService {
  private memoryService: ReturnType<typeof getSimpleMemoryStorage>;
  private syncProgress = new Map<string, SyncProgress>();
  private listeners = new Set<(progress: SyncProgress) => void>();

  constructor() {
    this.memoryService = getSimpleMemoryStorage();
  }

  /**
   * Analyze all chat data and extract memory candidates
   */
  async analyzeAllChats(): Promise<SyncAnalysisResult> {
    const sessions = await sessionDatabase.getSessions();
    const existingMemories = await this.memoryService.getAllMemories();
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
      
      // Extract implicit learnings from assistant responses
      const implicitLearnings = this.extractImplicitLearnings(session, turn);
      candidates.push(...implicitLearnings);
      
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
    
    const assistantMessages = turn.filter(m => m.from === 'assistant' || m.from === 'knez' || m.from === 'user');
    
    for (const msg of assistantMessages) {
      const text = msg.text;
      
      // Look for learning indicators - more flexible patterns
      const learningPatterns = [
        // Explicit learning patterns
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
        
        // Additional patterns for better coverage
        /i figured out|we figured out/i,
        /i grasped|we grasped/i,
        /i comprehend|we comprehend/i,
        /i see now|we see now/i,
        /it became apparent|it became obvious/i,
        /the crucial point is|the vital point is/i,
        /this reveals|this uncovers/i,
        /i recognized|we recognized/i,
        /i appreciate|we appreciate/i,
        /i acknowledge|we acknowledge/i,
        /this confirms|this validates/i,
        /i get it now|we get it now/i,
        /it strikes me that|it occurs to me that/i,
        /i've come to understand|we've come to understand/i,
        /this makes clear|this clarifies/i,
        /i'm beginning to see|we're beginning to see/i,
        
        // More flexible patterns for general insights
        /i think|we think|in my opinion|in our opinion/i,
        /i believe|we believe|my belief is|our belief is/i,
        /i understand|we understand|my understanding is|our understanding is/i,
        /i found|we found|my finding is|our finding is/i,
        /i noticed|we noticed|my observation is|our observation is/i,
        /i discovered|we discovered|my discovery is|our discovery is/i,
        /the point is|the idea is|the concept is/i,
        /basically|essentially|fundamentally/i,
        /in other words|to put it differently|essentially/i,
        /what i mean is|what we mean is|the point is/i,
        /this means|that means|it means/i,
        /this suggests|that suggests|it suggests/i,
        /this indicates|that indicates|it indicates/i,
        /this implies|that implies|it implies/i,
        
        // Technical/professional learning patterns
        /i implemented|we implemented|implementation shows/i,
        /i created|we created|creation reveals/i,
        /i built|we built|building taught me/i,
        /i developed|we developed|development showed/i,
        /i designed|we designed|design taught us/i,
        /i solved|we solved|solution demonstrates/i,
        /i fixed|we fixed|fix revealed/i,
        /i optimized|we optimized|optimization showed/i,
        /i improved|we improved|improvement taught/i,
        
        // React/programming specific patterns
        /react|component|hook|state|props/i,
        /function|method|class|object|array/i,
        /bug|error|issue|problem|solution/i,
        /code|programming|development|debugging/i,
        /api|database|server|client|frontend/i,
        /javascript|typescript|html|css/i,
        
        // General knowledge patterns
        /i remember|we remember|memory tells me/i,
        /i recall|we recall|recollection is/i,
        /experience taught|experience shows|experience revealed/i,
        /practice shows|in practice|practically speaking/i,
        /from my experience|from our experience|experience-based/i,
        /based on my knowledge|based on our knowledge|knowledge-based/i,
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
   * Extract implicit learnings from assistant responses that provide valuable information
   */
  private extractImplicitLearnings(session: Session, turn: StoredMessage[]): MemoryCandidate[] {
    const implicitLearnings: MemoryCandidate[] = [];
    
    const assistantMessages = turn.filter(m => m.from === 'assistant' || m.from === 'knez');
    
    for (const msg of assistantMessages) {
      const text = msg.text;
      
      // Check for valuable informational content
      const informationalPatterns = [
        /here's how to|here's the way to|this is how you can/i,
        /the best approach is|the recommended way is|you should/i,
        /this works because|this happens due to|the reason is/i,
        /for example|for instance|to illustrate/i,
        /keep in mind|remember to|make sure to/i,
        /the advantage is|the benefit is|this helps/i,
        /this prevents|this avoids|this stops/i,
        /you can use|you might want to|consider using/i,
        /this is important because|this matters because/i,
        /the key is to|the secret is to|the trick is to/i,
      ];
      
      // Check for technical explanations
      const technicalPatterns = [
        /the function works by|the method operates|the process involves/i,
        /under the hood|behind the scenes|internally/i,
        /this uses|this implements|this leverages/i,
        /the architecture is|the design is|the structure is/i,
        /it's built with|it's powered by|it runs on/i,
      ];
      
      // Check for problem-solving content
      const problemSolvingPatterns = [
        /to fix this|to resolve this|to solve this/i,
        /the solution is|the answer is|the fix is/i,
        /this addresses|this solves|this resolves/i,
        /common mistake|common issue|common problem/i,
      ];
      
      const allPatterns = [...informationalPatterns, ...technicalPatterns, ...problemSolvingPatterns];
      
      for (const pattern of allPatterns) {
        const match = text.match(pattern);
        if (match) {
          const title = this.generateImplicitLearningTitle(text, match.index!);
          const content = this.extractContext(text, match.index!);
          
          implicitLearnings.push({
            id: uuidv4(),
            type: 'learning',
            title,
            content,
            domain: 'technical',
            tags: ['conversational', 'extracted', 'learning', 'implicit'],
            metadata: {
              sourceType: 'chat',
              extractedFrom: msg.id,
              sessionId: session.id,
              confidence: 0.5, // Lower confidence for implicit learnings
              learningType: 'implicit',
            },
            sourceSessionId: session.id,
            sourceSessionName: session.name,
            sourceMessageIds: [msg.id],
            confidence: 0.5,
            extractedAt: new Date().toISOString(),
          });
          break; // Only extract one implicit learning per message
        }
      }
    }
    
    return implicitLearnings;
  }

  /**
   * Generate title for implicit learning
   */
  private generateImplicitLearningTitle(text: string, matchIndex: number): string {
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + 100);
    const context = text.substring(start, end).trim();
    
    // Find a good breaking point for the title
    const sentences = context.split(/[.!?]+/);
    if (sentences.length > 0) {
      let title = sentences[0].trim();
      if (title.length > 60) {
        title = title.substring(0, 57) + '...';
      }
      return title;
    }
    
    return 'Technical insight or explanation';
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
   * Sync a single session with proper progress tracking
   */
  async syncSession(sessionId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    // FIRST: Check if already syncing (BEFORE setting any state)
    const existingProgress = this.syncProgress.get(sessionId);
    if (existingProgress && existingProgress.isSyncing) {
      throw new Error('Sync already in progress');
    }

    // THEN: Initialize progress tracking
    const progress: SyncProgress = {
      sessionId,
      progress: 0,
      stage: 'Initializing',
      isSyncing: true,
      startTime,
      errors: []
    };
    
    this.syncProgress.set(sessionId, progress);
    this.notifyListeners(progress);

    try {

      // Step 1: Extract messages (10%)
      this.updateProgress(sessionId, 10, 'Extracting messages');
      const messages = await this.getSessionMessages(sessionId);
      
      // Check for timeout or empty result
      if (!messages) {
        errors.push('Failed to extract messages - database timeout');
        return { success: false, memoriesProcessed: 0, errors, duration: Date.now() - startTime };
      }
      
      if (messages.length === 0) {
        errors.push('No messages found in session');
        return { success: false, memoriesProcessed: 0, errors, duration: Date.now() - startTime };
      }

      // Step 2: Extract memory candidates (30%)
      this.updateProgress(sessionId, 30, 'Extracting memory candidates');
      
      // Get session using in-memory database
      let session: Session | undefined;
      
      try {
        console.log(`Loading session ${sessionId} from session database`);
        session = await sessionDatabase.getSession(sessionId);
        
        if (!session) {
          console.log(`Session ${sessionId} not found in session database, creating fallback session`);
          
          // Create fallback session
          session = {
            id: sessionId,
            name: `Session ${sessionId.substring(0, 6)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: [],
            outcome: ""
          };
          
          // Save to session database
          await sessionDatabase.saveSession(session.id, session.name);
          console.log(`Created and saved fallback session ${sessionId}`);
        }
        
      } catch (error) {
        console.error(`Failed to get session ${sessionId}:`, error);
        
        // Final fallback: Create minimal session
        session = {
          id: sessionId,
          name: `Session ${sessionId.substring(0, 6)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          outcome: ""
        };
      }
      
      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }
      
      const candidates = this.extractMemoryCandidates(session, messages);
      
      if (candidates.length === 0) {
        this.updateProgress(sessionId, 100, 'No memories to sync');
        return { success: true, memoriesProcessed: 0, duration: Date.now() - startTime };
      }

      // Step 3: Filter existing memories (50%)
      this.updateProgress(sessionId, 50, 'Filtering existing memories');
      const existingMemories = await this.memoryService.getAllMemories();
      const existingTitles = new Set(existingMemories.map(m => m.title.toLowerCase()));
      const newCandidates = candidates.filter(c => !existingTitles.has(c.title.toLowerCase()));

      // Step 4: Inject new memories (80%)
      this.updateProgress(sessionId, 80, 'Injecting memories');
      const injectedIds = await this.injectCandidates(newCandidates);

      // Step 5: Complete (100%)
      this.updateProgress(sessionId, 100, 'Sync completed');
      
      return {
        success: true,
        memoriesProcessed: injectedIds.length,
        duration: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      progress.errors.push(errorMessage);
      this.notifyListeners(progress);
      
      return {
        success: false,
        memoriesProcessed: 0,
        errors,
        duration: Date.now() - startTime
      };
    } finally {
      // Clean up progress tracking immediately
      this.syncProgress.delete(sessionId);
    }
  }

  /**
   * Get sync progress for a session
   */
  getSyncProgress(sessionId: string): SyncProgress | null {
    return this.syncProgress.get(sessionId) || null;
  }

  /**
   * Check if a session is currently syncing
   */
  isSessionSyncing(sessionId: string): boolean {
    const progress = this.syncProgress.get(sessionId);
    return progress?.isSyncing || false;
  }

  /**
   * Force clear a stuck sync state (emergency cleanup)
   */
  forceClearSyncState(sessionId: string): void {
    const progress = this.syncProgress.get(sessionId);
    if (progress) {
      console.warn(`Force clearing stuck sync state for session: ${sessionId}`);
      this.syncProgress.delete(sessionId);
      
      // Notify listeners that sync is cleared
      const clearedProgress: SyncProgress = {
        sessionId,
        progress: 0,
        stage: 'Cleared',
        isSyncing: false,
        startTime: Date.now(),
        errors: ['Sync state was forcefully cleared']
      };
      this.notifyListeners(clearedProgress);
    }
  }

  /**
   * Clear all stuck sync states (emergency cleanup)
   */
  clearAllStuckStates(): void {
    const stuckSessions: string[] = [];
    
    for (const [sessionId, progress] of this.syncProgress.entries()) {
      const isStuck = progress.isSyncing && 
                      (Date.now() - progress.startTime > 60000); // Stuck if > 1 minute
      
      if (isStuck) {
        stuckSessions.push(sessionId);
      }
    }
    
    if (stuckSessions.length > 0) {
      console.warn(`Clearing ${stuckSessions.length} stuck sync states: ${stuckSessions.join(', ')}`);
      stuckSessions.forEach(sessionId => this.forceClearSyncState(sessionId));
    }
  }

  /**
   * Subscribe to sync progress updates
   */
  onProgressUpdate(callback: (progress: SyncProgress) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Update progress and notify listeners
   */
  private updateProgress(sessionId: string, progress: number, stage: string): void {
    const currentProgress = this.syncProgress.get(sessionId);
    if (currentProgress) {
      currentProgress.progress = progress;
      currentProgress.stage = stage;
      this.notifyListeners(currentProgress);
    }
  }

  /**
   * Notify all listeners of progress updates
   */
  private notifyListeners(progress: SyncProgress): void {
    this.listeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  /**
   * Get messages for a session using in-memory database
   */
  private async getSessionMessages(sessionId: string): Promise<StoredMessage[]> {
    try {
      console.log(`Loading messages for session ${sessionId} from session database`);
      const messages = await sessionDatabase.loadMessages(sessionId);
      console.log(`Loaded ${messages.length} messages for session ${sessionId}`);
      return messages;
    } catch (error) {
      console.error(`Failed to load messages for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Inject selected memory candidates into the memory system
   */
  async injectCandidates(candidates: MemoryCandidate[]): Promise<string[]> {
    const injectedIds: string[] = [];
    
    // Use SimpleMemoryStorage directly to bypass any caching issues
    const simpleStorage = getSimpleMemoryStorage();
    
    for (const candidate of candidates) {
      try {
        const memoryId = await simpleStorage.createMemory(
          candidate.type,
          candidate.title,
          candidate.content,
          candidate.domain,
          candidate.tags,
          candidate.metadata,
          candidate.sourceSessionId,
          candidate.sourceSessionName,
          candidate.sourceMessageIds
        );
        injectedIds.push(memoryId);
        console.log(`Successfully injected memory: ${candidate.title} (${memoryId})`);
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
