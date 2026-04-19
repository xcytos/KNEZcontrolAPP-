# Data Structures & Algorithms - Learnings

## Probabilistic Data Structures

### Learning 95: Bloom Filter Fundamentals
- **Source**: wikipedia.org/wiki/Bloom_filter
- Space-efficient probabilistic data structure
- Tests whether element is member of a set
- False positives possible, false negatives not possible
- Returns "possibly in set" or "definitely not in set"
- Elements can be added but not removed (unless counting variant)

### Learning 96: Bloom Filter Performance
- **Source**: wikipedia.org/wiki/Bloom_filter
- Fewer than 10 bits per element for 1% false positive probability
- Independent of size or number of elements in set
- Conceived by Burton Howard Bloom in 1970
- Used for hyphenation algorithm example
- 18% of ideal error-free hash size still eliminates 87% of disk accesses

### Learning 97: Bloom Filter Use Cases
- **Source**: redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/
- Spell checkers
- Network routers for packet filtering
- Web crawlers to avoid revisiting URLs
- Database query optimization
- Cache filtering
- Distributed systems for membership testing

### Learning 98: Bloom Filter Extensions
- **Source**: wikipedia.org/wiki/Bloom_filter
- Counting Bloom filters: support deletions
- Scalable Bloom filters: adapt to growing data
- Layered Bloom filters: multiple layers for different recall levels
- Spatial Bloom filters: spatial locality
- Attenuated Bloom filters: for network applications

## Schema Design

### Learning 99: Taxonomy vs Ontology
- **Source**: innodata.com/understanding-the-role-of-taxonomies-ontologies-schemas-and-knowledge-graphs/
- Taxonomy: classification into categories and sub-categories (static)
- Ontology: formal naming convention of types, properties, relationships (dynamic, domain-centric)
- Schema: organization/structure for database
- Taxonomy offers simpler classification structure, hierarchical organization
- Ontology provides richer representation with properties, relationships, logical rules

### Learning 100: Taxonomy Characteristics
- **Source**: innodata.com/understanding-the-role-of-taxonomies-ontologies-schemas-and-knowledge-graphs/
- Provides unified view of data in system
- Introduces common terminologies and semantics
- Formal structure of classes or types of objects within a domain
- Static in nature
- Well-suited for basic organization and categorization

### Learning 101: Ontology Characteristics
- **Source**: innodata.com/understanding-the-role-of-taxonomies-ontologies-schemas-and-knowledge-graphs/
- Defines types, properties, and inter-relationships of entities
- Dynamic and domain-centric
- Includes properties like "has fur", "has wings"
- Specifies relationships like "is a predator of", "lives in symbiosis with"
- Ideal for deeper domain knowledge and intricate relationships

### Learning 102: Schema Design for AI
- **Source**: innodata.com/understanding-the-role-of-taxonomies-ontologies-schemas-and-knowledge-graphs/
- Define data structure but inference rules separate
- Machines cannot read, interpret, or make sense of data without structure
- Well-designed taxonomy, ontology, schema fundamental for AI success
- Subject matter expertise and domain knowledge key ingredients
- Taxonomies need to be updated and renewed constantly

## Memory Management

