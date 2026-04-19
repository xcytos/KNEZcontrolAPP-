# Storage-Based Memories Page - Ticket Set 01

**Objective**: Build an advanced memories page for the knez-control-app that applies all storage research learnings including event sourcing, vector databases, graph databases, compression, deduplication, caching, and proper data structures.

**Applied Learnings**: Based on 124+ learnings from 29+ research sources covering storage architectures, compression techniques, database optimization, and data structures.

---

## Ticket #01: Event Sourcing Foundation for Memory Storage

**Priority**: CRITICAL  
**Status**: TODO  
**Estimated Effort**: 8 hours

### Description
Implement event sourcing pattern for all memory operations (learnings, mistakes, decisions, patterns) to provide complete audit trail and enable state reconstruction at any point in time.

### Applied Learnings
- Learning 36-39: Event Sourcing Fundamentals, Trade-offs, Write Contention, Auditability
- Learning 34-35: Append-Only Log Design and Benefits
- Learning 60-61: Persistent Data Structures (Partial vs Full Persistence)

### Implementation Steps

1. **Define Memory Event Schema**
   ```typescript
   interface MemoryEvent {
     eventId: string;              // UUID
     eventType: 'MEMORY_CREATED' | 'MEMORY_UPDATED' | 'MEMORY_DELETED' | 'MEMORY_TAGGED';
     aggregateId: string;          // Memory ID
     eventData: unknown;           // Event-specific payload
     timestamp: ISO8601String;     // Monotonically increasing
     sequence: number;            // Event sequence number
     causationId?: string;        // For event chains
     correlationId?: string;      // For distributed tracing
   }
   ```

2. **Create Event Store (Append-Only Log)**
   - Use SQLite with WAL mode (Learning 31) for concurrent readers
   - Implement append-only writes with sequential storage (Learning 34)
   - Store events in `.taqwin/memory/events.db`
   - Enable memory mapping with `mmap_size` pragma (Learning 32)
   - Set page size to 32768 for efficient storage (Learning 33)

3. **Implement Event Replay Function**
   ```typescript
   async function replayMemoryState(memoryId: string, asOfTimestamp?: ISO8601String): MemoryState {
     const events = await eventStore.getEventsForAggregate(memoryId, asOfTimestamp);
     return events.reduce(applyEvent, initialState);
   }
   ```

4. **Create Materialized Views for Querying**
   - Build denormalized views for common queries (Learning 36)
   - Update views asynchronously on new events
   - Store in `.taqwin/memory/views/` directory

5. **Add Event Sourcing Service**
   ```typescript
   class MemoryEventSourcingService {
     async appendEvent(event: MemoryEvent): Promise<void>;
     async getMemoryState(memoryId: string): Promise<MemoryState>;
     async getMemoryHistory(memoryId: string): Promise<MemoryEvent[]>;
     async rebuildMemory(memoryId: string, asOf?: ISO8601String): Promise<MemoryState>;
   }
   ```

### Edge Cases to Handle
- **Event sequence gaps**: Detect and warn about missing sequence numbers
- **Concurrent writes**: Use optimistic concurrency with sequence number checks
- **Event replay failure**: Implement circuit breaker to prevent infinite loops
- **Large event streams**: Implement snapshotting every N events to reduce replay time
- **Schema evolution**: Support multiple event versions with migration logic

### Testing Requirements
- [ ] Test event append with concurrent writers
- [ ] Verify state reconstruction at different timestamps
- [ ] Test materialized view consistency after events
- [ ] Validate event sequence integrity
- [ ] Performance test with 10,000+ events

### Dependencies
- None (foundation ticket)

---

## Ticket #02: Vector Database Integration for Semantic Memory Search

**Priority**: HIGH  
**Status**: TODO  
**Estimated Effort**: 12 hours

### Description
Integrate vector database (pgvector) to enable semantic search across memories using embeddings, allowing discovery by meaning rather than exact keyword matching.

### Applied Learnings
- Learning 40-46: Vector Database Purpose, Recall vs Speed, Purpose-Built vs Extensions, Performance Metrics, Hybrid Search, Multi-Tenancy, Cost Considerations
- Learning 75-77: B-Tree Indexing Characteristics, Performance, Use Cases
- Learning 83-85: Cache-Aside and Write-Through Caching Strategies

### Implementation Steps

1. **Set up pgvector Extension**
   - Add pgvector to SQLite via extension or use PostgreSQL
   - Configure vector dimensions (e.g., 1536 for OpenAI embeddings)
   - Create vector index using HNSW algorithm (Learning 42)

2. **Define Memory Vector Schema**
   ```typescript
   interface MemoryVector {
     id: string;                    // Memory ID
     embedding: number[];           // 1536-dim vector
     domain: string;               // aimodels, chat, controlapp, etc.
     tags: string[];               // For hybrid search filtering
     timestamp: ISO8601String;
     contentHash: string;          // For deduplication (Learning 24)
   }
   ```

3. **Implement Embedding Generation**
   ```typescript
   class MemoryEmbeddingService {
     async generateEmbedding(text: string): Promise<number[]>;
     async generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
   }
   ```

4. **Create Vector Search Service**
   ```typescript
   class MemoryVectorSearchService {
     async searchMemories(
       query: string,
       options: {
         limit?: number;
         threshold?: number;       // Similarity threshold
         domain?: string;          // Pre-filtering (Learning 44)
         tags?: string[];
         recall?: number;          // 95% or 99% (Learning 41)
       }
     ): Promise<MemorySearchResult[]>;
   }
   ```

