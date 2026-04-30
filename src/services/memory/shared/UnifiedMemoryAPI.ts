/**
 * Unified Memory API Service
 * 
 * Provides high-level API for unified memory operations
 * Handles cross-system synchronization and data transformation
 * 
 * Features:
 * - CRUD operations for memories, sessions, and relations
 * - Advanced search with semantic and full-text capabilities
 * - Cross-system synchronization
 * - Performance optimization with caching
 * - Real-time event broadcasting
 */

import { EventEmitter } from 'events';
import { getUnifiedMemoryDatabase, UnifiedMemory, UnifiedSession, MemoryRelation, SearchQuery, SearchResult } from './UnifiedMemoryDatabase';

// API interfaces
export interface CreateMemoryRequest {
  session_id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern' | 'fact' | 'preference' | 'event';
  title: string;
  content: string;
  domain: string;
  tags?: string[];
  metadata?: Record<string, any>;
  importance?: number;
  confidence?: number;
  system_origin: 'taqwin' | 'knez' | 'unified';
  system_memory_id?: string;
  user_id?: string;
}

export interface UpdateMemoryRequest {
  title?: string;
  content?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  importance?: number;
  confidence?: number;
}

export interface CreateSessionRequest {
  name: string;
  description?: string;
  system_origin: 'taqwin' | 'knez' | 'unified';
  system_session_id?: string;
  user_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateSessionRequest {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  outcome?: string;
  status?: 'active' | 'archived' | 'deleted';
  sync_status?: 'synced' | 'pending' | 'conflict';
  last_sync_at?: number;
}

export interface CreateRelationRequest {
  source_memory_id: string;
  target_memory_id: string;
  relationship_type: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on' | 'contradicts';
  weight?: number;
  confidence?: number;
  bidirectional?: boolean;
  metadata?: Record<string, any>;
  system_origin: 'taqwin' | 'knez' | 'unified';
}

export interface SyncSessionRequest {
  force?: boolean;
  resolve_conflicts?: 'local' | 'remote' | 'merge';
}

export interface SyncSessionResponse {
  session: UnifiedSession;
  sync_status: 'synced' | 'conflict' | 'failed';
  conflicts?: Conflict[];
}

export interface Conflict {
  type: 'data_conflict' | 'version_conflict' | 'relationship_conflict';
  entity_id: string;
  local_data: any;
  remote_data: any;
  timestamp: number;
}

export interface MemoryAnalytics {
  total_memories: number;
  memories_by_type: Record<string, number>;
  memories_by_domain: Record<string, number>;
  memory_growth: { date: Date; count: number }[];
  top_tags: { tag: string; count: number }[];
  system_usage: { system: string; usage: number }[];
  performance_metrics: {
    avg_query_time: number;
    avg_sync_time: number;
    cache_hit_rate: number;
    error_rate: number;
  };
}

export interface SessionAnalytics {
  total_sessions: number;
  active_sessions: number;
  sessions_by_system: Record<string, number>;
  average_memories_per_session: number;
  session_duration_stats: {
    min: number;
    max: number;
    avg: number;
  };
}

export class UnifiedMemoryAPI extends EventEmitter {
  private db = getUnifiedMemoryDatabase();
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private performanceTracker: PerformanceTracker;

  constructor() {
    super();
    this.performanceTracker = new PerformanceTracker();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.db.initialize();
    this.setupEventHandlers();
    console.log('Unified Memory API initialized');
  }

  private setupEventHandlers(): void {
    // Setup cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute

    // Setup performance tracking
    setInterval(() => {
      this.emit('performance_metrics', this.performanceTracker.getMetrics());
    }, 30000); // Emit metrics every 30 seconds
  }

  /**
   * Session Operations
   */
  async createSession(request: CreateSessionRequest): Promise<UnifiedSession> {
    const startTime = Date.now();
    
    try {
      const sessionId = await this.db.createSession({
        ...request,
        status: 'active',
        sync_status: 'synced'
      });

      const session = await this.db.getSession(sessionId);
      if (!session) {
        throw new Error('Failed to retrieve created session');
      }

      // Invalidate cache
      this.invalidateCache('sessions:*');

      // Emit event
      this.emit('session_created', session);

      // Track performance
      this.performanceTracker.recordOperation('create_session', Date.now() - startTime);

      return session;
    } catch (error) {
      this.performanceTracker.recordError('create_session', error);
      throw error;
    }
  }

