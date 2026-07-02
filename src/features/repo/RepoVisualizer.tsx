import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, GitBranch, AlertCircle, FolderTreeIcon } from 'lucide-react';
import type { FileNodeData, GitTreeEntry, GitStatusEntry, SessionFileMap } from '../../services/repo/types';
import { repoScannerService } from '../../services/repo/RepoScannerService';
import { sessionFileMapper } from '../../services/repo/SessionFileMapper';
import { RepoLegend } from './components/RepoLegend';
import { FileTree } from './components/FileTree';
import { RepoGraph } from './components/RepoGraph';
import { FileDetailPanel } from './components/FileDetailPanel';

interface ProjectOption {
  projectId: string;
  projectName: string;
  projectPath: string | null;
  sessionCount: number;
  isGitRepo: boolean;
}

interface RepoVisualizerProps {
  projects?: Array<{ project_id: string; project_name: string; project_path: string | null }>;
  dbPath?: string;
  allSessions?: Array<{ session_id: string; display_id: string; name: string; project_id?: string }>;
  currentSessionId?: string;
}

type ViewMode = 'tree' | 'graph';

export const RepoVisualizer = ({ projects = [], dbPath, allSessions = [], currentSessionId }: RepoVisualizerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [projectGitStatus, setProjectGitStatus] = useState<Record<string, boolean>>({});
  const [treeEntries, setTreeEntries] = useState<GitTreeEntry[]>([]);
  const [statusEntries, setStatusEntries] = useState<GitStatusEntry[]>([]);
  const [sessionFileMap, setSessionFileMap] = useState<SessionFileMap>({});
  const [selectedNode, setSelectedNode] = useState<FileNodeData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [repoType, setRepoType] = useState<'git' | 'filesystem' | 'none'>('none');

  const projectOptions = useMemo(() => {
    return projects
      .filter(p => p.project_path)
      .map(p => ({
        projectId: p.project_id,
        projectName: p.project_name,
        projectPath: p.project_path,
        sessionCount: allSessions.filter(s => s.project_id === p.project_id).length,
        isGitRepo: projectGitStatus[p.project_id] || false,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }, [projects, allSessions, projectGitStatus]);

  const projectSessions = useMemo(() => {
    if (!selectedProject) return [];
    return allSessions.filter(s => s.project_id === selectedProject.projectId);
  }, [allSessions, selectedProject]);

  useEffect(() => {
    if (projectOptions.length > 0 && !selectedProject) {
      setSelectedProject(projectOptions[0]);
    }
  }, [projectOptions]);

  useEffect(() => {
    if (!selectedProject?.projectPath) return;
    checkGitStatus(selectedProject);
    scanForProject(selectedProject);
  }, [selectedProject, refreshKey]);

  const checkGitStatus = async (project: ProjectOption) => {
    if (!project.projectPath) return;
    const wasSet = projectGitStatus[project.projectId];
    if (wasSet !== undefined) return;

    repoScannerService.setRepoPath(project.projectPath);
    const isGit = await repoScannerService.isGitRepo();
    setProjectGitStatus(prev => ({ ...prev, [project.projectId]: isGit }));
  };

  const scanForProject = async (project: ProjectOption) => {
    if (!project.projectPath) return;

    setScanning(true);
    setMapping(true);
    setError(null);

    try {
      repoScannerService.setRepoPath(project.projectPath);
      sessionFileMapper.setDbPath(dbPath || '');

      const scanResult = await repoScannerService.scanTree();
      setRepoType(scanResult.repoType);

      let finalEntries = scanResult.entries;

      if (scanResult.repoType === 'filesystem') {
        finalEntries = await repoScannerService.walkFilesystem();
        setTreeEntries(finalEntries);
        setStatusEntries([]);
      } else {
        const status = await repoScannerService.scanStatus();
        setTreeEntries(finalEntries);
        setStatusEntries(status);
      }
      setScanning(false);

      const fileMap = await sessionFileMapper.buildSessionFileMap(projectSessions);
      setSessionFileMap(fileMap);
      setMapping(false);
    } catch (e: any) {
      setError(e?.message || String(e));
      setScanning(false);
      setMapping(false);
    }
  };

  const handleRefresh = () => {
    repoScannerService.clearCache();
    sessionFileMapper.clearCache();
    setRefreshKey(k => k + 1);
  };

  const fileTree = useMemo(() => {
    if (treeEntries.length === 0) return [];
    return repoScannerService.buildFileTree(treeEntries, statusEntries);
  }, [treeEntries, statusEntries]);

  const sessionDisplayMap = useMemo(() => {
    const map: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }> = {};
    for (const [path, info] of Object.entries(sessionFileMap)) {
      map[path] = info;
    }
    return map;
  }, [sessionFileMap]);

  const stats = useMemo(() => {
    const totalFiles = treeEntries.length;
    const touchedFiles = Object.keys(sessionFileMap).length;
    const currentFiles = currentSessionId
      ? Object.entries(sessionFileMap).filter(([_, info]) => info.sessionIds.includes(currentSessionId!)).length
      : 0;
    return { totalFiles, touchedFiles, currentFiles };
  }, [treeEntries, sessionFileMap, currentSessionId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={handleRefresh}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <div className="relative">
            <select
              value={selectedProject?.projectId || ''}
              onChange={e => {
                const p = projectOptions.find(po => po.projectId === e.target.value);
                if (p) {
                  setSelectedProject(p);
                  setSelectedNode(null);
                  setTreeEntries([]);
                  setStatusEntries([]);
                  setSessionFileMap({});
                }
              }}
              className="bg-zinc-800 text-xs text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-700 appearance-none cursor-pointer pr-7 font-mono"
            >
              {projectOptions.map(p => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName} ({p.sessionCount} sessions)
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-500">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Repo type indicator */}
          {selectedProject && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full ${
                repoType === 'git'
                  ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30'
                  : repoType === 'filesystem'
                    ? 'bg-amber-900/20 text-amber-400 border border-amber-800/30'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              }`}>
                {repoType === 'git' ? (
                  <GitBranch className="w-3 h-3" />
                ) : (
                  <FolderTreeIcon className="w-3 h-3" />
                )}
                <span>{repoType === 'git' ? 'Git' : repoType === 'filesystem' ? 'Filesystem' : 'No repo'}</span>
              </div>

              {selectedProject.projectPath && (
                <span className="text-[10px] text-zinc-600 font-mono max-w-[200px] truncate" title={selectedProject.projectPath}>
                  {selectedProject.projectPath}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-zinc-600 border-l border-zinc-800 pl-3">
            <span>{stats.totalFiles} files</span>
            <span className="text-blue-400">{stats.touchedFiles} touched</span>
            {stats.currentFiles > 0 && (
              <span className="text-emerald-400">{stats.currentFiles} current</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RepoLegend />

          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                viewMode === 'tree'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                viewMode === 'graph'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Graph
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={scanning || mapping}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${scanning || mapping ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {(scanning || mapping) && (
        <div className="flex items-center gap-2 px-4 py-1 text-[10px] text-zinc-600 bg-zinc-900/20 border-b border-zinc-800/50">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>{scanning ? 'Scanning files...' : 'Mapping sessions to files...'}</span>
        </div>
      )}

      {/* No project path warning */}
      {selectedProject && !selectedProject.projectPath && (
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-amber-400 bg-amber-900/10 border-b border-amber-800/30">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>This project has no file path assigned. Sessions exist but files cannot be scanned.</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {viewMode === 'tree' ? (
          <>
            <div className="flex-1 min-w-0">
              <FileTree
                files={fileTree}
                sessionFileMap={sessionDisplayMap}
                currentSessionId={currentSessionId}
                onFileSelect={setSelectedNode}
                selectedPath={selectedNode?.path}
              />
            </div>

            {selectedNode && (
              <FileDetailPanel
                node={selectedNode}
                sessionFileMap={sessionDisplayMap}
                onClose={() => setSelectedNode(null)}
                sessions={projectSessions}
              />
            )}
          </>
        ) : (
          <RepoGraph
            files={fileTree}
            sessionFileMap={sessionDisplayMap}
            currentSessionId={currentSessionId}
            onFileSelect={setSelectedNode}
          />
        )}
      </div>
    </div>
  );
};