5. **Implement Hybrid Search**
   - Combine vector similarity with keyword search (Learning 44)
   - Add metadata filters for domain and tags
   - Use post-filtering to maintain recall (Learning 44)

6. **Add Caching Layer**
   - Cache frequent search results using Cache-Aside pattern (Learning 83)
   - Use LRU eviction policy (Learning 87)
   - Set TTL based on query frequency

### Edge Cases to Handle
- **Embedding generation failure**: Fallback to keyword-only search
- **Vector index corruption**: Implement index rebuild procedure
- **Low recall queries**: Adjust threshold or increase result limit
- **Large memory volumes**: Implement pagination and lazy loading
- **Multi-tenant isolation**: Use namespaces or separate indexes (Learning 45)

### Testing Requirements
- [ ] Test semantic search with similar concepts
- [ ] Verify hybrid search accuracy
- [ ] Performance test with 10,000+ vectors
- [ ] Test recall at different thresholds
- [ ] Validate caching effectiveness

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #03: Knowledge Graph Construction for Memory Relationships

**Priority**: HIGH  
**Status**: TODO  
**Estimated Effort**: 16 hours

### Description
Build a knowledge graph to represent memory relationships (learnings, mistakes, decisions) as nodes and edges, enabling visual exploration and complex relationship queries.

### Applied Learnings
- Learning 47-48: Graph Database Fundamentals, RDF vs Property Graph
- Learning 51-53: Knowledge Graph Definition, Benefits, Use Cases
- Learning 99-102: Taxonomy vs Ontology, Schema Design for AI
- Learning 122-124: Columnar vs Row Storage Benefits, Storage Format Selection

### Implementation Steps

1. **Design Graph Schema**
   ```typescript
   interface MemoryNode {
     id: string;                    // Memory ID
     type: 'learning' | 'mistake' | 'decision' | 'pattern';
     properties: {
       title: string;
       domain: string;
       timestamp: ISO8601String;
       tags: string[];
       [key: string]: unknown;
     };
   }

   interface MemoryEdge {
     id: string;
     source: string;               // From memory ID
     target: string;               // To memory ID
     relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on';
     weight: number;              // Relationship strength
     timestamp: ISO8601String;
   }
   ```

2. **Implement Graph Storage**
   - Use SQLite with foreign keys for relationships
   - Create separate tables for nodes and edges
   - Add B-tree indexes on frequently queried columns (Learning 77)
   - Store in `.taqwin/memory/graph.db`

3. **Build Relationship Extraction Service**
   ```typescript
   class MemoryRelationshipService {
     async extractRelationships(memory: Memory): Promise<MemoryEdge[]>;
     async inferRelationships(memories: Memory[]): Promise<MemoryEdge[]>;
     async updateRelationships(memoryId: string): Promise<void>;
   }
   ```

4. **Implement Graph Traversal Queries**
   ```typescript
   class MemoryGraphService {
     async findRelatedMemories(memoryId: string, depth: number): Promise<MemoryNode[]>;
     async findShortestPath(fromId: string, toId: string): Promise<MemoryNode[]>;
     async findClusters(): Promise<MemoryNode[][]>;
     async getMemoryContext(memoryId: string): Promise<GraphContext>;
   }
   ```

5. **Create Ontology/Taxonomy System**
   - Define ontology for memory types and relationships (Learning 101)
   - Implement taxonomy for domain categorization (Learning 100)
   - Store in `.taqwin/memory/ontology.json`

6. **Add Graph Visualization Support**
   - Export graph in D3.js or Cytoscape.js format
   - Provide force-directed layout
   - Enable interactive exploration

### Edge Cases to Handle
- **Circular relationships**: Detect and prevent infinite loops in traversal
- **Orphaned nodes**: Implement cleanup for disconnected memories
- **Relationship ambiguity**: Use confidence scores for inferred relationships
- **Large graph performance**: Implement graph partitioning and lazy loading
- **Schema evolution**: Support ontology versioning and migration

### Testing Requirements
- [ ] Test relationship extraction accuracy
- [ ] Verify graph traversal correctness
- [ ] Performance test with 1,000+ nodes
- [ ] Test cluster detection algorithms
- [ ] Validate ontology consistency

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #04: Memory Compression Layer Implementation

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 10 hours

### Description
Implement compression layer for memory storage using ZSTD for archival data and LZ4 for real-time access, reducing storage costs while maintaining performance.

### Applied Learnings
- Learning 1-5: File Compression Formats (ZIP, RAR, 7Z, TAR, ZSTD)
- Learning 6-16: Database Compression Techniques (LZ-based, Entropy, RLE, Delta, Dictionary, Page/Block, Row/Tuple, Columnar, LSM, Granularity)
- Learning 21-23: LZ4 vs ZSTD Trade-offs, XZ, GZIP
- Learning 116-119: Compression Algorithms (LZ4, ZSTD, GZIP, XZ)

### Implementation Steps

1. **Design Compression Strategy**
   ```typescript
   enum CompressionStrategy {
     NONE,              // For hot data (last 7 days)
     LZ4_FAST,          // For warm data (7-30 days)
     ZSTD_LEVEL_3,      // For cold data (30-90 days)
     ZSTD_LEVEL_15      // For archival data (90+ days)
   }
   ```

