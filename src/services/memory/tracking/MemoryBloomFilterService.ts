/**
 * Memory Bloom Filter Service
 * 
 * Implements Bloom Filter for memory existence checks
 * 
 * Applied Learnings:
 * - Learning 73-74: Data Deduplication for existence checking
 * - Learning 31-33: SQLite WAL for consistent storage
 * - Learning 69-72: Compression Ratio vs Speed Trade-offs
 */

import * as crypto from 'crypto';

export class MemoryBloomFilter {
  private bitArray: Uint8Array;
  private size: number;
  private hashCount: number;
  private itemCount: number;

  constructor(size: number = 10000, hashCount: number = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bitArray = new Uint8Array(Math.ceil(size / 8));
    this.itemCount = 0;
  }

  /**
   * Generate hash values for an item
   */
  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    
    for (let i = 0; i < this.hashCount; i++) {
      const hash = crypto
        .createHash('sha256')
        .update(`${item}-${i}`)
        .digest('hex');
      
      // Convert hex to number and modulo size
      const hashNum = parseInt(hash.substring(0, 8), 16);
      hashes.push(hashNum % this.size);
    }
    
    return hashes;
  }

  /**
   * Add item to bloom filter
   */
  add(item: string): void {
    const hashes = this.getHashes(item);
    
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      this.bitArray[byteIndex] |= (1 << bitIndex);
    }
    
    this.itemCount++;
  }

  /**
   * Check if item might exist in bloom filter
   */
  mightContain(item: string): boolean {
    const hashes = this.getHashes(item);
    
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get estimated false positive rate
   */
  getFalsePositiveRate(): number {
    if (this.itemCount === 0) return 0;
    
    // Formula: (1 - e^(-kn/m))^k
    // where k = hash count, n = item count, m = size
    const k = this.hashCount;
    const n = this.itemCount;
    const m = this.size;
    
    const exponent = (-k * n) / m;
    const probability = Math.pow(1 - Math.exp(exponent), k);
    
    return probability;
  }

  /**
   * Clear the bloom filter
   */
  clear(): void {
    this.bitArray.fill(0);
    this.itemCount = 0;
  }

  /**
   * Get bloom filter statistics
   */
  getStats(): {
    size: number;
    hashCount: number;
    itemCount: number;
    falsePositiveRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.size,
      hashCount: this.hashCount,
      itemCount: this.itemCount,
      falsePositiveRate: this.getFalsePositiveRate(),
      memoryUsage: this.bitArray.length
    };
  }

  /**
   * Serialize bloom filter to buffer
   */
  serialize(): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(this.size, 0);
    header.writeUInt32LE(this.hashCount, 4);
    
    return Buffer.concat([header, Buffer.from(this.bitArray)]);
  }

  /**
   * Deserialize bloom filter from buffer
   */
  static deserialize(buffer: Buffer): MemoryBloomFilter {
    const size = buffer.readUInt32LE(0);
    const hashCount = buffer.readUInt32LE(4);
    const bitArray = new Uint8Array(buffer.slice(8));
    
    const filter = new MemoryBloomFilter(size, hashCount);
    filter.bitArray = bitArray;
    
    // Estimate item count based on set bits
    let setBits = 0;
    for (const byte of bitArray) {
      for (let i = 0; i < 8; i++) {
        if (byte & (1 << i)) {
          setBits++;
        }
      }
    }
    
    // Estimate n from m and set bits: n = -m/k * ln(1 - setBits/m)
    const m = size;
    const k = hashCount;
    const setBitsRatio = setBits / (m / 8 * 8);
    filter.itemCount = Math.floor((-m / k) * Math.log(1 - setBitsRatio));
    
    return filter;
  }
}

// Singleton instance
let memoryBloomFilter: MemoryBloomFilter | null = null;

export function getMemoryBloomFilter(size: number = 10000, hashCount: number = 3): MemoryBloomFilter {
  if (!memoryBloomFilter) {
    memoryBloomFilter = new MemoryBloomFilter(size, hashCount);
  }
  return memoryBloomFilter;
}

export function resetMemoryBloomFilter(): void {
  memoryBloomFilter = null;
}
