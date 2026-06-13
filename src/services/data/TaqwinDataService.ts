import { invoke } from '@tauri-apps/api/core';

interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionHierarchy {
  session: Record<string, any>;
  checkpoints: Record<string, any>[];
  events: Record<string, any>[];
  decisions: Record<string, any>[];
  insights: Record<string, any>[];
  patterns: Record<string, any>[];
  files: Record<string, any>[];
  memories: Record<string, any>[];
}

export interface SessionListItem {
  id: string;
  display_id: string;
  name: string;
  session_type: string;
  tags?: string;
  status: string;
  created_at: string;
  updated_at: string;
  checkpoint_count?: number;
  event_count?: number;
}

export class TaqwinDataService {
  private static instance: TaqwinDataService;
  private dbPath: string = 'C:\\Users\\syedm\\taqwin_memory.db';

  private constructor() {}

  public static getInstance(): TaqwinDataService {
    if (!TaqwinDataService.instance) {
      TaqwinDataService.instance = new TaqwinDataService();
    }
    return TaqwinDataService.instance;
  }

  setDatabasePath(path: string): void {
    this.dbPath = path;
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Get all sessions with basic metadata
   */
  async listSessions(limit: number = 100): Promise<SessionListItem[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<any[]>>('sqlite_query_table', {
        dbPath: this.dbPath,
        tableName: 'sessions',
        limit,
      });

      if (response.success && response.data) {
        return response.data as SessionListItem[];
      } else {
        throw new Error(response.error || 'Failed to list sessions');
      }
    } catch (error) {
      console.error('[TaqwinDataService] List sessions error:', error);
      throw error;
    }
  }

  /**
   * Get complete session hierarchy with all related data
   * Includes: checkpoints, events, decisions, insights, patterns, files, memories
   */
  async getSessionHierarchy(sessionId: string): Promise<SessionHierarchy> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<SessionHierarchy>>(
        'sqlite_get_session_hierarchy',
        {
          dbPath: this.dbPath,
          sessionId,
        }
      );

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get session hierarchy');
      }
    } catch (error) {
      console.error('[TaqwinDataService] Get session hierarchy error:', error);
      throw error;
    }
  }

  /**
   * Get counts for all related tables for a session
   */
  async getSessionCounts(sessionId: string): Promise<Record<string, number>> {
    const hierarchy = await this.getSessionHierarchy(sessionId);
    
    return {
      checkpoints: hierarchy.checkpoints.length,
      events: hierarchy.events.length,
      decisions: hierarchy.decisions.length,
      insights: hierarchy.insights.length,
      patterns: hierarchy.patterns.length,
      files: hierarchy.files.length,
      memories: hierarchy.memories.length,
    };
  }

  /**
   * Get chronological timeline of events for a session
   */
  async getSessionTimeline(sessionId: string): Promise<any[]> {
    const hierarchy = await this.getSessionHierarchy(sessionId);
    
    // Combine all timestamped events into a single timeline, sorted by created_at
    const timeline: any[] = [];

    // Add checkpoints
    hierarchy.checkpoints.forEach((cp) => {
      timeline.push({
        type: 'checkpoint',
        timestamp: cp.created_at,
        data: cp,
      });
    });

    // Add events
    hierarchy.events.forEach((evt) => {
      timeline.push({
        type: 'event',
        timestamp: evt.created_at || evt.timestamp,
        data: evt,
      });
    });

    // Add decisions
    hierarchy.decisions.forEach((dec) => {
      timeline.push({
        type: 'decision',
        timestamp: dec.created_at || dec.timestamp,
        data: dec,
      });
    });

    // Add insights
    hierarchy.insights.forEach((ins) => {
      timeline.push({
        type: 'insight',
        timestamp: ins.created_at || ins.timestamp,
        data: ins,
      });
    });

    // Add patterns
    hierarchy.patterns.forEach((pat) => {
      timeline.push({
        type: 'pattern',
        timestamp: pat.created_at || pat.timestamp,
        data: pat,
      });
    });

    // Add file changes
    hierarchy.files.forEach((file) => {
      timeline.push({
        type: 'file',
        timestamp: file.created_at || file.timestamp,
        data: file,
      });
    });

    // Sort by timestamp
    timeline.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Newest first
    });

    return timeline;
  }

  /**
   * Get all tables in the database
   */
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
      console.error('[TaqwinDataService] List tables error:', error);
      throw error;
    }
  }
}

export const taqwinDataService = TaqwinDataService.getInstance();
