// ─── ToolResultCache.ts ─────────────────────────────────────────────────
// T5: Tool Result Caching — adds in-memory cache with TTL, invalidation, statistics
//     for better performance when tools are called repeatedly with same args.
// ─────────────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  tool: string;
  args: any;
  result: any;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
  hitCount: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  totalSize: number;
}

/**
 * Tool result cache with TTL support.
 */
export class ToolResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats = { hits: 0, misses: 0 };
  private maxEntries = 1000;
  private defaultTTL = 300000; // 5 minutes default

  /**
   * Generate cache key from tool name and arguments.
   */
  private generateKey(tool: string, args: any): string {
    const argsStr = JSON.stringify(args);
    return `${tool}:${argsStr}`;
  }

  /**
   * Get cached result if available and not expired.
   */
  get(tool: string, args: any): any | null {
    const key = this.generateKey(tool, args);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    const age = now - entry.timestamp.getTime();
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Cache hit
    entry.hitCount++;
    this.stats.hits++;
    return entry.result;
  }

  /**
   * Store result in cache.
   */
  set(tool: string, args: any, result: any, ttl?: number): void {
    const key = this.generateKey(tool, args);
    const entry: CacheEntry = {
      tool,
      args,
      result,
      timestamp: new Date(),
      ttl: ttl ?? this.defaultTTL,
      hitCount: 0
    };

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entry for specific tool and args.
   */
  invalidate(tool: string, args?: any): void {
    if (args) {
      const key = this.generateKey(tool, args);
      this.cache.delete(key);
    } else {
      // Invalidate all entries for this tool
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tool === tool) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Evict oldest entries to make space.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries.
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics.
   */
  getStatistics(): CacheStatistics {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.result).length;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      entries: this.cache.size,
      totalSize
    };
  }

  /**
   * Get cache entries for a specific tool.
   */
  getToolEntries(tool: string): CacheEntry[] {
    return Array.from(this.cache.values()).filter(entry => entry.tool === tool);
  }

  /**
   * Set maximum cache size.
   */
  setMaxEntries(max: number): void {
    this.maxEntries = max;
    while (this.cache.size > this.maxEntries) {
      this.evictOldest();
    }
  }

  /**
   * Set default TTL.
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Get cache size in bytes.
   */
  getSize(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry.result).length;
    }
    return size;
  }

  /**
   * Get top N most frequently accessed entries.
   */
  getTopEntries(limit: number = 10): Array<{ key: string; hitCount: number; tool: string }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hitCount: entry.hitCount, tool: entry.tool }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }
}

// Global instance
export const toolResultCache = new ToolResultCache();

// Periodic cleanup (every 5 minutes)
if (typeof window !== "undefined") {
  setInterval(() => {
    toolResultCache.cleanup();
  }, 300000);
}
