# Storage Architectures - Learnings

## Event Sourcing Pattern

### Learning 36: Event Sourcing Fundamentals
- **Source**: learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
- Store full series of events describing actions taken on data
- Append-only store acts as system of record
- Current state derived by replaying all events (rehydration)
- Materialized views optimize for querying
- Improves auditability and write performance in complex systems

### Learning 37: Event Sourcing Trade-offs
- **Source**: learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
- Complex pattern with significant trade-offs
- Changes how you store data, handle concurrency, evolve schemas
- Costly to migrate to or from event sourcing
- Constrains future design decisions
- Benefits must justify complexity (auditability, historical reconstruction)

### Learning 38: Event Sourcing Write Contention
- **Source**: learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
- CRUD requires read-modify-write with row-level locking
- Concurrent writes to same entity degrade performance
- Event sourcing eliminates write contention
- Events are appended, never updated
- Better for high-load systems

### Learning 39: Event Sourcing Auditability
- **Source**: learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
- CRUD systems only store latest state
- Event sourcing preserves complete history
- No need for separate auditing mechanism
- Every operation recorded in event log
- Can reconstruct state at any point in time

## Vector Databases

### Learning 40: Vector Database Purpose
- **Source**: firecrawl.dev/blog/best-vector-databases
- Store and search high-dimensional vectors (embeddings)
- Search by meaning through semantic similarity
- Enables RAG (Retrieval Augmented Generation)
- Powers chatbots, recommendation systems, search engines
- Critical for modern AI applications

### Learning 41: Recall vs Speed Trade-off
- **Source**: firecrawl.dev/blog/best-vector-databases
- Core compromise: exact nearest neighbor too slow
- Use approximate search with vector indexing
- 95% recall misses 1 in 20 relevant documents
- 99% recall misses 1 in 100
- Benchmarks only meaningful with recall number attached

### Learning 42: Purpose-Built vs Extensions
- **Source**: firecrawl.dev/blog/best-vector-databases
- Purpose-built: Pinecone, Milvus, Qdrant, Weaviate
- Use HNSW (Hierarchical Navigable Small World) algorithm
- Graph-based search through multiple layers
- Algorithm complexity grows logarithmically, not linearly
- Extensions: pgvector, Redis, MongoDB, Elasticsearch add vector indexes to existing engines
- Extensions hit limits beyond 50-100M vectors

### Learning 43: Performance Metrics
- **Source**: firecrawl.dev/blog/best-vector-databases
- p99 latency (99th percentile) matters more than median
- Slow tail queries degrade user experience more
- Concurrent throughput (QPS) shows behavior under load
- Write performance determines if can keep up with updates
- Quantization (32-bit to 8-bit) cuts memory 75% with minimal recall impact

### Learning 44: Hybrid Search
- **Source**: firecrawl.dev/blog/best-vector-databases
- Combines vector similarity, keyword search, metadata filters
- Weaviate and Qdrant include without plugins
- Pre-filtering: faster but disrupts HNSW traversal
- Post-filtering: maintains recall but scans more vectors
- Test with your filter selectivity

### Learning 45: Multi-Tenancy
- **Source**: firecrawl.dev/blog/best-vector-databases
- Pinecone: up to 100,000 namespaces, 20 indexes
- Cloudflare Vectorize: 50,000 namespaces, 5M vectors per index
- Turbopuffer: no enforced namespace limits
- Turso: one database per tenant approach
- Namespace limits and performance degradation at high tenant counts

### Learning 46: Cost Considerations
- **Source**: firecrawl.dev/blog/best-vector-databases
- Managed services trade dollars for time
- Pinecone usage-based (storage + read/write units)
- 10M vectors: $100/month to $2,000+ depending on throughput
- Self-hosted: free but needs engineering expertise
- Infrastructure integration often determines total cost more than database pricing

## Graph Databases

