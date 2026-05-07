export interface WorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
  content?: string;
  hash?: string;
}

export interface WorkspaceConfig {
  rootPath: string;
  maxFiles: number;
  maxFileSize: number;
  allowedExtensions: string[];
  gitIntegration: boolean;
  autoSync: boolean;
}

export interface GitStatus {
  branch: string;
  commit: string;
  status: 'clean' | 'modified' | 'staged' | 'untracked';
  ahead: number;
  behind: number;
  lastSync: Date;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  files: Map<string, WorkspaceFile>;
  gitStatus: GitStatus;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private config: WorkspaceConfig;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<WorkspaceConfig> = {}) {
    this.config = {
      rootPath: process.cwd(),
      maxFiles: 10000,
      maxFileSize: 10485760, // 10MB
      allowedExtensions: ['.ts', '.tsx', '.js', '.json', '.md'],
      gitIntegration: true,
      autoSync: true,
      ...config
    };
  }

  // Workspace management
  createWorkspace(name: string, path?: string): Workspace {
    const workspaceId = `workspace-${Date.now()}`;
    const workspacePath = path || this.config.rootPath;
    
    const workspace: Workspace = {
      id: workspaceId,
      name,
      path: workspacePath,
      files: new Map(),
      gitStatus: {
        branch: 'main',
        commit: '',
        status: 'clean',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      },
      isActive: false,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        environment: 'development'
      }
    };

    this.workspaces.set(workspaceId, workspace);
    this.emitEvent('workspace_created', { workspaceId, workspace });
    
    console.log(`[WorkspaceManager] Created workspace: ${workspaceId} at ${workspacePath}`);
    return workspace;
  }

  getWorkspace(workspaceId: string): Workspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  setActiveWorkspace(workspaceId: string): void {
    // Deactivate all workspaces first
    this.workspaces.forEach((workspace) => {
      if (workspace.isActive) {
        workspace.isActive = false;
        workspace.lastActivity = new Date();
      }
    });

    // Activate the requested workspace
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    workspace.isActive = true;
    workspace.lastActivity = new Date();
    
    this.emitEvent('active_workspace_changed', { workspaceId, workspace });
    console.log(`[WorkspaceManager] Activated workspace: ${workspaceId}`);
  }

  getActiveWorkspace(): Workspace | undefined {
    return Array.from(this.workspaces.values()).find(workspace => workspace.isActive);
  }

  // File management
  addFile(workspaceId: string, filePath: string, content?: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const relativePath = filePath.replace(workspace.path, '');
    const file: WorkspaceFile = {
      path: relativePath,
      name: relativePath.split('/').pop() || relativePath,
      type: 'file',
      size: content ? content.length : 0,
      lastModified: new Date(),
      content
    };

    workspace.files.set(relativePath, file);
    workspace.lastActivity = new Date();
    
    this.emitEvent('file_added', { workspaceId, file });
    console.log(`[WorkspaceManager] Added file: ${relativePath} to workspace ${workspaceId}`);
  }

  removeFile(workspaceId: string, filePath: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const relativePath = filePath.replace(workspace.path, '');
    workspace.files.delete(relativePath);
    workspace.lastActivity = new Date();
    
    this.emitEvent('file_removed', { workspaceId, filePath });
    console.log(`[WorkspaceManager] Removed file: ${relativePath} from workspace ${workspaceId}`);
  }

  getFile(workspaceId: string, filePath: string): WorkspaceFile | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return undefined;
    }

    const relativePath = filePath.replace(workspace.path, '');
    return workspace.files.get(relativePath);
  }

  getAllFiles(workspaceId: string): WorkspaceFile[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [];
    }

    return Array.from(workspace.files.values());
  }

  // Git integration
  async initializeGit(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.config.gitIntegration) {
      return;
    }

    try {
      // Initialize git repository
      await this.executeCommand('git init', workspace.path);
      await this.executeCommand('git add .', workspace.path);
      await this.executeCommand('git commit -m "Initial commit"', workspace.path);
      
      workspace.gitStatus = {
        branch: 'main',
        commit: 'Initial commit',
        status: 'clean',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      };
      
      this.emitEvent('git_initialized', { workspaceId, workspace });
      console.log(`[WorkspaceManager] Git initialized for workspace ${workspaceId}`);
    } catch (error) {
      console.error(`[WorkspaceManager] Failed to initialize git for workspace ${workspaceId}:`, error);
    }
  }

  async syncGit(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.config.gitIntegration) {
      return;
    }

    try {
      // Check git status
      const status = await this.executeCommand('git status --porcelain', workspace.path);
      const isClean = status.trim() === '';

      // Add all changes
      if (!isClean) {
        await this.executeCommand('git add .', workspace.path);
      await this.executeCommand('git commit -m "Auto sync"', workspace.path);
      }

      workspace.gitStatus = {
        branch: 'main',
        commit: await this.executeCommand('git rev-parse HEAD', workspace.path).catch(() => 'unknown'),
        status: isClean ? 'clean' : 'modified',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      };
      
      this.emitEvent('git_synced', { workspaceId, workspace });
      console.log(`[WorkspaceManager] Git synced for workspace ${workspaceId}`);
    } catch (error) {
      console.error(`[WorkspaceManager] Failed to sync git for workspace ${workspaceId}:`, error);
    }
  }

  async getGitStatus(workspaceId: string): Promise<GitStatus> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.config.gitIntegration) {
      return {
        branch: 'main',
        commit: '',
        status: 'clean',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      };
    }

    try {
      const status = await this.executeCommand('git status --porcelain=v2', workspace.path);
      const branch = await this.executeCommand('git rev-parse --abbrev-ref HEAD', workspace.path);
      const commit = await this.executeCommand('git rev-parse HEAD', workspace.path);
      
      workspace.gitStatus = {
        branch: branch.trim(),
        commit: commit.trim(),
        status: status.includes('M') ? 'modified' : 'clean',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      };
      
      return workspace.gitStatus;
    } catch (error) {
      console.error(`[WorkspaceManager] Failed to get git status for workspace ${workspaceId}:`, error);
      return {
        branch: 'main',
        commit: '',
        status: 'clean',
        ahead: 0,
        behind: 0,
        lastSync: new Date()
      };
    }
  }

  // Private helper methods
  private async executeCommand(command: string, cwd: string): Promise<string> {
    // In a real implementation, this would use the PTYService
    // For now, we'll simulate with a simple shell command
    return new Promise((resolve, _reject) => {
      console.log(`[WorkspaceManager] Executing: ${command} in ${cwd}`);
      // Simulate command execution
      setTimeout(() => {
        resolve(`Command output: ${command}`);
      }, 1000);
    });
  }

  // Event handling
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in WorkspaceManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Statistics and monitoring
  getStatistics(): {
    totalWorkspaces: number;
    activeWorkspaces: number;
    workspacesByType: Record<string, number>;
    totalFiles: number;
    averageFilesPerWorkspace: number;
  } {
    const workspaces = Array.from(this.workspaces.values());
    const activeWorkspaces = workspaces.filter(workspace => workspace.isActive);
    
    const totalFiles = workspaces.reduce((sum, workspace) => 
      sum + workspace.files.size, 0
    );

    return {
      totalWorkspaces: workspaces.length,
      activeWorkspaces: activeWorkspaces.length,
      workspacesByType: {}, // Could categorize by type
      totalFiles,
      averageFilesPerWorkspace: workspaces.length > 0 ? totalFiles / workspaces.length : 0
    };
  }

  // Cleanup and maintenance
  cleanupInactiveWorkspaces(): void {
    const now = new Date();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [workspaceId, workspace] of this.workspaces.entries()) {
      const inactiveTime = now.getTime() - workspace.lastActivity.getTime();
      
      if (inactiveTime > inactiveThreshold && workspace.files.size === 0) {
        console.log(`[WorkspaceManager] Cleaning up inactive workspace: ${workspaceId}`);
        this.workspaces.delete(workspaceId);
        this.emitEvent('workspace_deleted', { workspaceId, workspace });
      }
    }
  }
}

// Singleton instance
let globalWorkspaceManager: WorkspaceManager | null = null;

export function getWorkspaceManager(): WorkspaceManager {
  if (!globalWorkspaceManager) {
    globalWorkspaceManager = new WorkspaceManager();
  }
  return globalWorkspaceManager;
}
