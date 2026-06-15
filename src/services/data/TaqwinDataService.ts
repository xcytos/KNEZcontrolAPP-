import { invoke } from '@tauri-apps/api/core';
import { postgresService } from './DatabaseService';

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
  documents?: Document[];  // Session documents from Document Manager MCP
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
  document_count?: number;
  project_id?: string;
  project_path?: string;
}

export interface Document {
  document_id: string;
  title: string;
  doc_type: 'requirement' | 'design' | 'specification' | 'note' | 'form' | 'other';
  content: string;
  session_id?: string;
  project_name?: string;
  checkpoint_id?: string;
  created_at: string;
  updated_at: string;
  is_large: boolean;
  file_path?: string;
}

export interface SessionDocuments {
  documents: Document[];
  storage_summary: {
    psql_documents: Array<{ id: string; title: string }>;
    filesystem_documents: Array<{ id: string; title: string; path: string }>;
  };
}

export interface Project {
  project_id: string;
  project_name: string;
  project_path: string;
  description?: string;
  git_remote?: string;
  created_at: string;
  last_accessed: string;
  metadata?: Record<string, any>;
  sessions?: SessionListItem[];
}

export interface DataIntegrityIssues {
  sessionsWithoutProjects: number;
  checkpointsWithoutSessions: number;
  eventsWithoutSessions: number;
  emptyCheckpoints: number;
  emptyEvents: number;
  orphanedDocuments: number;
}

export interface GitStats {
  total_commits: number;
  total_files_changed: number;
  total_insertions: number;
  total_deletions: number;
  branch: string;
  is_valid_repo: boolean;
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
   * INCLUDES documents from PostgreSQL database
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

    // Add documents from PostgreSQL (if available)
    try {
      const documents = await this.getSessionDocuments(sessionId);
      documents.forEach((doc) => {
        timeline.push({
          type: 'document',
          timestamp: doc.created_at,
          data: doc,
        });
      });
    } catch (error) {
      console.warn('[TaqwinDataService] Could not fetch documents:', error);
      // Continue without documents
    }

