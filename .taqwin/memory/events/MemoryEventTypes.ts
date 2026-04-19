/**
 * Memory Event Sourcing Types
 * 
 * Applies Learning 36-39: Event Sourcing Fundamentals, Trade-offs, Write Contention, Auditability
 * Applies Learning 34-35: Append-Only Log Design and Benefits
 * Applies Learning 60-61: Persistent Data Structures (Partial vs Full Persistence)
 */

export type MemoryEventType = 
  | 'MEMORY_CREATED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_TAGGED'
  | 'MEMORY_UNTAGGED'
  | 'MEMORY_RELATED'
  | 'MEMORY_UNRELATED';

export interface MemoryEvent {
  eventId: string;              // UUID
  eventType: MemoryEventType;
  aggregateId: string;          // Memory ID
  eventData: MemoryEventData;   // Event-specific payload
  timestamp: string;            // ISO8601 timestamp
  sequence: number;            // Event sequence number for this aggregate
  causationId?: string;        // For event chains
  correlationId?: string;      // For distributed tracing
}

export interface MemoryEventData {
  [key: string]: unknown;
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

export interface MemoryTaggedEventData extends MemoryEventData {
  tag: string;
}

export interface MemoryUntaggedEventData extends MemoryEventData {
  tag: string;
}

export interface MemoryRelatedEventData extends MemoryEventData {
  relatedMemoryId: string;
  relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on';
  weight?: number;
}

export interface MemoryUnrelatedEventData extends MemoryEventData {
  relatedMemoryId: string;
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

export interface EventStoreConfig {
  dbPath: string;
  walEnabled: boolean;
  synchronousMode: 'off' | 'normal' | 'full';
  mmapSize: number;
  pageSize: number;
}

export interface MaterializedView {
  viewName: string;
  query: string;
  lastUpdated: string;
}