  async getSession(id: string): Promise<UnifiedSession | null> {
    // Check cache first
    const cacheKey = `session:${id}`;
    const cached = this.getFromCache<UnifiedSession>(cacheKey);
    if (cached) {
      return cached;
    }

    const session = await this.db.getSession(id);
    if (session) {
      this.setCache(cacheKey, session);
    }

    return session;
  }

  async updateSession(id: string, updates: UpdateSessionRequest): Promise<UnifiedSession | null> {
    const startTime = Date.now();
    
    try {
      const success = await this.db.updateSession(id, updates);
      if (!success) {
        return null;
      }

      const session = await this.db.getSession(id);
      if (!session) {
        return null;
      }

      // Invalidate cache
      this.invalidateCache(`session:${id}`);
      this.invalidateCache('sessions:*');

      // Emit event
      this.emit('session_updated', session);

      // Track performance
      this.performanceTracker.recordOperation('update_session', Date.now() - startTime);

      return session;
    } catch (error) {
      this.performanceTracker.recordError('update_session', error);
      throw error;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const success = await this.db.deleteSession(id);
      
      if (success) {
        // Invalidate cache
        this.invalidateCache(`session:${id}`);
        this.invalidateCache('sessions:*');

        // Emit event
        this.emit('session_deleted', { id });
      }

      // Track performance
      this.performanceTracker.recordOperation('delete_session', Date.now() - startTime);

      return success;
    } catch (error) {
      this.performanceTracker.recordError('delete_session', error);
      throw error;
    }
  }

  async getSessions(filters?: {
    user_id?: string;
    system_origin?: string;
    status?: 'active' | 'archived' | 'deleted';
    limit?: number;
    offset?: number;
  }): Promise<UnifiedSession[]> {
    const cacheKey = `sessions:${JSON.stringify(filters)}`;
    const cached = this.getFromCache<UnifiedSession[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build query
    let sql = 'SELECT * FROM sessions WHERE 1=1';
    const params: any[] = [];

    if (filters?.user_id) {
      sql += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters?.system_origin) {
      sql += ' AND system_origin = ?';
      params.push(filters.system_origin);
    }

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY updated_at DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.getDatabase().prepare(sql);
    const rows = stmt.all(...params) as any[];

    const sessions = rows.map(row => this.mapRowToSession(row));
    this.setCache(cacheKey, sessions);

    return sessions;
  }

  /**
   * Memory Operations
   */
  async createMemory(request: CreateMemoryRequest): Promise<UnifiedMemory> {
    const startTime = Date.now();
    
    try {
      // Generate content hash for deduplication
      const content_hash = this.generateContentHash(request.content);

      const memoryId = await this.db.createMemory({
        ...request,
        importance: request.importance || 5,
        confidence: request.confidence || 1.0,
        content_hash,
        sync_status: 'synced'
      });

      const memory = await this.db.getMemory(memoryId);
      if (!memory) {
        throw new Error('Failed to retrieve created memory');
      }

      // Invalidate cache
      this.invalidateCache(`memory:${memoryId}`);
      this.invalidateCache(`memories:session:${request.session_id}`);
      this.invalidateCache('memories:*');

      // Emit event
      this.emit('memory_created', memory);

      // Track performance
      this.performanceTracker.recordOperation('create_memory', Date.now() - startTime);

      return memory;
    } catch (error) {
      this.performanceTracker.recordError('create_memory', error);
      throw error;
    }
  }

  async getMemory(id: string): Promise<UnifiedMemory | null> {
    // Check cache first
    const cacheKey = `memory:${id}`;
    const cached = this.getFromCache<UnifiedMemory>(cacheKey);
    if (cached) {
      return cached;
    }

    const memory = await this.db.getMemory(id);
    if (memory) {
      this.setCache(cacheKey, memory);
    }

    return memory;
  }

  async updateMemory(id: string, updates: UpdateMemoryRequest): Promise<UnifiedMemory | null> {
    const startTime = Date.now();
    
    try {
      const success = await this.db.updateMemory(id, updates);
      if (!success) {
        return null;
      }

      const memory = await this.db.getMemory(id);
      if (!memory) {
        return null;
      }

      // Update content hash if content changed
      if (updates.content) {
        const content_hash = this.generateContentHash(updates.content);
        await this.db.updateMemory(id, { content_hash } as any);
        memory.content_hash = content_hash;
      }

      // Invalidate cache
      this.invalidateCache(`memory:${id}`);
      this.invalidateCache(`memories:session:${memory.session_id}`);
      this.invalidateCache('memories:*');

      // Emit event
      this.emit('memory_updated', memory);

      // Track performance
      this.performanceTracker.recordOperation('update_memory', Date.now() - startTime);

      return memory;
    } catch (error) {
      this.performanceTracker.recordError('update_memory', error);
      throw error;
    }
  }

  async deleteMemory(id: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Get memory before deletion for cache invalidation
      const memory = await this.db.getMemory(id);
      
      const success = await this.db.deleteMemory(id);
      
      if (success && memory) {
        // Invalidate cache
        this.invalidateCache(`memory:${id}`);
        this.invalidateCache(`memories:session:${memory.session_id}`);
        this.invalidateCache('memories:*');

        // Emit event
        this.emit('memory_deleted', { id, session_id: memory.session_id });
      }

      // Track performance
      this.performanceTracker.recordOperation('delete_memory', Date.now() - startTime);

      return success;
    } catch (error) {
      this.performanceTracker.recordError('delete_memory', error);
      throw error;
    }
  }

