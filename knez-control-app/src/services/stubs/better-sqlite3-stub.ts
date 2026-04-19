/**
 * Browser-compatible stub for better-sqlite3
 * 
 * This stub provides a minimal implementation that allows the memory services
 * to work in the browser environment without the native Node.js module.
 * 
 * In a production Tauri app, database operations should be moved to the Rust backend.
 */

export class Database {
  private _path: string;
  private memoryStore: Map<string, any[]> = new Map();
  private preparedStatements: Map<string, PreparedStatement> = new Map();

  constructor(_path: string) {
    this._path = _path;
    console.warn(`[better-sqlite3 stub] Using in-memory storage for ${this._path}. Database operations will not persist.`);
  }

  exec(sql: string): void {
    // Simple SQL parsing for basic operations
    const upperSql = sql.toUpperCase();
    
    if (upperSql.includes('CREATE TABLE')) {
      const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!this.memoryStore.has(tableName)) {
          this.memoryStore.set(tableName, []);
        }
      }
    } else if (upperSql.includes('CREATE INDEX')) {
      // Indexes are no-ops in memory
    } else if (upperSql.includes('INSERT')) {
      // Handled by prepare().run()
    } else if (upperSql.includes('UPDATE')) {
      // Handled by prepare().run()
    } else if (upperSql.includes('DELETE')) {
      // Handled by prepare().run()
    }
  }

  prepare(sql: string): PreparedStatement {
    const stmt = new PreparedStatement(sql, this.memoryStore);
    this.preparedStatements.set(sql, stmt);
    return stmt;
  }

  close(): void {
    this.memoryStore.clear();
    this.preparedStatements.clear();
  }

  // Additional methods that might be used
  pragma(_pragma: string): any {
    return null;
  }

  backup(_dest: Database): void {
    console.warn('[better-sqlite3 stub] Backup not supported in browser');
  }

  function(_name: string, _func: Function): void {
    console.warn('[better-sqlite3 stub] Custom functions not supported in browser');
  }

  aggregate(_name: string, _step: Function, _final: Function): void {
    console.warn('[better-sqlite3 stub] Aggregate functions not supported in browser');
  }

  table(_name: string, _module: any): void {
    console.warn('[better-sqlite3 stub] Table modules not supported in browser');
  }

  loadExtension(_path: string): void {
    console.warn('[better-sqlite3 stub] Extensions not supported in browser');
  }

  checkpoint(): void {
    // No-op for in-memory
  }

  get inTransaction(): boolean {
    return false;
  }

  begin(): void {
    // No-op for in-memory
  }

  commit(): void {
    // No-op for in-memory
  }

  rollback(): void {
    // No-op for in-memory
  }
}

export class PreparedStatement {
  private sql: string;
  private store: Map<string, any[]>;
  private lastInsertRowid: number = 1;

  constructor(sql: string, store: Map<string, any[]>) {
    this.sql = sql;
    this.store = store;
  }

  run(...params: any[]): RunResult {
    const upperSql = this.sql.toUpperCase();
    
    // Extract table name from SQL
    const tableMatch = this.sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;
    
    if (!tableName) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    const table = this.store.get(tableName) || [];
    
    if (upperSql.includes('INSERT')) {
      // Convert undefined values to null to avoid "undefined" string storage
      const cleanedParams = params[0] || {};
      const cleanedRow: any = { id: this.lastInsertRowid++ };
      for (const key in cleanedParams) {
        cleanedRow[key] = cleanedParams[key] === undefined ? null : cleanedParams[key];
      }
      table.push(cleanedRow);
      this.store.set(tableName, table);
      return { changes: 1, lastInsertRowid: cleanedRow.id };
    } else if (upperSql.includes('UPDATE')) {
      const changes = table.length; // Simplified
      return { changes, lastInsertRowid: this.lastInsertRowid };
    } else if (upperSql.includes('DELETE')) {
      const changes = table.length;
      this.store.set(tableName, []);
      return { changes, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...params: any[]): any | null {
    const upperSql = this.sql.toUpperCase();
    const tableMatch = this.sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;
    
    if (!tableName) {
      return null;
    }

    const table = this.store.get(tableName) || [];
    
    if (upperSql.includes('WHERE')) {
      const whereMatch = this.sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const column = whereMatch[1];
        const value = params[0];
        return table.find((row: any) => row[column] === value) || null;
      }
    } else if (upperSql.includes('COUNT')) {
      return { count: table.length };
    }

    return table[0] || null;
  }

  all(...params: any[]): any[] {
    const upperSql = this.sql.toUpperCase();
    const tableMatch = this.sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;
    
    if (!tableName) {
      return [];
    }

    const table = this.store.get(tableName) || [];
    
    if (upperSql.includes('WHERE')) {
      const whereMatch = this.sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const column = whereMatch[1];
        const value = params[0];
        return table.filter((row: any) => row[column] === value);
      }
    }

    if (upperSql.includes('ORDER BY')) {
      const orderMatch = this.sql.match(/ORDER BY\s+(\w+)\s+(DESC|ASC)?/i);
      if (orderMatch) {
        const column = orderMatch[1];
        const direction = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1;
        return [...table].sort((a: any, b: any) => 
          (a[column] > b[column] ? 1 : -1) * direction
        );
      }
    }

    if (upperSql.includes('LIMIT')) {
      const limitMatch = this.sql.match(/LIMIT\s+(\d+)/i);
      const offsetMatch = this.sql.match(/OFFSET\s+(\d+)/i);
      const limit = limitMatch ? parseInt(limitMatch[1]) : table.length;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
      return table.slice(offset, offset + limit);
    }

    return table;
  }

  iterate(...params: any[]): IterableIterator<any> {
    const results = this.all(...params);
    return results[Symbol.iterator]();
  }

  columns(): ColumnInfo[] {
    return [];
  }

  readonly(...params: any[]): any | null {
    return this.get(...params);
  }
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface ColumnInfo {
  name: string;
  column: number;
  type: string;
  notNull: number;
  defaultValue: any;
  primaryKey: number;
}

// Export default for compatibility
export default Database;
