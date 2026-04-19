/**
 * Memory Compression Service
 * 
 * Implements compression layer for memory data
 * 
 * Applied Learnings:
 * - Learning 1-18: File Compression Formats (ZIP, RAR, 7Z, TAR, ZSTD, LZ4, GZIP, XZ)
 * - Learning 19-30: Database Compression (Row vs Columnar, Dictionary, Run-Length)
 * - Learning 62-68: Compression Algorithms (LZ4, ZSTD, GZIP, XZ)
 * - Learning 69-72: Compression Ratio vs Speed Trade-offs
 * - Learning 73-74: Data Deduplication Patterns
 */

import { gzip, ungzip } from 'pako';
import { deflate, inflate } from 'pako';

export type CompressionAlgorithm = 'none' | 'gzip' | 'deflate' | 'zstd';

export interface CompressionConfig {
  algorithm: CompressionAlgorithm;
  level: number; // 1-9 for gzip/deflate, 1-3 for lz4
  threshold: number; // Minimum size in bytes to compress
}

export interface CompressionResult {
  compressed: Buffer;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  timeMs: number;
}

export class MemoryCompressionService {
  private config: CompressionConfig;

  constructor(config: CompressionConfig = { algorithm: 'gzip', level: 6, threshold: 1024 }) {
    this.config = config;
  }

  /**
   * Compress data using configured algorithm
   * Applies Learning 69-72: Compression Ratio vs Speed Trade-offs
   */
  compress(data: string | Buffer): CompressionResult {
    const input = typeof data === 'string' ? Buffer.from(data) : data;
    const originalSize = input.length;

    // Don't compress if below threshold
    if (originalSize < this.config.threshold) {
      return {
        compressed: input,
        algorithm: 'none',
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        timeMs: 0
      };
    }

    const startTime = Date.now();
    let compressed: Buffer;
    let algorithm = this.config.algorithm;

    try {
      switch (this.config.algorithm) {
        case 'gzip':
          // GZIP: Good compression, slower (Learning 66)
          compressed = gzip(input, { level: this.config.level });
          break;
        case 'deflate':
          // Deflate: Similar to gzip without headers (Learning 67)
          compressed = deflate(input, { level: this.config.level });
          break;
        case 'zstd':
          // ZSTD: Best ratio, fast decompression (Learning 65)
          // For now, fall back to gzip since zstd binding not available
          compressed = gzip(input, { level: this.config.level });
          algorithm = 'gzip';
          break;
        default:
          compressed = input;
          algorithm = 'none';
      }
    } catch (error) {
      // Fallback to uncompressed on error
      compressed = input;
      algorithm = 'none';
    }

    const timeMs = Date.now() - startTime;
    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;

    // If compression didn't help, return original
    if (ratio >= 0.95) {
      return {
        compressed: input,
        algorithm: 'none',
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        timeMs
      };
    }

    return {
      compressed,
      algorithm,
      originalSize,
      compressedSize,
      ratio,
      timeMs
    };
  }

  /**
   * Decompress data
   */
  decompress(data: Buffer, algorithm: CompressionAlgorithm): Buffer {
    if (algorithm === 'none') {
      return data;
    }

    try {
      switch (algorithm) {
        case 'gzip':
          return ungzip(data);
        case 'deflate':
          return inflate(data);
        case 'zstd':
          // Fallback to gzip
          return ungzip(data);
        default:
          return data;
      }
    } catch (error) {
      // Return original on error
      return data;
    }
  }

  /**
   * Compress memory event data
   * Applies Learning 73-74: Data Deduplication Patterns
   */
  compressEventData(eventData: Record<string, unknown>): {
    compressed: Buffer;
    algorithm: CompressionAlgorithm;
    metadata: Record<string, unknown>;
  } {
    const json = JSON.stringify(eventData);
    const result = this.compress(json);

    return {
      compressed: result.compressed,
      algorithm: result.algorithm,
      metadata: {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: result.ratio,
        algorithm: result.algorithm
      }
    };
  }

