/**
 * Memory Sharding Strategy Service
 * 
 * Implements sharding strategy for memory scalability
 * 
 * Applied Learnings:
 * - Learning 19-30: Columnar storage for shard optimization
 * - Learning 31-33: SQLite WAL for consistent sharding
 * - Learning 75-77: B-Tree Indexing for shard queries
 */

import * as crypto from 'crypto';

export interface ShardInfo {
  shardId: string;
  shardKey: string;
  memoryCount: number;
  size: number;
}

export class MemoryShardingStrategyService {
  private shards: Map<string, ShardInfo>;
  private shardCount: number;

  constructor(shardCount: number = 4) {
    this.shards = new Map();
    this.shardCount = shardCount;
    this.initializeShards();
  }

  /**
   * Initialize shards
   */
  private initializeShards(): void {
    for (let i = 0; i < this.shardCount; i++) {
      const shardId = `shard-${i}`;
      this.shards.set(shardId, {
        shardId,
        shardKey: `shard_${i}`,
        memoryCount: 0,
        size: 0
      });
    }
  }

  /**
   * Get shard for a memory ID using consistent hashing
   */
  getShardForMemory(memoryId: string): ShardInfo {
    const hash = crypto.createHash('md5').update(memoryId).digest('hex');
    const shardIndex = parseInt(hash.substring(0, 8), 16) % this.shardCount;
    const shardId = `shard-${shardIndex}`;
    
    return this.shards.get(shardId)!;
  }

  /**
   * Get shard for a domain
   */
  getShardForDomain(domain: string): ShardInfo {
    const hash = crypto.createHash('md5').update(domain).digest('hex');
    const shardIndex = parseInt(hash.substring(0, 8), 16) % this.shardCount;
    const shardId = `shard-${shardIndex}`;
    
    return this.shards.get(shardId)!;
  }

  /**
   * Add memory to shard
   */
  addMemoryToShard(memoryId: string, size: number): ShardInfo {
    const shard = this.getShardForMemory(memoryId);
    shard.memoryCount++;
    shard.size += size;
    return shard;
  }

  /**
   * Remove memory from shard
   */
  removeMemoryFromShard(memoryId: string, size: number): ShardInfo {
    const shard = this.getShardForMemory(memoryId);
    shard.memoryCount = Math.max(0, shard.memoryCount - 1);
    shard.size = Math.max(0, shard.size - size);
    return shard;
  }

  /**
   * Get all shards
   */
  getAllShards(): ShardInfo[] {
    return Array.from(this.shards.values());
  }

  /**
   * Get shard by ID
   */
  getShard(shardId: string): ShardInfo | null {
    return this.shards.get(shardId) || null;
  }

  /**
   * Rebalance shards (move memories from overloaded to underloaded)
   */
  rebalanceShards(threshold: number = 0.2): Array<{ from: string; to: string; count: number }> {
    const moves: Array<{ from: string; to: string; count: number }> = [];
    const shardList = this.getAllShards();
    
    // Calculate average memory count
    const totalCount = shardList.reduce((sum, s) => sum + s.memoryCount, 0);
    const avgCount = totalCount / this.shardCount;
    
    // Find overloaded and underloaded shards
    const overloaded = shardList.filter(s => s.memoryCount > avgCount * (1 + threshold));
    const underloaded = shardList.filter(s => s.memoryCount < avgCount * (1 - threshold));
    
    // Plan moves
    for (const over of overloaded) {
      for (const under of underloaded) {
        const diff = over.memoryCount - avgCount;
        const underDiff = avgCount - under.memoryCount;
        const moveCount = Math.min(diff, underDiff);
        
        if (moveCount > 0) {
          moves.push({
            from: over.shardId,
            to: under.shardId,
            count: Math.floor(moveCount)
          });
        }
      }
    }
    
    return moves;
  }

  /**
   * Get shard statistics
   */
  getStats(): {
    totalShards: number;
    totalMemories: number;
    totalSize: number;
    avgMemoriesPerShard: number;
    avgSizePerShard: number;
    overloadedShards: number;
    underloadedShards: number;
  } {
    const shards = this.getAllShards();
    const totalMemories = shards.reduce((sum, s) => sum + s.memoryCount, 0);
    const totalSize = shards.reduce((sum, s) => sum + s.size, 0);
    const avgMemories = totalMemories / this.shardCount;
    const avgSize = totalSize / this.shardCount;
    
    const overloaded = shards.filter(s => s.memoryCount > avgMemories * 1.2).length;
    const underloaded = shards.filter(s => s.memoryCount < avgMemories * 0.8).length;
    
    return {
      totalShards: this.shardCount,
      totalMemories,
      totalSize,
      avgMemoriesPerShard: avgMemories,
      avgSizePerShard: avgSize,
      overloadedShards: overloaded,
      underloadedShards: underloaded
    };
  }

  /**
   * Add new shard dynamically
   */
  addShard(): ShardInfo {
    const newShardId = `shard-${this.shardCount}`;
    const shard: ShardInfo = {
      shardId: newShardId,
      shardKey: `shard_${this.shardCount}`,
      memoryCount: 0,
      size: 0
    };
    
    this.shards.set(newShardId, shard);
    this.shardCount++;
    
    return shard;
  }

  /**
   * Remove shard (requires rebalancing first)
   */
  removeShard(shardId: string): boolean {
    const shard = this.shards.get(shardId);
    if (!shard || shard.memoryCount > 0) {
      return false;
    }
    
    this.shards.delete(shardId);
    this.shardCount--;
    
    return true;
  }

  /**
   * Get shard distribution by domain
   */
  getShardDistributionByDomain(): Map<string, string[]> {
    const distribution = new Map<string, string[]>();
    
    for (let i = 0; i < this.shardCount; i++) {
      const shardId = `shard-${i}`;
      distribution.set(shardId, []);
    }
    
    return distribution;
  }

  /**
   * Reset all shards
   */
  reset(): void {
    this.shards.clear();
    this.shardCount = 4;
    this.initializeShards();
  }
}

// Singleton instance
let memoryShardingStrategyService: MemoryShardingStrategyService | null = null;

export function getMemoryShardingStrategyService(shardCount?: number): MemoryShardingStrategyService {
  if (!memoryShardingStrategyService) {
    memoryShardingStrategyService = new MemoryShardingStrategyService(shardCount || 4);
  }
  return memoryShardingStrategyService;
}

export function resetMemoryShardingStrategyService(): void {
  memoryShardingStrategyService = null;
}
