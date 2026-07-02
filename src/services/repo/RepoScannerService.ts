import { invoke } from '@tauri-apps/api/core';
import type { GitTreeEntry, GitStatusEntry, FileNodeData, ScanResult } from './types';

interface FsEntry {
  is_dir: boolean;
  size: number;
  path: string;
}

interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class RepoScannerService {
  private repoPath: string = '';
  private cachedIsGitRepo: boolean | null = null;
  private cachedTree: GitTreeEntry[] | null = null;
  private cachedStatus: GitStatusEntry[] | null = null;

  setRepoPath(path: string) {
    if (path === this.repoPath) return;
    this.repoPath = path;
    this.cachedIsGitRepo = null;
    this.cachedTree = null;
    this.cachedStatus = null;
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  async isGitRepo(): Promise<boolean> {
    if (this.cachedIsGitRepo !== null) return this.cachedIsGitRepo;
    if (!this.repoPath) return false;

    try {
      const response = await invoke<DatabaseResponse<boolean>>('git_is_repo', {
        repoPath: this.repoPath,
      });
      this.cachedIsGitRepo = response.success && response.data === true;
    } catch {
      this.cachedIsGitRepo = false;
    }
    return this.cachedIsGitRepo;
  }

  async scanTree(): Promise<ScanResult> {
    if (this.cachedTree) {
      return { repoType: 'git', entries: this.cachedTree };
    }
    if (!this.repoPath) {
      return { repoType: 'none', entries: [] };
    }

    const isGit = await this.isGitRepo();
    if (isGit) {
      const response = await invoke<DatabaseResponse<GitTreeEntry[]>>('git_ls_tree', {
        repoPath: this.repoPath,
      });

      if (response.success && response.data) {
        this.cachedTree = response.data;
        return { repoType: 'git', entries: response.data };
      }
      return { repoType: 'git', entries: [], error: response.error };
    }

    const fsResult = await this.walkFilesystem();
    return { repoType: 'filesystem', entries: fsResult };
  }

  async scanStatus(): Promise<GitStatusEntry[]> {
    if (this.cachedStatus) return this.cachedStatus;
    if (!this.repoPath) return [];

    const isGit = await this.isGitRepo();
    if (!isGit) return [];

    const response = await invoke<DatabaseResponse<GitStatusEntry[]>>('git_status', {
      repoPath: this.repoPath,
    });

    if (response.success && response.data) {
      this.cachedStatus = response.data;
      return response.data;
    }
    return [];
  }

  async walkFilesystem(): Promise<GitTreeEntry[]> {
    if (!this.repoPath) return [];

    const response = await invoke<DatabaseResponse<FsEntry[]>>('fs_walk', {
      rootPath: this.repoPath,
    });

    if (!response.success || !response.data) return [];

    return response.data
      .filter(e => !e.is_dir)
      .map(e => ({
        mode: '',
        type: 'blob',
        sha: '',
        size: e.size,
        path: e.path,
      }));
  }

  async getFileLog(filePath: string): Promise<Array<{ hash: string; date: string; message: string }>> {
    if (!this.repoPath) return [];
    const isGit = await this.isGitRepo();
    if (!isGit) return [];

    const response = await invoke<DatabaseResponse<Array<{ hash: string; date: string; message: string }>>>('git_file_log', {
      repoPath: this.repoPath,
      filePath,
    });

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  }

  buildFileTree(treeEntries: GitTreeEntry[], statusEntries: GitStatusEntry[]): FileNodeData[] {
    const statusMap = new Map<string, string>();
    for (const s of statusEntries) {
      statusMap.set(s.path, s.status);
    }

    return this.buildDirectoryNodes(treeEntries, statusMap);
  }

  private buildDirectoryNodes(entries: GitTreeEntry[], statusMap: Map<string, string>): FileNodeData[] {
    const rootNodes: FileNodeData[] = [];
    const dirMap = new Map<string, FileNodeData>();

    for (const entry of entries) {
      const parts = entry.path.split('/');
      const name = parts.pop()!;
      const parentPath = parts.join('/');

      const fileNode: FileNodeData = {
        path: entry.path,
        name,
        type: 'file',
        size: entry.size,
        sha: entry.sha,
        gitStatus: statusMap.get(entry.path),
        depth: parts.length + 1,
      };

      if (parentPath === '') {
        rootNodes.push(fileNode);
      } else {
        let currentPath = '';
        for (const part of parts) {
          const parentPrevPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;

          if (!dirMap.has(currentPath)) {
            const dirNode: FileNodeData = {
              path: currentPath,
              name: part,
              type: 'directory',
              size: 0,
              sha: '',
              depth: parentPrevPath ? parentPrevPath.split('/').length + 1 : 1,
              children: [],
            };
            dirMap.set(currentPath, dirNode);

            if (parentPrevPath === '') {
              rootNodes.push(dirNode);
            } else {
              const parentDir = dirMap.get(parentPrevPath);
              if (parentDir && parentDir.children) {
                parentDir.children.push(dirNode);
              }
            }
          }
        }

        const parentDir = dirMap.get(parentPath);
        if (parentDir && parentDir.children) {
          parentDir.children.push(fileNode);
        }
      }
    }

    return rootNodes;
  }

  clearCache() {
    this.cachedIsGitRepo = null;
    this.cachedTree = null;
    this.cachedStatus = null;
  }
}

export const repoScannerService = new RepoScannerService();