2. **Implement Compression Service**
   ```typescript
   class MemoryCompressionService {
     async compress(data: Buffer, strategy: CompressionStrategy): Promise<Buffer>;
     async decompress(data: Buffer, strategy: CompressionStrategy): Promise<Buffer>;
     async estimateCompressionRatio(data: Buffer, strategy: CompressionStrategy): Promise<number>;
     async autoSelectStrategy(data: Buffer, accessPattern: AccessPattern): Promise<CompressionStrategy>;
   }
   ```

3. **Apply Compression by Data Type**
   - Text content: ZSTD level 3 (Learning 15)
   - Binary data: LZ4 for speed (Learning 21)
   - JSON metadata: Dictionary encoding (Learning 10)
   - Time-series data: Delta encoding + LZ4 (Learning 9)

4. **Implement Compression Tiering**
   - Hot data (recent): No compression
   - Warm data: LZ4 for fast access
   - Cold data: ZSTD for space savings
   - Archive data: ZSTD level 15 for maximum compression

5. **Add Compression Metrics Tracking**
   - Track compression ratio per strategy
   - Monitor compression/decompression latency
   - Calculate storage savings
   - Alert on compression failures

### Edge Cases to Handle
- **Compression failure**: Fallback to uncompressed storage
- **Decompression timeout**: Implement timeout and retry logic
- **Corrupted compressed data**: Add checksums and recovery
- **Strategy selection errors**: Default to safe compression level
- **Large file compression**: Implement chunked compression

### Testing Requirements
- [ ] Test compression ratios for different data types
- [ ] Verify decompression accuracy
- [ ] Performance test compression/decompression speed
- [ ] Test tiering strategy effectiveness
- [ ] Validate storage savings calculations

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #05: Content-Addressable Storage for Memory Deduplication

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 8 hours

### Description
Implement content-addressable storage using SHA-256 hashing to automatically deduplicate identical memory content, reducing storage and enabling verifiable data replication.

### Applied Learnings
- Learning 24-25: CAS Fundamentals, Benefits
- Learning 26-28: Content-Defined Chunking, FastCDC Algorithm, Multi-Buffer Hashing
- Learning 105-107: Deduplication Algorithms, Benefits
- Learning 114-115: Rolling Hash, Multi-Buffer Hashing

### Implementation Steps

1. **Design CAS Storage Schema**
   ```typescript
   interface CASObject {
     hash: string;                  // SHA-256 hash of content
     content: Buffer;              // Compressed content
     size: number;                 // Original size
     compressedSize: number;       // Compressed size
     references: number;           // Reference count
     firstSeen: ISO8601String;
     lastAccessed: ISO8601String;
   }
   ```

2. **Implement CAS Service**
   ```typescript
   class MemoryCASService {
     async store(content: Buffer): Promise<string>;  // Returns hash
     async retrieve(hash: string): Promise<Buffer>;
     async exists(hash: string): Promise<boolean>;
     async incrementReference(hash: string): Promise<void>;
     async decrementReference(hash: string): Promise<void>;
     async garbageCollect(): Promise<void>;  // Remove unreferenced objects
   }
   ```

3. **Implement Content-Defined Chunking**
   - Use FastCDC algorithm for variable-length chunks (Learning 106)
   - Configure min=4KB, mean=32KB, max=64KB chunk sizes
   - Use rolling hash for boundary detection (Learning 105)

4. **Add Deduplication Layer**
   ```typescript
   class MemoryDeduplicationService {
     async deduplicateContent(content: Buffer): Promise<string[]>;
     async reassembleContent(hashes: string[]): Promise<Buffer>;
     async calculateSavings(): Promise<DeduplicationStats>;
   }
   ```

5. **Integrate with Event Sourcing**
   - Store event payloads in CAS
   - Reference CAS hash in event data
   - Enable efficient event replay without payload duplication

### Edge Cases to Handle
- **Hash collision**: Use SHA-256 (collision-resistant) but verify content on retrieval
- **Reference count errors**: Implement reference counting with locks
- **Garbage collection conflicts**: Delay GC until all references released
- **Chunk boundary edge cases**: Handle files smaller than min chunk size
- **Concurrent writes**: Use atomic operations for reference counting

### Testing Requirements
- [ ] Test deduplication accuracy
- [ ] Verify content reassembly
- [ ] Test reference counting correctness
- [ ] Performance test with large files
- [ ] Validate garbage collection

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #04 (Memory Compression Layer)

---

## Ticket #06: Binary Serialization for Memory Data

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 6 hours

### Description
Replace JSON serialization with Protocol Buffers for memory data to reduce payload size by up to 80% and improve serialization/deserialization performance.

### Applied Learnings
- Learning 17-20: Protocol Buffers, FlatBuffers, MessagePack, CBOR
- Learning 116-119: Compression Algorithms (LZ4, ZSTD, GZIP, XZ)

### Implementation Steps

1. **Define Protobuf Schema for Memory**
   ```protobuf
   syntax = "proto3";
   package taqwin.memory;

   message Memory {
     string id = 1;
     string type = 2;              // learning, mistake, decision, pattern
     string title = 3;
     string content = 4;
     string domain = 5;
     repeated string tags = 6;
     int64 created_at = 7;
     int64 updated_at = 8;
     map<string, string> metadata = 9;
   }

   message MemoryEvent {
     string event_id = 1;
     string event_type = 2;
     string aggregate_id = 3;
     bytes event_data = 4;          // Protobuf-encoded
     int64 timestamp = 5;
     uint64 sequence = 6;
   }
   ```

