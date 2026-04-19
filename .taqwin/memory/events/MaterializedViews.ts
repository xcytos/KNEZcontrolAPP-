/**
 * Materialized Views for Memory Queries
 * 
 * Implements denormalized views for common queries (Learning 36)
 * Updated asynchronously on new events
 */

import Database from 'better-sqlite3';
import { MemoryEvent, MemoryEventType } from './MemoryEventTypes';

export class MaterializedViewManager {
  private db: Database.Database;
  private views: Map<string, ViewDefinition>;

  constructor(db: Database.Database) {
    this.db = db;
    this.views = new Map();
    this.initializeViews();
  }

  private initializeViews(): void {
    // Create views table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS materialized_views (
        view_name TEXT PRIMARY KEY,
        view_query TEXT NOT NULL,
        last_updated TEXT NOT NULL
      )
    `);

    // Register view definitions
    this.registerView('memories_by_domain', `
      SELECT 
        aggregate_id as memory_id,
        JSON_EXTRACT(event_data, '$.type') as type,
        JSON_EXTRACT(event_data, '$.domain') as domain,
        JSON_EXTRACT(event_data, '$.title') as title,
        timestamp as created_at,
        sequence as version
      FROM events e1
      WHERE event_type = 'MEMORY_CREATED'
        AND sequence = (SELECT MAX(sequence) FROM events e2 WHERE e2.aggregate_id = e1.aggregate_id AND e2.event_type = 'MEMORY_CREATED')
    `);

    this.registerView('memories_by_type', `
      SELECT 
        aggregate_id as memory_id,
        JSON_EXTRACT(event_data, '$.type') as type,
        JSON_EXTRACT(event_data, '$.domain') as domain,
        JSON_EXTRACT(event_data, '$.title') as title,
        timestamp as created_at
      FROM events e1
      WHERE event_type = 'MEMORY_CREATED'
        AND sequence = (SELECT MAX(sequence) FROM events e2 WHERE e2.aggregate_id = e1.aggregate_id AND e2.event_type = 'MEMORY_CREATED')
    `);

    this.registerView('memories_with_tags', `
      SELECT 
        e.aggregate_id as memory_id,
        JSON_EXTRACT(e.event_data, '$.title') as title,
        JSON_EXTRACT(e.event_data, '$.domain') as domain,
        t.event_data as tags,
        e.timestamp as updated_at
      FROM events e
      LEFT JOIN events t ON t.aggregate_id = e.aggregate_id 
        AND t.event_type = 'MEMORY_TAGGED'
        AND t.sequence = (SELECT MAX(sequence) FROM events WHERE aggregate_id = e.aggregate_id AND event_type = 'MEMORY_TAGGED')
      WHERE e.event_type = 'MEMORY_CREATED'
        AND e.sequence = (SELECT MAX(sequence) FROM events WHERE aggregate_id = e.aggregate_id AND event_type = 'MEMORY_CREATED')
    `);

    this.registerView('memory_relations', `
      SELECT 
        aggregate_id as memory_id,
        JSON_EXTRACT(event_data, '$.relatedMemoryId') as related_memory_id,
        JSON_EXTRACT(event_data, '$.relationship') as relationship,
        JSON_EXTRACT(event_data, '$.weight') as weight,
        timestamp as added_at
      FROM events
      WHERE event_type = 'MEMORY_RELATED'
    `);

    this.registerView('recent_memories', `
      SELECT 
        aggregate_id as memory_id,
        JSON_EXTRACT(event_data, '$.type') as type,
        JSON_EXTRACT(event_data, '$.domain') as domain,
        JSON_EXTRACT(event_data, '$.title') as title,
        timestamp as created_at
      FROM events
      WHERE event_type = 'MEMORY_CREATED'
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    // Create the views in the database
    this.createViews();
  }

  private registerView(name: string, query: string): void {
    this.views.set(name, { name, query });
  }

  private createViews(): void {
    for (const [name, definition] of this.views) {
      // Drop view if exists
      this.db.exec(`DROP VIEW IF EXISTS ${name}`);
      
      // Create view
      this.db.exec(`CREATE VIEW ${name} AS ${definition.query}`);
      
      // Register in materialized_views table
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO materialized_views (view_name, view_query, last_updated)
        VALUES (?, ?, ?)
      `);
      stmt.run(name, definition.query, new Date().toISOString());
    }
  }

  /**
   * Refresh a specific materialized view
   * Called asynchronously after events are appended
   */
  refreshView(viewName: string): void {
    const definition = this.views.get(viewName);
    if (!definition) {
      throw new Error(`View ${viewName} not found`);
    }

    // Recreate view
    this.db.exec(`DROP VIEW IF EXISTS ${viewName}`);
    this.db.exec(`CREATE VIEW ${viewName} AS ${definition.query}`);

    // Update last_updated timestamp
    const stmt = this.db.prepare(`
      UPDATE materialized_views
      SET last_updated = ?
      WHERE view_name = ?
    `);
    stmt.run(new Date().toISOString(), viewName);
  }

  /**
   * Refresh all materialized views
   */
  refreshAllViews(): void {
    for (const viewName of this.views.keys()) {
      this.refreshView(viewName);
    }
  }

  /**
   * Get view statistics
   */
  getViewStats(): Map<string, ViewStats> {
    const stats = new Map<string, ViewStats>();
    
    for (const viewName of this.views.keys()) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${viewName}`);
      const result = stmt.get() as { count: number };
      
      const metadataStmt = this.db.prepare(`
        SELECT last_updated FROM materialized_views WHERE view_name = ?
      `);
      const metadata = metadataStmt.get(viewName) as { last_updated: string } | undefined;
      
      stats.set(viewName, {
        name: viewName,
        rowCount: result.count,
        lastUpdated: metadata?.last_updated || null
      });
    }
    
    return stats;
  }
}

interface ViewDefinition {
  name: string;
  query: string;
}

interface ViewStats {
  name: string;
  rowCount: number;
  lastUpdated: string | null;
}