### Learning 103: Memory Management in C++
- **Source**: stackoverflow.com/questions/14539624/memory-management-patterns-in-c
- C++ requires explicit memory management
- Unlike managed languages (Java, C#)
- Need to understand normal and functional design patterns
- Gang of Four patterns apply differently in C++
- Memory leaks and dangling pointers are common issues

### Learning 104: Memory Management Patterns
- **Source**: informit.com/articles/article.aspx?p=30309
- Efficient management of memory as a resource
- Robust sharing of general software resources
- Focus on real-time and embedded systems
- Managing shared resources efficiently and robustly
- Memory patterns for complex system building

## Deduplication Algorithms

### Learning 105: Content-Defined Chunking
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Variable-length chunking based on content
- Rolling hash determines chunk boundaries
- Configurable min, mean, max chunk sizes
- Better deduplication than fixed-size
- Hash & mask == trigger condition

### Learning 106: FastCDC Algorithm
- **Source**: csyhua.github.io/csyhua/hua-tpds2020-dedup.pdf
- Fast and efficient Content-Defined Chunking
- Reduces CPU overhead of byte-by-byte rolling hashes
- Combined use of five key techniques
- Better performance for deduplication-based storage
- Addresses heavy CPU overhead problem

### Learning 107: Deduplication Benefits
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Improves storage space utilization
- Reduces duplicated data
- Stores only single copy
- Important for cloud storage with exploding data demand
- Intel ISA-L provides acceleration

## Data Consistency

### Learning 108: CRDT Conflict Resolution
- **Source**: crdt.tech
- Automatic conflict resolution without user intervention
- Strong eventual consistency
- No need for single server
- Decentralized operation possible
- Peer-to-peer networks supported

### Learning 109: CRDT Use Cases
- **Source**: crdt.tech
- Mobile apps syncing data across devices
- Distributed databases with multiple replicas
- Collaboration software (Google Docs, Trello, Figma)
- Large-scale data storage and processing
- Global scalability through replication

### Learning 110: CRDT vs Alternatives
- **Source**: crdt.tech
- Google Docs, Trello, Figma require server communication
- CRDTs don't assume single server
- CRDTs enable true peer-to-peer
- Operational transformation (OT) alternative
- Choice depends on architecture requirements

## Data Persistence

### Learning 111: Persistent vs Ephemeral
- **Source**: wikipedia.org/wiki/Persistent_data_structure
- Persistent: always preserves previous version when modified
- Ephemeral: not persistent, can be modified in-place
- Persistent structures effectively immutable
- Operations yield new updated structure
- Common in functional programming languages

### Learning 112: Partial Persistence
- **Source**: wikipedia.org/wiki/Persistent_data_structure
- All versions can be accessed
- Only newest version can be modified
- Good for version control with read-only history
- Simpler than full persistence
- Common use case: undo functionality

### Learning 113: Full Persistence
- **Source**: wikipedia.org/wiki/Persistent_data_structure
- Every version can be both accessed and modified
- More complex than partial persistence
- Allows branching and merging
- Useful for complex version control
- Higher memory overhead

## Hashing Techniques

### Learning 114: Rolling Hash
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Efficiently compute hash over sliding window
- Used in content-defined chunking
- Determines chunk boundaries dynamically
- Configurable window size (w parameter)
- Intel ISA-L provides accelerated implementation

### Learning 115: Multi-Buffer Hashing
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Intel ISA-L feature for deduplication
- Accelerated hashing for data deduplication
- Combines chunking and hashing efficiently
- Reduces CPU overhead
- Optimized for Intel architecture

## Compression Algorithms

### Learning 116: LZ4 Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- Extremely fast compression and decompression
- Lower compression ratio than ZSTD
- Ideal for real-time data processing
- Low memory requirements
- Good for systems where speed is critical

### Learning 117: ZSTD Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- Better compression ratio than LZ4
- Slower than LZ4 but still fast
- Tunable compression levels (1-22)
- Good balance of speed and ratio
- Modern algorithm widely adopted

### Learning 118: GZIP Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- DEFLATE algorithm (LZ77 + Huffman)
- Widely supported across platforms
- Moderate compression ratio and speed
- Good compatibility
- CPU intensive at high compression levels

### Learning 119: XZ Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- Based on LZMA2 algorithm
- Highest compression ratio among common formats
- Very slow compression and decompression
- Good for long-term archival
- Not suitable for real-time use

## Data Organization

### Learning 120: Append-Only Benefits
- **Source**: questdb.com/glossary/append-only-log/
- Data integrity through immutability
- Performance through sequential I/O
- Simplicity in implementation
- Natural ordering for time-based queries
- Enables efficient event streaming

### Learning 121: Append-Only Use Cases
- **Source**: questdb.com/glossary/append-only-log/
- Time-series data storage
- Event sourcing
- Transaction logging
- Change data capture (CDC)
- Financial systems
- Event streaming platforms

## Storage Optimization

### Learning 122: Columnar Storage Benefits
- **Source**: wikipedia.org/wiki/Apache_Parquet
- Column-wise compression efficient
- Type-specific encoding per column
- Queries fetch specific columns without reading entire rows
- Better for analytical workloads
- Higher compression ratios than row storage

### Learning 123: Row Storage Benefits
- **Source**: apache arrow documentation
- Better for OLTP workloads
- Efficient for single-row operations
- Better for point lookups
- Lower overhead for small row updates
- More natural for transactional systems

### Learning 124: Storage Format Selection
- **Source**: apache arrow documentation
- Columnar: analytics, data warehousing, BI
- Row: OLTP, transactional systems, operational workloads
- Hybrid: mixed workloads
- Consider query patterns
- Evaluate read vs write ratios
