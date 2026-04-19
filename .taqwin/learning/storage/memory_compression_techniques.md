# Memory Compression Techniques - Learnings

## File Compression Formats

### Learning 1: ZIP Format
- **Source**: iformat.io/blog/file-compression-formats-complete-guide
- ZIP is a versatile archive format supporting multiple compression algorithms
- Best for general-purpose archiving and email attachments
- Supports spanning across multiple volumes
- Compatible across all major operating systems

### Learning 2: RAR Format
- **Source**: iformat.io/blog/file-compression-formats-complete-guide
- RAR provides better compression ratios than ZIP in many cases
- Proprietary format with advanced features like error recovery
- Supports solid compression for better ratios on similar files
- Not as widely supported as ZIP due to licensing

### Learning 3: 7Z Format
- **Source**: iformat.io/blog/file-compression-formats-complete-guide
- 7-Zip format offers superior compression ratios
- Open-source with LZMA and LZMA2 algorithms
- Supports high compression levels for archival purposes
- Slower compression/decompression than ZIP but better space savings

### Learning 4: TAR Format
- **Source**: iformat.io/blog/file-compression-formats-complete-guide
- TAR is an archive format, not a compression format itself
- Typically combined with gzip (tar.gz) or bzip2 (tar.bz2)
- Preserves file permissions and metadata
- Native to Unix/Linux systems

### Learning 5: ZSTD (Zstandard)
- **Source**: iformat.io/blog/file-compression-formats-complete-guide
- Modern compression algorithm offering excellent balance
- Faster than gzip with comparable or better compression
- Tunable compression levels from 1-22
- Widely adopted in modern systems and databases

## Database Compression Techniques

### Learning 6: LZ-Based Compression
- **Source**: usavps.com/blog/database-compression-techniques/
- LZ77 family algorithms (LZ4, LZMA, ZSTD) use dictionary coding
- Excellent for compressing repetitive data patterns
- Fast decompression speeds suitable for OLTP workloads
- LZ4 prioritizes speed over compression ratio
- ZSTD offers better ratio with acceptable speed

### Learning 7: Entropy Coding
- **Source**: usavps.com/blog/database-compression-techniques/
- Huffman encoding and arithmetic coding for further compression
- Works well after LZ-based compression as a second pass
- Exploits statistical properties of data
- Higher CPU cost but better space savings

### Learning 8: Run-Length Encoding (RLE)
- **Source**: usavps.com/blog/database-compression-techniques/
- Effective for data with repeated values or long runs
- Simple and fast to implement
- Best for sorted data or data with low cardinality
- Limited effectiveness on random data

### Learning 9: Delta Encoding
- **Source**: usavps.com/blog/database-compression-techniques/
- Stores differences between consecutive values instead of absolute values
- Highly effective for time-series and sequential data
- Works well with numeric data that changes incrementally
- Often combined with other compression techniques

### Learning 10: Dictionary Encoding
- **Source**: usavps.com/blog/database-compression-techniques/
- Replaces repeated values with dictionary references
- Excellent for low-cardinality columns
- Reduces storage by storing unique values once
- Used extensively in columnar databases

### Learning 11: Page/Block Compression
- **Source**: usavps.com/blog/database-compression-techniques/
- Compresses entire database pages or blocks
- Good balance of compression ratio and performance
- Reduces I/O by reading fewer compressed pages
- Common in PostgreSQL, SQL Server, and Oracle

### Learning 12: Row/Tuple Compression
- **Source**: usavps.com/blog/database-compression-techniques/
- Compresses individual rows or tuples
- More granular than page compression
- Can achieve better ratios for heterogeneous data
- Higher CPU overhead due to per-row operations

### Learning 13: Columnar Compression
- **Source**: usavps.com/blog/database-compression-techniques/
- Compresses columns independently in columnar databases
- Enables encoding techniques specific to data types
- Highly effective for analytics workloads
- Used in Redshift, Snowflake, BigQuery

### Learning 14: LSM-Tree Compression
- **Source**: usavps.com/blog/database-compression-techniques/
- Compression applied during SSTable compaction in LSM trees
- Reduces write amplification by compressing before writes
- RocksDB and LevelDB use this extensively
- Balances write performance with space savings

### Learning 15: Compression Granularity Selection
- **Source**: usavps.com/blog/database-compression-techniques/
- OLTP workloads: prefer fast block/row compression (LZ4/Snappy)
- OLAP workloads: prefer columnar compression with advanced codecs
- Key-value stores: lightweight DB-native schemes
- Trade-off between compression ratio, CPU cost, and access patterns

### Learning 16: Compression Strategy Selection
- **Source**: usavps.com/blog/database-compression-techniques/
- Profile workload to determine I/O-bound vs CPU-bound
- Test multiple compressors and settings with real data
- Consider hardware acceleration (CPU instructions)
- Monitor continuously for regressions
- Staged rollout starting with non-critical tables

## Binary Serialization Formats

### Learning 17: Protocol Buffers (Protobuf)
- **Source**: cloudthat.com/resources/blog/optimizing-api-performance-with-protocol-buffers-flatbuffers-messagepack-and-cbor
- Google's compact binary serialization format
- Schema-based with .proto files
- Up to 80% smaller payloads than JSON
- Precompiled code for fast serialization/deserialization
- Foundation of gRPC

### Learning 18: FlatBuffers
- **Source**: cloudthat.com/resources/blog/optimizing-api-performance-with-protocol-buffers-flatbuffers-messagepack-and-cbor
- Zero-copy deserialization - access data directly from buffer
- No parsing overhead, excellent for real-time systems
- Ideal for gaming, IoT, edge computing
- Low memory usage, high throughput
- Can cut message size and CPU by 60-80%

