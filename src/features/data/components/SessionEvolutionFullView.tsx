import React, { useState, useEffect, useCallback } from 'react';
import { SessionFullViewProps, EventTypeFilters, SessionFullData } from '../types/SessionFullViewTypes';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import { SessionMetadataSidebar } from './SessionMetadataSidebar';
import { FullViewHeader } from './FullViewHeader';
import { SessionEvolutionChart } from './SessionEvolutionChart';
import { RelationshipGraph } from './RelationshipGraph';
import { Loader, AlertCircle } from 'lucide-react';

export const SessionEvolutionFullView: React.FC<SessionFullViewProps> = ({
  sessionId,
  initialView = 'timeline',
  onClose,
  embedded = false,
}) => {
  const [activeView, setActiveView] = useState<'timeline' | 'graph'>(initialView);
  const [filters, setFilters] = useState<EventTypeFilters>({
    checkpoints: true,
    events: true,
    decisions: true,
    insights: true,
    files: true,
    documents: true,
  });
  const [sessionData, setSessionData] = useState<SessionFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjectSessions, setAllProjectSessions] = useState<any[]>([]);

  // Load session data - wrapped in useCallback to prevent infinite loops
  const loadSessionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use existing TaqwinDataService to get session hierarchy
      const hierarchy = await taqwinDataService.getSessionHierarchy(sessionId);
      
      // Extract data from hierarchy response
      const session = hierarchy.session as any;
      const checkpoints = hierarchy.checkpoints || [];
      const documents = hierarchy.documents || [];
      
      // Load all sessions from the same project for the graph
      if (session.project_id) {
        try {
          const allSessions = await taqwinDataService.getProjectSessions(session.project_id);
          setAllProjectSessions(allSessions || [session]);
        } catch (err) {
          console.warn('[SessionEvolutionFullView] Failed to load project sessions:', err);
          setAllProjectSessions([session]);
        }
      } else {
        setAllProjectSessions([session]);
      }
      
      // Build timeline from hierarchy data
      const timeline: any[] = [];
      
      // Add checkpoints
      checkpoints.forEach((cp: any) => {
        timeline.push({
          type: 'checkpoint',
          timestamp: cp.created_at,
          data: cp,
        });
        
        // Extract decisions
        const decisions = typeof cp.decisions === 'string' ? JSON.parse(cp.decisions || '[]') : cp.decisions;
        if (Array.isArray(decisions)) {
          decisions.forEach((decision: any) => {
            timeline.push({
              type: 'decision',
              timestamp: cp.created_at,
              data: { ...decision, checkpoint_id: cp.checkpoint_id },
            });
          });
        }
        
        // Extract findings as insights
        const findings = typeof cp.findings === 'string' ? JSON.parse(cp.findings || '[]') : cp.findings;
        if (Array.isArray(findings)) {
          findings.forEach((finding: string) => {
            timeline.push({
              type: 'insight',
              timestamp: cp.created_at,
              data: { insight: finding, checkpoint_id: cp.checkpoint_id },
            });
          });
        }
      });
      
      // Add dev events
      if (hierarchy.events && Array.isArray(hierarchy.events)) {
        hierarchy.events.forEach((event: any) => {
          timeline.push({
            type: 'event',
            timestamp: event.created_at,
            data: event,
          });
        });
      }
      
      // Sort timeline by timestamp (newest first)
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Compute stats
      let memoriesCount = 0;
      let decisionsCount = 0;
      let filesCount = 0;
      
      checkpoints.forEach((cp: any) => {
        const memories = typeof cp.learned_memories === 'string' ? JSON.parse(cp.learned_memories || '[]') : cp.learned_memories;
        if (Array.isArray(memories)) memoriesCount += memories.length;
        
        const decisions = typeof cp.decisions === 'string' ? JSON.parse(cp.decisions || '[]') : cp.decisions;
        if (Array.isArray(decisions)) decisionsCount += decisions.length;
      });
      
      const stats = {
        checkpoints: checkpoints.length,
        events: hierarchy.events?.length || 0,
        memories: memoriesCount,
        decisions: decisionsCount,
        files: filesCount,
        documents: documents.length,
      };
      
      setSessionData({
        session: {
          session_id: session.session_id,
          display_id: session.display_id || session.session_id,
          name: session.name,
          status: session.status,
          tags: session.tags || [],
          created_at: session.created_at,
          updated_at: session.updated_at,
          project_id: session.project_id,
          project_name: session.project_name,
          project_path: session.project_path,
          type: session.session_type,
        },
        checkpoints: checkpoints as any[], // Cast to satisfy type - data from TaqwinDataService
        documents,
        timeline,
        stats,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load session data';
      setError(errorMsg);
      console.error('[SessionEvolutionFullView] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]); // Only depend on sessionId

  // Load session data on mount or when sessionId changes
  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  const handleExport = useCallback((format: 'json' | 'markdown') => {
    if (!sessionData) return;

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(sessionData, null, 2);
        filename = `session-${sessionId}-export.json`;
        mimeType = 'application/json';
      } else {
        // Markdown export
        content = generateMarkdownExport(sessionData);
        filename = `session-${sessionId}-export.md`;
        mimeType = 'text/markdown';
      }

      // Create download link
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[SessionEvolutionFullView] Export error:', err);
      alert('Failed to export session data');
    }
  }, [sessionData, sessionId]);

  // Filter timeline based on active filters
  const filteredTimeline = sessionData?.timeline.filter(event => {
    if (event.type === 'checkpoint' && !filters.checkpoints) return false;
    if (event.type === 'event' && !filters.events) return false;
    if (event.type === 'decision' && !filters.decisions) return false;
    if (event.type === 'insight' && !filters.insights) return false;
    if (event.type === 'file' && !filters.files) return false;
    if (event.type === 'document' && !filters.documents) return false;
    return true;
  }) || [];

  return (
    <div
      className={`${
        embedded ? 'relative' : 'fixed inset-0'
      } z-50 bg-zinc-950 flex overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-full-view-title"
    >
      {/* Left Sidebar */}
      <SessionMetadataSidebar
        session={sessionData?.session || null}
        stats={sessionData?.stats || { checkpoints: 0, events: 0, memories: 0, decisions: 0, files: 0, documents: 0 }}
        loading={loading}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <FullViewHeader
          activeView={activeView}
          onViewChange={setActiveView}
          filters={filters}
          onFilterChange={setFilters}
          onExport={handleExport}
          onClose={onClose}
        />

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
                <div className="text-sm text-zinc-400">Loading session data...</div>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-8">
              <div className="max-w-md text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <div className="text-lg font-semibold text-zinc-200 mb-2">
                  Failed to Load Session
                </div>
                <div className="text-sm text-zinc-400 mb-4">{error}</div>
                <button
                  onClick={loadSessionData}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && sessionData && (
            <>
              {activeView === 'timeline' && (
                <SessionEvolutionChart
                  timeline={filteredTimeline}
                  sessionStart={sessionData.session.created_at}
                  sessionEnd={sessionData.session.updated_at}
                />
              )}

              {activeView === 'graph' && (
                <RelationshipGraph
                  projects={sessionData.session.project_id ? [{
                    project_id: sessionData.session.project_id,
                    project_name: sessionData.session.project_name || sessionData.session.project_id,
                    project_path: sessionData.session.project_path || '',
                    children: [],
                    created_at: sessionData.session.created_at,
                    last_accessed: sessionData.session.updated_at,
                  }] : []}
                  allSessions={allProjectSessions.map(s => ({
                    session_id: s.session_id || s.id,
                    id: s.session_id || s.id,
                    display_id: s.display_id || s.session_id || s.id,
                    name: s.name,
                    status: s.status,
                    created_at: s.created_at,
                    updated_at: s.updated_at,
                    project_id: s.project_id || '',
                    session_type: s.session_type || s.type || 'GENERAL',
                  }))}
                  allDocuments={sessionData.documents.map(doc => ({
                    ...doc,
                    content: '',
                    file_path: doc.absolute_path || undefined,
                    doc_type: doc.doc_type as 'form' | 'note' | 'other' | 'requirement' | 'design' | 'specification',
                    session_id: doc.session_id || '',
                  }))}
                  onClose={onClose}
                  onNavigateToSession={(newSessionId) => {
                    // Switch to the selected session
                    window.location.hash = `session-${newSessionId}`;
                    // Reload with new session
                    // Note: This is a simple implementation - for full SPA behavior,
                    // you'd update the sessionId prop from parent component
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Generate Markdown export of session data
 */
function generateMarkdownExport(data: SessionFullData): string {
  const { session, stats, timeline } = data;

  let markdown = `# Session Evolution Report: ${session.display_id}\n\n`;
  markdown += `**Session Name**: ${session.name}  \n`;
  markdown += `**Status**: ${session.status.charAt(0).toUpperCase() + session.status.slice(1)}  \n`;
  
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  markdown += `**Period**: ${formatDate(session.created_at)} - ${formatDate(session.updated_at)}\n\n`;

  // Session Metrics
  markdown += `## Session Metrics\n\n`;
  markdown += `- **Checkpoints**: ${stats.checkpoints}\n`;
  markdown += `- **Events**: ${stats.events}\n`;
  markdown += `- **Learned Memories**: ${stats.memories}\n`;
  markdown += `- **Decisions Made**: ${stats.decisions}\n`;
  markdown += `- **Files Changed**: ${stats.files}\n`;
  markdown += `- **Documents**: ${stats.documents}\n\n`;

  // Timeline
  markdown += `## Timeline\n\n`;

  const parseIfNeeded = (data: any) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  };

  timeline.forEach((event) => {
    const timestamp = formatDate(event.timestamp);

    if (event.type === 'checkpoint') {
      markdown += `### ${timestamp} - Checkpoint: ${event.data.checkpoint_id}\n`;
      markdown += `**${event.data.title || 'Checkpoint'}**\n\n`;

      const memories = parseIfNeeded(event.data.learned_memories);
      if (Array.isArray(memories) && memories.length > 0) {
        markdown += `**Learned Memories** (${memories.length}):\n`;
        memories.forEach(m => markdown += `- ${m}\n`);
        markdown += `\n`;
      }

      const decisions = parseIfNeeded(event.data.decisions);
      if (Array.isArray(decisions) && decisions.length > 0) {
        markdown += `**Decisions** (${decisions.length}):\n`;
        decisions.forEach(d => {
          const decision = typeof d === 'string' ? d : d.decision;
          markdown += `- ${decision}\n`;
          if (d.reasoning) markdown += `  - Reasoning: ${d.reasoning}\n`;
        });
        markdown += `\n`;
      }
    } else if (event.type === 'decision') {
      markdown += `### ${timestamp} - Decision\n`;
      markdown += `${event.data.decision || 'Decision'}\n\n`;
    } else if (event.type === 'insight') {
      markdown += `### ${timestamp} - Insight\n`;
      markdown += `${event.data.insight || event.data.pattern || 'Insight'}\n\n`;
    }
  });

  markdown += `\n---\n\n`;
  markdown += `*Generated by TAQWIN Dashboard - ${new Date().toLocaleString()}*\n`;

  return markdown;
}
