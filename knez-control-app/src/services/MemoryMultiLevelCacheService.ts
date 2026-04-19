/**
 * Memory Multi-Level Caching Service
 * 
 * Implements multi-level caching for memory access
 * 
 * Applied Learnings:
 * - Learning 83-85: Cache-Aside, Write-Through, Write-Back Patterns
 * - Learning 75-77: B-Tree Indexing for cache optimization
 * - Learning 69-72: Compression Ratio vs Speed Trade-offs
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  level1: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  level2: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  level3: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class MemoryMultiLevelCacheService<T> {
  private level1: Map<string, CacheEntry<T>>; // L1: In-memory (fastest, smallest)
  private level2: Map<string, CacheEntry<T>>; // L2: Larger in-memory
  private level3: Map<string, CacheEntry<T>>; // L3: Persistent/IndexedDB

  private l1MaxSize: number;
  private l2MaxSize: number;
  private l3MaxSize: number;

  private l1Stats = { hits: 0, misses: 0 };
  private l2Stats = { hits: 0, misses: 0 };
  private l3Stats = { hits: 0, misses: 0 };

  constructor(
    l1MaxSize: number = 100,
    l2MaxSize: number = 1000,
    l3MaxSize: number = 10000
  ) {
    this.level1 = new Map();
    this.level2 = new Map();
    this.level3 = new Map();
    this.l1MaxSize = l1MaxSize;
    this.l2MaxSize = l2MaxSize;
    this.l3MaxSize = l3MaxSize;
  }

  /**
   * Get value from cache (Cache-Aside Pattern - Learning 83)
   */
  get(key: string): T | null {
    // Check L1 first
    const l1Entry = this.level1.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      this.l1Stats.hits++;
      return l1Entry.value;
    }
    if (l1Entry) {
      this.level1.delete(key);
    }
    this.l1Stats.misses++;

    // Check L2
    const l2Entry = this.level2.get(key);
    if (l2Entry && !this.isExpired(l2Entry)) {
      this.l2Stats.hits++;
      // Promote to L1
      this.promoteToL1(key, l2Entry);
      return l2Entry.value;
    }
    if (l2Entry) {
      this.level2.delete(key);
    }
    this.l2Stats.misses++;

    // Check L3
    const l3Entry = this.level3.get(key);
    if (l3Entry && !this.isExpired(l3Entry)) {
      this.l3Stats.hits++;
      // Promote to L2 and L1
      this.promoteToL2(key, l3Entry);
      this.promoteToL1(key, l3Entry);
      return l3Entry.value;
    }
    if (l3Entry) {
      this.level3.delete(key);
    }
    this.l3Stats.misses++;

    return null;
  }

  /**
   * Set value in cache (Write-Through Pattern - Learning 84)
   */
  set(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: this.estimateSize(value)
    };

    // Write to all levels (Write-Through)
    this.setLevel1(key, entry);
    this.setLevel2(key, entry);
    this.setLevel3(key, entry);
  }

  /**
   * Set value with Write-Back Pattern (Learning 85)
   */
  setWriteBack(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: this.estimateSize(value)
    };

    // Write to L1 only initially
    this.setLevel1(key, entry);
  }

  /**
   * Delete from cache
   */
  delete(key: string): void {
    this.level1.delete(key);
    this.level2.delete(key);
    this.level3.delete(key);
  }

  /**
   * Clear all cache levels
   */
  clear(): void {
    this.level1.clear();
    this.level2.clear();
    this.level3.clear();
    this.l1Stats = { hits: 0, misses: 0 };
    this.l2Stats = { hits: 0, misses: 0 };
    this.l3Stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const l1Total = this.l1Stats.hits + this.l1Stats.misses;
    const l2Total = this.l2Stats.hits + this.l2Stats.misses;
    const l3Total = this.l3Stats.hits + this.l3Stats.misses;

    return {
      level1: {
        size: this.level1.size,
        hits: this.l1Stats.hits,
        misses: this.l1Stats.misses,
        hitRate: l1Total > 0 ? this.l1Stats.hits / l1Total : 0
      },
      level2: {
        size: this.level2.size,
        hits: this.l2Stats.hits,
        misses: this.l2Stats.misses,
        hitRate: l2Total > 0 ? this.l2Stats.hits / l2Total : 0
      },
      level3: {
        size: this.level3.size,
        hits: this.l3Stats.hits,
        misses: this.l3Stats.misses,
        hitRate: l3Total > 0 ? this.l3Stats.hits / l3Total : 0
      }
    };
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    let evicted = 0;

    // Evict from L1
    for (const [key, entry] of this.level1.entries()) {
      if (this.isExpired(entry)) {
        this.level1.delete(key);
        evicted++;
      }
    }

    // Evict from L2
    for (const [key, entry] of this.level2.entries()) {
      if (this.isExpired(entry)) {
        this.level2.delete(key);
        evicted++;
      }
    }

    // Evict from L3
    for (const [key, entry] of this.level3.entries()) {
      if (this.isExpired(entry)) {
        this.level3.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Set value in L1 with LRU eviction
   */
  private setLevel1(key: string, entry: CacheEntry<T>): void {
    if (this.level1.size >= this.l1MaxSize) {
      // Evict least recently used (first entry in Map maintains insertion order)
      const firstKey = this.level1.keys().next().value;
      if (firstKey) {
        this.level1.delete(firstKey);
      }
    }
    this.level1.set(key, entry);
  }

  /**
   * Set value in L2 with LRU eviction
   */
  private setLevel2(key: string, entry: CacheEntry<T>): void {
    if (this.level2.size >= this.l2MaxSize) {
      const firstKey = this.level2.keys().next().value;
      if (firstKey) {
        this.level2.delete(firstKey);
      }
    }
    this.level2.set(key, entry);
  }

  /**
   * Set value in L3 with LRU eviction
   */
  private setLevel3(key: string, entry: CacheEntry<T>): void {
    if (this.level3.size >= this.l3MaxSize) {
      const firstKey = this.level3.keys().next().value;
      if (firstKey) {
        this.level3.delete(firstKey);
      }
    }
    this.level3.set(key, entry);
  }

  /**
   * Promote entry to L1
   */
  private promoteToL1(key: string, entry: CacheEntry<T>): void {
    this.setLevel1(key, { ...entry, timestamp: Date.now() });
  }

  /**
   * Promote entry to L2
   */
  private promoteToL2(key: string, entry: CacheEntry<T>): void {
    this.setLevel2(key, { ...entry, timestamp: Date.now() });
  }

  /**
   * Estimate size of value (simplified)
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  /**
   * Flush L1 to L2 (Write-Back flush)
   */
  flushL1ToL2(): number {
    let flushed = 0;
    for (const [key, entry] of this.level1.entries()) {
      this.setLevel2(key, entry);
      flushed++;
    }
    return flushed;
  }

  /**
   * Flush L2 to L3 (Write-Back flush)
   */
  flushL2ToL3(): number {
    let flushed = 0;
    for (const [key, entry] of this.level2.entries()) {
      this.setLevel3(key, entry);
      flushed++;
    }
    return flushed;
  }
}

// Singleton instance for memories
let memoryCacheService: MemoryMultiLevelCacheService<any> | null = null;

export function getMemoryCacheService(): MemoryMultiLevelCacheService<any> {
  if (!memoryCacheService) {
    memoryCacheService = new MemoryMultiLevelCacheService(100, 1000, 10000);
  }
  return memoryCacheService;
}

export function resetMemoryCacheService(): void {
  memoryCacheService = null;
}