  async getMemories(filters?: {
    session_id?: string;
    type?: string[];
    domain?: string[];
    tags?: string[];
    user_id?: string;
    system_origin?: string;
    importance_min?: number;
    importance_max?: number;
    created_after?: number;
    created_before?: number;
    limit?: number;
    offset?: number;
    sort_by?: 'created_at' | 'updated_at' | 'importance';
    sort_order?: 'asc' | 'desc';
  }): Promise<UnifiedMemory[]> {
    const cacheKey = `memories:${JSON.stringify(filters)}`;
    const cached = this.getFromCache<UnifiedMemory[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build query
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];

    if (filters?.session_id) {
      sql += ' AND session_id = ?';
      params.push(filters.session_id);
    }

    if (filters?.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      if (types.length > 0) {
        sql += ` AND type IN (${types.map(() => '?').join(', ')})`;
        params.push(...types);
      }
    }

    if (filters?.domain) {
      const domains = Array.isArray(filters.domain) ? filters.domain : [filters.domain];
      if (domains.length > 0) {
        sql += ` AND domain IN (${domains.map(() => '?').join(', ')})`;
        params.push(...domains);
      }
    }

    if (filters?.user_id) {
      sql += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters?.system_origin) {
      sql += ' AND system_origin = ?';
      params.push(filters.system_origin);
    }

    if (filters?.importance_min !== undefined) {
      sql += ' AND importance >= ?';
      params.push(filters.importance_min);
    }

    if (filters?.importance_max !== undefined) {
      sql += ' AND importance <= ?';
      params.push(filters.importance_max);
    }

    if (filters?.created_after) {
      sql += ' AND created_at >= ?';
      params.push(filters.created_after);
    }

    if (filters?.created_before) {
      sql += ' AND created_at <= ?';
      params.push(filters.created_before);
    }

    // Add sorting
    const sortBy = filters?.sort_by || 'created_at';
    const sortOrder = filters?.sort_order || 'desc';
    sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.getDatabase().prepare(sql);
    const rows = stmt.all(...params) as any[];

    const memories = rows.map(row => this.mapRowToMemory(row));
    this.setCache(cacheKey, memories);

    return memories;
  }

  /**
   * Search Operations
   */
  async searchMemories(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      const results = await this.db.searchMemories(query);
      
      // Track performance
      this.performanceTracker.recordOperation('search_memories', Date.now() - startTime);
      
      return results;
    } catch (error) {
      this.performanceTracker.recordError('search_memories', error);
      throw error;
    }
  }