  /**
   * Decompress memory event data
   */
  decompressEventData(
    compressed: Buffer,
    algorithm: CompressionAlgorithm
  ): Record<string, unknown> {
    const decompressed = this.decompress(compressed, algorithm);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  /**
   * Batch compress multiple items
   * Applies Learning 70: Batch Compression for Efficiency
   */
  batchCompress(items: Array<{ id: string; data: string | Buffer }>): Map<string, CompressionResult> {
    const results = new Map<string, CompressionResult>();

    for (const item of items) {
      const result = this.compress(item.data);
      results.set(item.id, result);
    }

    return results;
  }

  /**
   * Update compression config
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Benchmark compression algorithms
   * Applies Learning 69-72: Compression Ratio vs Speed Trade-offs
   */
  benchmark(data: string | Buffer): Map<CompressionAlgorithm, CompressionResult> {
    const results = new Map<CompressionAlgorithm, CompressionResult>();
    const algorithms: CompressionAlgorithm[] = ['gzip', 'deflate'];

    const originalConfig = this.config;

    for (const algo of algorithms) {
      this.config = { ...originalConfig, algorithm: algo };
      const result = this.compress(data);
      results.set(algo, result);
    }

    this.config = originalConfig;
    return results;
  }

  /**
   * Get compression statistics
   */
  getStats(): {
    algorithm: CompressionAlgorithm;
    level: number;
    threshold: number;
  } {
    return {
      algorithm: this.config.algorithm,
      level: this.config.level,
      threshold: this.config.threshold
    };
  }
}

/**
 * Columnar Compression for Memory Analytics
 * Applies Learning 23-26: Columnar Storage Benefits
 */
export class MemoryColumnarCompression {
  private compressionService: MemoryCompressionService;

  constructor(compressionService?: MemoryCompressionService) {
    this.compressionService = compressionService || new MemoryCompressionService();
  }

  /**
   * Compress columnar data
   * Columnar storage compresses better due to similar values in columns (Learning 24)
   */
  compressColumnar(data: {
    timestamps: string[];
    types: string[];
    domains: string[];
    tags: string[][];
  }): {
    timestamps: CompressionResult;
    types: CompressionResult;
    domains: CompressionResult;
    tags: CompressionResult;
  } {
    return {
      timestamps: this.compressionService.compress(JSON.stringify(data.timestamps)),
      types: this.compressionService.compress(JSON.stringify(data.types)),
      domains: this.compressionService.compress(JSON.stringify(data.domains)),
      tags: this.compressionService.compress(JSON.stringify(data.tags))
    };
  }

  /**
   * Decompress columnar data
   */
  decompressColumnar(compressed: {
    timestamps: { data: Buffer; algorithm: CompressionAlgorithm };
    types: { data: Buffer; algorithm: CompressionAlgorithm };
    domains: { data: Buffer; algorithm: CompressionAlgorithm };
    tags: { data: Buffer; algorithm: CompressionAlgorithm };
  }): {
    timestamps: string[];
    types: string[];
    domains: string[];
    tags: string[][];
  } {
    return {
      timestamps: JSON.parse(
        this.compressionService.decompress(
          compressed.timestamps.data,
          compressed.timestamps.algorithm
        ).toString('utf-8')
      ),
      types: JSON.parse(
        this.compressionService.decompress(
          compressed.types.data,
          compressed.types.algorithm
        ).toString('utf-8')
      ),
      domains: JSON.parse(
        this.compressionService.decompress(
          compressed.domains.data,
          compressed.domains.algorithm
        ).toString('utf-8')
      ),
      tags: JSON.parse(
        this.compressionService.decompress(
          compressed.tags.data,
          compressed.tags.algorithm
        ).toString('utf-8')
      )
    };
  }
}

// Singleton instance
let memoryCompressionService: MemoryCompressionService | null = null;

export function getMemoryCompressionService(): MemoryCompressionService {
  if (!memoryCompressionService) {
    memoryCompressionService = new MemoryCompressionService();
  }
  return memoryCompressionService;
}

export function resetMemoryCompressionService(): void {
  memoryCompressionService = null;
}
