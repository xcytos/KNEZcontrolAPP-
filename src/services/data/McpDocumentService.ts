/**
 * MCP Document Service
 * Uses Document Manager MCP directly to bypass broken Tauri PostgreSQL backend
 * This service provides a bridge between the UI and the Document Manager MCP
 */

export interface McpDocument {
  document_id: string;
  title: string;
  doc_type: string;
  content?: string;
  session_id?: string;
  project_name?: string;
  checkpoint_id?: string;
  created_at: string;
  updated_at?: string;
  is_large: boolean;
  file_path?: string;
}

export interface McpDocumentResponse {
  success: boolean;
  documents?: McpDocument[];
  document?: McpDocument;
  error?: string;
  count?: number;
}

class McpDocumentService {
  private static instance: McpDocumentService;
  private mcpAvailable: boolean = false;

  private constructor() {
    this.checkMcpAvailability();
  }

  public static getInstance(): McpDocumentService {
    if (!McpDocumentService.instance) {
      McpDocumentService.instance = new McpDocumentService();
    }
    return McpDocumentService.instance;
  }

  /**
   * Check if MCP is available (running in Kiro environment)
   */
  private checkMcpAvailability(): void {
    // Check if we're running in Kiro environment with MCP support
    // @ts-ignore - MCP global may not be defined
    this.mcpAvailable = typeof window !== 'undefined' && typeof window.mcp !== 'undefined';
    console.log('[McpDocumentService] MCP availability:', this.mcpAvailable);
  }

  /**
   * Call Document Manager MCP tool
   */
  private async callMcp(action: string, params: Record<string, any> = {}): Promise<any> {
    try {
      // In a real implementation, this would use the MCP protocol
      // For now, we'll use a placeholder that can be implemented
      // via the Kiro MCP bridge when running in Kiro
      
      console.log('[McpDocumentService] Calling MCP:', { action, params });
      
      // This is a placeholder - actual implementation would go through Kiro's MCP bridge
      throw new Error('MCP bridge not yet implemented in UI layer');
      
    } catch (error) {
      console.error('[McpDocumentService] MCP call failed:', error);
      throw error;
    }
  }

  /**
   * Get documents for a specific session
   */
  async getSessionDocuments(sessionId: string): Promise<McpDocument[]> {
    try {
      if (!sessionId) {
        console.warn('[McpDocumentService] No session ID provided');
        return [];
      }

      console.log('[McpDocumentService] Fetching documents for session:', sessionId);
      
      // Call MCP get_session_documents
      const response = await this.callMcp('get_session_documents', {
        session_id: sessionId,
      });

      if (response.success && response.documents) {
        console.log('[McpDocumentService] Retrieved documents:', response.documents.length);
        return response.documents;
      }

      return [];
    } catch (error) {
      console.error('[McpDocumentService] Error fetching session documents:', error);
      return [];
    }
  }

  /**
   * List all documents with optional limit
   */
  async listDocuments(limit: number = 100): Promise<McpDocument[]> {
    try {
      console.log('[McpDocumentService] Listing documents, limit:', limit);
      
      const response = await this.callMcp('list_documents', { limit });

      if (response.success && response.documents) {
        console.log('[McpDocumentService] Retrieved documents:', response.documents.length);
        return response.documents;
      }

      return [];
    } catch (error) {
      console.error('[McpDocumentService] Error listing documents:', error);
      return [];
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<McpDocument | null> {
    try {
      console.log('[McpDocumentService] Fetching document:', documentId);
      
      const response = await this.callMcp('get_document', {
        document_id: documentId,
      });

      if (response.success && response.document) {
        return response.document;
      }

      return null;
    } catch (error) {
      console.error('[McpDocumentService] Error fetching document:', error);
      return null;
    }
  }

  /**
   * Search documents by query
   */
  async searchDocuments(query: string, limit: number = 50): Promise<McpDocument[]> {
    try {
      console.log('[McpDocumentService] Searching documents:', query);
      
      const response = await this.callMcp('search_documents', {
        query,
        limit,
      });

      if (response.success && response.documents) {
        console.log('[McpDocumentService] Search results:', response.documents.length);
        return response.documents;
      }

      return [];
    } catch (error) {
      console.error('[McpDocumentService] Error searching documents:', error);
      return [];
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{ connected: boolean; documentCount?: number }> {
    try {
      const response = await this.callMcp('get_health', {});

      if (response.success && response.health) {
        return {
          connected: true,
          documentCount: response.health.database?.match(/\d+/)?.[0] || 0,
        };
      }

      return { connected: false };
    } catch (error) {
      console.error('[McpDocumentService] Error checking health:', error);
      return { connected: false };
    }
  }

  /**
   * Check if MCP is available
   */
  isMcpAvailable(): boolean {
    return this.mcpAvailable;
  }
}

export const mcpDocumentService = McpDocumentService.getInstance();