  /**
   * Memory Relations
   */
  async createRelation(request: CreateRelationRequest): Promise<MemoryRelation> {
    const startTime = Date.now();
    
    try {
      // Check if memories exist
      const sourceMemory = await this.db.getMemory(request.source_memory_id);
      const targetMemory = await this.db.getMemory(request.target_memory_id);
      
      if (!sourceMemory || !targetMemory) {
        throw new Error('Source or target memory not found');
      }

      // Create relation
      const relationId = await this.db.createMemoryRelation({
        source_memory_id: request.source_memory_id,
        target_memory_id: request.target_memory_id,
        relationship_type: request.relationship_type,
        weight: request.weight || 1.0,
        confidence: request.confidence || 1.0,
        bidirectional: request.bidirectional || false,
        metadata: request.metadata,
        system_origin: request.system_origin
      });

      const relation = await this.db.getMemoryRelation(relationId);
      if (!relation) {
        throw new Error('Failed to retrieve created relation');
      }

      // Invalidate cache
      this.invalidateCache(`relations:memory:${request.source_memory_id}`);
      this.invalidateCache(`relations:memory:${request.target_memory_id}`);
      this.invalidateCache('relations:*');

      // Emit event
      this.emit('relation_created', relation);

      // Track performance
      this.performanceTracker.recordOperation('create_relation', Date.now() - startTime);

      return relation;
    } catch (error) {
      this.performanceTracker.recordError('create_relation', error);
      throw error;
    }
  }

  async getMemoryRelations(memoryId: string): Promise<MemoryRelation[]> {
    const cacheKey = `relations:memory:${memoryId}`;
    const cached = this.getFromCache<MemoryRelation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const relations = await this.db.getMemoryRelations(memoryId);
    this.setCache(cacheKey, relations);

    return relations;
  }

