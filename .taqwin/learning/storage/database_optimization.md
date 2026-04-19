# Database Optimization - Learnings

## Key-Value Storage

### Learning 70: LevelDB vs RocksDB
- **Source**: influxdata.com/blog/benchmarking-leveldb-vs-rocksdb-vs-hyperleveldb-vs-lmdb-performance-for-influxdb/
- LevelDB: Log Structured Merge Tree (LSM) based
- RocksDB: fork of LevelDB with optimizations
- HyperLevelDB: another LevelDB fork
- LMDB: memory-mapped copy-on-write B+Tree (different architecture)
- Choice depends on workload and hardware

### Learning 71: RocksDB Fundamentals
- **Source**: getstream.io/blog/rocksdb-fundamentals/
- Embeddable, persistent key-value store
- Based on LevelDB design principles
- LSM-tree underlying data structure
- Optimized for write-heavy workloads
- Customizable to the bone for different workloads

### Learning 72: LSM Tree Architecture
- **Source**: getstream.io/blog/rocksdb-fundamentals/
- Log-Structured Merge Tree optimized for writes
- Data written to in-memory Memtable first
- Memtable flushed to disk as SSTables (sorted files)
- SSTables are immutable, append-only
- Compaction merges SSTables, discarding deleted/stale data

### Learning 73: LSM Tree Components
- **Source**: getstream.io/blog/rocksdb-fundamentals/
- Memtables: in-memory data structures, fast reads/writes
- SSTables: immutable sorted files on disk
- Compaction: process merging SSTables, removing stale data
- Two compaction families: Levelled (LevelDB) and Tiered (RocksDB default)
- RocksDB improves upon LevelDB's lack of parallelism and high write amplification

### Learning 74: RocksDB Improvements
- **Source**: getstream.io/blog/rocksdb-fundamentals/
- Parallel compaction on multi-core CPUs
- Tunable number of simultaneous compaction jobs
- Better write amplification than LevelDB
- Configurable for different workloads
- Built-in support for tools and utilities

## Database Indexing

### Learning 75: B-Tree Indexing Characteristics
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Balanced nodes ensure efficient data retrieval
- Logarithmic time complexity operations
- All leaf nodes at same level (balanced nature)
- Uniform access times across dataset
- Each node contains multiple keys and child pointers

### Learning 76: B-Tree Performance
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Reduces disk accesses for data location
- Crucial for speeding up query processing
- Maintains balanced structure during insertions/deletions
- Dynamic adjustment keeps tree optimized
- Favorable space complexity for massive datasets

### Learning 77: B-Tree Use Cases
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Range queries (retrieving data within specific interval)
- Ordered data retrieval based on keys or values
- General-purpose indexing for wide range of applications
- Consistent performance across different use cases
- Inherent sorting mechanism facilitates sequential access

### Learning 78: Hash Indexing Characteristics
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Constant time complexity for exact matches
- Based on hash function mapping keys to locations
- Not suitable for range queries
- Efficient for equality comparisons
- Can suffer from hash collisions

### Learning 79: Hash Indexing Performance
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Extremely fast for point lookups
- O(1) average case for exact matches
- No need for tree traversal
- Memory overhead for hash table
- Performance degrades with poor hash function or high collision rate

### Learning 80: Hash Indexing Use Cases
- **Source**: pingcap.com/article/understanding-b-tree-and-hash-indexing-in-databases/
- Key-value lookups where exact match needed
- Caching systems
- In-memory databases
- Situations where range queries not required
- High-concurrency point access patterns

## Time-Series Databases

### Learning 81: Time-Series Database Fundamentals
- **Source**: signoz.io/guides/which-database-is-used-in-prometheus/
- Optimized for handling time-stamped data
- Each data point associated with specific timestamp
- Efficiently store, retrieve, analyze time-stamped data
- Numeric values changing over time, collected at regular intervals
- Manage large volumes of time-stamped data

### Learning 82: Prometheus TSDB
- **Source**: signoz.io/guides/which-database-is-used-in-prometheus/
- Open-source monitoring and alerting toolkit
- Collects and stores metrics as time series data
- Well-suited for monitoring dynamic cloud environments
- Robust features and flexibility
- Components: data ingestion, data storage, data persistence

