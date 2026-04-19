/**
 * Memory Event Sourcing Service for Control App
 * 
 * Implements event sourcing pattern for memory storage with SQLite and WAL mode
 * 
 * Applied Learnings:
 * - Learning 31-33: SQLite Performance Tuning (WAL, memory mapping, page size)
 * - Learning 34-35: Append-Only Log Design and Benefits
 * - Learning 36-39: Event Sourcing Fundamentals, Trade-offs, Write Contention, Auditability
 * - Learning 60-61: Persistent Data Structures (Partial vs Full Persistence)
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export type MemoryEventType = 
  | 'MEMORY_CREATED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_TAGGED'
  | 'MEMORY_UNTAGGED'
  | 'MEMORY_RELATED'
  | 'MEMORY_UNRELATED';

export interface MemoryEvent {
  eventId: string;
  eventType: MemoryEventType;
  aggregateId: string;
  eventData: MemoryEventData;
  timestamp: string;
  sequence: number;
  causationId?: string;
  correlationId?: string;
}

export interface MemoryEventData {
  [key: string]: unknown;
}

export interface MemoryState {
  id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  title: string;
  content: string;
  domain: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
  relations: MemoryRelation[];
}

export interface MemoryRelation {
  relatedMemoryId: string;
  relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on';
  weight: number;
  addedAt: string;
}

export interface MemoryCreatedEventData extends MemoryEventData {
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  title: string;
  content: string;
  domain: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryUpdatedEventData extends MemoryEventData {
  title?: string;
  content?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class MemoryEventSourcingService {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = '.taqwin/memory/events.db') {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.initializeDatabase();
    this.configurePerformance();
  }

  private initializeDatabase(): void {
    // Create events table with append-only design
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        event_data TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        causation_id TEXT,
        correlation_id TEXT
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_aggregate_sequence 
      ON events(aggregate_id, sequence)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_timestamp 
      ON events(timestamp)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_type 
      ON events(event_type)
    `);

    // Create aggregate metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aggregate_metadata (
        aggregate_id TEXT PRIMARY KEY,
        current_version INTEGER NOT NULL DEFAULT 0,
        last_event_id TEXT,
        last_updated TEXT NOT NULL
      )
    `);

    // Create materialized views table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS materialized_views (
        view_name TEXT PRIMARY KEY,
        view_query TEXT NOT NULL,
        last_updated TEXT NOT NULL
      )
    `);
  }

  private configurePerformance(): void {
    // WAL mode for concurrent readers (Learning 31)
    this.db.pragma('journal_mode = WAL');

    // Synchronous mode: normal for corruption safety with performance (Learning 93)
    this.db.pragma('synchronous = normal');

    // Memory mapping for fewer syscalls (Learning 32)
    this.db.pragma('mmap_size = 30000000000');

    // Page size for large data (Learning 33)
    this.db.pragma('page_size = 32768');

    // Temp store in memory for temporary tables
    this.db.pragma('temp_store = memory');
  }

  /**
   * Create a new memory with event sourcing
   */
  async createMemory(
    type: 'learning' | 'mistake' | 'decision' | 'pattern',
    title: string,
    content: string,
    domain: string,
    tags: string[] = [],
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const memoryId = uuidv4();
    const timestamp = new Date().toISOString();

    const event: MemoryEvent = {
      eventId: uuidv4(),
      eventType: 'MEMORY_CREATED',
      aggregateId: memoryId,
      eventData: {
        type,
        title,
        content,
        domain,
        tags,
        metadata
      } as MemoryCreatedEventData,
      timestamp,
      sequence: 1
    };

    await this.appendEvent(event);
    return memoryId;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<{
      title: string;
      content: string;
      domain: string;
      tags: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<void> {
    const metadata = this.getAggregateMetadata(memoryId);
    const nextSequence = (metadata?.currentVersion || 0) + 1;

    const event: MemoryEvent = {
      eventId: uuidv4(),
      eventType: 'MEMORY_UPDATED',
      aggregateId: memoryId,
      eventData: updates as MemoryUpdatedEventData,
      timestamp: new Date().toISOString(),
      sequence: nextSequence
    };

    await this.appendEvent(event);
  }

  /**
   * Add a tag to a memory
   */
  async addTag(memoryId: string, tag: string): Promise<void> {
    const metadata = this.getAggregateMetadata(memoryId);
    const nextSequence = (metadata?.currentVersion || 0) + 1;

    const event: MemoryEvent = {
      eventId: uuidv4(),
      eventType: 'MEMORY_TAGGED',
      aggregateId: memoryId,
      eventData: { tag },
      timestamp: new Date().toISOString(),
      sequence: nextSequence
    };

    await this.appendEvent(event);
  }

  /**
   * Remove a tag from a memory
   */
  async removeTag(memoryId: string, tag: string): Promise<void> {
    const metadata = this.getAggregateMetadata(memoryId);
    const nextSequence = (metadata?.currentVersion || 0) + 1;

    const event: MemoryEvent = {
      eventId: uuidv4(),
      eventType: 'MEMORY_UNTAGGED',
      aggregateId: memoryId,
      eventData: { tag },
      timestamp: new Date().toISOString(),
      sequence: nextSequence
    };

    await this.appendEvent(event);
  }

  /**
   * Add a relationship between memories
   */
  async addRelation(
    memoryId: string,
    relatedMemoryId: string,
    relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on',
    weight: number = 1
  ): Promise<void> {
    const metadata = this.getAggregateMetadata(memoryId);
    const nextSequence = (metadata?.currentVersion || 0) + 1;

    const event: MemoryEvent = {
      eventId: uuidv4(),
      eventType: 'MEMORY_RELATED',
      aggregateId: memoryId,
      eventData: { relatedMemoryId, relationship, weight },
      timestamp: new Date().toISOString(),
      sequence: nextSequence
    };

    await this.appendEvent(event);
  }

  /**
   * Append a new event to the event store
   */
  async appendEvent(event: MemoryEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        event_id, event_type, aggregate_id, event_data, 
        timestamp, sequence, causation_id, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      this.db.exec('BEGIN TRANSACTION');

      const metadata = this.getAggregateMetadata(event.aggregateId);
      const nextSequence = (metadata?.currentVersion || 0) + 1;

      if (event.sequence !== nextSequence) {
        throw new Error(`Sequence mismatch for aggregate ${event.aggregateId}. Expected ${nextSequence}, got ${event.sequence}`);
      }

      stmt.run(
        event.eventId,
        event.eventType,
        event.aggregateId,
        JSON.stringify(event.eventData),
        event.timestamp,
        event.sequence,
        event.causationId || null,
        event.correlationId || null
      );

      this.updateAggregateMetadata(
        event.aggregateId,
        event.sequence,
        event.eventId,
        event.timestamp
      );

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get memory state by replaying events (Learning 36)
   */
  getMemoryState(memoryId: string, asOfTimestamp?: string): MemoryState | null {
    const events = this.getEventsForAggregate(memoryId, asOfTimestamp);
    
    if (events.length === 0) {
      return null;
    }

    const state = this.replayEvents(events);
    return state;
  }

  /**
   * Get all events for a specific aggregate
   */
  getEventsForAggregate(
    aggregateId: string,
    asOfTimestamp?: string
  ): MemoryEvent[] {
    let query = `
      SELECT event_id, event_type, aggregate_id, event_data, 
             timestamp, sequence, causation_id, correlation_id
      FROM events
      WHERE aggregate_id = ?
    `;

    const params: (string | number)[] = [aggregateId];

    if (asOfTimestamp) {
      query += ' AND timestamp <= ?';
      params.push(asOfTimestamp);
    }

    query += ' ORDER BY sequence ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type as MemoryEventType,
      aggregateId: row.aggregate_id,
      eventData: JSON.parse(row.event_data) as MemoryEventData,
      timestamp: row.timestamp,
      sequence: row.sequence,
      causationId: row.causation_id,
      correlationId: row.correlation_id
    }));
  }

  /**
   * Get all memories
   */
  getAllMemories(): MemoryState[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT aggregate_id
      FROM events
      WHERE event_type = 'MEMORY_CREATED'
    `);
    const rows = stmt.all() as any[];

    return rows
      .map(row => this.getMemoryState(row.aggregate_id))
      .filter((state): state is MemoryState => state !== null);
  }

  /**
   * Get memories by domain
   */
  getMemoriesByDomain(domain: string): MemoryState[] {
    const allMemories = this.getAllMemories();
    return allMemories.filter(memory => memory.domain === domain);
  }

  /**
   * Get memories by type
   */
  getMemoriesByType(type: 'learning' | 'mistake' | 'decision' | 'pattern'): MemoryState[] {
    const allMemories = this.getAllMemories();
    return allMemories.filter(memory => memory.type === type);
  }

  /**
   * Get memories by tag
   */
  getMemoriesByTag(tag: string): MemoryState[] {
    const allMemories = this.getAllMemories();
    return allMemories.filter(memory => memory.tags.includes(tag));
  }

  /**
   * Get memory history (all events)
   */
  getMemoryHistory(memoryId: string): MemoryEvent[] {
    return this.getEventsForAggregate(memoryId);
  }

  /**
   * Rebuild memory state at a specific point in time (Learning 39)
   */
  rebuildMemory(memoryId: string, asOf?: string): MemoryState | null {
    return this.getMemoryState(memoryId, asOf);
  }

  /**
   * Search memories by content
   */
  searchMemories(query: string): MemoryState[] {
    const allMemories = this.getAllMemories();
    const lowerQuery = query.toLowerCase();
    
    return allMemories.filter(memory => 
      memory.title.toLowerCase().includes(lowerQuery) ||
      memory.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get aggregate metadata
   */
  private getAggregateMetadata(aggregateId: string): any {
    const stmt = this.db.prepare(`
      SELECT current_version, last_event_id, last_updated
      FROM aggregate_metadata
      WHERE aggregate_id = ?
    `);
    return stmt.get(aggregateId);
  }

  /**
   * Update aggregate metadata
   */
  private updateAggregateMetadata(
    aggregateId: string,
    version: number,
    eventId: string,
    timestamp: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO aggregate_metadata (aggregate_id, current_version, last_event_id, last_updated)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(aggregate_id) DO UPDATE SET
        current_version = excluded.current_version,
        last_event_id = excluded.last_event_id,
        last_updated = excluded.last_updated
    `);
    stmt.run(aggregateId, version, eventId, timestamp);
  }

  /**
   * Replay events to build state
   */
  private replayEvents(events: MemoryEvent[]): MemoryState {
    const initialState: MemoryState = {
      id: '',
      type: 'learning',
      title: '',
      content: '',
      domain: '',
      tags: [],
      metadata: {},
      createdAt: '',
      updatedAt: '',
      version: 0,
      relations: []
    };

    return events.reduce((state, event) => this.applyEvent(state, event), initialState);
  }

  /**
   * Apply a single event to state
   */
  private applyEvent(state: MemoryState, event: MemoryEvent): MemoryState {
    switch (event.eventType) {
      case 'MEMORY_CREATED':
        return {
          ...state,
          id: event.aggregateId,
          type: event.eventData.type as any,
          title: event.eventData.title as string,
          content: event.eventData.content as string,
          domain: event.eventData.domain as string,
          tags: event.eventData.tags as string[],
          metadata: event.eventData.metadata as Record<string, unknown> || {},
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_UPDATED':
        return {
          ...state,
          title: event.eventData.title !== undefined ? event.eventData.title as string : state.title,
          content: event.eventData.content !== undefined ? event.eventData.content as string : state.content,
          domain: event.eventData.domain !== undefined ? event.eventData.domain as string : state.domain,
          tags: event.eventData.tags !== undefined ? event.eventData.tags as string[] : state.tags,
          metadata: event.eventData.metadata !== undefined ? { ...state.metadata, ...event.eventData.metadata } : state.metadata,
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_TAGGED':
        return {
          ...state,
          tags: [...state.tags, event.eventData.tag as string],
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_UNTAGGED':
        return {
          ...state,
          tags: state.tags.filter(tag => tag !== event.eventData.tag),
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_RELATED':
        return {
          ...state,
          relations: [
            ...state.relations,
            {
              relatedMemoryId: event.eventData.relatedMemoryId as string,
              relationship: event.eventData.relationship as any,
              weight: (event.eventData.weight as number) || 1,
              addedAt: event.timestamp
            }
          ],
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_UNRELATED':
        return {
          ...state,
          relations: state.relations.filter(
            r => r.relatedMemoryId !== event.eventData.relatedMemoryId
          ),
          updatedAt: event.timestamp,
          version: event.sequence
        };

      case 'MEMORY_DELETED':
        return {
          ...state,
          metadata: { ...state.metadata, deleted: true, deletedAt: event.timestamp },
          updatedAt: event.timestamp,
          version: event.sequence
        };

      default:
        return state;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalEvents: number;
    totalAggregates: number;
    dbSize: number;
  } {
    const eventCount = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    const aggregateCount = this.db.prepare('SELECT COUNT(*) as count FROM aggregate_metadata').get() as { count: number };
    
    // dbSize calculation removed - fs.statSync not available in browser/Tauri environment
    const dbSize = 0;

    return {
      totalEvents: eventCount.count,
      totalAggregates: aggregateCount.count,
      dbSize
    };
  }
}

// Singleton instance
let memoryEventSourcingService: MemoryEventSourcingService | null = null;

export function getMemoryEventSourcingService(): MemoryEventSourcingService {
  if (!memoryEventSourcingService) {
    memoryEventSourcingService = new MemoryEventSourcingService();
  }
  return memoryEventSourcingService;
}

export function resetMemoryEventSourcingService(): void {
  if (memoryEventSourcingService) {
    memoryEventSourcingService.close();
    memoryEventSourcingService = null;
  }
}
