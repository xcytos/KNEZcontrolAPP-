/**
 * Unified Memory Database Service
 * 
 * Implements shared database layer for TAQWIN and KNEZ systems
 * Provides unified storage, indexing, and synchronization capabilities
 * 
 * Features:
 * - SQLite with WAL mode for performance
 * - Full-text search with FTS5
 * - Vector similarity search
 * - Cross-system synchronization
 * - Performance optimization with indexing
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Database configuration
const DB_PATH = path.join(process.cwd(), '.taqwin', 'memory', 'unified_memory.db');
const BACKUP_PATH = path.join(process.cwd(), '.taqwin', 'memory', 'backups');

// Data types
export interface UnifiedSession {
  id: string;
  name: string;
  description?: string;
  created_at: number;
  updated_at: number;
  system_origin: 'taqwin' | 'knez' | 'unified';
  system_session_id?: string;
  user_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  outcome?: string;
  status: 'active' | 'archived' | 'deleted';
  sync_status: 'synced' | 'pending' | 'conflict';
  last_sync_at?: number;
  version: number;
}

export interface UnifiedMemory {
  id: string;
  session_id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern' | 'fact' | 'preference' | 'event';
  title: string;
  content: string;
  domain: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
  system_origin: 'taqwin' | 'knez' | 'unified';
  system_memory_id?: string;
  user_id?: string;
  importance: number; // 1-10 scale
  confidence: number; // 0.0-1.0
  embedding?: Buffer; // Vector embedding for semantic search
  content_hash?: string; // For deduplication
  sync_status: 'synced' | 'pending' | 'conflict';
  last_sync_at?: number;
  version: number;
}

export interface MemoryRelation {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  relationship_type: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on' | 'contradicts';
  weight: number;
  confidence: number;
  bidirectional: boolean;
  created_at: number;
  updated_at: number;
  system_origin: 'taqwin' | 'knez' | 'unified';
  metadata?: Record<string, any>;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_sync_at?: number;
  version: number;
}

export interface UnifiedMessage {
  id: string;
  session_id: string;
  sequence_number: number;
  from_type: 'user' | 'assistant' | 'tool_execution' | 'tool_result' | 'system' | 'knez';
  content: string;
  created_at: number;
  updated_at: number;
  system_origin: 'taqwin' | 'knez' | 'unified';
  system_message_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
  metrics?: Record<string, any>;
  tool_call?: Record<string, any>;
  reply_to_message_id?: string;
  correlation_id?: string;
  delivery_status: 'queued' | 'pending' | 'delivered' | 'failed';
  delivery_error?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_sync_at?: number;
  version: number;
}

export interface SyncLog {
  id: string;
  system_origin: string;
  operation_type: 'create' | 'update' | 'delete' | 'merge';
  entity_type: 'session' | 'memory' | 'relation' | 'message';
  entity_id: string;
  operation_data?: string; // JSON
  timestamp: number;
  sync_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'conflict';
  error_message?: string;
  retry_count: number;
  next_retry_at?: number;
  completed_at?: number;
}

export interface SearchQuery {
  query: string;
  type?: string[];
  domain?: string[];
  tags?: string[];
  user_id?: string;
  session_id?: string;
  importance_min?: number;
  importance_max?: number;
  created_after?: number;
  created_before?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'relevance' | 'created_at' | 'updated_at' | 'importance';
  sort_order?: 'asc' | 'desc';
  search_type?: 'fulltext' | 'semantic' | 'hybrid';
}

export interface SearchResult {
  memory: UnifiedMemory;
  score: number;
  highlights: string[];
  match_type: 'fulltext' | 'semantic' | 'hybrid';
}

export class UnifiedMemoryDatabase {
  private db: Database.Database;
  private isInitialized: boolean = false;

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456'); // 256MB
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create backup directory
      await this.ensureDirectoryExists(BACKUP_PATH);

      // Create tables
      this.createSessionsTable();
      this.createMemoriesTable();
      this.createMemoryRelationsTable();
      this.createMessagesTable();
      this.createAssistantMessagesTable();
      this.createSyncLogTable();
      this.createSystemConfigTable();

      // Create FTS tables
      this.createFTSTables();

      // Create indexes
      this.createIndexes();

      // Create triggers
      this.createTriggers();

      this.isInitialized = true;
      console.log('Unified Memory Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private createSessionsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        system_origin TEXT NOT NULL CHECK (system_origin IN ('taqwin', 'knez', 'unified')),
        system_session_id TEXT,
        user_id TEXT,
        tags TEXT, -- JSON array
        metadata TEXT, -- JSON object
        outcome TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
        last_sync_at INTEGER,
        version INTEGER DEFAULT 1
      )
    `);
  }

  private createMemoriesTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('learning', 'mistake', 'decision', 'pattern', 'fact', 'preference', 'event')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        domain TEXT NOT NULL,
        tags TEXT, -- JSON array
        metadata TEXT, -- JSON object
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        system_origin TEXT NOT NULL CHECK (system_origin IN ('taqwin', 'knez', 'unified')),
        system_memory_id TEXT,
        user_id TEXT,
        importance INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 10),
        confidence REAL DEFAULT 1.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
        embedding BLOB, -- Vector embedding
        content_hash TEXT,
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
        last_sync_at INTEGER,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);
  }

  private createMemoryRelationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_relations (
        id TEXT PRIMARY KEY,
        source_memory_id TEXT NOT NULL,
        target_memory_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL CHECK (relationship_type IN ('relates_to', 'caused', 'resolved', 'similar_to', 'depends_on', 'contradicts')),
        weight REAL DEFAULT 1.0,
        confidence REAL DEFAULT 1.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
        bidirectional BOOLEAN DEFAULT FALSE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        system_origin TEXT NOT NULL CHECK (system_origin IN ('taqwin', 'knez', 'unified')),
        metadata TEXT, -- JSON object
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
        last_sync_at INTEGER,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (target_memory_id) REFERENCES memories(id) ON DELETE CASCADE
      )
    `);
  }

  private createMessagesTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        from_type TEXT NOT NULL CHECK (from_type IN ('user', 'assistant', 'tool_execution', 'tool_result', 'system', 'knez')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        system_origin TEXT NOT NULL CHECK (system_origin IN ('taqwin', 'knez', 'unified')),
        system_message_id TEXT,
        user_id TEXT,
        metadata TEXT, -- JSON object
        metrics TEXT, -- JSON object
        tool_call TEXT, -- JSON object
        reply_to_message_id TEXT,
        correlation_id TEXT,
        delivery_status TEXT DEFAULT 'delivered' CHECK (delivery_status IN ('queued', 'pending', 'delivered', 'failed')),
        delivery_error TEXT,
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
        last_sync_at INTEGER,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);
  }

  private createAssistantMessagesTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('draft', 'finalizing', 'finalized', 'failed')),
        blocks TEXT NOT NULL, -- JSON array
        created_at INTEGER NOT NULL,
        finalized_at INTEGER,
        system_origin TEXT NOT NULL CHECK (system_origin IN ('taqwin', 'knez', 'unified')),
        system_message_id TEXT,
        user_id TEXT,
        metadata TEXT, -- JSON object
        sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
        last_sync_at INTEGER,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);
  }

  private createSyncLogTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        system_origin TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete', 'merge')),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('session', 'memory', 'relation', 'message')),
        entity_id TEXT NOT NULL,
        operation_data TEXT, -- JSON object
        timestamp INTEGER NOT NULL,
        sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed', 'conflict')),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        next_retry_at INTEGER,
        completed_at INTEGER
      )
    `);
  }

  private createSystemConfigTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
        description TEXT,
        system_origin TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  private createFTSTables(): void {
    // Memories FTS table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        domain,
        tags,
        metadata,
        content='memories',
        content_rowid='rowid'
      )
    `);

    // Messages FTS table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        content,
        metadata,
        content='messages',
        content_rowid='rowid'
      )
    `);
  }

  private createIndexes(): void {
    // Sessions indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_system_origin ON sessions(system_origin);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_sync_status ON sessions(sync_status);
    `);

    // Memories indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_domain ON memories(domain);
      CREATE INDEX IF NOT EXISTS idx_memories_system_origin ON memories(system_origin);
      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_sync_status ON memories(sync_status);
      CREATE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash);
      CREATE INDEX IF NOT EXISTS idx_memories_composite ON memories(session_id, type, created_at);
    `);

    // Memory relations indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_relations_source ON memory_relations(source_memory_id);
      CREATE INDEX IF NOT EXISTS idx_memory_relations_target ON memory_relations(target_memory_id);
      CREATE INDEX IF NOT EXISTS idx_memory_relations_type ON memory_relations(relationship_type);
      CREATE INDEX IF NOT EXISTS idx_memory_relations_weight ON memory_relations(weight);
      CREATE INDEX IF NOT EXISTS idx_memory_relations_sync_status ON memory_relations(sync_status);
    `);

    // Messages indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sequence ON messages(session_id, sequence_number);
      CREATE INDEX IF NOT EXISTS idx_messages_from_type ON messages(from_type);
      CREATE INDEX IF NOT EXISTS idx_messages_system_origin ON messages(system_origin);
      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_sync_status ON messages(sync_status);
      CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_message_id);
    `);

    // Sync log indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sync_log_system_origin ON sync_log(system_origin);
      CREATE INDEX IF NOT EXISTS idx_sync_log_entity_type ON sync_log(entity_type);
      CREATE INDEX IF NOT EXISTS idx_sync_log_entity_id ON sync_log(entity_id);
      CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(sync_status);
      CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_log_retry ON sync_log(next_retry_at);
    `);
  }

  private createTriggers(): void {
    // Memories FTS triggers
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(id, title, content, domain, tags, metadata)
        VALUES (new.id, new.title, new.content, new.domain, new.tags, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
        DELETE FROM memories_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
        DELETE FROM memories_fts WHERE id = old.id;
        INSERT INTO memories_fts(id, title, content, domain, tags, metadata)
        VALUES (new.id, new.title, new.content, new.domain, new.tags, new.metadata);
      END;
    `);

    // Messages FTS triggers
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(id, content, metadata)
        VALUES (new.id, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(id, content, metadata)
        VALUES (new.id, new.content, new.metadata);
      END;
    `);

    // Version update triggers
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_session_version AFTER UPDATE ON sessions BEGIN
        UPDATE sessions SET version = version + 1 WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_memory_version AFTER UPDATE ON memories BEGIN
        UPDATE memories SET version = version + 1 WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_relation_version AFTER UPDATE ON memory_relations BEGIN
        UPDATE memory_relations SET version = version + 1 WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_message_version AFTER UPDATE ON messages BEGIN
        UPDATE messages SET version = version + 1 WHERE id = old.id;
      END;
    `);
  }

  /**
   * Session Operations
   */
  async createSession(session: Omit<UnifiedSession, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, name, description, created_at, updated_at, system_origin,
        system_session_id, user_id, tags, metadata, outcome, status,
        sync_status, last_sync_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(
      id,
      session.name,
      session.description || null,
      now,
      now,
      session.system_origin,
      session.system_session_id || null,
      session.user_id || null,
      JSON.stringify(session.tags || []),
      JSON.stringify(session.metadata || {}),
      session.outcome || null,
      session.status,
      session.sync_status,
      session.last_sync_at || null
    );

    return id;
  }

  async getSession(id: string): Promise<UnifiedSession | null> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToSession(row);
  }

  async updateSession(id: string, updates: Partial<Omit<UnifiedSession, 'id' | 'created_at' | 'version'>>): Promise<boolean> {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.outcome !== undefined) {
      fields.push('outcome = ?');
      values.push(updates.outcome);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.sync_status !== undefined) {
      fields.push('sync_status = ?');
      values.push(updates.sync_status);
    }
    if (updates.last_sync_at !== undefined) {
      fields.push('last_sync_at = ?');
      values.push(updates.last_sync_at);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  async deleteSession(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Memory Operations
   */
  async createMemory(memory: Omit<UnifiedMemory, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO memories (
        id, session_id, type, title, content, domain, tags, metadata,
        created_at, updated_at, system_origin, system_memory_id, user_id,
        importance, confidence, embedding, content_hash, sync_status,
        last_sync_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(
      id,
      memory.session_id,
      memory.type,
      memory.title,
      memory.content,
      memory.domain,
      JSON.stringify(memory.tags || []),
      JSON.stringify(memory.metadata || {}),
      now,
      now,
      memory.system_origin,
      memory.system_memory_id || null,
      memory.user_id || null,
      memory.importance,
      memory.confidence,
      memory.embedding || null,
      memory.content_hash || null,
      memory.sync_status,
      memory.last_sync_at || null
    );

    return id;
  }

  async getMemory(id: string): Promise<UnifiedMemory | null> {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToMemory(row);
  }

  async updateMemory(id: string, updates: Partial<Omit<UnifiedMemory, 'id' | 'created_at' | 'version'>>): Promise<boolean> {
    const fields = [];
    const values = [];

    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.domain !== undefined) {
      fields.push('domain = ?');
      values.push(updates.domain);
    }
    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.importance !== undefined) {
      fields.push('importance = ?');
      values.push(updates.importance);
    }
    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }
    if (updates.embedding !== undefined) {
      fields.push('embedding = ?');
      values.push(updates.embedding);
    }
    if (updates.content_hash !== undefined) {
      fields.push('content_hash = ?');
      values.push(updates.content_hash);
    }
    if (updates.sync_status !== undefined) {
      fields.push('sync_status = ?');
      values.push(updates.sync_status);
    }
    if (updates.last_sync_at !== undefined) {
      fields.push('last_sync_at = ?');
      values.push(updates.last_sync_at);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  async deleteMemory(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Search Operations
   */
  async searchMemories(query: SearchQuery): Promise<SearchResult[]> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    if (query.search_type === 'semantic' || query.search_type === 'hybrid') {
      return this.semanticSearch(query, limit, offset);
    } else {
      return this.fullTextSearch(query, limit, offset);
    }
  }

  private async fullTextSearch(query: SearchQuery, limit: number, offset: number): Promise<SearchResult[]> {
    let sql = `
      SELECT memories.*, bm25(memories_fts) as score
      FROM memories_fts
      JOIN memories ON memories.id = memories_fts.id
      WHERE memories_fts MATCH ?
    `;

    const params: (string | number)[] = [query.query];

    // Add filters
    if (query.type && query.type.length > 0) {
      sql += ` AND memories.type IN (${query.type.map(() => '?').join(', ')})`;
      params.push(...query.type);
    }

    if (query.domain && query.domain.length > 0) {
      sql += ` AND memories.domain IN (${query.domain.map(() => '?').join(', ')})`;
      params.push(...query.domain);
    }

    if (query.session_id) {
      sql += ` AND memories.session_id = ?`;
      params.push(query.session_id);
    }

    if (query.importance_min !== undefined) {
      sql += ` AND memories.importance >= ?`;
      params.push(query.importance_min);
    }

    if (query.importance_max !== undefined) {
      sql += ` AND memories.importance <= ?`;
      params.push(query.importance_max);
    }

    // Add sorting
    const sortBy = query.sort_by || 'relevance';
    const sortOrder = query.sort_order || 'desc';
    
    if (sortBy === 'relevance') {
      sql += ` ORDER BY score ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'created_at') {
      sql += ` ORDER BY memories.created_at ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'importance') {
      sql += ` ORDER BY memories.importance ${sortOrder.toUpperCase()}`;
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      memory: this.mapRowToMemory(row),
      score: row.score,
      highlights: this.extractHighlights(row.content, query.query),
      match_type: 'fulltext' as const
    }));
  }

  private async semanticSearch(query: SearchQuery, limit: number, offset: number): Promise<SearchResult[]> {
    // For now, fall back to full-text search
    // TODO: Implement actual semantic search with vector embeddings
    return this.fullTextSearch(query, limit, offset);
  }

  private extractHighlights(content: string, query: string): string[] {
    // Simple highlight extraction - can be improved
    const words = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];
    
    words.forEach(word => {
      const regex = new RegExp(`(.{0,50})${word}(.{0,50})`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches.slice(0, 3));
      }
    });

    return highlights;
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

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    // Simple directory creation - in production, use fs.promises.mkdir
    try {
      const fs = require('fs');
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get direct database access for complex queries (public method)
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Memory Relations Operations
   */
  async createMemoryRelation(relation: {
    source_memory_id: string;
    target_memory_id: string;
    relationship_type: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on' | 'contradicts';
    weight?: number;
    confidence?: number;
    bidirectional?: boolean;
    metadata?: Record<string, any>;
    system_origin: 'taqwin' | 'knez' | 'unified';
  }): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO memory_relations (
        id, source_memory_id, target_memory_id, relationship_type, weight,
        confidence, bidirectional, created_at, updated_at, system_origin,
        metadata, sync_status, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(
      id,
      relation.source_memory_id,
      relation.target_memory_id,
      relation.relationship_type,
      relation.weight || 1.0,
      relation.confidence || 1.0,
      relation.bidirectional || false,
      now,
      now,
      relation.system_origin,
      JSON.stringify(relation.metadata || {}),
      'synced'
    );

    return id;
  }

  async getMemoryRelation(id: string): Promise<MemoryRelation | null> {
    const stmt = this.db.prepare('SELECT * FROM memory_relations WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }

    return this.mapRowToMemoryRelation(row);
  }

  async getMemoryRelations(memoryId: string): Promise<MemoryRelation[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_relations 
      WHERE source_memory_id = ? OR target_memory_id = ?
      ORDER BY weight DESC
    `);
    
    const rows = stmt.all(memoryId, memoryId) as any[];
    
    return rows.map(row => this.mapRowToMemoryRelation(row));
  }

  private mapRowToMemoryRelation(row: any): MemoryRelation {
    return {
      id: row.id,
      source_memory_id: row.source_memory_id,
      target_memory_id: row.target_memory_id,
      relationship_type: row.relationship_type,
      weight: row.weight,
      confidence: row.confidence,
      bidirectional: Boolean(row.bidirectional),
      created_at: row.created_at,
      updated_at: row.updated_at,
      system_origin: row.system_origin,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      sync_status: row.sync_status,
      last_sync_at: row.last_sync_at,
      version: row.version
    };
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any;
    const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as any;
    const relationCount = this.db.prepare('SELECT COUNT(*) as count FROM memory_relations').get() as any;
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
    const syncCount = this.db.prepare('SELECT COUNT(*) as count FROM sync_log WHERE sync_status = "pending"').get() as any;

    let databaseSize = 0;
    try {
      const fs = require('fs');
      databaseSize = fs.statSync(DB_PATH).size;
    } catch (error) {
      // File might not exist yet
    }

    return {
      sessions: sessionCount.count,
      memories: memoryCount.count,
      relations: relationCount.count,
      messages: messageCount.count,
      pendingSyncs: syncCount.count,
      databaseSize
    };
  }
}

interface DatabaseStats {
  sessions: number;
  memories: number;
  relations: number;
  messages: number;
  pendingSyncs: number;
  databaseSize: number;
}

// Singleton instance
let unifiedMemoryDatabase: UnifiedMemoryDatabase | null = null;

export function getUnifiedMemoryDatabase(): UnifiedMemoryDatabase {
  if (!unifiedMemoryDatabase) {
    unifiedMemoryDatabase = new UnifiedMemoryDatabase();
  }
  return unifiedMemoryDatabase;
}

export async function initializeUnifiedMemoryDatabase(): Promise<void> {
  const db = getUnifiedMemoryDatabase();
  await db.initialize();
}
