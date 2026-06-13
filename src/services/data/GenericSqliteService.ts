import { invoke } from '@tauri-apps/api/core';

interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TableInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export class GenericSqliteService {
  private static instance: GenericSqliteService;
  private dbPath: string = '';

  private constructor() {}

  public static getInstance(): GenericSqliteService {
    if (!GenericSqliteService.instance) {
      GenericSqliteService.instance = new GenericSqliteService();
    }
    return GenericSqliteService.instance;
  }

  setDatabasePath(path: string): void {
    this.dbPath = path;
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  async listTables(): Promise<string[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<string[]>>('sqlite_list_tables', {
        dbPath: this.dbPath,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list tables');
      }
    } catch (error) {
      console.error('[GenericSqliteService] List tables error:', error);
      throw error;
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<TableInfo[]>>('sqlite_get_table_info', {
        dbPath: this.dbPath,
        tableName,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get table info');
      }
    } catch (error) {
      console.error('[GenericSqliteService] Get table info error:', error);
      throw error;
    }
  }

  async queryTable(tableName: string, limit: number = 100): Promise<any[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<any[]>>('sqlite_query_table', {
        dbPath: this.dbPath,
        tableName,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to query table');
      }
    } catch (error) {
      console.error('[GenericSqliteService] Query table error:', error);
      throw error;
    }
  }

  async getRowCount(tableName: string): Promise<number> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<number>>('sqlite_get_row_count', {
        dbPath: this.dbPath,
        tableName,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get row count');
      }
    } catch (error) {
      console.error('[GenericSqliteService] Get row count error:', error);
      throw error;
    }
  }
}

export const genericSqliteService = GenericSqliteService.getInstance();