2. **Generate TypeScript Protobuf Code**
   - Use `protoc` with TypeScript plugin
   - Generate type-safe serializers/deserializers
   - Place in `.taqwin/generated/protobuf/`

3. **Implement Serialization Service**
   ```typescript
   class MemorySerializationService {
     serializeMemory(memory: Memory): Buffer;
     deserializeMemory(buffer: Buffer): Memory;
     serializeEvent(event: MemoryEvent): Buffer;
     deserializeEvent(buffer: Buffer): MemoryEvent;
   }
   ```

4. **Add Versioning Support**
   - Include schema version in messages
   - Implement migration logic for version upgrades
   - Support backward compatibility

5. **Benchmark Against JSON**
   - Measure serialization/deserialization speed
   - Compare payload sizes
   - Validate 60-80% reduction (Learning 18)

### Edge Cases to Handle
- **Schema mismatch**: Implement fallback to JSON for old data
- **Version upgrade**: Provide migration path
- **Serialization errors**: Graceful degradation to JSON
- **Large messages**: Implement chunked serialization
- **Binary data corruption**: Add checksums

### Testing Requirements
- [ ] Test serialization accuracy
- [ ] Verify performance improvement
- [ ] Compare payload sizes
- [ ] Test version compatibility
- [ ] Validate error handling

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #07: Multi-Level Caching System for Memory Access

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 10 hours

### Description
Implement multi-level caching system using in-memory cache (LRU) and persistent cache (Redis-like) to optimize memory access patterns and reduce database load.

### Applied Learnings
- Learning 83-85: Cache-Aside, Write-Through Caching
- Learning 86-90: Cache Replacement Policies (LRU, LFU, ARC)
- Learning 87-88: LRU vs LFU characteristics
- Learning 89: Advanced Eviction Policies (ARC, LIRS)

### Implementation Steps

1. **Design Cache Architecture**
   ```typescript
   interface CacheConfig {
     l1: {  // In-memory cache
       maxSize: number;            // 1000 entries
       ttl: number;                // 5 minutes
       eviction: 'LRU' | 'LFU' | 'ARC';
     };
     l2: {  // Persistent cache (SQLite-based)
       maxSize: number;            // 10000 entries
       ttl: number;                // 1 hour
       eviction: 'LRU' | 'LFU';
     };
   }
   ```

2. **Implement L1 In-Memory Cache**
   ```typescript
   class MemoryL1Cache {
     private cache: LRUCache<string, CachedMemory>;
     async get(key: string): Promise<CachedMemory | null>;
     async set(key: string, value: CachedMemory): Promise<void>;
     async invalidate(key: string): Promise<void>;
     async invalidatePattern(pattern: string): Promise<void>;
   }
   ```

3. **Implement L2 Persistent Cache**
   - Use SQLite with WAL mode (Learning 31)
   - Add B-tree index on cache key (Learning 77)
   - Implement LRU eviction (Learning 87)
   - Store in `.taqwin/cache/memory.db`

4. **Implement Cache-Aside Pattern** (Learning 83)
   ```typescript
   class MemoryCacheService {
     async getMemory(id: string): Promise<Memory> {
       // Check L1
       let memory = await l1Cache.get(id);
       if (memory) return memory;
       
       // Check L2
       memory = await l2Cache.get(id);
       if (memory) {
         await l1Cache.set(id, memory);
         return memory;
       }
       
       // Fetch from source
       memory = await eventSourcingService.getMemoryState(id);
       await l2Cache.set(id, memory);
       await l1Cache.set(id, memory);
       return memory;
     }
   }
   ```

5. **Add Cache Invalidation Strategy**
   - Invalidate on memory updates (write-through, Learning 85)
   - Time-based expiration (TTL)
   - Manual invalidation for bulk updates
   - Pattern-based invalidation for domain changes

### Edge Cases to Handle
- **Cache stampede**: Implement request coalescing
- **Cache poisoning**: Validate data before caching
- **Memory pressure**: Implement cache size limits
- **Cache consistency**: Use write-through for critical data
- **Cold cache**: Implement warmup on startup

### Testing Requirements
- [ ] Test cache hit/miss ratios
- [ ] Verify cache consistency
- [ ] Performance test with concurrent access
- [ ] Test eviction policies
- [ ] Validate cache invalidation

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #08: Database Indexing Strategy for Memory Queries

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 6 hours

### Description
Implement comprehensive indexing strategy using B-tree and hash indexes to optimize common memory query patterns and ensure sub-second response times.

### Applied Learnings
- Learning 75-80: B-Tree Indexing Characteristics, Performance, Use Cases, Hash Indexing
- Learning 93-94: SQLite Performance Tuning, WAL Benefits

### Implementation Steps

1. **Analyze Query Patterns**
   - Identify most frequent queries
   - Determine access patterns (point lookup vs range)
   - Profile query performance

2. **Create Indexes by Query Type**
   ```sql
   -- B-tree for range queries (Learning 77)
   CREATE INDEX idx_memories_timestamp ON memories(timestamp);
   CREATE INDEX idx_memories_domain_timestamp ON memories(domain, timestamp);
   
   -- Hash index for point lookups (Learning 80)
   CREATE INDEX idx_memories_id ON memories(id);
   CREATE INDEX idx_memories_tags ON memories USING hash(tags);
   
   -- Composite index for common filters
   CREATE INDEX idx_memories_domain_type ON memories(domain, type);
   ```

