/**
 * Type definitions for SessionEvolutionChart Full-View feature
 */

export interface SessionFullViewProps {
  sessionId: string;
  initialView?: 'timeline' | 'graph';
  onClose: () => void;
  embedded?: boolean;
}

export interface SessionData {
  session_id: string;
  display_id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'delegated' | 'archived';
  tags: string[];
  created_at: string;
  updated_at: string;
  project_id?: string;
  project_name?: string;
  project_path?: string;
  type?: string;
}

export interface SessionStats {
  checkpoints: number;
  events: number;
  memories: number;
  decisions: number;
  files: number;
  documents: number;
}

export interface TimelineEvent {
  type: 'checkpoint' | 'event' | 'decision' | 'insight' | 'pattern' | 'file' | 'document';
  timestamp: string;
  data: any;
}

export interface Checkpoint {
  checkpoint_id: string;
  session_id: string;
  title: string;
  created_at: string;
  context?: any;
  learned_memories?: string[] | string;
  decisions?: any[] | string;
  findings?: string[] | string;
  metadata?: any;
}

export interface DocumentMetadata {
  document_id: string;
  title: string;
  doc_type: string;
  session_id?: string;
  project_name?: string;
  created_at: string;
  updated_at: string;
  is_large: boolean;
  absolute_path?: string | null;
}

export interface SessionFullData {
  session: SessionData;
  checkpoints: Checkpoint[];
  documents: DocumentMetadata[];
  timeline: TimelineEvent[];
  stats: SessionStats;
}

export interface EventTypeFilters {
  checkpoints: boolean;
  events: boolean;
  decisions: boolean;
  insights: boolean;
  files: boolean;
  documents: boolean;
}

export interface ExportFormat {
  type: 'json' | 'markdown';
  label: string;
}

// Helper type for MCP responses
export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
