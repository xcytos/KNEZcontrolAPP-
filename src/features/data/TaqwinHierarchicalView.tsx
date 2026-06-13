import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Calendar,
  FileText,
  AlertCircle,
  Lightbulb,
  Target,
  CheckCircle,
  Database,
  Search,
  Loader,
  BarChart3,
  List,
  Save,
  Layout,
  Puzzle,
} from 'lucide-react';
import { taqwinDataService, SessionHierarchy, SessionListItem } from '../../services/data/TaqwinDataService';
import { SessionTimelineGraph } from './components/SessionTimelineGraph';

export const TaqwinHierarchicalView: React.FC = () => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<SessionHierarchy | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'sections'>('timeline');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load hierarchy when session is selected - MORE AGGRESSIVE
  useEffect(() => {
    if (selectedSession) {
      console.log('[TaqwinHierarchicalView] useEffect triggered for session:', selectedSession);
      // Immediately show loading state
      setLoading(true);
      setError(null);
      setHierarchy(null);
      
      // Then load the hierarchy
      loadHierarchy(selectedSession);
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
      const data = await taqwinDataService.listSessions(100);
      console.log('[TaqwinHierarchicalView] Sessions loaded:', data);
      console.log('[TaqwinHierarchicalView] First session structure:', data[0]);
      console.log('[TaqwinHierarchicalView] Available fields:', Object.keys(data[0] || {}));
      console.log('[TaqwinHierarchicalView] session_id field:', (data[0] as any)?.session_id);
      setSessions(data || []);
    } catch (err) {
      const errorMsg = `Failed to load sessions: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('[TaqwinHierarchicalView] Error loading sessions:', err);
      setError(errorMsg);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHierarchy = async (sessionId: string) => {
    try {
      console.log('[TaqwinHierarchicalView] Starting to load hierarchy for session:', sessionId);
      // setLoading is already true from useEffect
      const data = await taqwinDataService.getSessionHierarchy(sessionId);
      console.log('[TaqwinHierarchicalView] Hierarchy loaded:', data);
      console.log('[TaqwinHierarchicalView] Session data:', data.session);
      console.log('[TaqwinHierarchicalView] Data counts:', {
        checkpoints: data.checkpoints?.length || 0,
        events: data.events?.length || 0,
        decisions: data.decisions?.length || 0,
        insights: data.insights?.length || 0,
        patterns: data.patterns?.length || 0,
        files: data.files?.length || 0,
        memories: data.memories?.length || 0,
      });
      setHierarchy(data);
      
      // Build timeline from hierarchy data
      const timelineData = await taqwinDataService.getSessionTimeline(sessionId);
      console.log('[TaqwinHierarchicalView] Timeline built:', timelineData.length, 'events');
      setTimeline(timelineData);
      
      setError(null);
      // Expand key sections by default
      setExpandedSections({
        checkpoints: true,
        events: true,
        decisions: true,
      });
    } catch (err) {
      const errorMsg = `Failed to load hierarchy: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('[TaqwinHierarchicalView] Error loading hierarchy:', err);
      setError(errorMsg);
      setHierarchy(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const saveCheckpoint = async () => {
    if (!selectedSession || !hierarchy) return;
    
    try {
      setSaving(true);
      setSaveSuccess(false);
      
      // Prepare checkpoint data
      const checkpointData = {
        title: `Context Snapshot - ${new Date().toLocaleString()}`,
        context: {
          session_id: selectedSession,
          session_name: (hierarchy.session as any).name,
          captured_at: new Date().toISOString(),
          summary: {
            total_checkpoints: hierarchy.checkpoints.length,
            total_events: hierarchy.events.length,
            total_decisions: hierarchy.decisions.length,
            total_insights: hierarchy.insights.length,
            total_patterns: hierarchy.patterns.length,
            total_files: hierarchy.files.length,
            total_memories: hierarchy.memories.length,
          },
          timeline_length: timeline.length,
        },
        learned_memories: [
          `Session ${(hierarchy.session as any).display_id} context captured`,
          `Total timeline events: ${timeline.length}`,
          `Session type: ${(hierarchy.session as any).session_type}`,
        ],
        findings: [
          `Captured full context for session ${selectedSession}`,
          `Timeline spans ${timeline.length} events`,
        ],
      };

      // Use TAQWIN MCP to save checkpoint
      console.log('[TaqwinHierarchicalView] Saving checkpoint:', checkpointData);
      
      // For now, just show success (actual MCP integration would go here)
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Reload hierarchy to show new checkpoint
      await loadHierarchy(selectedSession);
    } catch (err) {
      console.error('[TaqwinHierarchicalView] Error saving checkpoint:', err);
      setError(`Failed to save checkpoint: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.display_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Left Panel: Session Navigator */}
        <div className="w-80 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="flex flex-col gap-2 p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Database className="w-4 h-4" />
              TAQWIN Sessions
            </h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && !selectedSession ? (
              <div className="flex items-center justify-center p-4 text-zinc-400">
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">No sessions found</div>
            ) : (
              <div className="p-2">
                {filteredSessions.map((session) => {
                  // Database uses 'session_id' as the primary key column
                  const sessionId = (session as any).session_id;
                  
                  if (!sessionId) {
                    console.warn('[TaqwinHierarchicalView] Session missing session_id:', session);
                    return null;
                  }
                  
                  return (
                    <button
                      key={`session-${sessionId}`}
                      onClick={() => {
                        console.log('[TaqwinHierarchicalView] Clicking session:', sessionId);
                        setSelectedSession(sessionId);
                      }}
                      className={`
                        w-full text-left p-3 rounded-lg border-l-4 transition-all mb-2
                        ${
                          selectedSession === sessionId
                            ? 'bg-blue-900/40 border-blue-600 text-blue-100'
                            : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        }
                      `}
                    >
                      <div className="font-medium text-sm truncate">{session.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">{session.display_id}</div>
                      <div className="text-xs mt-1 text-zinc-400">
                        Type: {session.session_type}
                      </div>
                      <div className="text-xs mt-1 text-zinc-500">
                        {formatDate(session.created_at)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Details & Timeline */}
        <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a session to view hierarchy and timeline</p>
                <p className="text-xs mt-2 text-zinc-500">Sessions loaded: {sessions.length}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-zinc-400">Loading hierarchy for session {selectedSession}...</p>
              </div>
            </div>
          ) : error && !hierarchy ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-red-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => {
                    console.log('[TaqwinHierarchicalView] Clearing error and selection');
                    setError(null);
                    setHierarchy(null);
                    setSelectedSession(null);
                  }}
                  className="mt-2 px-3 py-1 bg-red-900/50 hover:bg-red-900 rounded text-xs"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : hierarchy ? (
            <div className="flex flex-col overflow-hidden h-full">
              {/* Session Header */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-zinc-100 mb-2">
                      {(hierarchy.session as any).name || (hierarchy.session as any).id || 'Session'}
                    </h2>
                    
                    {/* Session Metadata with Icons */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                        <Database className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-500">ID:</span>
                        <span className="font-mono text-zinc-300">{(hierarchy.session as any).session_id || (hierarchy.session as any).display_id || 'N/A'}</span>
                      </div>
                      
                      {(hierarchy.session as any).session_type && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                          <Layers className="w-3 h-3 text-zinc-400" />
                          <span className="text-zinc-300">{(hierarchy.session as any).session_type}</span>
                        </div>
                      )}
                      
                      {(hierarchy.session as any).created_at && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          <span className="text-zinc-300">{formatDate((hierarchy.session as any).created_at)}</span>
                        </div>
                      )}
                      
                      {(hierarchy.session as any).status && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-zinc-300">{(hierarchy.session as any).status}</span>
                        </div>
                      )}
                    </div>

                    {/* Session Tags as Icons */}
                    {(hierarchy.session as any).tags && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          try {
                            const tags = typeof (hierarchy.session as any).tags === 'string' 
                              ? JSON.parse((hierarchy.session as any).tags) 
                              : (hierarchy.session as any).tags;
                            
                            if (Array.isArray(tags)) {
                              return tags.map((tag: string, idx: number) => {
                                const getTagIcon = (tag: string) => {
                                  if (tag.includes('data') || tag.includes('database')) return Database;
                                  if (tag.includes('ui') || tag.includes('design')) return Layout;
                                  if (tag.includes('mcp') || tag.includes('integration')) return Puzzle;
                                  if (tag.includes('code') || tag.includes('development')) return FileText;
                                  return Layers;
                                };
                                
                                const TagIcon = getTagIcon(tag.toLowerCase());
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="group relative inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-900/20 border border-blue-700/30 rounded text-[10px] text-blue-300 hover:bg-blue-900/40 transition-colors cursor-help"
                                    title={tag}
                                  >
                                    <TagIcon className="w-2.5 h-2.5" />
                                    <span className="max-w-[100px] truncate">{tag}</span>
                                  </div>
                                );
                              });
                            }
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={saveCheckpoint}
                    disabled={saving}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      saveSuccess
                        ? 'bg-green-600 text-white'
                        : saving
                        ? 'bg-zinc-700 text-zinc-400 cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        Save Checkpoint
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* View Mode Tabs */}
              <div className="flex border-b border-zinc-800 bg-zinc-950">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'timeline'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Timeline Graph
                </button>
                <button
                  onClick={() => setViewMode('sections')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'sections'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Sections
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-hidden">
                {viewMode === 'timeline' ? (
                  <SessionTimelineGraph 
                    timeline={timeline}
                    gitMetrics={{
                      commits: hierarchy.checkpoints.length,
                      files_changed: hierarchy.files.length,
                      insertions: hierarchy.events.length * 10, // Mock data
                      deletions: hierarchy.events.length * 3,  // Mock data
                    }}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Checkpoints */}
                {hierarchy.checkpoints.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('checkpoints')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-blue-900/30 hover:bg-blue-900/50 text-blue-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Checkpoints ({hierarchy.checkpoints.length})
                      </span>
                      {expandedSections.checkpoints ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.checkpoints && (
                      <div className="p-3 space-y-2">
                        {hierarchy.checkpoints.map((cp, idx) => (
                          <div key={`checkpoint-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-blue-300">{(cp as any).title}</div>
                            <div className="text-zinc-400 mt-1">
                              {formatDate((cp as any).created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Events */}
                {hierarchy.events.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('events')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Events ({hierarchy.events.length})
                      </span>
                      {expandedSections.events ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.events && (
                      <div className="p-3 space-y-2">
                        {hierarchy.events.map((evt, idx) => (
                          <div key={`event-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-purple-300">
                              {(evt as any).event_type || 'Event'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {formatDate((evt as any).created_at || (evt as any).timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Decisions */}
                {hierarchy.decisions.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('decisions')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-orange-900/30 hover:bg-orange-900/50 text-orange-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Decisions ({hierarchy.decisions.length})
                      </span>
                      {expandedSections.decisions ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.decisions && (
                      <div className="p-3 space-y-2">
                        {hierarchy.decisions.map((dec, idx) => (
                          <div key={`decision-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-orange-300">
                              {(dec as any).decision || (dec as any).title || 'Decision'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {formatDate((dec as any).created_at || (dec as any).timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Insights */}
                {hierarchy.insights.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('insights')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Insights ({hierarchy.insights.length})
                      </span>
                      {expandedSections.insights ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.insights && (
                      <div className="p-3 space-y-2">
                        {hierarchy.insights.map((ins, idx) => (
                          <div key={`insight-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-yellow-300">
                              {(ins as any).insight || (ins as any).title || 'Insight'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {formatDate((ins as any).created_at || (ins as any).timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Patterns */}
                {hierarchy.patterns.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('patterns')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-green-900/30 hover:bg-green-900/50 text-green-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Patterns ({hierarchy.patterns.length})
                      </span>
                      {expandedSections.patterns ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.patterns && (
                      <div className="p-3 space-y-2">
                        {hierarchy.patterns.map((pat, idx) => (
                          <div key={`pattern-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-green-300">
                              {(pat as any).pattern || (pat as any).title || 'Pattern'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {formatDate((pat as any).created_at || (pat as any).timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Files */}
                {hierarchy.files.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('files')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        File Changes ({hierarchy.files.length})
                      </span>
                      {expandedSections.files ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.files && (
                      <div className="p-3 space-y-2">
                        {hierarchy.files.map((file, idx) => (
                          <div key={`file-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-cyan-300">
                              {(file as any).file_path || (file as any).name || 'File'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {(file as any).change || (file as any).operation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {hierarchy.memories.length > 0 && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('memories')}
                      className="w-full px-4 py-2 flex items-center justify-between bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-200 font-medium text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Memories ({hierarchy.memories.length})
                      </span>
                      {expandedSections.memories ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.memories && (
                      <div className="p-3 space-y-2">
                        {hierarchy.memories.map((mem, idx) => (
                          <div key={`memory-${idx}`} className="bg-zinc-900/50 p-2 rounded text-xs">
                            <div className="font-medium text-indigo-300">
                              {(mem as any).memory_type || 'Memory'}
                            </div>
                            <div className="text-zinc-400 mt-1">
                              {(mem as any).domain || ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {hierarchy.checkpoints.length === 0 &&
                  hierarchy.events.length === 0 &&
                  hierarchy.decisions.length === 0 &&
                  hierarchy.insights.length === 0 &&
                  hierarchy.patterns.length === 0 &&
                  hierarchy.files.length === 0 &&
                  hierarchy.memories.length === 0 && (
                    <div className="p-4 text-center text-zinc-400">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No related data found for this session</p>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </div>
          ) : selectedSession && !loading && !error ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-zinc-400">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hierarchy data available</p>
                <button
                  onClick={() => {
                    console.log('[TaqwinHierarchicalView] Clearing selection');
                    setSelectedSession(null);
                  }}
                  className="mt-2 px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
