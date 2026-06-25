/**
 * McpDocumentBridge - Bridge to PostgreSQL documents
 * 
 * Uses Tauri PostgreSQL connection (already connected and working).
 * Bypasses the broken TLS-less connection attempt.
 */

import { postgresService } from './DatabaseService';

export interface McpDocument {
  document_id: string;
  title: string;
  doc_type: 'requirement' | 'design' | 'specification' | 'note' | 'form' | 'other';
  session_id: string;
  project_name?: string;
  checkpoint_id?: string;
  created_at: string;
  updated_at?: string;
  is_large: boolean;
  file_path?: string;
  absolute_path?: string;
  version_number?: number;
  content?: string;
  tags?: string[];
  project_id?: string;
  content_size?: number;
  slug?: string;
  category?: string;
}

export interface McpDocumentListResponse {
  documents: McpDocument[];
  total_documents: number;
  grouped_by_type?: Record<string, McpDocument[]>;
  types_summary?: Record<string, number>;
  storage_summary?: {
    psql_count: number;
    filesystem_count: number;
    psql_documents: Array<{ id: string; title: string }>;
    filesystem_documents: Array<{ id: string; title: string; path: string }>;
  };
}

export class McpDocumentBridge {
  private static instance: McpDocumentBridge;

  private constructor() {}

  public static getInstance(): McpDocumentBridge {
    if (!McpDocumentBridge.instance) {
      McpDocumentBridge.instance = new McpDocumentBridge();
    }
    return McpDocumentBridge.instance;
  }

  /**
   * Get all documents (uses existing PostgreSQL connection)
   */
  async listAllDocuments(): Promise<McpDocument[]> {
    try {
      console.log('[McpDocumentBridge] Fetching all documents via PostgreSQL...');
      
      // Use the existing Tauri PostgreSQL connection
      if (!postgresService.isConnected()) {
        console.warn('[McpDocumentBridge] PostgreSQL not connected, attempting connection...');
        const connected = await postgresService.connect({
          host: 'db.sspsljqdhesqezrmspcj.supabase.co',
          port: 5432,
          database: 'postgres',
          user: 'postgres',
          password: 'TAQWIN!@#777',
        });
        
        if (!connected) {
          console.error('[McpDocumentBridge] PostgreSQL connection failed');
          return [];
        }
      }

      const docs = await postgresService.listDocuments(1000);
      console.log(`[McpDocumentBridge] Loaded ${docs.length} documents`);
      
      return docs.map(this.normalizeDocument);
    } catch (error) {
      console.error('[McpDocumentBridge] Error loading documents:', error);
      return [];
    }
  }

  /**
   * Get documents for a specific session
   */
  async getSessionDocuments(sessionId: string): Promise<McpDocumentListResponse> {
    try {
      console.log(`[McpDocumentBridge] Fetching documents for session: ${sessionId}`);
      
      const allDocs = await this.listAllDocuments();
      const sessionDocs = allDocs.filter(doc => doc.session_id === sessionId);
      
      console.log(`[McpDocumentBridge] Session ${sessionId}: ${sessionDocs.length} documents`);
      
      return {
        documents: sessionDocs,
        total_documents: sessionDocs.length,
        grouped_by_type: this.groupDocumentsByType(sessionDocs),
        types_summary: this.getDocumentTypeCounts(sessionDocs)
      };
    } catch (error) {
      console.error(`[McpDocumentBridge] Error loading session documents:`, error);
      return {
        documents: [],
        total_documents: 0
      };
    }
  }

  /**
   * Get single document with full content
   */
  async getDocument(documentId: string): Promise<McpDocument | null> {
    try {
      console.log(`[McpDocumentBridge] Fetching document: ${documentId}`);
      
      const doc = await postgresService.getDocument(documentId);
      return doc ? this.normalizeDocument(doc) : null;
    } catch (error) {
      console.error(`[McpDocumentBridge] Error loading document:`, error);
      return null;
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(query: string, limit: number = 50): Promise<McpDocument[]> {
    try {
      console.log(`[McpDocumentBridge] Searching documents: "${query}"`);
      
      const docs = await postgresService.searchDocuments(query, limit);
      console.log(`[McpDocumentBridge] Found ${docs.length} matching documents`);
      
      return docs.map(this.normalizeDocument);
    } catch (error) {
      console.error(`[McpDocumentBridge] Error searching documents:`, error);
      return [];
    }
  }

  /**
   * Filter documents by session_id (client-side filter for efficiency)
   */
  filterDocumentsBySession(documents: McpDocument[], sessionId: string): McpDocument[] {
    return documents.filter(doc => doc.session_id === sessionId);
  }

  /**
   * Filter documents by project sessions (client-side filter)
   */
  filterDocumentsByProjectSessions(
    documents: McpDocument[], 
    sessionIds: string[]
  ): McpDocument[] {
    const sessionIdSet = new Set(sessionIds);
    return documents.filter(doc => doc.session_id && sessionIdSet.has(doc.session_id));
  }

  /**
   * Group documents by type
   */
  groupDocumentsByType(documents: McpDocument[]): Record<string, McpDocument[]> {
    const grouped: Record<string, McpDocument[]> = {};
    
    documents.forEach(doc => {
      if (!grouped[doc.doc_type]) {
        grouped[doc.doc_type] = [];
      }
      grouped[doc.doc_type].push(doc);
    });

    return grouped;
  }

  /**
   * Get document counts by type
   */
  getDocumentTypeCounts(documents: McpDocument[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    documents.forEach(doc => {
      counts[doc.doc_type] = (counts[doc.doc_type] || 0) + 1;
    });

    return counts;
  }

  /**
   * Normalize document structure to match UI expectations
   */
  private normalizeDocument(doc: any): McpDocument {
    return {
      document_id: doc.document_id,
      title: doc.title,
      doc_type: doc.doc_type,
      session_id: doc.session_id,
      project_name: doc.project_name,
      checkpoint_id: doc.checkpoint_id,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      is_large: doc.is_large || false,
      file_path: doc.file_path,
      absolute_path: doc.absolute_path,
      version_number: doc.version_number,
      content: doc.content,
      tags: doc.tags,
      project_id: doc.project_id,
      content_size: doc.content_size,
      slug: doc.slug,
      category: doc.category
    };
  }

  /**
   * Check if PostgreSQL is available
   */
  isAvailable(): boolean {
    return postgresService.isConnected();
  }
}

// Export singleton instance
export const mcpDocumentBridge = McpDocumentBridge.getInstance();
