/**
 * Memory Time-Series Tracking Service
 * 
 * Implements time-series tracking for memory metrics
 * 
 * Applied Learnings:
 * - Learning 19-30: Columnar storage for time-series data
 * - Learning 75-77: B-Tree Indexing for time-based queries
 * - Learning 31-33: SQLite WAL for consistent time-series writes
 */

import Database from 'better-sqlite3';

export interface TimeSeriesMetric {
  timestamp: number;
  metricName: string;
  value: number;
  tags: Record<string, string>;
}

export interface TimeSeriesQuery {
  metricName: string;
  startTime: number;
  endTime: number;
  tags?: Record<string, string>;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  interval?: number; // milliseconds
}

export class MemoryTimeSeriesTrackingService {
  private db: Database.Database;

  constructor(dbPath: string = '.taqwin/memory/timeseries.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create metrics table (columnar-like structure)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        timestamp INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        tags TEXT NOT NULL,
        PRIMARY KEY (timestamp, metric_name)
      )
    `);

    // Create indexes for time-series queries (Learning 75-77)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp)
    `);

    // Create aggregated metrics table for faster queries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_hourly (
        hour_start INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        value_sum REAL NOT NULL,
        value_count INTEGER NOT NULL,
        value_min REAL NOT NULL,
        value_max REAL NOT NULL,
        PRIMARY KEY (hour_start, metric_name)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_hourly_time ON metrics_hourly(hour_start)
    `);
  }

  /**
   * Record a metric
   */
  recordMetric(metricName: string, value: number, tags: Record<string, string> = {}): void {
    const timestamp = Date.now();
    const tagsStr = JSON.stringify(tags);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (timestamp, metric_name, value, tags)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(timestamp, metricName, value, tagsStr);
  }

  /**
   * Record multiple metrics in batch
   */
  recordMetrics(metrics: TimeSeriesMetric[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (timestamp, metric_name, value, tags)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((metrics) => {
      for (const metric of metrics) {
        stmt.run(metric.timestamp, metric.metricName, metric.value, JSON.stringify(metric.tags));
      }
    });

    insertMany(metrics);
  }

  /**
   * Query metrics
   */
  queryMetrics(query: TimeSeriesQuery): TimeSeriesMetric[] {
    let sql = 'SELECT timestamp, metric_name, value, tags FROM metrics WHERE 1=1';
    const params: any[] = [];

    sql += ' AND metric_name = ?';
    params.push(query.metricName);

    sql += ' AND timestamp >= ?';
    params.push(query.startTime);

    sql += ' AND timestamp <= ?';
    params.push(query.endTime);

    if (query.tags) {
      for (const [key, value] of Object.entries(query.tags)) {
        sql += ` AND tags LIKE ?`;
        params.push(`%"${key}":"${value}"%`);
      }
    }

    sql += ' ORDER BY timestamp ASC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      timestamp: row.timestamp,
      metricName: row.metric_name,
      value: row.value,
      tags: JSON.parse(row.tags)
    }));
  }

  /**
   * Query aggregated metrics
   */
  queryAggregatedMetrics(query: TimeSeriesQuery): Array<{ timestamp: number; value: number }> {
    const interval = query.interval || 60 * 1000; // 1 minute default
    const bucketSize = Math.floor((query.endTime - query.startTime) / interval) || 1;

    const bucketStart = Math.floor(query.startTime / interval) * interval;

    const sql = `
      SELECT 
        ((timestamp - ?) / ?) as bucket,
        ${this.getAggregationFunction(query.aggregation || 'avg')}(value) as value
      FROM metrics
      WHERE metric_name = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(bucketStart, interval, query.metricName, query.startTime, query.endTime) as any[];

    return rows.map(row => ({
      timestamp: bucketStart + (row.bucket * interval),
      value: row.value
    }));
  }

  /**
   * Get aggregation function for SQL
   */
  private getAggregationFunction(aggregation: string): string {
    switch (aggregation) {
      case 'sum': return 'SUM';
      case 'avg': return 'AVG';
      case 'min': return 'MIN';
      case 'max': return 'MAX';
      case 'count': return 'COUNT';
      default: return 'AVG';
    }
  }

  /**
   * Aggregate metrics into hourly buckets
   */
  aggregateHourlyMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Get metrics from the last hour
    const metrics = this.queryMetrics({
      metricName: 'memory_count',
      startTime: oneHourAgo,
      endTime: now
    });

    if (metrics.length === 0) return;

    const hourStart = Math.floor(oneHourAgo / (60 * 60 * 1000)) * (60 * 60 * 1000);

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    const count = metrics.length;
    const min = Math.min(...metrics.map(m => m.value));
    const max = Math.max(...metrics.map(m => m.value));

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics_hourly (hour_start, metric_name, value_sum, value_count, value_min, value_max)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(hourStart, 'memory_count', sum, count, min, max);

    // Delete raw metrics that have been aggregated
    this.db.prepare(`
      DELETE FROM metrics
      WHERE metric_name = ? AND timestamp >= ? AND timestamp <= ?
    `).run('memory_count', oneHourAgo, now);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(metricName: string, startTime: number, endTime: number): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(value) as sum,
        AVG(value) as avg,
        MIN(value) as min,
        MAX(value) as max
      FROM metrics
      WHERE metric_name = ? AND timestamp >= ? AND timestamp <= ?
    `);
    
    const result = stmt.get(metricName, startTime, endTime) as any;
    
    return {
      count: result.count || 0,
      sum: result.sum || 0,
      avg: result.avg || 0,
      min: result.min || 0,
      max: result.max || 0
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(metricName: string, limit: number = 100): TimeSeriesMetric[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, metric_name, value, tags
      FROM metrics
      WHERE metric_name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(metricName, limit) as any[];
    
    return rows.map(row => ({
      timestamp: row.timestamp,
      metricName: row.metric_name,
      value: row.value,
      tags: JSON.parse(row.tags)
    }));
  }

  /**
   * Delete old metrics
   */
  deleteOldMetrics(olderThan: number): number {
    const stmt = this.db.prepare('DELETE FROM metrics WHERE timestamp < ?');
    const result = stmt.run(olderThan);
    return result.changes;
  }

  /**
   * Get database size
   */
  getDatabaseSize(): number {
    const stmt = this.db.prepare('PRAGMA page_count');
    const pageCount = stmt.get() as { page_count: number };
    
    const pageSizeStmt = this.db.prepare('PRAGMA page_size');
    const pageSize = pageSizeStmt.get() as { page_size: number };
    
    return pageCount.page_count * pageSize.page_size;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let memoryTimeSeriesTrackingService: MemoryTimeSeriesTrackingService | null = null;

export function getMemoryTimeSeriesTrackingService(): MemoryTimeSeriesTrackingService {
  if (!memoryTimeSeriesTrackingService) {
    memoryTimeSeriesTrackingService = new MemoryTimeSeriesTrackingService();
  }
  return memoryTimeSeriesTrackingService;
}

export function resetMemoryTimeSeriesTrackingService(): void {
  if (memoryTimeSeriesTrackingService) {
    memoryTimeSeriesTrackingService.close();
    memoryTimeSeriesTrackingService = null;
  }
}