3. **Implement Index Maintenance Service**
   ```typescript
   class MemoryIndexService {
     async analyzeIndexUsage(): Promise<IndexStats>;
     async rebuildIndex(indexName: string): Promise<void>;
     async suggestIndexes(): Promise<IndexSuggestion[]>;
     async removeUnusedIndexes(): Promise<void>;
   }
   ```

4. **Optimize SQLite Configuration**
   - Enable WAL mode for concurrent readers (Learning 93)
   - Set `synchronous=normal` for performance
   - Configure `temp_store=memory` for temp tables
   - Set `mmap_size=30000000000` for memory mapping (Learning 32)

5. **Add Index Monitoring**
   - Track index hit/miss ratios
   - Monitor query execution times
   - Alert on slow queries
   - Auto-suggest new indexes

### Edge Cases to Handle
- **Index bloat**: Implement index rebuild schedule
- **Write performance degradation**: Balance read/write needs
- **Index corruption**: Implement index validation and repair
- **Query plan changes**: Monitor and alert on plan regressions
- **Large index size**: Implement partial indexes for common filters

### Testing Requirements
- [ ] Verify index usage for all queries
- [ ] Performance test with and without indexes
- [ ] Test concurrent read/write with WAL
- [ ] Validate index maintenance operations
- [ ] Benchmark query performance

### Dependencies
- Ticket #01 (Event Sourcing Foundation)

---

## Ticket #09: Time-Series Memory Tracking for Metrics

**Priority**: LOW  
**Status**: TODO  
**Estimated Effort**: 8 hours

### Description
Implement time-series database pattern to track memory metrics (access frequency, compression ratios, cache hit rates) for monitoring and optimization.

### Applied Learnings
- Learning 81-82: Time-Series Database Fundamentals, Prometheus TSDB
- Learning 120-121: Append-Only Benefits, Use Cases
- Learning 124: Storage Format Selection (Columnar for analytics)

### Implementation Steps

1. **Design Metrics Schema**
   ```typescript
   interface MemoryMetric {
     timestamp: ISO8601String;
     metricName: string;          // memory_access_count, compression_ratio, cache_hit_rate
     value: number;
     labels: {
       domain?: string;
       memoryType?: string;
       [key: string]: string;
     };
   }
   ```

2. **Implement Time-Series Storage**
   - Use SQLite with columnar-like organization (Learning 124)
   - Store in `.taqwin/metrics/memory_metrics.db`
   - Use append-only writes (Learning 120)
   - Partition by time (daily partitions)

3. **Create Metrics Collection Service**
   ```typescript
   class MemoryMetricsService {
     async recordMetric(metric: MemoryMetric): Promise<void>;
     async recordBatchMetrics(metrics: MemoryMetric[]): Promise<void>;
     async queryMetrics(
       metricName: string,
       timeRange: TimeRange,
       labels?: Record<string, string>
     ): Promise<MemoryMetric[]>;
     async aggregateMetrics(
       metricName: string,
       aggregation: 'avg' | 'sum' | 'max' | 'min',
       timeRange: TimeRange,
       interval: string
     ): Promise<MemoryMetric[]>;
   }
   ```

4. **Implement Common Metrics**
   - Memory access frequency per domain
   - Compression ratio by strategy
   - Cache hit/miss rates
   - Query latency percentiles
   - Storage growth over time

5. **Add Metrics Dashboard**
   - Real-time metrics display
   - Time-series charts
   - Alert thresholds
   - Export capabilities

### Edge Cases to Handle
- **High cardinality labels**: Limit label combinations
- **Metric backfill**: Handle gaps in time series
- **Aggregation errors**: Validate aggregation logic
- **Storage growth**: Implement retention policy
- **Query performance**: Use time-based partitioning

### Testing Requirements
- [ ] Test metrics recording accuracy
- [ ] Verify aggregation correctness
- [ ] Performance test with large time ranges
- [ ] Test retention policy
- [ ] Validate dashboard data

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #04 (Memory Compression Layer)
- Ticket #07 (Multi-Level Caching)

---

## Ticket #10: Memory Visualization UI Component

**Priority**: HIGH  
**Status**: TODO  
**Estimated Effort**: 16 hours

### Description
Build comprehensive UI component for memory visualization including timeline view, graph view, and list view with advanced filtering and search capabilities.

### Applied Learnings
- Learning 51-53: Knowledge Graph Use Cases (NASA, Cisco, Novartis examples)
- Learning 99-102: Schema Design for AI (taxonomy, ontology)
- Learning 122-124: Columnar vs Row Storage for query patterns

### Implementation Steps

1. **Design Memory View Architecture**
   ```typescript
   enum MemoryView {
     LIST,              // Traditional list with filters
     TIMELINE,          // Chronological view
     GRAPH,             // Knowledge graph visualization
     MATRIX,            // Relationship matrix
     HEATMAP            // Activity heatmap
   }
   ```

2. **Implement List View Component**
   - Sortable columns (date, domain, type, tags)
   - Advanced filtering (domain, type, tags, date range)
   - Virtual scrolling for large lists
   - Inline editing capabilities

3. **Implement Timeline View**
   - Chronological display of memories
   - Group by day/week/month
   - Show event sourcing history
   - Zoom and pan controls