## Caching Strategies

### Learning 83: Cache-Aside (Lazy Loading)
- **Source**: docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html
- Most common caching strategy
- Application checks cache first, then database on miss
- Cache populated only after cache miss
- Cache contains only data application actually requests
- Straightforward implementation with immediate performance gains

### Learning 84: Cache-Aside Trade-offs
- **Source**: docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html
- Advantage: cost-effective cache size
- Disadvantage: overhead on initial response time
- Additional roundtrips to cache and database on miss
- Good for read-heavy applications
- Cache misses acceptable

### Learning 85: Write-Through Caching
- **Source**: docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html
- Data written to cache and database simultaneously
- Ensures cache always in sync with database
- Higher write latency due to dual writes
- Good for read-heavy workloads with frequent writes
- Consistency between cache and database

## Cache Eviction Policies

### Learning 86: Cache Replacement Fundamentals
- **Source**: wikipedia.org/wiki/Cache_replacement_policies
- Average memory reference time = hit time + miss rate * miss penalty
- Two primary figures: latency and hit ratio
- Hit ratio: how often searched-for item is found
- Latency: how long to return item when hit
- Each replacement strategy is compromise between hit rate and latency

### Learning 87: LRU (Least Recently Used)
- **Source**: wikipedia.org/wiki/Cache_replacement_policies
- Evicts least recently used items
- Works well for temporal locality
- Simple to implement
- Can suffer from cache pollution with streaming data
- Streaming data fills cache, pushing out useful information

### Learning 88: LFU (Least Frequently Used)
- **Source**: wikipedia.org/wiki/Cache_replacement_policies
- Evicts least frequently accessed items
- Better for skewed popularity distributions
- Counts how often item needed
- May give better results than LRU for Pareto distributions
- Requires tracking access frequency

### Learning 89: Advanced Eviction Policies
- **Source**: medium.com/@qingedaig/cache-eviction-policies-59adf9fc67d6
- ARC (Adaptive Replacement Cache): scan-resistant
- CAR: Clock with Adaptive Replacement
- LIRS: Low Inter-reference Recency Set
- Clock-Pro: combines LRU and Clock-Pro
- Windowed TinyLFU: hybrid LRU + LFU (state of the art)

### Learning 90: Eviction Policy Selection
- **Source**: aerospike.com/blog/cache-replacement-policies/
- Skewed popularity: frequency-based strategies (LFU)
- Long sequential scans or one-time use: basic LRU might pollute
- Workload characteristics determine optimal policy
- Scan-resistant workloads need advanced policies
- Monitor hit rates to evaluate effectiveness

## Distributed Storage

### Learning 91: Cassandra vs DynamoDB
- **Source**: bytebase.com/blog/dynamodb-vs-cassandra/
- Cassandra: open-source, masterless ring architecture
- DynamoDB: fully managed AWS NoSQL solution
- Cassandra: linear scalability, no single point of failure
- DynamoDB: high availability, scalability, security
- Cassandra: self-managed, DynamoDB: managed service

### Learning 92: Cassandra Architecture
- **Source**: bytebase.com/blog/dynamodb-vs-cassandra/
- Synthesis of Amazon Dynamo and Google Bigtable
- Masterless ring architecture
- Highly resilient with no single point of failure
- Wide-column store architecture
- Designed for large amounts of data across multiple commodity servers

## Database Performance Tuning

### Learning 93: SQLite Performance Tuning
- **Source**: phiresky.github.io/blog/2020/sqlite-performance-tuning/
- Run pragmas every connection: journal_mode=WAL, synchronous=normal
- temp_store=memory for temporary indices/tables
- mmap_size for memory mapping
- page_size=32768 for large blobs
- Scale to multiple GB with many concurrent readers

### Learning 94: SQLite WAL Benefits
- **Source**: phiresky.github.io/blog/2020/sqlite-performance-tuning/
- Multiple concurrent readers even during open write transaction
- Significantly improves performance
- Normal synchronous still corruption-safe
- Off synchronous can cause corruption but faster
- Regularly commit changes from WAL to main DB
