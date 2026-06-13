import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  GitBranch,
  FileText,
  Plus,
  Minus,
  Calendar,
  User,
  Hash,
  Upload,
  RefreshCw,
  Loader,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface GitCommit {
  hash: string;
  short_hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  files: GitFileChange[];
}

interface GitFileChange {
  file: string;
  insertions: number;
  deletions: number;
  status: string; // A=added, M=modified, D=deleted
}

interface GitStats {
  total_commits: number;
  total_files_changed: number;
  total_insertions: number;
  total_deletions: number;
  branch: string;
}

export const GitStatisticsView: React.FC = () => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [stats, setStats] = useState<GitStats | null>(null);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repoPath = 'C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP';

  useEffect(() => {
    loadGitStats();
  }, []);

  const loadGitStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await invoke<{ commits: GitCommit[]; stats: GitStats }>('get_git_stats', {
        repoPath,
        limit: 50,
      });
      
      setCommits(response.commits);
      setStats(response.stats);
    } catch (err) {
      setError(`Failed to load git stats: ${err instanceof Error ? err.message : String(err)}`);
      console.error('[GitStatisticsView] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pushToRemote = async () => {
    try {
      setPushing(true);
      setError(null);
      
      await invoke('git_push', { repoPath });
      
      // Reload stats after push
      await loadGitStats();
    } catch (err) {
      setError(`Failed to push: ${err instanceof Error ? err.message : String(err)}`);
      console.error('[GitStatisticsView] Push error:', err);
    } finally {
      setPushing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'A': return 'text-green-400';
      case 'M': return 'text-yellow-400';
      case 'D': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'A': return 'Added';
      case 'M': return 'Modified';
      case 'D': return 'Deleted';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Git Statistics</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadGitStats}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            <button
              onClick={pushToRemote}
              disabled={pushing || loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              {pushing ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Push to Remote
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-zinc-800/50 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Branch</div>
              <div className="text-sm font-semibold text-purple-400">{stats.branch}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Commits</div>
              <div className="text-sm font-semibold text-zinc-200">{stats.total_commits}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Files Changed</div>
              <div className="text-sm font-semibold text-zinc-200">{stats.total_files_changed}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Insertions</div>
              <div className="text-sm font-semibold text-green-400">+{stats.total_insertions}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Deletions</div>
              <div className="text-sm font-semibold text-red-400">-{stats.total_deletions}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Commits List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && commits.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-500" />
              <p className="text-sm text-zinc-400">Loading git history...</p>
            </div>
          </div>
        ) : commits.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-zinc-400">
              <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No commits found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {commits.map((commit) => (
              <div
                key={commit.hash}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
              >
                {/* Commit Header */}
                <button
                  onClick={() => setExpandedCommit(expandedCommit === commit.hash ? null : commit.hash)}
                  className="w-full p-4 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Commit Message */}
                      <div className="flex items-start gap-2 mb-2">
                        <GitCommit className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="font-medium text-zinc-100 break-words">{commit.message}</div>
                      </div>

                      {/* Commit Metadata */}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono">{commit.short_hash}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{commit.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(commit.date)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Badge */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">{commit.files_changed} files</span>
                        <span className="text-green-400">+{commit.insertions}</span>
                        <span className="text-red-400">-{commit.deletions}</span>
                      </div>
                      {expandedCommit === commit.hash ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded File Changes */}
                {expandedCommit === commit.hash && commit.files.length > 0 && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
                      Changed Files ({commit.files.length})
                    </div>
                    <div className="space-y-2">
                      {commit.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-zinc-900/50 rounded text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <span className={`font-mono truncate ${getStatusColor(file.status)}`}>
                              {file.file}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(file.status)} bg-zinc-800`}>
                              {getStatusLabel(file.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs flex-shrink-0">
                            {file.insertions > 0 && (
                              <span className="text-green-400 flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {file.insertions}
                              </span>
                            )}
                            {file.deletions > 0 && (
                              <span className="text-red-400 flex items-center gap-1">
                                <Minus className="w-3 h-3" />
                                {file.deletions}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