4. **Implement Graph View**
   - Force-directed layout using D3.js or Cytoscape.js
   - Node size based on importance
   - Edge thickness based on relationship strength
   - Interactive exploration (click to expand/collapse)

5. **Add Search and Filter**
   - Semantic search (Ticket #02)
   - Keyword search
   - Tag-based filtering
   - Domain-based filtering
   - Date range filtering

6. **Implement Memory Detail View**
   - Show full memory content
   - Display related memories (from graph)
   - Show event history (from event sourcing)
   - Display metrics (access frequency, etc.)

### Edge Cases to Handle
- **Large dataset rendering**: Use virtualization and lazy loading
- **Graph layout performance**: Implement progressive rendering
- **Search result overload**: Paginate results
- **Mobile responsiveness**: Responsive design for all views
- **Browser compatibility**: Test across browsers

### Testing Requirements
- [ ] Test all view types
- [ ] Verify filtering accuracy
- [ ] Performance test with 10,000+ memories
- [ ] Test interactive graph exploration
- [ ] Validate responsive design

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #02 (Vector Database Integration)
- Ticket #03 (Knowledge Graph Construction)

---

## Ticket #11: Learning and Mistakes Visualization

**Priority**: HIGH  
**Status**: TODO  
**Estimated Effort**: 12 hours

### Description
Create specialized visualization for learnings and mistakes with pattern recognition, trend analysis, and actionable insights display.

### Applied Learnings
- Learning 51-53: Knowledge Graph Benefits (NASA "Lessons Learned", Cisco, Novartis examples)
- Learning 99-102: Taxonomy vs Ontology for AI
- Learning 57: Memory Frameworks (Mem0, Zep, LangMem patterns)

### Implementation Steps

1. **Design Learning/Mistake Schema Extensions**
   ```typescript
   interface LearningMemory extends Memory {
     learningType: 'insight' | 'pattern' | 'best_practice' | 'anti_pattern';
     confidence: number;            // 0-1
     applicability: string[];       // Domains where applicable
     relatedLearnings: string[];   // IDs of related learnings
     validated: boolean;            // Has this learning been validated?
   }

   interface MistakeMemory extends Memory {
     severity: 'low' | 'medium' | 'high' | 'critical';
     rootCause: string;
     resolution: string;
     prevention: string;
     recurrence: number;            // Times this mistake repeated
     relatedMistakes: string[];    // IDs of similar mistakes
   }
   ```

2. **Implement Learning Pattern Recognition**
   ```typescript
   class LearningPatternService {
     async detectPatterns(learnings: LearningMemory[]): Promise<LearningPattern[]>;
     async suggestRelatedLearnings(learning: LearningMemory): Promise<LearningMemory[]>;
     async validateLearning(learningId: string): Promise<void>;
     async trackLearningApplication(learningId: string, context: string): Promise<void>;
   }
   ```

3. **Implement Mistake Trend Analysis**
   ```typescript
   class MistakeAnalysisService {
     async analyzeMistakeTrends(mistakes: MistakeMemory[]): Promise<MistakeTrend[]>;
     async detectRecurringMistakes(): Promise<MistakeMemory[]>;
     async suggestPrevention(mistake: MistakeMemory): Promise<PreventionSuggestion>;
     async calculateCost(mistake: MistakeMemory): Promise<number>;
   }
   ```

4. **Create Visualization Components**
   - **Learning Heatmap**: Show learning density by domain/time
   - **Mistake Timeline**: Track mistake occurrences over time
   - **Pattern Graph**: Visualize learning relationships
   - **Insight Cards**: Highlight key learnings with confidence scores
   - **Prevention Dashboard**: Show proactive measures based on past mistakes

5. **Add Actionable Insights**
   - Suggest learnings based on current context
   - Warn about potential mistakes before they happen
   - Show learning application history
   - Provide mistake prevention tips

### Edge Cases to Handle
- **Pattern overfitting**: Validate patterns with statistical significance
- **False positives**: Use confidence thresholds
- **Conflicting learnings**: Implement conflict resolution
- **Stale learnings**: Mark learnings as outdated after time
- **Sensitive mistake data**: Implement access controls

### Testing Requirements
- [ ] Test pattern detection accuracy
- [ ] Verify mistake trend analysis
- [ ] Test insight suggestions
- [ ] Validate confidence scoring
- [ ] Performance test with large datasets

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #02 (Vector Database Integration)
- Ticket #03 (Knowledge Graph Construction)
- Ticket #10 (Memory Visualization UI)

---

## Ticket #12: CRDT-Based Memory Synchronization

**Priority**: MEDIUM  
**Status**: TODO  
**Estimated Effort**: 16 hours

### Description
Implement conflict-free replicated data types (CRDT) for memory synchronization across multiple devices/clients, enabling offline work and automatic conflict resolution.

### Applied Learnings
- Learning 58-59: CRDT Fundamentals, Decentralized Operation
- Learning 108-110: CRDT Conflict Resolution, Use Cases, vs Alternatives
- Learning 111-113: Persistent Data Structures (Partial vs Full Persistence)

### Implementation Steps

1. **Choose CRDT Library**
   - Use `automerge` or `yjs` for CRDT implementation
   - Supports text, counters, maps, and lists
   - TypeScript support included

2. **Design Memory CRDT Schema**
   ```typescript
   // Use automerge for memory document
   type MemoryCRDT = {
     id: string;
     title: string;               // CRDT text for concurrent edits
     content: string;             // CRDT text for concurrent edits
     tags: Array<string>;         // CRDT array
     metadata: Record<string, string>;  // CRDT map
     lastModified: number;        // Logical clock
     version: number;             // Version vector
   };
   ```

3. **Implement CRDT Sync Service**
   ```typescript
   class MemoryCRDTService {
     async createMemoryCRDT(memory: Memory): Promise<MemoryCRDT>;
     async mergeChanges(local: MemoryCRDT, remote: MemoryCRDT): Promise<MemoryCRDT>;
     async getConflictHistory(memoryId: string): Promise<Conflict[]>;
     async resolveConflict(conflict: Conflict, resolution: Resolution): Promise<void>;
     async exportChanges(sinceVersion: number): Promise<Change[]>;
     async importChanges(changes: Change[]): Promise<void>;
   }
   ```

4. **Implement Sync Protocol**
   - WebSocket-based real-time sync
   - HTTP fallback for offline scenarios
   - Change batching for efficiency
   - Conflict detection and notification

5. **Add Offline Support**
   - Queue changes while offline
   - Sync on reconnection
   - Show sync status in UI
   - Handle merge conflicts

### Edge Cases to Handle
- **Complex conflicts**: Provide UI for manual resolution
- **Network partition**: Implement conflict-free merges
- **Large document sync**: Implement incremental sync
- **Version vector overflow**: Use compact representation
- **Memory exhaustion**: Limit CRDT history size

### Testing Requirements
- [ ] Test concurrent edits
- [ ] Verify conflict resolution
- [ ] Test offline/online transitions
- [ ] Performance test with large documents
- [ ] Validate sync consistency

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #06 (Binary Serialization)

---

## Ticket #13: Bloom Filter for Memory Existence Checks

**Priority**: LOW  
**Status**: TODO  
**Estimated Effort**: 4 hours

### Description
Implement Bloom filter to quickly check if a memory exists before expensive database lookups, reducing cache misses and improving performance.

### Applied Learnings
- Learning 95-98: Bloom Filter Fundamentals, Performance, Use Cases, Extensions
- Learning 97: Bloom Filter Use Cases (cache filtering, database optimization)

### Implementation Steps

1. **Select Bloom Filter Library**
   - Use `bloom-filters` npm package
   - Configurable false positive rate (1% default, Learning 96)
   - Supports counting Bloom filters for deletions

2. **Implement Memory Bloom Filter**
   ```typescript
   class MemoryBloomFilter {
     private filter: BloomFilter;
     
     constructor(config: {
       expectedItems: number;      // e.g., 100,000
       falsePositiveRate: number;  // e.g., 0.01 (1%)
     });
     
     add(memoryId: string): void;
     exists(memoryId: string): boolean;
     remove(memoryId: string): void;  // Requires counting Bloom filter
     clear(): void;
     
     // Get statistics
     getFalsePositiveRate(): number;
     getMemoryUsage(): number;
   }
   ```

3. **Integrate with Cache Service**
   ```typescript
   class MemoryCacheService {
     async getMemory(id: string): Promise<Memory> {
       // Check Bloom filter first (Learning 97)
       if (!bloomFilter.exists(id)) {
         return null;  // Definitely doesn't exist
       }
       
       // Might exist, check cache
       const cached = await l1Cache.get(id);
       if (cached) return cached;
       
       // Check database
       const memory = await eventSourcingService.getMemoryState(id);
       if (memory) {
         bloomFilter.add(id);
         await l1Cache.set(id, memory);
       }
       return memory;
     }
   }
   ```

4. **Add Bloom Filter Persistence**
   - Save Bloom filter state to disk periodically
   - Rebuild on startup from memory IDs
   - Handle Bloom filter regeneration

5. **Monitor Bloom Filter Metrics**
   - Track false positive rate
   - Monitor memory usage
   - Alert on degraded performance

### Edge Cases to Handle
- **Bloom filter full**: Regenerate with larger capacity
- **False positive spike**: Investigate data distribution
- **Persistence failure**: Rebuild from database
- **Concurrent access**: Use thread-safe implementation
- **Memory ID changes**: Invalidate Bloom filter

### Testing Requirements
- [ ] Verify false positive rate matches config
- [ ] Test existence check accuracy
- [ ] Performance test vs database lookup
- [ ] Test persistence and recovery
- [ ] Validate memory usage

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #07 (Multi-Level Caching)

---

## Ticket #14: Memory Sharding Strategy for Scalability

**Priority**: LOW  
**Status**: TODO  
**Estimated Effort**: 8 hours

### Description
Implement database sharding strategy to distribute memory data across multiple SQLite databases, enabling horizontal scaling for large memory volumes.

### Applied Learnings
- Learning 65-69: Database Sharding Fundamentals, Horizontal vs Vertical Partitioning, Benefits, Strategies, Challenges
- Learning 66: Horizontal vs Vertical Partitioning

### Implementation Steps

1. **Design Sharding Strategy**
   ```typescript
   enum ShardStrategy {
     BY_DOMAIN,          // Shard by memory domain
     BY_DATE,            // Shard by creation date (monthly)
     BY_HASH,            // Consistent hash by memory ID
     BY_SIZE,            // Shard by memory size
   }
   
   interface ShardConfig {
     strategy: ShardStrategy;
     shardCount: number;           // Number of shards
     shardDirectory: string;      // Path to shard files
   }
   ```

2. **Implement Shard Manager**
   ```typescript
   class MemoryShardManager {
     private shards: Map<string, SQLite.Database>;
     
     async initialize(config: ShardConfig): Promise<void>;
     async getShardForMemory(memoryId: string, metadata: MemoryMetadata): Promise<SQLite.Database>;
     async queryAllShards(query: string, params?: any[]): Promise<any[]>;
     async rebalanceShards(newStrategy: ShardStrategy): Promise<void>;
     async getShardStats(): Promise<ShardStats[]>;
   }
   ```

3. **Implement Sharding by Domain (Learning 66)**
   - Each domain gets its own shard
   - Easy to manage domain-specific data
   - Good for domain-isolated queries

4. **Implement Sharding by Date**
   - Monthly shards for chronological data
   - Easy to archive old data
   - Good for time-based queries

5. **Add Cross-Shard Query Support**
   - Union queries across shards
   - Aggregation across shards
   - Distributed transaction support

6. **Implement Shard Rebalancing**
   - Move data between shards
   - Handle hotspots (Learning 69)
   - Minimize downtime during rebalancing

### Edge Cases to Handle
- **Shard hotspot**: Implement rebalancing (Learning 69)
- **Cross-shard transactions**: Use two-phase commit
- **Shard failure**: Implement fallback to other shards
- **Uneven distribution**: Monitor and rebalance
- **Query performance**: Optimize cross-shard queries

### Testing Requirements
- [ ] Test sharding strategy effectiveness
- [ ] Verify cross-shard queries
- [ ] Test rebalancing without data loss
- [ ] Performance test with multiple shards
- [ ] Validate shard statistics

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #08 (Database Indexing Strategy)

---

## Ticket #15: Memory Backup and Recovery System

**Priority**: CRITICAL  
**Status**: TODO  
**Estimated Effort**: 12 hours

### Description
Implement comprehensive backup and recovery system for memory data using compression, deduplication, and incremental backups to ensure data safety and quick recovery.

### Applied Learnings
- Learning 1-5: File Compression Formats (ZIP, 7Z, ZSTD)
- Learning 24-25: CAS Benefits (immutability, deduplication)
- Learning 26-28: Deduplication Algorithms
- Learning 120-121: Append-Only Benefits for backup/archival

### Implementation Steps

1. **Design Backup Strategy**
   ```typescript
   enum BackupType {
     FULL,              // Complete backup
     INCREMENTAL,       // Since last backup
     DIFFERENTIAL       // Since last full backup
   }
   
   interface BackupConfig {
     schedule: cron;               // Backup schedule
     retention: number;            // Days to keep
     compression: CompressionStrategy;
     encryption: boolean;
     destination: string;          // Backup location
   }
   ```

2. **Implement Backup Service**
   ```typescript
   class MemoryBackupService {
     async createFullBackup(config: BackupConfig): Promise<BackupResult>;
     async createIncrementalBackup(config: BackupConfig): Promise<BackupResult>;
     async restoreBackup(backupId: string, toPoint?: ISO8601String): Promise<RestoreResult>;
     async listBackups(): Promise<BackupMetadata[]>;
     async verifyBackup(backupId: string): Promise<boolean>;
     async pruneOldBackups(config: BackupConfig): Promise<void>;
   }
   ```

3. **Implement Incremental Backup**
   - Use event log for incremental changes (Learning 39)
   - Apply content deduplication (Learning 26)
   - Compress with ZSTD level 15 (Learning 22)
   - Store in CAS for deduplication (Learning 24)

4. **Add Encryption Support**
   - Encrypt backups with AES-256
   - Store encryption keys separately
   - Implement key rotation

5. **Implement Restore Point-in-Time**
   - Use event replay to restore state (Learning 36)
   - Support restore to specific timestamp
   - Validate restored data integrity

6. **Add Backup Verification**
   - Periodic backup integrity checks
   - Test restore procedures
   - Alert on backup failures
   - Monitor backup success rates

### Edge Cases to Handle
- **Backup corruption**: Keep multiple backup generations
- **Restore failure**: Implement partial restore capability
- **Large backup size**: Implement chunked backup/restore
- **Encryption key loss**: Implement key recovery procedure
- **Backup location unavailable**: Implement local fallback

### Testing Requirements
- [ ] Test full backup creation
- [ ] Verify incremental backup accuracy
- [ ] Test restore procedures
- [ ] Verify encryption/decryption
- [ ] Performance test with large datasets
- [ ] Test point-in-time restore

### Dependencies
- Ticket #01 (Event Sourcing Foundation)
- Ticket #04 (Memory Compression Layer)
- Ticket #05 (Content-Addressable Storage)

---

## Summary

This ticket set provides a comprehensive roadmap to build an advanced memories page that applies all storage research learnings:

- **Foundation (Tickets 1-3)**: Event sourcing, vector search, knowledge graphs
- **Optimization (Tickets 4-9)**: Compression, deduplication, serialization, caching, indexing, metrics
- **Visualization (Tickets 10-11)**: UI components, learning/mistake visualization
- **Advanced Features (Tickets 12-15)**: CRDT sync, Bloom filters, sharding, backup/recovery

**Total Estimated Effort**: ~130 hours  
**Risk Level**: Medium (complex integrations but well-researched)  
**Dependencies**: Clear dependency chain with foundation tickets first

**Success Criteria**:
- All 15 tickets completed and tested
- 50+ learnings from research applied
- Performance benchmarks met
- Edge cases handled
- Documentation complete
