import { invoke } from '@tauri-apps/api/core';

// Database Response Type
export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// SeaORM PostgreSQL document model (from generated entity)
export interface OrmDocument {
  document_id: string;
  title: string;
  doc_type: string;
  content?: string;
  file_path?: string;
  session_id: string;
  project_name?: string;
  checkpoint_id?: string;
  created_at?: string;
  updated_at?: string;
  is_large?: boolean;
  embedding?: string;
  version_number?: number;
  parent_version_id?: string;
  created_by?: string;
  updated_by?: string;
  content_size?: number;
  slug?: string;
  tags?: string[];
  category?: string;
  project_id?: string;
  purpose?: string;
  latest_changes?: string;
  business_id?: number;
}

// SeaORM SQLite session model (from generated entity)
export interface OrmSession {
  session_id: string;
  display_id: string;
  name: string;
  type: string;
  tags?: string;
  created_at: string;
  updated_at: string;
  status: string;
  summary?: string;
  event_count?: number;
  file_count?: number;
  embedding_vector?: string;
  indexed_at?: string;
  project_id?: string;
  project_path?: string;
  last_heartbeat_at?: string;
  heartbeat_timeout_seconds?: number;
  client_metadata?: string;
  session_state?: string;
}

// SeaORM SQLite checkpoint model
export interface OrmCheckpoint {
  checkpoint_id?: string;
  session_id?: string;
  title: string;
  created_at: string;
  context_data: string;
  learned_memories?: string;
  decisions?: string;
  findings?: string;
  metadata?: string;
  type?: string;
}

// SeaORM SQLite event model
export interface OrmEvent {
  event_id?: string;
  session_id: string;
  event_type: string;
  content: string;
  created_at: string;
  embedding_vector?: string;
}

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// PostgreSQL Service
export class PostgresService {
  private static instance: PostgresService;
  private config: PostgresConnectionConfig | null = null;

  private constructor() {}

  public static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }

  async connect(config: PostgresConnectionConfig): Promise<boolean> {
    this.config = config;
    try {
      const response = await invoke<DatabaseResponse<string>>('orm_connect_postgres', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      });
      if (response.success) {
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

  async listDocuments(limit: number = 100): Promise<OrmDocument[]> {
    if (!this.config) {
      throw new Error('Not connected to PostgreSQL');
    }
    const cfg = this.config;

    try {
      const response = await invoke<DatabaseResponse<OrmDocument[]>>('orm_list_documents', {
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        limit,
      });
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

  async searchDocuments(query: string, limit: number = 50): Promise<OrmDocument[]> {
    if (!this.config) {
      throw new Error('Not connected to PostgreSQL');
    }
    const cfg = this.config;

    try {
      const response = await invoke<DatabaseResponse<OrmDocument[]>>('orm_search_documents', {
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
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

  async getDocument(_documentId: string): Promise<OrmDocument | null> {
    throw new Error('Use searchDocuments for now — single document lookup via ORM not yet exposed');
  }

  isConnected(): boolean {
    return this.config !== null;
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

  async listSessions(limit: number = 100): Promise<OrmSession[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }
    try {
      const response = await invoke<DatabaseResponse<OrmSession[]>>('orm_list_sessions', {
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

  async listCheckpoints(limit: number = 100): Promise<OrmCheckpoint[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }
    try {
      const response = await invoke<DatabaseResponse<OrmCheckpoint[]>>('orm_list_checkpoints', {
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

  async listSessionEvents(sessionId: string, limit: number = 100): Promise<OrmEvent[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }
    try {
      const response = await invoke<DatabaseResponse<OrmEvent[]>>('orm_list_session_events', {
        dbPath: this.dbPath,
        sessionId,
        limit,
      });
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to list events');
      }
    } catch (error) {
      console.error('[SqliteService] List events error:', error);
      throw error;
    }
  }

  async updateSessionStatus(sessionId: string, newStatus: string): Promise<boolean> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }
    try {
      const response = await invoke<DatabaseResponse<boolean>>('orm_update_session_status', {
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