### Learning 47: Graph Database Fundamentals
- **Source**: linkurious.com/blog/choosing-the-best-graph-database/
- Stores information as nodes (entities) and edges (relationships)
- Structures everything as network of connections
- Particularly helpful when relationships carry meaning
- Use cases: fraud detection, social networks, recommendation systems, supply chain
- Better questions and faster answers for deeply interconnected data

### Learning 48: RDF vs Property Graph
- **Source**: linkurious.com/blog/choosing-the-best-graph-database/
- RDF databases: semantic data, knowledge graphs, logical inference
- Property graphs: native (built for graph) vs multi-model (supports graphs + other models)
- Native graph data stores optimized for graph workloads
- Multi-model: graphs along with document, key-value
- Choice depends on specific use case requirements

## Architectural Decision Records

### Learning 49: ADR Fundamentals
- **Source**: adr.github.io
- Architectural Decision (AD): justified design choice addressing architecturally significant requirement
- Architecturally Significant Requirement (ASR): requirement with measurable effect on architecture
- ADR captures single AD with rationale
- Collection of ADRs = decision log
- Part of Architectural Knowledge Management (AKM)

### Learning 50: ADR Purpose
- **Source**: adr.github.io
- Help understand reasons for chosen architectural decision
- Capture trade-offs and consequences
- Establish common vocabulary
- Strengthen tooling around ADRs for agile practices
- Provide pointers to public knowledge

## Knowledge Graph Construction

### Learning 51: Knowledge Graph Definition
- **Source**: neo4j.com/blog/knowledge-graph/how-to-build-knowledge-graph/
- Design pattern organizing interrelated data entities and semantic relationships
- Data layer supporting broad range of enterprise use cases
- Integrates with all types of data stores
- Better suited for relationship-heavy use cases than relational databases
- Three components: nodes, relationships, organizing principles

### Learning 52: Knowledge Graph Benefits
- **Source**: neo4j.com/blog/knowledge-graph/how-to-build-knowledge-graph/
- Treats relationships as integral component of data
- Captured natively in graph database
- No need to reconstruct with JOINs
- NASA "Lessons Learned Database": saved over $2 million
- Cisco: cut search times in half, saved 4 million work hours annually
- Novartis: accelerated drug development timelines

### Learning 53: Knowledge Graph Use Cases
- **Source**: neo4j.com/blog/knowledge-graph/how-to-build-knowledge-graph/
- Recommendation engines
- Fraud detection systems
- Supply chain tracking
- GraphRAG for enterprise search
- Master data management
- Choose focused starting point rather than modeling entire domain upfront

## Memory System Architecture

### Learning 54: AI Agent Memory Architecture
- **Source**: analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/
- Treat LLM as brain of larger system (CPU analogy)
- CoALA separates thinking process from memory
- Memory as structured system, not raw text
- Agent actively retrieves, updates, uses information
- MemGPT introduces memory hierarchy like computers

### Learning 55: Short-Term Memory
- **Source**: analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/
- Working context window (limited token limits)
- Holds recent conversation history, system prompts, tool outputs
- FIFO queues remove older information
- Advanced systems: prompt model to summarize and store in long-term memory
- Attention mechanisms prioritize relevant information

### Learning 56: Long-Term Memory Tripartite Model
- **Source**: analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/
- Episodic Memory: events and sequential experiences
- Semantic Memory: distilled facts and knowledge representation
- Procedural Memory: operational skills and dynamic execution
- Each requires different data structures, storage mechanisms, retrieval algorithms
- Multi-database approach adds latency and operational complexity

### Learning 57: Memory Frameworks Comparison
- **Source**: dev.to/anajuliabit/mem0-vs-zep-vs-langmem-vs-memoclaw-ai-agent-memory-comparison-2026-1l1k
- Mem0: most well-known, YC-backed, 50,000+ developers
- Managed platform with open-source self-hosted option
- Zep: temporal knowledge graphs for high-performance relational retrieval
- LangMem: native developer integration for procedural learning
- MemoClaw: alternative approach

## CRDT (Conflict-Free Replicated Data Types)

