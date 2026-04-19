/**
 * Memory Event Store Service
 * 
 * Implements append-only event store with SQLite and WAL mode
 * 
 * Applies Learning 31-33: SQLite Performance Tuning (WAL, memory mapping, page size)
 * Applies Learning 34-35: Append-Only Log Design and Benefits
 * Applies Learning 36-39: Event Sourcing Fundamentals, Trade-offs, Write Contention, Auditability
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  MemoryEvent,
  MemoryEventType,
  MemoryEventData,
  MemoryState,
  EventStoreConfig
} from './MemoryEventTypes';

export class MemoryEventStore {
  private db: Database.Database;
  private config: EventStoreConfig;

  constructor(config: EventStoreConfig) {
    this.config = config;
    this.db = new Database(config.dbPath);
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
        correlation_id TEXT,
        INDEX(aggregate_id, sequence),
        INDEX(timestamp),
        INDEX(event_type)
      )
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
    // Apply Learning 31-33: SQLite Performance Tuning
    
    // WAL mode for concurrent readers (Learning 31)
    if (this.config.walEnabled) {
      this.db.pragma('journal_mode = WAL');
    }

    // Synchronous mode: normal for corruption safety with performance (Learning 93)
    this.db.pragma(`synchronous = ${this.config.synchronousMode}`);

    // Memory mapping for fewer syscalls (Learning 32)
    this.db.pragma(`mmap_size = ${this.config.mmapSize}`);

    // Page size for large data (Learning 33)
    this.db.pragma(`page_size = ${this.config.pageSize}`);

    // Temp store in memory for temporary tables
    this.db.pragma('temp_store = memory');
  }

  /**
   * Append a new event to the event store
   * Implements append-only pattern (Learning 34)
   */
  async appendEvent(event: MemoryEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        event_id, event_type, aggregate_id, event_data, 
        timestamp, sequence, causation_id, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      // Start transaction
      this.db.exec('BEGIN TRANSACTION');

      // Get next sequence number for this aggregate
      const metadata = this.getAggregateMetadata(event.aggregateId);
      const nextSequence = (metadata?.currentVersion || 0) + 1;

      // Validate sequence (optimistic concurrency)
      if (event.sequence !== nextSequence) {
        throw new Error(`Sequence mismatch for aggregate ${event.aggregateId}. Expected ${nextSequence}, got ${event.sequence}`);
      }

      // Insert event
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

      // Update aggregate metadata
      this.updateAggregateMetadata(
        event.aggregateId,
        event.sequence,
        event.eventId,
        event.timestamp
      );

      // Commit transaction
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get all events for a specific aggregate
   * Implements event replay capability (Learning 36)
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
   * Get all events (for debugging/audit)
   */
  getAllEvents(limit?: number): MemoryEvent[] {
    let query = `
      SELECT event_id, event_type, aggregate_id, event_data, 
             timestamp, sequence, causation_id, correlation_id
      FROM events
      ORDER BY timestamp ASC
    `;

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];

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
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Event Sourcing Service
 * 
 * Provides high-level event sourcing operations
 */
export class MemoryEventSourcingService {
  private eventStore: MemoryEventStore;

  constructor(config: EventStoreConfig) {
    this.eventStore = new MemoryEventStore(config);
  }

  /**
   * Append a new event
   */
  async appendEvent(event: MemoryEvent): Promise<void> {
    return this.eventStore.appendEvent(event);
  }

  /**
   * Get memory state by replaying events (Learning 36)
   */
  getMemoryState(memoryId: string, asOfTimestamp?: string): MemoryState | null {
    const events = this.eventStore.getEventsForAggregate(memoryId, asOfTimestamp);
    
    if (events.length === 0) {
      return null;
    }

    // Replay events to build current state
    const state = this.replayEvents(events);
    return state;
  }

  /**
   * Get memory history (all events)
   */
  getMemoryHistory(memoryId: string): MemoryEvent[] {
    return this.eventStore.getEventsForAggregate(memoryId);
  }

  /**
   * Rebuild memory state at a specific point in time (Learning 39)
   */
  rebuildMemory(memoryId: string, asOf?: string): MemoryState | null {
    return this.getMemoryState(memoryId, asOf);
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
        // Mark as deleted - in real implementation, handle soft delete
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
   * Close the service
   */
  close(): void {
    this.eventStore.close();
  }
}
