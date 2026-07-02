export interface GitTreeEntry {
  mode: string;
  type: string;
  sha: string;
  size: number;
  path: string;
}

export interface GitStatusEntry {
  status: string;
  path: string;
}

export interface FileSessionInfo {
  sessionIds: string[];
  accessCount: number;
  lastAccessed: string;
  changes: string[];
}

export interface FileNodeData {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  sha: string;
  sessionInfo?: FileSessionInfo;
  gitStatus?: string;
  children?: FileNodeData[];
  depth: number;
}

export interface SessionFileMap {
  [filePath: string]: FileSessionInfo;
}

export interface ScanResult {
  repoType: 'git' | 'filesystem' | 'none';
  entries: GitTreeEntry[];
  error?: string;
}