### Learning 58: CRDT Fundamentals
- **Source**: crdt.tech
- Data structure simplifying distributed storage and multi-user applications
- Copies of data stored on multiple computers (replicas)
- Used in mobile apps, distributed databases, collaboration software
- Ensure data can always be merged into consistent state
- No special conflict resolution code or user intervention needed

### Learning 59: CRDT Decentralized Operation
- **Source**: crdt.tech
- Support decentralized operation
- Don't assume single server
- Can be used in peer-to-peer networks
- Differ from Google Docs, Trello, Figma (require server communication)
- Strong eventual consistency

## Persistent Data Structures

### Learning 60: Persistent Data Structure Definition
- **Source**: wikipedia.org/wiki/Persistent_data_structure
- Always preserves previous version when modified
- Effectively immutable
- Operations yield new updated structure, don't update in-place
- Term introduced in Driscoll, Sarnak, Sleator, and Tarjan's 1986 article
- Common in functional programming

### Learning 61: Partial vs Full Persistence
- **Source**: wikipedia.org/wiki/Persistent_data_structure
- Partial: all versions accessible, only newest can be modified
- Full: every version can be both accessed and modified
- Confluently persistent: can create new version from two previous versions
- Ephemeral: not persistent structures
- Useful for version control, undo/redo, functional programming

## Message Queue Architectures

### Learning 62: RabbitMQ Architecture
- **Source**: aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/
- Exchange receives messages from producer, determines routing
- Queue: storage receiving messages from exchange, sending to consumers
- Binding: path connecting exchange and broker
- Routing key: message attribute used for routing
- Low latency and complex message distributions

### Learning 63: Kafka Architecture
- **Source**: aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/
- Kafka broker: server allowing producers to stream data to consumers
- Topic: data storage grouping similar data
- Partition: smaller data storage within topic
- ZooKeeper (now KRaft): manages clusters and partitions
- High-throughput stream event processing

### Learning 64: Kafka vs RabbitMQ Use Cases
- **Source**: aws.amazon.com/compare/the-difference-between-rabbitmq-and-kafka/
- Kafka: event stream replays, real-time data processing
- RabbitMQ: complex routing architecture, effective message delivery
- Kafka: higher throughput, event streaming
- RabbitMQ: flexible routing, message reliability
- Choice depends on specific requirements

## Database Sharding

### Learning 65: Database Sharding Fundamentals
- **Source**: aerospike.com/blog/database-sharding-scalable-systems/
- Store large database on multiple machines instead of one server
- Split large dataset into smaller chunks (shards)
- Distribute shards across separate database nodes
- Each shard holds portion of data using same schema
- All shards collectively represent entire dataset

### Learning 66: Horizontal vs Vertical Partitioning
- **Source**: aerospike.com/blog/database-sharding-scalable-systems/
- Sharding usually refers to horizontal partitioning
- Horizontal: each shard contains subset of rows, same columns
- Vertical: split by columns, each shard holds different columns
- Sharding implies horizontal distribution across multiple servers
- Shared-nothing partitioning to overcome single machine limits

### Learning 67: Sharding Benefits
- **Source**: aerospike.com/blog/database-sharding-scalable-systems/
- Horizontal scaling: many commodity servers instead of one powerful server
- Improved performance and throughput
- High availability and fault tolerance
- Overcomes vertical scaling diminishing returns
- Handles higher throughput than any single node

### Learning 68: Sharding Strategies
- **Source**: aerospike.com/blog/database-sharding-scalable-systems/
- Range-based: shard key ranges map to specific shards
- Hash-based: consistent hashing for even distribution
- Directory/lookup table: centralized mapping
- Geographical: shard based on location
- Choice depends on data access patterns and requirements

### Learning 69: Sharding Challenges
- **Source**: aerospike.com/blog/database-sharding-scalable-systems/
- Uneven data distribution and hotspots
- Increased operational and application complexity
- Rebalancing and resharding complexity
- Data consistency and distributed transactions
- Higher infrastructure costs