    // Sort by timestamp
    timeline.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Newest first
    });

    return timeline;
  }

  /**
   * Get documents linked to a session from PostgreSQL
   * @param sessionId - Session ID to filter by, or empty string for all documents
   */
  async getSessionDocuments(sessionId: string): Promise<any[]> {
    try {
      // For now, filter from all documents since we don't have a direct session filter method
      // This should be replaced with a proper backend implementation later
      const allDocs = await postgresService.listDocuments(1000);
      
      // If sessionId is empty, return all documents
      if (!sessionId) {
        return allDocs.map(doc => ({
          document_id: doc.document_id,
          title: doc.title,
          doc_type: doc.doc_type,
          content: doc.content,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          is_large: doc.is_large,
          file_path: doc.file_path,
          session_id: doc.session_id,
          checkpoint_id: doc.checkpoint_id,
          project_name: doc.project_name,
          tags: doc.tags,
        }));
      }
      
      const sessionDocs = allDocs.filter(doc => doc.session_id === sessionId);
      
      return sessionDocs.map(doc => ({
        document_id: doc.document_id,
        title: doc.title,
        doc_type: doc.doc_type,
        content: doc.content,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        is_large: doc.is_large,
        file_path: doc.file_path,
        session_id: doc.session_id,
        checkpoint_id: doc.checkpoint_id,
        project_name: doc.project_name,
        tags: doc.tags,
      }));
    } catch (error) {
      console.error('[TaqwinDataService] Get session documents error:', error);
      return [];
    }
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

  /**
   * Get all projects from the database
   */
  async listProjects(): Promise<Project[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      const response = await invoke<DatabaseResponse<any[]>>('sqlite_query_table', {
        dbPath: this.dbPath,
        tableName: 'projects',
        limit: 100,
      });

      if (response.success && response.data) {
        return response.data as Project[];
      } else {
        throw new Error(response.error || 'Failed to list projects');
      }
    } catch (error) {
      console.error('[TaqwinDataService] List projects error:', error);
      throw error;
    }
  }

  /**
   * Get sessions for a specific project
   */
  async getProjectSessions(projectId: string): Promise<SessionListItem[]> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      // Get all sessions and filter by project_id
      const allSessions = await this.listSessions(1000);
      return allSessions.filter((s: any) => s.project_id === projectId);
    } catch (error) {
      console.error('[TaqwinDataService] Get project sessions error:', error);
      throw error;
    }
  }

  /**
   * Get project hierarchy: project + all its sessions + session counts
   */
  async getProjectHierarchy(projectId: string): Promise<Project> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      // Get project details
      const projects = await this.listProjects();
      const project = projects.find((p) => p.project_id === projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Get all sessions for this project
      const sessions = await this.getProjectSessions(projectId);
      
      // Enhance sessions with counts
      const enhancedSessions = await Promise.all(
        sessions.map(async (session: any) => {
          try {
            const counts = await this.getSessionCounts(session.session_id);
            return {
              ...session,
              checkpoint_count: counts.checkpoints,
              event_count: counts.events,
            };
          } catch (error) {
            console.warn(`[TaqwinDataService] Failed to get counts for session ${session.session_id}:`, error);
            return session;
          }
        })
      );

      return {
        ...project,
        sessions: enhancedSessions,
      };
    } catch (error) {
      console.error('[TaqwinDataService] Get project hierarchy error:', error);
      throw error;
    }
  }

  /**
   * Analyze data integrity issues
   */
  async getDataIntegrityIssues(): Promise<DataIntegrityIssues> {
    if (!this.dbPath) {
      throw new Error('Database path not set');
    }

    try {
      // Get all sessions
      const allSessions = await this.listSessions(10000);
      
      // Count sessions without projects
      const sessionsWithoutProjects = allSessions.filter((s: any) => !s.project_id).length;

      // Get all checkpoints and count orphaned ones
      const checkpointsResponse = await invoke<DatabaseResponse<any[]>>('sqlite_query_table', {
        dbPath: this.dbPath,
        tableName: 'checkpoints',
        limit: 10000,
      });
      const allCheckpoints = checkpointsResponse.success && checkpointsResponse.data ? checkpointsResponse.data : [];
      const sessionIds = new Set(allSessions.map((s: any) => s.session_id));
      const checkpointsWithoutSessions = allCheckpoints.filter((cp: any) => !sessionIds.has(cp.session_id)).length;
      const emptyCheckpoints = allCheckpoints.filter((cp: any) => 
        !cp.learned_memories || 
        (typeof cp.learned_memories === 'string' && JSON.parse(cp.learned_memories).length === 0)
      ).length;

      // Get all events and count orphaned/empty ones
      const eventsResponse = await invoke<DatabaseResponse<any[]>>('sqlite_query_table', {
        dbPath: this.dbPath,
        tableName: 'events',
        limit: 10000,
      });
      const allEvents = eventsResponse.success && eventsResponse.data ? eventsResponse.data : [];
      const eventsWithoutSessions = allEvents.filter((evt: any) => !sessionIds.has(evt.session_id)).length;
      
      // Count events with no file changes (dev_event type with empty or no files array)
      const emptyEvents = allEvents.filter((evt: any) => {
        if (evt.event_type !== 'dev_event') return false;
        
        if (!evt.content) return true;
        
        try {
          let contentObj = evt.content;
          if (typeof contentObj === 'string') {
            contentObj = JSON.parse(contentObj);
          }
          
          // Check if data.files exists and has content
          if (!contentObj.data || !contentObj.data.files || !Array.isArray(contentObj.data.files) || contentObj.data.files.length === 0) {
            return true;
          }
          
          return false;
        } catch (err) {
          return true;
        }
      }).length;

      return {
        sessionsWithoutProjects,
        checkpointsWithoutSessions,
        eventsWithoutSessions,
        emptyCheckpoints,
        emptyEvents,
        orphanedDocuments: 0, // Would need PostgreSQL query
      };
    } catch (error) {
      console.error('[TaqwinDataService] Get data integrity issues error:', error);
      throw error;
    }
  }

  /**
   * Get Git statistics for a project repository
   */
  async getProjectGitStats(projectPath: string, limit: number = 50): Promise<GitStats | null> {
    try {
      const response = await invoke<any>('get_git_stats', {
        repoPath: projectPath,
        limit,
      });

      if (response && response.stats) {
        return {
          ...response.stats,
          is_valid_repo: true,
        };
      }
      return null;
    } catch (error) {
      console.error('[TaqwinDataService] Get git stats error:', error);
      return {
        total_commits: 0,
        total_files_changed: 0,
        total_insertions: 0,
        total_deletions: 0,
        branch: 'unknown',
        is_valid_repo: false,
      };
    }
  }
}

export const taqwinDataService = TaqwinDataService.getInstance();
