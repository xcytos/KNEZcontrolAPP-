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
  GitBranch,
  AlertTriangle,
  GitCommit,
} from 'lucide-react';
import { 
  taqwinDataService, 
  SessionHierarchy, 
  SessionListItem,
  Project,
  DataIntegrityIssues,
  GitStats 
} from '../../services/data/TaqwinDataService';
import { SessionEvolutionChart } from './components/SessionEvolutionChart';
import { SessionEvolutionFullView } from './components/SessionEvolutionFullView';
import { genericSqliteService } from '../../services/data/GenericSqliteService';
import { DocumentList, Document } from './components/DocumentList';
import { DocumentDetailPanel } from './components/DocumentDetailPanel';
import { ensurePostgresConnection } from '../../services/data/PostgresConnectionManager';
import { RelationshipGraph } from './components/RelationshipGraph';

type ViewLevel = 'projects' | 'sessions' | 'session-detail';

export const TaqwinHierarchicalView: React.FC<{
  onNavigateToSqlite?: (tableName: string, filter?: string, issueType?: string) => void;
  onActivityContextChange?: (context: { sessionId?: string; sessionName?: string; projectId?: string }) => void;
}> = ({ onNavigateToSqlite, onActivityContextChange }) => {
  // View state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [projectBreadcrumb, setProjectBreadcrumb] = useState<Project[]>([]); // Navigation breadcrumb trail
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set()); // Track which parent projects are expanded
  
  // Data state
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [allSessions, setAllSessions] = useState<SessionListItem[]>([]); // For session_id search
  const [hierarchy, setHierarchy] = useState<SessionHierarchy | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [integrityIssues, setIntegrityIssues] = useState<DataIntegrityIssues | null>(null);
  const [gitStats, setGitStats] = useState<GitStats | null>(null);
  const [sessionDocuments, setSessionDocuments] = useState<Document[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]); // For Level 1 counts
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'sections'>('timeline');
  const [showIssues, setShowIssues] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showRelationshipGraph, setShowRelationshipGraph] = useState(false);
  const [showSessionFullView, setShowSessionFullView] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    project_id: '',
    project_name: '',
    project_path: '',
    description: '',
  });

  // Load projects on mount
  useEffect(() => {
    taqwinDataService.setDatabasePath('C:\\Users\\syedm\\taqwin_memory.db');
    ensurePostgresConnection(); // Use shared utility
    
    // Load core data
    loadProjects();
    loadIntegrityIssues();
    
    // Load optional data in background (don't block UI)
    loadAllDocuments().catch(err => console.warn('[TaqwinHierarchicalView] Background document load failed:', err));
    loadAllSessions().catch(err => console.warn('[TaqwinHierarchicalView] Background session load failed:', err));
  }, []);

  // Notify parent of activity context changes
  useEffect(() => {
    if (onActivityContextChange) {
      if (viewLevel === 'session-detail' && selectedSessionId && hierarchy) {
        onActivityContextChange({
          sessionId: selectedSessionId,
          sessionName: (hierarchy.session as any)?.name,
          projectId: selectedProjectId || undefined,
        });
      } else if (viewLevel === 'sessions' && selectedProjectId) {
        onActivityContextChange({
          projectId: selectedProjectId,
          sessionId: undefined,
          sessionName: undefined,
        });
      } else {
        onActivityContextChange({});
      }
    }
  }, [viewLevel, selectedSessionId, selectedProjectId, hierarchy, onActivityContextChange]);

  const loadAllDocuments = async () => {
    try {
      console.log('[TaqwinHierarchicalView] Loading all documents...');
      const docs = await taqwinDataService.getSessionDocuments(''); // Empty string to get all
      console.log('[TaqwinHierarchicalView] All documents loaded:', docs.length);
      setAllDocuments(docs);
    } catch (err) {
      console.warn('[TaqwinHierarchicalView] Could not load all documents:', err);
      setAllDocuments([]);
    }
  };

  const loadAllSessions = async () => {
    try {
      const allSessionsData = await taqwinDataService.listSessions(10000); // Get all sessions
      console.log('[TaqwinHierarchicalView] All sessions loaded:', allSessionsData.length);
      setAllSessions(allSessionsData);
    } catch (err) {
      console.warn('[TaqwinHierarchicalView] Could not load all sessions:', err);
      setAllSessions([]);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await taqwinDataService.getProjectHierarchy(); // Use hierarchy instead of flat list
      console.log('[TaqwinHierarchicalView] Projects hierarchy loaded:', projectData);
      
      // Load session counts for each project (recursively for children)
      const allSessions = await taqwinDataService.listSessions(10000);
      
      const enrichProjects = (projects: Project[]): Project[] => {
        return projects.map(project => {
          const projectSessions = allSessions.filter(s => s.project_id === project.project_id);
          return {
            ...project,
            sessions: projectSessions,
            children: project.children ? enrichProjects(project.children) : []
          };
        });
      };
      
      const enrichedProjects = enrichProjects(projectData);
      setProjects(enrichedProjects);
      
      // Count orphaned sessions
      const orphanedSessions = allSessions.filter((s: any) => !s.project_id || s.project_id === '');
      if (orphanedSessions.length > 0) {
        console.log('[TaqwinHierarchicalView] Found orphaned sessions:', orphanedSessions.length);
      }
    } catch (err) {
      const errorMsg = `Failed to load projects: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('[TaqwinHierarchicalView] Error loading projects:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadIntegrityIssues = async () => {
    try {
      const issues = await taqwinDataService.getDataIntegrityIssues();
      setIntegrityIssues(issues);
    } catch (err) {
      console.error('[TaqwinHierarchicalView] Error loading integrity issues:', err);
    }
  };

  const loadProjectSessions = async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Find the project in hierarchy
      const findProject = (projects: Project[], id: string): Project | null => {
        for (const p of projects) {
          if (p.project_id === id) return p;
          if (p.children) {
            const found = findProject(p.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const project = findProject(projects, projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      // Build breadcrumb trail
      const buildBreadcrumb = (projects: Project[], targetId: string, trail: Project[] = []): Project[] | null => {
        for (const p of projects) {
          const newTrail = [...trail, p];
          if (p.project_id === targetId) {
            return newTrail;
          }
          if (p.children) {
            const found = buildBreadcrumb(p.children, targetId, newTrail);
            if (found) return found;
          }
        }
        return null;
      };
      
      const breadcrumb = buildBreadcrumb(projects, projectId) || [project];
      setProjectBreadcrumb(breadcrumb);
      
      const projectSessions = await taqwinDataService.getProjectSessions(projectId);
      console.log('[TaqwinHierarchicalView] Project sessions loaded:', projectSessions);
      setSessions(projectSessions);
      setViewLevel('sessions');
      
      // Load Git stats for this project
      if (project.project_path) {
        const stats = await taqwinDataService.getProjectGitStats(project.project_path);
        setGitStats(stats);
      }
      
      // Load project documents - fetch fresh data for all sessions
      try {
        console.log('[TaqwinHierarchicalView] Loading documents for project sessions...');
        const sessionIds = projectSessions.map((s) => s.session_id || s.id).filter(Boolean);
        
        // Fetch documents for each session (parallel requests)
        const docPromises = sessionIds.map(sessionId => 
          taqwinDataService.getSessionDocuments(sessionId).catch(err => {
            console.warn(`[TaqwinHierarchicalView] Failed to load docs for session ${sessionId}:`, err);
            return [];
          })
        );
        
        const docsArrays = await Promise.all(docPromises);
        const allProjectDocs = docsArrays.flat();
        
        // Deduplicate by document_id
        const uniqueDocs = Array.from(
          new Map(allProjectDocs.map(doc => [doc.document_id, doc])).values()
        );
        
        console.log('[TaqwinHierarchicalView] Project documents loaded:', uniqueDocs.length, 'unique docs from', sessionIds.length, 'sessions');
        setProjectDocuments(uniqueDocs);
      } catch (docErr) {
        console.warn('[TaqwinHierarchicalView] Could not load project documents:', docErr);
        setProjectDocuments([]);
      }
    } catch (err) {
      const errorMsg = `Failed to load sessions: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('[TaqwinHierarchicalView] Error loading sessions:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionHierarchy = async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      setHierarchy(null);
      
      console.log('[TaqwinHierarchicalView] Loading hierarchy for session:', sessionId);
      const data = await taqwinDataService.getSessionHierarchy(sessionId);
      console.log('[TaqwinHierarchicalView] Hierarchy loaded:', data);
      setHierarchy(data);
      
      // Build timeline
      console.log('[TaqwinHierarchicalView] Loading timeline...');
      const timelineData = await taqwinDataService.getSessionTimeline(sessionId);
      console.log('[TaqwinHierarchicalView] Timeline loaded:', timelineData.length, 'items');
      setTimeline(timelineData);
      
      // Load session documents
      try {
        const docs = await taqwinDataService.getSessionDocuments(sessionId);
        console.log('[TaqwinHierarchicalView] Session documents loaded:', docs);
        setSessionDocuments(docs || []);
      } catch (docErr) {
        console.warn('[TaqwinHierarchicalView] Could not load session documents:', docErr);
        setSessionDocuments([]);
      }
      
      console.log('[TaqwinHierarchicalView] Setting view level to session-detail');
      setViewLevel('session-detail');
      setExpandedSections({
        checkpoints: true,
        events: true,
        decisions: true,
        documents: true,
      });
      console.log('[TaqwinHierarchicalView] Hierarchy loading complete');
    } catch (err) {
      const errorMsg = `Failed to load hierarchy: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('[TaqwinHierarchicalView] Error loading hierarchy:', err);
      setError(errorMsg);
    } finally {
      console.log('[TaqwinHierarchicalView] Finally block - clearing loading state');
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const navigateBack = () => {
    setLoading(false); // Clear any stuck loading state
    setError(null); // Clear any errors
    
    if (viewLevel === 'session-detail') {
      setViewLevel('sessions');
      setSelectedSessionId(null);
      setHierarchy(null);
      setTimeline([]);
    } else if (viewLevel === 'sessions') {
      // If we have a breadcrumb trail with parent, go back to parent project
      if (projectBreadcrumb.length > 1) {
        const parentProject = projectBreadcrumb[projectBreadcrumb.length - 2];
        setSelectedProjectId(parentProject.project_id);
        loadProjectSessions(parentProject.project_id);
      } else {
        // Go back to root projects view
        setViewLevel('projects');
        setSelectedProjectId(null);
        setSessions([]);
        setProjectBreadcrumb([]);
      }
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const renderProjectTree = (projectList: Project[], level: number = 0) => {
    return projectList.map((project) => {
      const getAllSessionsFromProject = (p: Project): SessionListItem[] => {
        const sessions = p.sessions || [];
        if (p.children) {
          return sessions.concat(...p.children.map(getAllSessionsFromProject));
        }
        return sessions;
      };
      
      const allProjectSessions = getAllSessionsFromProject(project);
      const projectSessionIds = allProjectSessions.map((s) => s.session_id || s.id).filter(Boolean);
      const projectDocCount = allDocuments.filter(doc => 
        doc.session_id && projectSessionIds.includes(doc.session_id)
      ).length;
      
      const hasChildren = project.children && project.children.length > 0;
      const isExpanded = expandedProjects.has(project.project_id);
      
      return (
        <div key={project.project_id} style={{ marginLeft: `${level * 16}px` }}>
          {/* Project Card */}
          <div className="mb-1">
            <div className="flex items-stretch gap-1">
              {/* Expand/Collapse Button (only for parents) */}
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProjectExpand(project.project_id);
                  }}
                  className="w-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>
              )}
              
              {/* Project Card Button */}
              <button
                onClick={() => {
                  setSelectedProjectId(project.project_id);
                  loadProjectSessions(project.project_id);
                }}
                className={`flex-1 text-left p-2.5 rounded border transition-all ${
                  !hasChildren && level > 0
                    ? 'border-l-4 border-l-blue-600 border-zinc-700 hover:border-blue-600 hover:bg-blue-900/10'
                    : hasChildren 
                      ? 'border-amber-700 hover:border-amber-600 bg-amber-900/5 hover:bg-amber-900/15'
                      : 'border-zinc-700 hover:border-purple-600 hover:bg-zinc-800/50'
                }`}
              >
                {/* Project Name */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {level > 0 && <span className="text-zinc-600">└</span>}
                    <span className="font-medium text-sm text-zinc-100">
                      {project.project_name}
                    </span>
                    {hasChildren && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded">
                        📦 {project.children!.length}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Project ID */}
                <div className="text-[10px] text-zinc-500 font-mono mb-1.5">
                  {project.project_id}
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-300 rounded">
                    {project.sessions?.length || 0} sessions
                  </span>
                  <span className="px-1.5 py-0.5 bg-pink-900/30 text-pink-300 rounded">
                    {projectDocCount} docs
                  </span>
                </div>
              </button>
            </div>
          </div>
          
          {/* Render Children if Expanded */}
          {hasChildren && isExpanded && renderProjectTree(project.children!, level + 1)}
        </div>
      );
    });
  };

  const handleAddProject = async () => {
    try {
      // Validate required fields
      if (!newProjectData.project_id || !newProjectData.project_name || !newProjectData.project_path) {
        alert('Please fill in all required fields: Project ID, Project Name, and Project Path');
        return;
      }

      // Generate timestamp in IST
      const now = new Date();
      const istTimestamp = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('T', ' ').substring(0, 19);

      // Insert project into database
      const insertQuery = `
        INSERT INTO projects (project_id, project_name, project_path, description, created_at, last_accessed)
        VALUES ('${newProjectData.project_id}', '${newProjectData.project_name}', '${newProjectData.project_path}', '${newProjectData.description || ''}', '${istTimestamp}', '${istTimestamp}')
      `;

      await genericSqliteService.executeQuery(insertQuery);

      // Close modal and reset form
      setShowAddProjectModal(false);
      setNewProjectData({
        project_id: '',
        project_name: '',
        project_path: '',
        description: '',
      });

      // Reload projects list
      await loadProjects();

      alert('Project added successfully!');
    } catch (err) {
      console.error('[TaqwinHierarchicalView] Error adding project:', err);
      alert(`Failed to add project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSessions = sessions.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.display_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Session ID search results (Level 1 view only)
  const sessionIdSearchResults = viewLevel === 'projects' && searchTerm.length > 0
    ? allSessions.filter((s) => {
        const sessionId = s.session_id || s.id || '';
        return sessionId.toLowerCase().includes(searchTerm.toLowerCase());
      }).slice(0, 5) // Show top 5 matches
    : [];

  // Direct navigation to session by ID
  const navigateToSessionDirect = async (sessionId: string, projectId: string) => {
    try {
      setError(null);
      
      // Clear search term to hide search results
      setSearchTerm('');
      
      // Set project context
      setSelectedProjectId(projectId);
      
      // Navigate directly to session without loading all project sessions
      setSelectedSessionId(sessionId);
      
      // loadSessionHierarchy manages its own loading state
      await loadSessionHierarchy(sessionId);
    } catch (err) {
      console.error('[TaqwinHierarchicalView] Error navigating to session:', err);
      setError(`Failed to navigate to session: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false); // Ensure loading is cleared on error
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Left Panel: Navigator */}
        <div className="w-80 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          {/* Address Bar - Always visible breadcrumb */}
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2 text-xs">
            <Database className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <div className="flex items-center gap-1 text-zinc-400 flex-1 min-w-0 overflow-x-auto">
              <button
                onClick={() => {
                  if (viewLevel !== 'projects') {
                    setViewLevel('projects');
                    setSelectedProjectId(null);
                    setSelectedSessionId(null);
                    setSessions([]);
                    setProjectBreadcrumb([]);
                  }
                }}
                className={`hover:text-purple-400 transition-colors whitespace-nowrap ${
                  viewLevel === 'projects' ? 'text-purple-300 font-medium' : ''
                }`}
              >
                Projects
              </button>
              
              {projectBreadcrumb.length > 0 && (
                <>
                  {projectBreadcrumb.map((project, index) => (
                    <React.Fragment key={project.project_id}>
                      <span className="text-zinc-600">/</span>
                      <button
                        onClick={() => {
                          if (index < projectBreadcrumb.length - 1 || viewLevel === 'session-detail') {
                            setSelectedProjectId(project.project_id);
                            loadProjectSessions(project.project_id);
                          }
                        }}
                        className={`hover:text-purple-400 transition-colors whitespace-nowrap ${
                          index === projectBreadcrumb.length - 1 && viewLevel !== 'session-detail'
                            ? 'text-purple-300 font-medium' 
                            : ''
                        }`}
                      >
                        {project.project_name}
                      </button>
                    </React.Fragment>
                  ))}
                  
                  {viewLevel === 'session-detail' && hierarchy && (
                    <>
                      <span className="text-zinc-600">/</span>
                      <span className="text-purple-300 font-medium whitespace-nowrap truncate">
                        {(hierarchy.session as any).display_id}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                {viewLevel === 'projects' && (
                  <>
                    <Database className="w-4 h-4" />
                    Projects
                  </>
                )}
                {viewLevel === 'sessions' && (
                  <>
                    <GitBranch className="w-4 h-4" />
                    Sessions
                  </>
                )}
                {viewLevel === 'session-detail' && (
                  <>
                    <FileText className="w-4 h-4" />
                    Details
                  </>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {viewLevel === 'projects' && (
                  <>
                    <button
                      onClick={() => setShowAddProjectModal(true)}
                      className="p-1 hover:bg-zinc-800 rounded transition-colors"
                      title="Add new project"
                    >
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        loadProjects();
                        loadIntegrityIssues();
                      }}
                      className="p-1 hover:bg-zinc-800 rounded transition-colors"
                      title="Refresh projects"
                    >
                      <Loader className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                  </>
                )}
                {viewLevel !== 'projects' && (
                  <button
                    onClick={navigateBack}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300"
                  >
                    ← Back
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder={
                  viewLevel === 'projects' 
                    ? 'Search projects or session ID...' 
                    : 'Search sessions...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && viewLevel === 'projects' ? (
              <div className="flex items-center justify-center p-4 text-zinc-400">
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Loading projects...
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-400">{error}</div>
            ) : viewLevel === 'projects' ? (
              /* Projects View - Tree structure */
              <div className="p-2 space-y-2">
                {/* Session ID Search Results */}
                {sessionIdSearchResults.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-green-400 mb-2 px-2 flex items-center gap-2">
                      <Search className="w-3 h-3" />
                      Sessions by ID ({sessionIdSearchResults.length})
                    </div>
                    {sessionIdSearchResults.map((session) => {
                      const sessionProject = projects.find(p => p.project_id === session.project_id);
                      return (
                        <button
                          key={session.session_id || session.id}
                          onClick={() => navigateToSessionDirect(session.session_id || session.id, session.project_id || '')}
                          className="w-full text-left p-3 rounded-lg border border-green-700 bg-green-900/20 hover:bg-green-900/40 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-medium text-xs text-green-100 truncate flex-1">
                              {session.name || 'Unnamed Session'}
                            </div>
                            <div className="text-[10px] text-green-400 font-mono">
                              {session.display_id}
                            </div>
                          </div>
                          <div className="text-[10px] text-green-300 font-mono truncate mb-1">
                            ID: {session.session_id || session.id}
                          </div>
                          {sessionProject && (
                            <div className="text-[10px] text-green-500">
                              Project: {sessionProject.project_name}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    <div className="border-t border-zinc-700 my-2"></div>
                  </div>
                )}

                {/* Hierarchical Project Tree */}
                {filteredProjects.length === 0 && sessionIdSearchResults.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500">No projects or sessions found</div>
                ) : (
                  renderProjectTree(filteredProjects)
                )}
              </div>
            ) : viewLevel === 'sessions' ? (
              /* Sessions View */
              loading ? (
                <div className="flex items-center justify-center p-4 text-zinc-400">
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Loading sessions...
                </div>
              ) : (
                <div className="p-2">
                  {filteredSessions.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-500">No sessions found for this project</div>
                  ) : (
                    filteredSessions.map((session) => {
                      const sessionId = session.session_id || session.id;
                      if (!sessionId) return null;

                      return (
                        <button
                          key={sessionId}
                          onClick={() => {
                            setSelectedSessionId(sessionId);
                            loadSessionHierarchy(sessionId);
                          }}
                          className={`w-full text-left p-3 rounded-lg border-l-4 transition-all mb-2
                            ${selectedSessionId === sessionId
                              ? 'bg-blue-900/40 border-blue-600 text-blue-100'
                              : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                            }`}
                        >
                          <div className="font-medium text-sm truncate mb-1">{session.name || 'Unnamed Session'}</div>
                          <div className="text-xs text-zinc-500 font-mono mb-1">{session.display_id || 'No ID'}</div>
                          <div className="text-xs mt-1 text-zinc-400">
                            Type: {session.session_type || 'Unknown'}
                          </div>
                          {session.checkpoint_count !== undefined && session.event_count !== undefined && (
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-300 rounded">
                                {session.checkpoint_count} checkpoints
                              </span>
                              <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-300 rounded">
                                {session.event_count} events
                              </span>
                            </div>
                          )}
                          <div className="text-xs mt-1 text-zinc-500">
                            {formatDate(session.created_at)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )
            ) : viewLevel === 'session-detail' ? (
              /* Session Detail Sidebar - Show session info and documents */
              <div className="p-2 space-y-2">
                {selectedSessionId && hierarchy && (
                  <>
                    <div className="bg-blue-900/40 border-l-4 border-blue-600 p-3 rounded-lg mb-3">
                      <div className="font-medium text-sm text-blue-100">
                        {(hierarchy.session as any).name || 'Session'}
                      </div>
                      <div className="text-xs text-blue-300 mt-1 font-mono">
                        {(hierarchy.session as any).session_id}
                      </div>
                      <div className="text-xs text-blue-200 mt-2">
                        📊 {hierarchy.checkpoints?.length || 0} checkpoints • {hierarchy.events?.length || 0} events
                      </div>
                    </div>

                    {/* Document List in Left Panel */}
                    {sessionDocuments.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <FileText className="w-3.5 h-3.5 text-pink-400" />
                          <h4 className="text-xs font-semibold text-zinc-300">
                            Documents ({sessionDocuments.length})
                          </h4>
                        </div>
                        <DocumentList
                          documents={sessionDocuments.sort((a, b) =>
                            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                          )}
                          onDocumentClick={(doc) => setSelectedDocument(doc)}
                          compact={true}
                          showSessionInfo={false}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          {viewLevel === 'projects' ? (
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-200">Database Overview</h3>
                <p className="text-xs text-zinc-500 mt-1">Data integrity and statistics</p>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Data Integrity Issues */}
                {integrityIssues && (
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                    <button
                      onClick={() => setShowIssues(!showIssues)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <div className="text-left">
                          <div className="font-medium text-sm text-zinc-200">Data Integrity Issues</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {Object.values(integrityIssues).reduce((a, b) => a + b, 0)} total issues found
                          </div>
                        </div>
                      </div>
                      {showIssues ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                    </button>
                    
                    {showIssues && (
                      <div className="p-4 space-y-3">
                        {integrityIssues.sessionsWithoutProjects > 0 && (
                          <button
                            onClick={() => onNavigateToSqlite?.('sessions', 'project_id IS NULL', 'Sessions Without Projects')}
                            className="w-full flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-800/30 rounded hover:bg-amber-900/30 transition-colors text-left"
                          >
                            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-amber-200">
                                {integrityIssues.sessionsWithoutProjects} sessions without projects
                              </div>
                              <div className="text-xs text-amber-300/70 mt-1">
                                Click to view and fix • These sessions are not linked to any project
                              </div>
                            </div>
                          </button>
                        )}
                        
                        {integrityIssues.checkpointsWithoutSessions > 0 && (
                          <button
                            onClick={() => onNavigateToSqlite?.('checkpoints', 'session_id NOT IN (SELECT session_id FROM sessions)', 'Orphaned Checkpoints')}
                            className="w-full flex items-start gap-3 p-3 bg-red-900/20 border border-red-800/30 rounded hover:bg-red-900/30 transition-colors text-left"
                          >
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-red-200">
                                {integrityIssues.checkpointsWithoutSessions} orphaned checkpoints
                              </div>
                              <div className="text-xs text-red-300/70 mt-1">
                                Click to view and delete • These checkpoints reference non-existent sessions
                              </div>
                            </div>
                          </button>
                        )}
                        
                        {integrityIssues.eventsWithoutSessions > 0 && (
                          <button
                            onClick={() => onNavigateToSqlite?.('events', 'session_id NOT IN (SELECT session_id FROM sessions)', 'Orphaned Events')}
                            className="w-full flex items-start gap-3 p-3 bg-red-900/20 border border-red-800/30 rounded hover:bg-red-900/30 transition-colors text-left"
                          >
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-red-200">
                                {integrityIssues.eventsWithoutSessions} orphaned events
                              </div>
                              <div className="text-xs text-red-300/70 mt-1">
                                Click to view and delete • These events reference non-existent sessions
                              </div>
                            </div>
                          </button>
                        )}
                        
                        {integrityIssues.emptyCheckpoints > 0 && (
                          <button
                            onClick={() => onNavigateToSqlite?.('checkpoints', 'learned_memories IS NULL OR learned_memories = "[]"', 'Empty Checkpoints')}
                            className="w-full flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded hover:bg-yellow-900/30 transition-colors text-left"
                          >
                            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-yellow-200">
                                {integrityIssues.emptyCheckpoints} checkpoints with no learned memories
                              </div>
                              <div className="text-xs text-yellow-300/70 mt-1">
                                Click to review • These checkpoints don't contain any learned memories
                              </div>
                            </div>
                          </button>
                        )}
                        
                        {integrityIssues.emptyEvents > 0 && (
                          <button
                            onClick={() => onNavigateToSqlite?.('events', "event_type = 'dev_event' AND (content IS NULL OR content = '{}' OR content NOT LIKE '%\"files\":%')", 'Empty Dev Events')}
                            className="w-full flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded hover:bg-yellow-900/30 transition-colors text-left"
                          >
                            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-yellow-200">
                                {integrityIssues.emptyEvents} events with no file changes
                              </div>
                              <div className="text-xs text-yellow-300/70 mt-1">
                                Click to review • These dev events don't contain any file change data
                              </div>
                            </div>
                          </button>
                        )}
                        
                        {Object.values(integrityIssues).every(v => v === 0) && (
                          <div className="flex items-start gap-3 p-3 bg-green-900/20 border border-green-800/30 rounded">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-green-200">
                                No data integrity issues found
                              </div>
                              <div className="text-xs text-green-300/70 mt-1">
                                All sessions, checkpoints, and events are properly linked
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Project Stats */}
                <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-blue-400" />
                    <h4 className="font-medium text-sm text-zinc-200">Project Statistics</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-900/50 rounded">
                      <div className="text-2xl font-bold text-blue-400">{projects.length}</div>
                      <div className="text-xs text-zinc-500 mt-1">Total Projects</div>
                    </div>
                    <div className="p-3 bg-zinc-900/50 rounded">
                      <div className="text-2xl font-bold text-purple-400">
                        {projects.reduce((sum, p) => sum + (p.sessions?.length || 0), 0)}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Total Sessions</div>
                    </div>
                  </div>
                </div>

                {/* Relationship Graph Button */}
                <button
                  onClick={() => setShowRelationshipGraph(true)}
                  className="w-full bg-gradient-to-r from-purple-900/40 to-blue-900/40 hover:from-purple-900/60 hover:to-blue-900/60 border border-purple-600 rounded-lg p-4 transition-all shadow-lg hover:shadow-purple-600/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-purple-300" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-purple-100">Relationship Graph</div>
                        <div className="text-xs text-purple-300/70 mt-0.5">
                          Visualize project connections
                        </div>
                      </div>
                    </div>
                    <div className="text-purple-400">→</div>
                  </div>
                </button>
              </div>
            </div>
          ) : viewLevel === 'sessions' ? (
            <div className="flex-1 flex gap-4">
              {/* Left: Project Documents */}
              <div className="w-80 flex flex-col border-r border-zinc-800 bg-zinc-900/30 overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                  <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-pink-400" />
                    Project Documents
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">{projectDocuments.length} documents</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {projectDocuments.length > 0 ? (
                    <DocumentList
                      documents={projectDocuments.sort((a, b) =>
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                      )}
                      onDocumentClick={(doc) => setSelectedDocument(doc)}
                      compact={true}
                      showSessionInfo={true}
                    />
                  ) : (
                    <div className="text-center py-8 text-zinc-500">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <div className="text-xs">No project documents</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Git Stats and Session Summary */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800">
                  <h3 className="text-base font-semibold text-zinc-200">Project Details</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {projects.find(p => p.project_id === selectedProjectId)?.project_name || 'Unknown Project'}
                  </p>
                </div>
                
                {/* Content - Smaller Fonts */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Git Statistics - Smaller */}
                  {gitStats && gitStats.is_valid_repo && (
                    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <GitCommit className="w-3.5 h-3.5 text-orange-400" />
                        <h4 className="font-medium text-xs text-zinc-200">Git Statistics</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-1.5 bg-zinc-900/50 rounded">
                          <span className="text-[10px] text-zinc-400">Branch:</span>
                          <span className="text-[10px] font-mono text-zinc-200">{gitStats.branch}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <div className="p-1.5 bg-zinc-900/50 rounded">
                            <div className="text-sm font-bold text-blue-400">{gitStats.total_commits}</div>
                            <div className="text-[9px] text-zinc-500">Commits</div>
                          </div>
                          <div className="p-1.5 bg-zinc-900/50 rounded">
                            <div className="text-sm font-bold text-cyan-400">{gitStats.total_files_changed}</div>
                            <div className="text-[9px] text-zinc-500">Files</div>
                          </div>
                          <div className="p-1.5 bg-zinc-900/50 rounded">
                            <div className="text-sm font-bold text-green-400">+{gitStats.total_insertions}</div>
                            <div className="text-[9px] text-zinc-500">Add</div>
                          </div>
                          <div className="p-1.5 bg-zinc-900/50 rounded">
                            <div className="text-sm font-bold text-red-400">-{gitStats.total_deletions}</div>
                            <div className="text-[9px] text-zinc-500">Del</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {gitStats && !gitStats.is_valid_repo && (
                    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <GitBranch className="w-3.5 h-3.5" />
                        <span className="text-xs">Not a Git repository</span>
                      </div>
                    </div>
                  )}

                  {/* Session Summary - Smaller */}
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                      <h4 className="font-medium text-xs text-zinc-200">Sessions Summary</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-zinc-900/50 rounded">
                        <div className="text-lg font-bold text-purple-400">{sessions.length}</div>
                        <div className="text-[9px] text-zinc-500">Total Sessions</div>
                      </div>
                      <div className="p-2 bg-zinc-900/50 rounded">
                        <div className="text-lg font-bold text-blue-400">
                          {sessions.reduce((sum, s) => sum + (s.checkpoint_count || 0), 0)}
                        </div>
                        <div className="text-[9px] text-zinc-500">Total Checkpoints</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-zinc-400">Loading session details...</p>
              </div>
            </div>
          ) : hierarchy ? (
            <div className="flex flex-col overflow-hidden h-full">
              {/* Session Header */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-zinc-100 mb-2">
                      {(hierarchy.session as any).name || 'Session'}
                    </h2>
                    
                    {/* Session Metadata */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                        <Database className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-500">Display ID:</span>
                        <span className="font-mono text-zinc-300">{(hierarchy.session as any).display_id}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                        <Database className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-500">Session ID:</span>
                        <span className="font-mono text-zinc-300 text-[10px]">{(hierarchy.session as any).session_id}</span>
                      </div>
                      
                      {(hierarchy.session as any).session_type && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                          <Layers className="w-3 h-3 text-zinc-400" />
                          <span className="text-zinc-300">{(hierarchy.session as any).session_type}</span>
                        </div>
                      )}
                    </div>

                    {/* Session Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="p-2 bg-zinc-800/50 rounded">
                        <div className="text-lg font-bold text-blue-400">
                          {hierarchy?.checkpoints?.length || 0}
                        </div>
                        <div className="text-[10px] text-zinc-500">Checkpoints</div>
                      </div>
                      <div className="p-2 bg-zinc-800/50 rounded">
                        <div className="text-lg font-bold text-purple-400">
                          {hierarchy?.events?.length || 0}
                        </div>
                        <div className="text-[10px] text-zinc-500">Events</div>
                      </div>
                      <div className="p-2 bg-zinc-800/50 rounded">
                        <div className="text-lg font-bold text-pink-400">
                          {sessionDocuments.length}
                        </div>
                        <div className="text-[10px] text-zinc-500">Documents</div>
                      </div>
                    </div>
                  </div>
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
                  Evolution Analysis
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
                  Data Sections
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-hidden">
                {viewMode === 'timeline' ? (
                  <SessionEvolutionChart
                    timeline={timeline}
                    sessionStart={(hierarchy.session as any).created_at || ''}
                    sessionEnd={(hierarchy.session as any).updated_at || new Date().toISOString()}
                    sessionId={selectedSessionId || undefined}
                    onOpenFullView={() => setShowSessionFullView(true)}
                  />
                ) : (
                  <div className="h-full overflow-y-auto p-4 space-y-3">
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

                    {/* Insights, Patterns, Files */}
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
                          {expandedSections.insights ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

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
                          {expandedSections.files ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {/* Documents Section */}
                    {sessionDocuments.length > 0 && (
                      <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
                        <button
                          onClick={() => toggleSection('documents')}
                          className="w-full px-4 py-2 flex items-center justify-between bg-pink-900/30 hover:bg-pink-900/50 text-pink-200 font-medium text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Session Documents ({sessionDocuments.length})
                          </span>
                          {expandedSections.documents ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {expandedSections.documents && (
                          <div className="p-3">
                            <DocumentList
                              documents={sessionDocuments}
                              onDocumentClick={(doc) => setSelectedDocument(doc)}
                              compact={true}
                              showSessionInfo={false}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAddProjectModal(false)}>
          <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-6 w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-200">Add New Project</h3>
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Project ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectData.project_id}
                  onChange={(e) => setNewProjectData({ ...newProjectData, project_id: e.target.value })}
                  placeholder="e.g., 67746855-9cf3-4350-8b07-70a4cf18a639"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectData.project_name}
                  onChange={(e) => setNewProjectData({ ...newProjectData, project_name: e.target.value })}
                  placeholder="e.g., COZINN"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Project Path <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectData.project_path}
                  onChange={(e) => setNewProjectData({ ...newProjectData, project_path: e.target.value })}
                  placeholder="e.g., C:\Users\syedm\Downloads\coinn\cozinn\"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newProjectData.description}
                  onChange={(e) => setNewProjectData({ ...newProjectData, description: e.target.value })}
                  placeholder="e.g., COZINN Admin User Management UI"
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white font-medium transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Panel */}
      {selectedDocument && (
        <DocumentDetailPanel
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Relationship Graph */}
      {showRelationshipGraph && (
        <RelationshipGraph
          projects={projects}
          allSessions={allSessions}
          allDocuments={allDocuments}
          onClose={() => setShowRelationshipGraph(false)}
          onNavigateToProject={(projectId) => {
            setShowRelationshipGraph(false);
            setSelectedProjectId(projectId);
            loadProjectSessions(projectId);
          }}
          onNavigateToSession={(sessionId, projectId) => {
            setShowRelationshipGraph(false);
            navigateToSessionDirect(sessionId, projectId);
          }}
          onNavigateToDocument={(documentId) => {
            setShowRelationshipGraph(false);
            const doc = allDocuments.find(d => d.document_id === documentId);
            if (doc) {
              setSelectedDocument(doc);
            }
          }}
        />
      )}

      {/* Session Full View Modal */}
      {showSessionFullView && selectedSessionId && (
        <SessionEvolutionFullView
          sessionId={selectedSessionId}
          initialView="timeline"
          onClose={() => setShowSessionFullView(false)}
        />
      )}
    </div>
  );
};
