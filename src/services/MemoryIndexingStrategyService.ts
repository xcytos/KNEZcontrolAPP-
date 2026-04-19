/**
 * Memory Database Indexing Strategy Service
 * 
 * Implements indexing strategy for memory queries
 * 
 * Applied Learnings:
 * - Learning 75-77: B-Tree Indexing for query optimization
 * - Learning 31-33: SQLite WAL for consistent indexing
 * - Learning 19-30: Columnar storage benefits for analytics
 */

import Database from 'better-sqlite3';

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'fulltext';
  unique: boolean;
  where?: string;
}

export interface IndexStats {
  name: string;
  table: string;
  columns: string[];
  size: number;
  rowCount: number;
  usage: number;
}

export class MemoryIndexingStrategyService {
  private db: Database.Database;

  constructor(dbPath: string = '.taqwin/memory/events.db') {
    this.db = new Database(dbPath);
  }

  /**
   * Create B-Tree index for column (Learning 75)
   */
  createBTreeIndex(table: string, column: string, unique: boolean = false): void {
    const indexName = `idx_${table}_${column}`;
    const uniqueClause = unique ? 'UNIQUE' : '';
    
    this.db.exec(`
      CREATE ${uniqueClause} INDEX IF NOT EXISTS ${indexName}
      ON ${table} (${column})
    `);
  }

  /**
   * Create composite B-Tree index for multiple columns
   */
  createCompositeIndex(table: string, columns: string[], unique: boolean = false): void {
    const indexName = `idx_${table}_${columns.join('_')}`;
    const uniqueClause = unique ? 'UNIQUE' : '';
    const columnsStr = columns.join(', ');
    
    this.db.exec(`
      CREATE ${uniqueClause} INDEX IF NOT EXISTS ${indexName}
      ON ${table} (${columnsStr})
    `);
  }

  /**
   * Create partial index with WHERE clause
   */
  createPartialIndex(table: string, column: string, where: string): void {
    const indexName = `idx_${table}_${column}_partial`;
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexName}
      ON ${table} (${column})
      WHERE ${where}
    `);
  }

  /**
   * Create full-text search index
   */
  createFullTextIndex(table: string, columns: string[]): void {
    const indexName = `fts_${table}`;
    const columnsStr = columns.join(', ');
    
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${indexName}
      USING fts5(${columnsStr})
    `);
  }

  /**
   * Create optimized indexes for memory queries
   */
  createMemoryIndexes(): void {
    // Index on aggregate_id for fast event lookup
    this.createBTreeIndex('events', 'aggregate_id');
    
    // Index on event_type for filtering
    this.createBTreeIndex('events', 'event_type');
    
    // Index on timestamp for time-based queries
    this.createBTreeIndex('events', 'timestamp');
    
    // Composite index for aggregate + timestamp
    this.createCompositeIndex('events', ['aggregate_id', 'timestamp']);
    
    // Partial index for MEMORY_CREATED events only
    this.createPartialIndex('events', 'aggregate_id', "event_type = 'MEMORY_CREATED'");
    
    // Full-text search on event data
    this.createFullTextIndex('events_fts', ['event_data']);
  }

  /**
   * Analyze index usage
   */
  analyzeIndexUsage(): Map<string, number> {
    const usage = new Map<string, number>();
    
    // Get all indexes
    const indexes = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all() as any[];
    
    for (const index of indexes) {
      // In production, would use ANALYZE command and sqlite_stat1 table
      // For now, return 0 as placeholder
      usage.set(index.name, 0);
    }
    
    return usage;
  }

  /**
   * Get index statistics
   */
  getIndexStats(): IndexStats[] {
    const stats: IndexStats[] = [];
    
    const indexes = this.db.prepare(`
      SELECT name, tbl_name as table
      FROM sqlite_master
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all() as any[];
    
    for (const index of indexes) {
      const indexInfo = this.db.prepare(`PRAGMA index_info(${index.name})`).all() as any[];
      const columns = indexInfo.map((info: any) => info.name);
      
      const tableInfo = this.db.prepare(`PRAGMA table_info(${index.table})`).all() as any[];
      
      stats.push({
        name: index.name,
        table: index.table,
        columns,
        size: 0, // Would require page count calculation
        rowCount: tableInfo.length,
        usage: 0
      });
    }
    
    return stats;
  }

  /**
   * Drop index
   */
  dropIndex(indexName: string): boolean {
    try {
      this.db.exec(`DROP INDEX IF EXISTS ${indexName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rebuild index
   */
  rebuildIndex(indexName: string): boolean {
    try {
      this.db.exec(`REINDEX ${indexName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Optimize database (Learning 31-33: WAL optimization)
   */
  optimizeDatabase(): void {
    // Run ANALYZE to update statistics
    this.db.exec('ANALYZE');
    
    // Run VACUUM to rebuild database
    this.db.exec('VACUUM');
    
    // Optimize for WAL mode
    this.db.exec('PRAGMA wal_autocheckpoint = 1000');
  }

  /**
   * Check index fragmentation
   */
  checkFragmentation(): Map<string, number> {
    const fragmentation = new Map<string, number>();
    
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
    `).all() as any[];
    
    for (const table of tables) {
      const pageCount = this.db.prepare(`PRAGMA page_count`).get() as any;
      const freelistCount = this.db.prepare(`PRAGMA freelist_count`).get() as any;
      
      const frag = pageCount.page_count > 0 
        ? (freelistCount.freelist_count / pageCount.page_count) * 100 
        : 0;
      
      fragmentation.set(table.name, frag);
    }
    
    return fragmentation;
  }

  /**
   * Get query plan for a query
   */
  getQueryPlan(sql: string): any[] {
    return this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let memoryIndexingStrategyService: MemoryIndexingStrategyService | null = null;

export function getMemoryIndexingStrategyService(): MemoryIndexingStrategyService {
  if (!memoryIndexingStrategyService) {
    memoryIndexingStrategyService = new MemoryIndexingStrategyService();
  }
  return memoryIndexingStrategyService;
}

export function resetMemoryIndexingStrategyService(): void {
  if (memoryIndexingStrategyService) {
    memoryIndexingStrategyService.close();
    memoryIndexingStrategyService = null;
  }
}