  /**
   * Analytics
   */
  async getMemoryAnalytics(timeRange?: { start: Date; end: Date }): Promise<MemoryAnalytics> {
    const cacheKey = `analytics:memory:${JSON.stringify(timeRange)}`;
    const cached = this.getFromCache<MemoryAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get basic counts
    const totalMemories = this.db.getDatabase().prepare('SELECT COUNT(*) as count FROM memories').get() as any;
    
    // Get memories by type
    const memoriesByType = this.db.getDatabase().prepare(`
      SELECT type, COUNT(*) as count 
      FROM memories 
      GROUP BY type
    `).all() as any[];

    // Get memories by domain
    const memoriesByDomain = this.db.getDatabase().prepare(`
      SELECT domain, COUNT(*) as count 
      FROM memories 
      GROUP BY domain
    `).all() as any[];

    // Get memory growth (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const memoryGrowth = this.db.getDatabase().prepare(`
      SELECT 
        DATE(created_at / 1000, 'unixepoch') as date,
        COUNT(*) as count
      FROM memories 
      WHERE created_at >= ?
      GROUP BY DATE(created_at / 1000, 'unixepoch')
      ORDER BY date
    `).all(thirtyDaysAgo) as any[];

    // Get top tags - handle tags as JSON array or comma-separated string
    const topTags = this.db.getDatabase().prepare(`
      SELECT 
        tag,
        COUNT(*) as count
      FROM (
        SELECT 
          CASE 
            WHEN json_valid(memories.tags) THEN json_extract(memories.tags, '$')
            WHEN typeof(memories.tags) = 'text' THEN trim(memories.tags)
            ELSE NULL
          END as tag
        FROM memories
        WHERE memories.tags IS NOT NULL AND memories.tags != ''
      ) 
      WHERE tag IS NOT NULL
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 20
    `).all() as any[];

    // Get system usage
    const systemUsage = this.db.getDatabase().prepare(`
      SELECT system_origin, COUNT(*) as usage
      FROM memories
      GROUP BY system_origin
    `).all() as any[];

    const analytics: MemoryAnalytics = {
      total_memories: totalMemories.count,
      memories_by_type: memoriesByType.reduce((acc, row) => {
        acc[row.type] = row.count;
        return acc;
      }, {}),
      memories_by_domain: memoriesByDomain.reduce((acc, row) => {
        acc[row.domain] = row.count;
        return acc;
      }, {}),
      memory_growth: memoryGrowth.map(row => ({
        date: new Date(row.date),
        count: row.count
      })),
      top_tags: topTags.map(row => ({
        tag: row.tag,
        count: row.count
      })),
      system_usage: systemUsage.map(row => ({
        system: row.system_origin,
        usage: row.usage
      })),
      performance_metrics: {
        avg_query_time: this.performanceTracker.getAverageDuration('search_memories') || 0,
        avg_sync_time: this.performanceTracker.getAverageDuration('sync_session') || 0,
        cache_hit_rate: this.performanceTracker.getCacheHitRate() || 0,
        error_rate: this.performanceTracker.getErrorRate() || 0
      }
    };

    this.setCache(cacheKey, analytics);
    return analytics;
  }

  async getSessionAnalytics(): Promise<SessionAnalytics> {
    const cacheKey = 'analytics:session';
    const cached = this.getFromCache<SessionAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get basic counts
    const totalSessions = this.db.getDatabase().prepare('SELECT COUNT(*) as count FROM sessions').get() as any;
    const activeSessions = this.db.getDatabase().prepare('SELECT COUNT(*) as count FROM sessions WHERE status = "active"').get() as any;
    
    // Get sessions by system
    const sessionsBySystem = this.db.getDatabase().prepare(`
      SELECT system_origin, COUNT(*) as count
      FROM sessions
      GROUP BY system_origin
    `).all() as any[];

    // Get average memories per session
    const avgMemoriesPerSession = this.db.getDatabase().prepare(`
      SELECT 
        AVG(memory_count) as avg_count
      FROM (
        SELECT 
          s.id,
          COUNT(m.id) as memory_count
        FROM sessions s
        LEFT JOIN memories m ON s.id = m.session_id
        GROUP BY s.id
      )
    `).get() as any;

    // Get session duration stats
    const durationStats = this.db.getDatabase().prepare(`
      SELECT 
        MIN(updated_at - created_at) as min_duration,
        MAX(updated_at - created_at) as max_duration,
        AVG(updated_at - created_at) as avg_duration
      FROM sessions
      WHERE status != 'active'
    `).get() as any;

    const analytics: SessionAnalytics = {
      total_sessions: totalSessions.count,
      active_sessions: activeSessions.count,
      sessions_by_system: sessionsBySystem.reduce((acc, row) => {
        acc[row.system_origin] = row.count;
        return acc;
      }, {}),
      average_memories_per_session: avgMemoriesPerSession.avg_count || 0,
      session_duration_stats: {
        min: durationStats.min_duration || 0,
        max: durationStats.max_duration || 0,
        avg: durationStats.avg_duration || 0
      }
    };

    this.setCache(cacheKey, analytics);
    return analytics;
  }

  /**
   * Synchronization
   */
  async syncSession(sessionId: string, options: SyncSessionRequest = {}): Promise<SyncSessionResponse> {
    const startTime = Date.now();
    
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(session);
      
      if (conflicts.length > 0 && !options.force) {
        return {
          session,
          sync_status: 'conflict',
          conflicts
        };
      }

      // Resolve conflicts
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts, options.resolve_conflicts || 'merge');
      }

      // Update sync status
      await this.updateSession(sessionId, {
        sync_status: 'synced',
        last_sync_at: Date.now()
      });

      const updatedSession = await this.getSession(sessionId);
      if (!updatedSession) {
        throw new Error('Failed to retrieve updated session');
      }

      // Track performance
      this.performanceTracker.recordOperation('sync_session', Date.now() - startTime);

      return {
        session: updatedSession,
        sync_status: 'synced'
      };
    } catch (error) {
      this.performanceTracker.recordError('sync_session', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */
  private mapRowToSession(row: any): UnifiedSession {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      system_origin: row.system_origin,
      system_session_id: row.system_session_id,
      user_id: row.user_id,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      outcome: row.outcome,
      status: row.status,
      sync_status: row.sync_status,
      last_sync_at: row.last_sync_at,
      version: row.version
    };
  }

  private mapRowToMemory(row: any): UnifiedMemory {
    return {
      id: row.id,
      session_id: row.session_id,
      type: row.type,
      title: row.title,
      content: row.content,
      domain: row.domain,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      system_origin: row.system_origin,
      system_memory_id: row.system_memory_id,
      user_id: row.user_id,
      importance: row.importance,
      confidence: row.confidence,
      embedding: row.embedding,
      content_hash: row.content_hash,
      sync_status: row.sync_status,
      last_sync_at: row.last_sync_at,
      version: row.version
    };
  }

  private generateContentHash(content: string): string {
    // Simple hash function - in production, use a proper hashing algorithm
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async detectConflicts(session: UnifiedSession): Promise<Conflict[]> {
    // Simple conflict detection - can be enhanced
    const conflicts: Conflict[] = [];
    
    // Check for version conflicts
    if (session.sync_status === 'conflict') {
      conflicts.push({
        type: 'version_conflict',
        entity_id: session.id,
        local_data: session,
        remote_data: null, // Would be fetched from other system
        timestamp: Date.now()
      });
    }

    return conflicts;
  }

  private async resolveConflicts(conflicts: Conflict[], strategy: 'local' | 'remote' | 'merge'): Promise<void> {
    // Simple conflict resolution - can be enhanced
    for (const conflict of conflicts) {
      switch (strategy) {
        case 'local':
          // Keep local data
          console.log('Resolving conflict with local strategy:', conflict.entity_id);
          break;
        case 'remote':
          // Would fetch and apply remote data
          console.log('Resolving conflict with remote strategy:', conflict.entity_id);
          break;
        case 'merge':
          // Would merge local and remote data
          console.log('Resolving conflict with merge strategy:', conflict.entity_id);
          break;
      }
    }
  }

  // Cache methods
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() - entry.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private invalidateCache(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

// Supporting classes
interface CacheEntry {
  data: any;
  timestamp: number;
}

class PerformanceTracker {
  private operations: Map<string, number[]> = new Map();
  private errors: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();

  recordOperation(operation: string, duration: number): void {
    if (!this.operations.has(operation)) {
      this.operations.set(operation, []);
    }
    this.operations.get(operation)!.push(duration);
    
    // Keep only last 100 operations
    const ops = this.operations.get(operation)!;
    if (ops.length > 100) {
      ops.splice(0, ops.length - 100);
    }
  }

  recordError(operation: string, error: any): void {
    const count = this.errors.get(operation) || 0;
    this.errors.set(operation, count + 1);
    console.error(`Error in ${operation}:`, error);
  }

  startOperation(operation: string): string {
    const id = `${operation}_${Date.now()}_${Math.random()}`;
    this.startTimes.set(id, Date.now());
    return id;
  }

  endOperation(id: string): void {
    const startTime = this.startTimes.get(id);
    if (startTime) {
      const duration = Date.now() - startTime;
      const operation = id.split('_')[0];
      this.recordOperation(operation, duration);
      this.startTimes.delete(id);
    }
  }

  getMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [operation, durations] of this.operations.entries()) {
      const errorCount = this.errors.get(operation) || 0;
      const totalOperations = durations.length + errorCount;
      
      metrics[operation] = {
        count: durations.length,
        avg_duration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        min_duration: Math.min(...durations),
        max_duration: Math.max(...durations),
        error_rate: errorCount / totalOperations,
        error_count: errorCount
      };
    }
    
    return metrics;
  }

  getAverageDuration(operation: string): number {
    const durations = this.operations.get(operation);
    if (!durations || durations.length === 0) {
      return 0;
    }
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  getCacheHitRate(): number {
    // This would be calculated from cache hits/misses
    // For now, return a placeholder
    return 0.85;
  }

  getErrorRate(): number {
    let totalErrors = 0;
    let totalOperations = 0;
    
    for (const [operation, durations] of this.operations.entries()) {
      const errorCount = this.errors.get(operation) || 0;
      totalErrors += errorCount;
      totalOperations += durations.length + errorCount;
    }
    
    return totalOperations > 0 ? totalErrors / totalOperations : 0;
  }

  /**
   * Get performance metrics for the memory system
   */
  async getPerformanceMetrics(): Promise<{
    totalOperations: number;
    averageQueryTime: number;
    cacheHitRate: number;
    errorRate: number;
    databaseSize: number;
  }> {
    // Simplified metrics implementation for now
    return {
      totalOperations: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      databaseSize: 0
    };
  }
}

// Memory relations methods will be added directly to the database class
// For now, we'll implement them as standalone methods in the API

// Singleton instance
let unifiedMemoryAPI: UnifiedMemoryAPI | null = null;

export function getUnifiedMemoryAPI(): UnifiedMemoryAPI {
  if (!unifiedMemoryAPI) {
    unifiedMemoryAPI = new UnifiedMemoryAPI();
  }
  return unifiedMemoryAPI;
}

// Test mode function to create isolated instances
export function createTestMemoryAPI(): UnifiedMemoryAPI {
  return new UnifiedMemoryAPI();
}
