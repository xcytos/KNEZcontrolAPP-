import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Database, Network, Activity, FileText, BarChart3, RefreshCw } from 'lucide-react';

interface ExtractionSession {
  session_id: string;
  name: string;
  status: string;
  created_at: string;
  event_count: number;
}

interface PipelineStatus {
  extractor_running: boolean;
  mcp_server_running: boolean;
  api_server_port: number;
  last_pipeline_run?: string;
  total_sessions: number;
}

interface SearchResult {
  id: string;
  type: string;
  content: string;
  similarity: number;
  metadata: any;
}

interface TaqwinProject {
  path: string;
  name: string;
  sessionCount: number;
  lastModified: string;
}

export function ExtractionDashboard() {
  const [sessions, setSessions] = useState<ExtractionSession[]>([]);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [selectedSession, setSelectedSession] = useState<ExtractionSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
const [scanning, setScanning] = useState(false);
const [progress, setProgress] = useState(0);
  const [projects, setProjects] = useState<TaqwinProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');

  useEffect(() => {
    loadPipelineStatus();
    scanForProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadSessions();
    }
  }, [selectedProject]);

  const loadPipelineStatus = async () => {
    try {
      const status = await invoke<PipelineStatus>('extractor_pipeline_status');
      setStatus(status);
    } catch (error) {
      console.error('Failed to load pipeline status:', error);
    }
  };

  const scanForProjects = async () => {
    console.log("Scan triggered");
    setScanning(true);
    try {
      const projectList = await invoke<TaqwinProject[]>('extractor_scan_projects');
      console.log("API response:", projectList);
      setProjects(projectList);
      
      // Auto-select first project if available
      if (projectList.length > 0 && !selectedProject) {
        setSelectedProject(projectList[0].path);
        console.log("Auto-selected project:", projectList[0].path);
      }
    } catch (error) {
      console.error('Failed to scan for projects:', error);
    } finally {
      setScanning(false);
    }
  };

  const loadSessions = async () => {
    try {
      const sessions = await invoke<ExtractionSession[]>('extractor_get_sessions');
      setSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    setLoading(true);
    try {
      const details = await invoke('extractor_get_session_details', { sessionId });
      setSessionDetails(details);
      
      const graph = await invoke('extractor_get_graph', { sessionId });
      setGraphData(graph);
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await invoke<{ results: SearchResult[] }>('extractor_search_vector', { 
        query: searchQuery, 
        topK: 10 
      });
      setSearchResults(results.results || []);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHybridQuery = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await invoke<{ vector_results: SearchResult[] }>('extractor_hybrid_query', { query: searchQuery });
      setSearchResults(results.vector_results || []);
    } catch (error) {
      console.error('Failed to execute hybrid query:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (projectPath: string) => {
    setSelectedProject(projectPath);
    try {
      await invoke('extractor_set_taqwin_path', { path: projectPath });
      // Reload sessions after setting path
      await loadSessions();
    } catch (error) {
      console.error('Failed to set TAQWIN path:', error);
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    setProgress(25); // Initial progress
    try {
      // Reload projects list
      await scanForProjects();
      setProgress(50);
      
      // Reload sessions for current project
      await loadSessions();
      setProgress(75);
      
      // Reload pipeline status
      await loadPipelineStatus();
      setProgress(100);
      
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">TAQWIN Extraction Pipeline</h1>
        <p className="text-gray-600">Knowledge extraction and analysis dashboard</p>
      </div>

      {/* Project Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Project Selection</h2>
          <div className="flex gap-2">
            <button
              onClick={scanForProjects}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Database className="h-4 w-4" />
              )}
              {scanning ? 'Scanning...' : 'Scan Projects'}
            </button>
            <button
              onClick={handleRefreshData}
              disabled={scanning}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </button>
          </div>
        </div>
        
        {projects.length > 0 ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select .taqwin Project:
            </label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectSelect(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {projects.map((project) => (
                <option key={project.path} value={project.path}>
                  {project.name} ({project.sessionCount} sessions)
                </option>
              ))}
            </select>
            {selectedProject && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Selected:</strong> {projects.find(p => p.path === selectedProject)?.name}
                </p>
                <p className="text-xs text-gray-500">
                  Path: {selectedProject}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No .taqwin projects found</p>
            <p className="text-sm">Click "Scan Projects" to search for .taqwin directories</p>
          </div>
        )}
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-500">Extractor</p>
              <p className={`text-lg font-semibold ${status?.extractor_running ? 'text-green-600' : 'text-red-600'}`}>
                {status?.extractor_running ? 'Running' : 'Stopped'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-500">MCP Server</p>
              <p className={`text-lg font-semibold ${status?.mcp_server_running ? 'text-green-600' : 'text-red-600'}`}>
                {status?.mcp_server_running ? 'Running' : 'Stopped'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Network className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-gray-500">API Server</p>
              <p className="text-lg font-semibold text-green-600">Port {status?.api_server_port || 8000}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-gray-500">Total Sessions</p>
              <p className="text-lg font-semibold text-gray-900">{status?.total_sessions || 0}</p>
            </div>
          </div>
        </div>
        
        {/* Progress Indicator */}
        {(loading || progress > 0) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4">
              <div className="flex items-center space-x-4">
                {loading && (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                )}
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {progress > 0 ? `Processing... ${progress}%` : 'Loading data...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Knowledge Search</h2>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions, events, or patterns..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Vector Search
          </button>
          <button
            onClick={handleHybridQuery}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Hybrid Query
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Search Results</h3>
            {searchResults.map((result, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{result.content}</p>
                    <p className="text-sm text-gray-500">Type: {result.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Similarity</p>
                    <p className="font-medium text-blue-600">{(result.similarity * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Extraction Sessions</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                onClick={() => {
                  setSelectedSession(session);
                  loadSessionDetails(session.session_id);
                }}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedSession?.session_id === session.session_id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{session.name}</p>
                    <p className="text-sm text-gray-500">{session.session_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{session.event_count} events</p>
                    <p className="text-xs text-gray-400">{new Date(session.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Session Details</h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading session details...</p>
              </div>
            ) : sessionDetails ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Summary</h3>
                  <p className="text-gray-600">{sessionDetails.summary}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-medium">{sessionDetails.metadata?.duration_minutes || 0} minutes</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Events</p>
                      <p className="font-medium">{sessionDetails.metadata?.event_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Success Rate</p>
                      <p className="font-medium text-green-600">
                        {sessionDetails.metadata?.success_count || 0} / {sessionDetails.metadata?.event_count || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Errors</p>
                      <p className="font-medium text-red-600">{sessionDetails.metadata?.error_count || 0}</p>
                    </div>
                  </div>
                </div>

                {graphData && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Knowledge Graph</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Nodes: {graphData.metadata?.total_nodes || 0} | 
                        Edges: {graphData.metadata?.total_edges || 0}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Select a session to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
