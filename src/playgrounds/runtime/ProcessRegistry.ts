export interface ProcessInfo {
  processId: string;
  pid?: number;
  ptyId?: string;
  runtimeId: string;
  playgroundId: string;
  workspaceId?: string;
  providerId?: string;
  ownerType: 'user' | 'system' | 'playground' | 'provider';
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  status: 'spawning' | 'running' | 'exiting' | 'exited' | 'error' | 'orphaned';
  createdAt: Date;
  lastActivity: Date;
  exitCode?: number;
  metadata?: Record<string, any>;
}

export interface ProcessTree {
  root: ProcessInfo;
  children: ProcessTree[];
}

export interface ProcessRegistryConfig {
  maxProcesses: number;
  cleanupInterval: number;
  orphanTimeout: number;
  enableAutoCleanup: boolean;
}

export class ProcessRegistry {
  private processes: Map<string, ProcessInfo> = new Map();
  private processTrees: Map<string, ProcessTree> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private config: ProcessRegistryConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<ProcessRegistryConfig> = {}) {
    this.config = {
      maxProcesses: 50,
      cleanupInterval: 5000,
      orphanTimeout: 30000,
      enableAutoCleanup: true,
      ...config
    };

    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }
  }

  // Public API
  registerProcess(processInfo: Omit<ProcessInfo, 'createdAt' | 'lastActivity'>): string {
    const processId = processInfo.processId || `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullProcessInfo: ProcessInfo = {
      ...processInfo,
      processId,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'spawning'
    };

    this.processes.set(processId, fullProcessInfo);
    this.emitEvent('process_registered', { processId, processInfo: fullProcessInfo });

    console.log(`[ProcessRegistry] Registered process ${processId}: ${processInfo.command}`);
    return processId;
  }

  updateProcess(processId: string, updates: Partial<ProcessInfo>): void {
    const process = this.processes.get(processId);
    if (!process) {
      console.warn(`[ProcessRegistry] Process ${processId} not found for update`);
      return;
    }

    const updatedProcess = {
      ...process,
      ...updates,
      lastActivity: new Date()
    };

    this.processes.set(processId, updatedProcess);
    this.emitEvent('process_updated', { processId, processInfo: updatedProcess });
  }

  getProcess(processId: string): ProcessInfo | undefined {
    return this.processes.get(processId);
  }

  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  getProcessesByStatus(status: ProcessInfo['status']): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.status === status);
  }

  getProcessesByOwner(ownerType: ProcessInfo['ownerType']): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.ownerType === ownerType);
  }

  getProcessesByRuntime(runtimeId: string): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.runtimeId === runtimeId);
  }

  getProcessesByPlayground(playgroundId: string): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.playgroundId === playgroundId);
  }

  // Process lifecycle management
  spawnProcess(processId: string): void {
    this.updateProcess(processId, { status: 'running' });
    this.emitEvent('process_spawned', { processId });
  }

  exitProcess(processId: string, exitCode?: number): void {
    this.updateProcess(processId, { 
      status: 'exited', 
      exitCode,
      lastActivity: new Date()
    });
    this.emitEvent('process_exited', { processId, exitCode });
  }

  errorProcess(processId: string, error: Error): void {
    this.updateProcess(processId, { 
      status: 'error', 
      lastActivity: new Date(),
      metadata: { error: error.message, stack: error.stack }
    });
    this.emitEvent('process_error', { processId, error });
  }

  orphanProcess(processId: string): void {
    this.updateProcess(processId, { 
      status: 'orphaned', 
      lastActivity: new Date()
    });
    this.emitEvent('process_orphaned', { processId });
  }

  // Process tree management
  addChildProcess(parentId: string, childProcess: ProcessInfo): void {
    const parent = this.processes.get(parentId);
    if (!parent) {
      console.warn(`[ProcessRegistry] Parent process ${parentId} not found`);
      return;
    }

    const childId = this.registerProcess(childProcess);
    
    // Update process tree
    const existingTree = this.processTrees.get(parentId) || { root: parent, children: [] };
    existingTree.children.push({
      root: this.processes.get(childId)!,
      children: []
    });
    
    this.processTrees.set(parentId, existingTree);
    this.processTrees.set(childId, { root: this.processes.get(childId)!, children: [] });
  }

  getProcessTree(rootId: string): ProcessTree | undefined {
    return this.processTrees.get(rootId);
  }

  getAllProcessTrees(): ProcessTree[] {
    return Array.from(this.processTrees.values());
  }

  // Process cleanup and termination
  async terminateProcess(processId: string, signal?: number): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    try {
      // Update status
      this.updateProcess(processId, { status: 'exiting' });

      // Terminate child processes first (recursive)
      await this.terminateProcessTree(processId);

      // Terminate the main process
      if (process.pid) {
        if (typeof window !== 'undefined' && window.__TAURI__?.invoke) {
          await window.__TAURI__.invoke('process_kill', { pid: process.pid, signal });
        } else {
          // Fallback for development
          console.log(`[ProcessRegistry] Would terminate process ${process.pid} with signal ${signal || 'SIGTERM'}`);
        }
      }

      // Update final status
      this.exitProcess(processId, signal ? -1 : 0);
    } catch (error) {
      this.errorProcess(processId, error as Error);
    }
  }

  private async terminateProcessTree(rootId: string): Promise<void> {
    const processTree = this.getProcessTree(rootId);
    if (!processTree) return;

    // Terminate all children recursively
    for (const child of processTree.children) {
      await this.terminateProcess(child.root.processId);
    }
  }

  // Orphan detection and cleanup
  detectOrphanedProcesses(): ProcessInfo[] {
    const now = new Date();
    const orphanThreshold = new Date(now.getTime() - this.config.orphanTimeout);
    
    return Array.from(this.processes.values()).filter(process => 
      process.status === 'running' && 
      process.lastActivity < orphanThreshold
    );
  }

  async cleanupOrphanedProcesses(): Promise<void> {
    const orphaned = this.detectOrphanedProcesses();
    
    for (const process of orphaned) {
      console.log(`[ProcessRegistry] Cleaning up orphaned process: ${process.processId}`);
      await this.terminateProcess(process.processId, 9); // SIGKILL
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private async performCleanup(): Promise<void> {
    try {
      // Clean up exited processes
      const exitedProcesses = this.getProcessesByStatus('exited');
      for (const process of exitedProcesses) {
        if (process.createdAt.getTime() < Date.now() - 60000) { // Keep for 1 minute
          console.log(`[ProcessRegistry] Cleaning up exited process: ${process.processId}`);
          this.processes.delete(process.processId);
          this.processTrees.delete(process.processId);
        }
      }

      // Clean up orphaned processes
      await this.cleanupOrphanedProcesses();

      this.emitEvent('cleanup_completed', {
        totalProcesses: this.processes.size,
        activeProcesses: this.getProcessesByStatus('running').length
      });
    } catch (error) {
      console.error('[ProcessRegistry] Cleanup error:', error);
    }
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
          console.error(`Error in ProcessRegistry event listener for ${event}:`, error);
        }
      });
    }
  }

  // Monitoring and statistics
  getStatistics(): {
    total: number;
    byStatus: Record<string, number>;
    byOwner: Record<string, number>;
    byRuntime: Record<string, number>;
    orphaned: number;
  } {
    const processes = this.getAllProcesses();
    
    const byStatus = processes.reduce((acc, process) => {
      acc[process.status] = (acc[process.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byOwner = processes.reduce((acc, process) => {
      acc[process.ownerType] = (acc[process.ownerType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byRuntime = processes.reduce((acc, process) => {
      acc[process.runtimeId] = (acc[process.runtimeId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: processes.length,
      byStatus,
      byOwner,
      byRuntime,
      orphaned: this.detectOrphanedProcesses().length
    };
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Terminate all running processes
    const runningProcesses = this.getProcessesByStatus('running');
    runningProcesses.forEach(process => {
      console.log(`[ProcessRegistry] Force terminating process: ${process.processId}`);
      this.terminateProcess(process.processId, 9).catch(error => {
        console.error(`Failed to terminate process ${process.processId}:`, error);
      });
    });

    // Clear all data
    this.processes.clear();
    this.processTrees.clear();
    this.eventListeners.clear();
    
    console.log('[ProcessRegistry] Destroyed');
  }
}

// Singleton instance
let globalProcessRegistry: ProcessRegistry | null = null;

export function getProcessRegistry(): ProcessRegistry {
  if (!globalProcessRegistry) {
    globalProcessRegistry = new ProcessRegistry();
  }
  return globalProcessRegistry;
}