### Learning 19: MessagePack
- **Source**: cloudthat.com/resources/blog/optimizing-api-performance-with-protocol-buffers-flatbuffers-messagepack-and-cbor
- "Binary JSON" - maintains JSON structure in binary format
- No schema required, easy migration from JSON
- 50-70% smaller payloads than JSON
- Minimal code changes to adopt
- Good for Lambda, API Gateway, Kinesis

### Learning 20: CBOR (Concise Binary Object Representation)
- **Source**: cloudthat.com/resources/blog/optimizing-api-performance-with-protocol-buffers-flatbuffers-messagepack-and-cbor
- Binary JSON with extended data types
- IETF standard (RFC 7049)
- Self-describing like JSON but compact
- Supports rich data types beyond JSON
- Good for constrained environments

## Compression Algorithm Performance

### Learning 21: LZ4 vs ZSTD Trade-offs
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- LZ4 is significantly faster than ZSTD
- ZSTD compresses more but slower
- LZ4 ideal for real-time data processing
- ZSTD better for archival storage
- Choice depends on whether compression algorithm is the bottleneck

### Learning 22: XZ Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- Based on LZMA2 algorithm
- High compression ratio but slow
- Good for long-term storage
- Not suitable for real-time use
- CPU intensive compression

### Learning 23: GZIP Compression
- **Source**: forum.puppylinux.com/viewtopic.php?t=8375
- Widely supported, good compatibility
- Moderate compression ratio and speed
- DEFLATE algorithm (LZ77 + Huffman)
- Good balance for general use
- Can be CPU intensive at high levels

## Content-Addressable Storage

### Learning 24: CAS Fundamentals
- **Source**: wikipedia.org/wiki/Content-addressable_storage
- Data addressed by content hash rather than location
- Immutable storage - data never modified in place
- Natural deduplication - identical content shares storage
- Used by Git, Docker registries, IPFS
- Enables verifiable data replication

### Learning 25: CAS Benefits
- **Source**: lab.abilian.com/Tech/Databases%20&%20Persistence/Content%20Addressable%20Storage%20(CAS)/
- Immutability and auditability
- Deduplication capabilities
- Effective for backup and archiving
- Underpins distributed systems like IPFS
- Fundamental to container registries

## Data Deduplication

### Learning 26: Content-Defined Chunking
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Variable-length chunking based on content patterns
- Rolling hash determines chunk boundaries
- Better deduplication than fixed-size chunks
- Configurable min, mean, max chunk sizes
- Hash & mask == trigger condition for boundaries

### Learning 27: FastCDC Algorithm
- **Source**: csyhua.github.io/csyhua/hua-tpds2020-dedup.pdf
- Fast and efficient Content-Defined Chunking
- Reduces CPU overhead compared to traditional CDC
- Combined use of five key techniques
- Better performance for deduplication-based storage
- Addresses heavy CPU overhead of byte-by-byte rolling hashes

### Learning 28: Multi-Buffer Hashing
- **Source**: intel.com/content/www/us/en/developer/articles/technical/accelerate-data-deduplication-using-chunking-and-hashing-functions.html
- Intel ISA-L provides accelerated hashing
- Combines chunking and hashing efficiently
- Reduces CPU overhead for deduplication
- Optimized for Intel architecture
- Can accelerate from small NAS to enterprise storage

## Columnar Storage

### Learning 29: Apache Parquet
- **Source**: wikipedia.org/wiki/Apache_Parquet
- Columnar storage format using record-shredding and assembly
- Values in each column stored in contiguous memory
- Efficient column-wise compression
- Type-specific encoding per column
- Queries fetch specific columns without reading entire rows
- Supports snappy, gzip, LZO, brotli, zstd, LZ4 compression

### Learning 30: Columnar vs Row Storage
- **Source**: apache arrow documentation
- Columnar: better for analytics, range queries on columns
- Row storage: better for OLTP, single-row operations
- Columnar enables vectorized operations
- Columnar has higher compression ratios
- Choice depends on workload pattern

## SQLite Optimization

### Learning 31: WAL Mode
- **Source**: phiresky.github.io/blog/2020/sqlite-performance-tuning/
- Write-Ahead Logging allows concurrent readers during writes
- Instead of writing directly to DB, write to WAL then commit
- Significantly improves performance for concurrent access
- Normal synchronous mode still corruption-safe in WAL
- Off synchronous can cause corruption but faster

### Learning 32: Memory Mapping
- **Source**: phiresky.github.io/blog/2020/sqlite-performance-tuning/
- mmap_size pragma enables memory mapping
- Uses OS page cache instead of read/write syscalls
- Less syscalls, better performance
- OS manages page eviction
- Set to ~30GB for large databases
- Only first part memory-mapped if DB larger than mmap_size

### Learning 33: Page Size Optimization
- **Source**: phiresky.github.io/blog/2020/sqlite-performance-tuning/
- Increase page size to 32768 for large blobs
- Improves performance and DB size for blob storage
- Increases write overhead (always replaces whole pages)
- Only useful for large data, not small rows
- Trade-off between read and write performance

## Append-Only Log

### Learning 34: Append-Only Log Design
- **Source**: questdb.com/glossary/append-only-log/
- Sequential storage with monotonically increasing identifiers
- Natural timeline of events
- Ideal for time-series, event sourcing, transaction logging
- Sequential writes faster than random access
- Immutable nature eliminates write conflicts

### Learning 35: Append-Only Benefits
- **Source**: questdb.com/glossary/append-only-log/
- Data integrity through immutability
- Performance through sequential I/O
- Simplicity in implementation
- Natural ordering for time-based queries
- Enables efficient event streaming
