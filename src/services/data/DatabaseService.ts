import { invoke } from '@tauri-apps/api/core';

// Database Response Type
export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// PostgreSQL Types
export interface PgDocument {
  document_id: string;
  title: string;
  doc_type: string;
  content?: string;
  session_id: string; // REQUIRED in PostgreSQL
  project_name?: string;
  project_id?: string; // NEW: Added in schema
  checkpoint_id?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  is_large: boolean;
  file_path?: string;
  
  // NEW: Version control fields
  version_number?: number;
  parent_version_id?: string;
  created_by?: string;
  updated_by?: string;
  
  // NEW: Metadata fields
  content_size?: number;
  slug?: string;
  category?: string;
  embedding?: string;
  
  // DEPRECATED: Not in schema
  domain?: string; // This field doesn't exist in PostgreSQL schema
}

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// SQLite Types
export interface TaqwinSession {
  id: string;
  display_id: string;
  name: string;
  session_type: string;
  tags?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TaqwinMemory {
  id: string;
  session_id: string;
  memory_type: string;
  domain: string;
  content: string;
  importance: number;
  created_at: string;
}

export interface TaqwinCheckpoint {
  id: string;
  session_id: string;
  title: string;
  context: string;
  learned_memories: string;
  decisions: string;
  findings: string;
  created_at: string;
}

// PostgreSQL Service
export class PostgresService {
  private static instance: PostgresService;
  private connected: boolean = false;

  private constructor() {}

  public static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }

  async connect(config: PostgresConnectionConfig): Promise<boolean> {
    try {
      const response = await invoke<DatabaseResponse<string>>('connect_to_postgres', { config });
      if (response.success) {
        this.connected = true;
        return true;
      } else {
        console.error('[PostgresService] Connection failed:', response.error);
        return false;
      }
    } catch (error) {
      console.error('[PostgresService] Connection error:', error);
      return false;
    }
  }

  async listDocuments(limit: number = 100): Promise<PgDocument[]> {
    if (!this.connected) {
      throw new Error('Not connected to PostgreSQL');
    }

    try {
      const response = await invoke<DatabaseResponse<PgDocument[]>>('list_pg_documents', { limit });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list documents');
      }
    } catch (error) {
      console.error('[PostgresService] List documents error:', error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<PgDocument | null> {
    if (!this.connected) {
      throw new Error('Not connected to PostgreSQL');
    }

    try {
      const response = await invoke<DatabaseResponse<PgDocument | null>>('get_pg_document', {
        documentId,
      });
      if (response.success) {
        return response.data || null;
      } else {
        throw new Error(response.error || 'Failed to get document');
      }
    } catch (error) {
      console.error('[PostgresService] Get document error:', error);
      throw error;
    }
  }

  async searchDocuments(query: string, limit: number = 50): Promise<PgDocument[]> {
    if (!this.connected) {
      throw new Error('Not connected to PostgreSQL');
    }

    try {
      const response = await invoke<DatabaseResponse<PgDocument[]>>('search_pg_documents', {
        query,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to search documents');
      }
    } catch (error) {
      console.error('[PostgresService] Search error:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// SQLite Service
export class SqliteService {
  private static instance: SqliteService;
  private dbPath: string = '';

  private constructor() {}

  public static getInstance(): SqliteService {
    if (!SqliteService.instance) {
      SqliteService.instance = new SqliteService();
    }
    return SqliteService.instance;
  }

  setDatabasePath(path: string): void {
    this.dbPath = path;
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  async listSessions(limit: number = 100): Promise<TaqwinSession[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<TaqwinSession[]>>('list_sqlite_sessions', {
        dbPath: this.dbPath,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list sessions');
      }
    } catch (error) {
      console.error('[SqliteService] List sessions error:', error);
      throw error;
    }
  }

  async listMemories(limit: number = 100): Promise<TaqwinMemory[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<TaqwinMemory[]>>('list_sqlite_memories', {
        dbPath: this.dbPath,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list memories');
      }
    } catch (error) {
      console.error('[SqliteService] List memories error:', error);
      throw error;
    }
  }

  async listCheckpoints(limit: number = 100): Promise<TaqwinCheckpoint[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<TaqwinCheckpoint[]>>('list_sqlite_checkpoints', {
        dbPath: this.dbPath,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list checkpoints');
      }
    } catch (error) {
      console.error('[SqliteService] List checkpoints error:', error);
      throw error;
    }
  }

  async updateSessionStatus(sessionId: string, newStatus: string): Promise<boolean> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<boolean>>('sqlite_update_session_status', {
        dbPath: this.dbPath,
        sessionId,
        newStatus,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update session status');
      }
    } catch (error) {
      console.error('[SqliteService] Update session status error:', error);
      throw error;
    }
  }
}

// Export singleton instances
export const postgresService = PostgresService.getInstance();
export const sqliteService = SqliteService.getInstance();
