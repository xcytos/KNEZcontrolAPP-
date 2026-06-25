/**
 * SessionDataService - TAQWIN MCP Integration Layer
 * Loads session data for full-view visualization
 */

import {
  SessionFullData,
  SessionData,
  SessionStats,
  TimelineEvent,
  Checkpoint,
  DocumentMetadata,
} from '../types/SessionFullViewTypes';

class SessionDataService {
  /**
   * Load complete session context with timeline data
   */
  async loadSessionFullContext(sessionId: string): Promise<SessionFullData> {
    try {
      // 1. Resume session to get basic info
      const sessionResponse = await this.callMCP('mcp_taqwin_session_session_manager', {
        action: 'resume_session',
        session_id: sessionId,
        load_context: true,
      });

      if (!sessionResponse.success || !sessionResponse.data?.session_data) {
        throw new Error('Failed to load session data');
      }

      const session: SessionData = sessionResponse.data.session_data;

      // 2. Get ALL checkpoints with full data
      const checkpointsResponse = await this.callMCP('mcp_taqwin_session_checkpoint_manager', {
        action: 'list_checkpoints',
        session_id: sessionId,
        include_full_data: true,
      });

      const checkpoints: Checkpoint[] = checkpointsResponse.success 
        ? (checkpointsResponse.data?.checkpoints || [])
        : [];

      // 3. Get session documents
      const docsResponse = await this.callMCP('mcp_document_manager_document_manager', {
        action: 'get_session_documents',
        session_id: sessionId,
      });

      const documents: DocumentMetadata[] = docsResponse.success
        ? (docsResponse.data?.documents || [])
        : [];

      // 4. Build timeline from checkpoints
      const timeline = this.buildTimelineFromCheckpoints(checkpoints);

      // 5. Compute stats
      const stats = this.computeStats(checkpoints, documents);

      return {
        session,
        checkpoints,
        documents,
        timeline,
        stats,
      };
    } catch (error) {
      console.error('[SessionDataService] Error loading session context:', error);
      throw error;
    }
  }

  /**
   * Build timeline events from checkpoint data
   */
  private buildTimelineFromCheckpoints(checkpoints: Checkpoint[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    checkpoints.forEach(cp => {
      // Add checkpoint event
      events.push({
        type: 'checkpoint',
        timestamp: cp.created_at,
        data: cp,
      });

      // Extract and parse learned_memories
      const memories = this.parseIfNeeded(cp.learned_memories);
      if (Array.isArray(memories) && memories.length > 0) {
        // Optionally add individual memory events (currently not in timeline)
        // For now, memories are shown within checkpoint detail
      }

      // Extract and parse decisions
      const decisions = this.parseIfNeeded(cp.decisions);
      if (Array.isArray(decisions) && decisions.length > 0) {
        decisions.forEach(decision => {
          events.push({
            type: 'decision',
            timestamp: cp.created_at,
            data: {
              ...decision,
              checkpoint_id: cp.checkpoint_id,
            },
          });
        });
      }

      // Extract and parse findings as insights
      const findings = this.parseIfNeeded(cp.findings);
      if (Array.isArray(findings) && findings.length > 0) {
        findings.forEach(finding => {
          events.push({
            type: 'insight',
            timestamp: cp.created_at,
            data: {
              insight: finding,
              checkpoint_id: cp.checkpoint_id,
            },
          });
        });
      }
    });

    // Sort by timestamp (newest first)
    return events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Compute session statistics
   */
  private computeStats(checkpoints: Checkpoint[], documents: DocumentMetadata[]): SessionStats {
    let memoriesCount = 0;
    let decisionsCount = 0;
    let filesCount = 0;
    let eventsCount = 0;

    checkpoints.forEach(cp => {
      // Count learned memories
      const memories = this.parseIfNeeded(cp.learned_memories);
      if (Array.isArray(memories)) {
        memoriesCount += memories.length;
      }

      // Count decisions
      const decisions = this.parseIfNeeded(cp.decisions);
      if (Array.isArray(decisions)) {
        decisionsCount += decisions.length;
      }

      // Count findings
      const findings = this.parseIfNeeded(cp.findings);
      if (Array.isArray(findings)) {
        eventsCount += findings.length;
      }
    });

    return {
      checkpoints: checkpoints.length,
      events: eventsCount,
      memories: memoriesCount,
      decisions: decisionsCount,
      files: filesCount, // TODO: Extract from dev events when available
      documents: documents.length,
    };
  }

  /**
   * Parse JSON string if needed
   */
  private parseIfNeeded(data: any): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  }

  /**
   * Call MCP tool via global window API
   */
  private async callMCP(toolName: string, params: any): Promise<any> {
    // Check if we're in Tauri environment
    const w = window as any;
    const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;

    if (!isTauri) {
      throw new Error('MCP tools require Tauri environment');
    }

    // Use Tauri invoke to call MCP tool
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke(toolName, params);
      return result;
    } catch (error) {
      console.error(`[SessionDataService] MCP call failed: ${toolName}`, error);
      return { success: false, error: String(error) };
    }
  }
}

// Export singleton instance
export const sessionDataService = new SessionDataService();
