/**
 * Memory Content-Addressable Storage Service
 * 
 * Implements content-addressable storage for memory deduplication
 * 
 * Applied Learnings:
 * - Learning 73-74: Data Deduplication Patterns
 * - Learning 31-33: SQLite WAL for consistent storage
 * - Learning 62-68: Compression Algorithms for storage optimization
 */

import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { getMemoryCompressionService } from './MemoryCompressionService';

export interface ContentAddress {
  hash: string;
  size: number;
  compressedSize: number;
  algorithm: string;
  timestamp: string;
  referenceCount: number;
}

export class MemoryContentAddressableStorage {
  private db: Database.Database;
  private compressionService = getMemoryCompressionService();

  constructor(dbPath: string = '.taqwin/memory/cas.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create content table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content (
        hash TEXT PRIMARY KEY,
        data BLOB NOT NULL,
        size INTEGER NOT NULL,
        compressed_size INTEGER NOT NULL,
        algorithm TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reference_count INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_size ON content(size)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at)
    `);
  }

  /**
   * Calculate content hash (SHA-256)
   */
  private calculateHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store content with deduplication
   */
  async storeContent(data: string | Buffer, compress: boolean = true): Promise<ContentAddress> {
    const input = typeof data === 'string' ? Buffer.from(data) : data;
    const originalSize = input.length;

    // Calculate hash
    const hash = this.calculateHash(input);

    // Check if content already exists
    const existing = this.db.prepare('SELECT * FROM content WHERE hash = ?').get(hash) as any;
    if (existing) {
      // Increment reference count
      this.db.prepare('UPDATE content SET reference_count = reference_count + 1 WHERE hash = ?').run(hash);
      return {
        hash,
        size: existing.size,
        compressedSize: existing.compressed_size,
        algorithm: existing.algorithm,
        timestamp: existing.created_at,
        referenceCount: existing.reference_count + 1
      };
    }

    // Compress content
    const compressionResult = compress ? this.compressionService.compress(input) : {
      compressed: input,
      algorithm: 'none' as const,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      timeMs: 0
    };

    // Store content
    const stmt = this.db.prepare(`
      INSERT INTO content (hash, data, size, compressed_size, algorithm, created_at, reference_count)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    stmt.run(
      hash,
      compressionResult.compressed,
      originalSize,
      compressionResult.compressedSize,
      compressionResult.algorithm,
      new Date().toISOString()
    );

    return {
      hash,
      size: originalSize,
      compressedSize: compressionResult.compressedSize,
      algorithm: compressionResult.algorithm,
      timestamp: new Date().toISOString(),
      referenceCount: 1
    };
  }

  /**
   * Retrieve content by hash
   */
  async retrieveContent(hash: string): Promise<Buffer | null> {
    const row = this.db.prepare('SELECT * FROM content WHERE hash = ?').get(hash) as any;
    if (!row) return null;

    // Decompress if needed
    if (row.algorithm === 'none') {
      return row.data;
    }

    return this.compressionService.decompress(row.data, row.algorithm);
  }

  /**
   * Delete content (decrement reference count)
   */
  async deleteContent(hash: string): Promise<boolean> {
    const row = this.db.prepare('SELECT * FROM content WHERE hash = ?').get(hash) as any;
    if (!row) return false;

    if (row.reference_count > 1) {
      // Decrement reference count
      this.db.prepare('UPDATE content SET reference_count = reference_count - 1 WHERE hash = ?').run(hash);
      return true;
    }

    // Delete content
    this.db.prepare('DELETE FROM content WHERE hash = ?').run(hash);
    return true;
  }

  /**
   * Get content metadata
   */
  getContentMetadata(hash: string): ContentAddress | null {
    const row = this.db.prepare('SELECT * FROM content WHERE hash = ?').get(hash) as any;
    if (!row) return null;

    return {
      hash: row.hash,
      size: row.size,
      compressedSize: row.compressed_size,
      algorithm: row.algorithm,
      timestamp: row.created_at,
      referenceCount: row.reference_count
    };
  }

  /**
   * List all content
   */
  listContent(limit: number = 100, offset: number = 0): ContentAddress[] {
    const rows = this.db.prepare(`
      SELECT hash, size, compressed_size, algorithm, created_at, reference_count
      FROM content
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    return rows.map(row => ({
      hash: row.hash,
      size: row.size,
      compressedSize: row.compressed_size,
      algorithm: row.algorithm,
      timestamp: row.created_at,
      referenceCount: row.reference_count
    }));
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalContent: number;
    totalSize: number;
    totalCompressedSize: number;
    deduplicationRatio: number;
    avgReferenceCount: number;
  } {
    const totalContent = this.db.prepare('SELECT COUNT(*) as count FROM content').get() as { count: number };
    const sizeStats = this.db.prepare(`
      SELECT SUM(size) as total_size, SUM(compressed_size) as total_compressed_size, AVG(reference_count) as avg_ref_count
      FROM content
    `).get() as any;

    return {
      totalContent: totalContent.count,
      totalSize: sizeStats.total_size || 0,
      totalCompressedSize: sizeStats.total_compressed_size || 0,
      deduplicationRatio: sizeStats.total_size > 0 
        ? sizeStats.total_compressed_size / sizeStats.total_size 
        : 1,
      avgReferenceCount: sizeStats.avg_ref_count || 0
    };
  }

  /**
   * Find duplicate content (content with reference count > 1)
   */
  findDuplicates(): Array<{ hash: string; referenceCount: number; size: number }> {
    const rows = this.db.prepare(`
      SELECT hash, reference_count, size
      FROM content
      WHERE reference_count > 1
      ORDER BY reference_count DESC
    `).all() as any[];

    return rows.map(row => ({
      hash: row.hash,
      referenceCount: row.reference_count,
      size: row.size
    }));
  }

  /**
   * Clean unused content (reference count = 0)
   */
  cleanUnused(): number {
    const result = this.db.prepare('DELETE FROM content WHERE reference_count = 0').run();
    return result.changes;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let memoryCAS: MemoryContentAddressableStorage | null = null;

export function getMemoryContentAddressableStorage(): MemoryContentAddressableStorage {
  if (!memoryCAS) {
    memoryCAS = new MemoryContentAddressableStorage();
  }
  return memoryCAS;
}

export function resetMemoryContentAddressableStorage(): void {
  if (memoryCAS) {
    memoryCAS.close();
    memoryCAS = null;
  }
}
