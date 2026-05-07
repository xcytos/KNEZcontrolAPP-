import { getPTYService } from './PTYService';
import { getPTYLifecycleManager } from './PTYLifecycleManager';
import { getProcessRegistry } from './ProcessRegistry';

export interface OpenCodeConfig {
  workspacePath?: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

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
  status: 'spawning' | 'attaching' | 'running' | 'detaching' | 'exited' | 'error';
  createdAt: Date;
  lastActivity: Date;
  exitCode?: number;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface OpenCodeProcess {
  processId: string;
  ptyId: string;
  workspacePath: string;
  model: string;
  provider: string;
  status: 'spawning' | 'attaching' | 'running' | 'detaching' | 'exited' | 'error';
  createdAt: Date;
  lastActivity: Date;
  exitCode?: number;
  error?: Error;
}

export class OpenCodeLauncher {
  private ptyService = getPTYService();
  private lifecycleManager = getPTYLifecycleManager();
  private processRegistry = getProcessRegistry();

  async launchOpenCode(config: OpenCodeConfig): Promise<OpenCodeProcess> {
    console.log(`[OpenCodeLauncher] Launching OpenCode with config:`, config);
    
    const processId = `opencode-${Date.now()}`;
    
    try {
      // Step 1: Create PTY
      console.log('[OpenCodeLauncher] Step 1: Creating PTY...');
      const ptyHandle = await this.ptyService.createPTY({
        cols: config.cols || 120,
        rows: config.rows || 30,
        cwd: config.workspacePath || process.cwd(),
        env: {
          ...config.env,
          // Add OpenCode-specific environment variables
          OPENCODE_WORKSPACE: config.workspacePath || process.cwd(),
          OPENCODE_MODEL: config.model || 'default',
          OPENCODE_PROVIDER: config.provider || 'local',
          OPENCODE_API_KEY: config.apiKey || '',
          OPENCODE_MAX_TOKENS: config.maxTokens?.toString() || '4096',
          OPENCODE_TEMPERATURE: config.temperature?.toString() || '0.7'
        },
        shell: process.platform === 'win32' ? 'cmd.exe' : 'bash'
      });

      console.log(`[OpenCodeLauncher] PTY created with ID: ${ptyHandle.id}`);

      // Step 2: Register process
      console.log('[OpenCodeLauncher] Step 2: Registering OpenCode process...');
      const registeredProcessId = this.processRegistry.registerProcess({
        processId,
        ptyId: ptyHandle.id,
        runtimeId: 'opencode',
        playgroundId: 'opencode-playground',
        ownerType: 'user',
        status: 'spawning',
        command: this.getOpenCodeCommand(),
        args: this.getOpenCodeArgs(config),
        cwd: config.workspacePath || process.cwd(),
        env: {
          ...config.env,
          OPENCODE_WORKSPACE: config.workspacePath || process.cwd(),
          OPENCODE_MODEL: config.model || 'default',
          OPENCODE_PROVIDER: config.provider || 'local',
          OPENCODE_API_KEY: config.apiKey || '',
          OPENCODE_MAX_TOKENS: config.maxTokens?.toString() || '4096',
          OPENCODE_TEMPERATURE: config.temperature?.toString() || '0.7'
        }
      });

      console.log(`[OpenCodeLauncher] Process registered with ID: ${registeredProcessId}`);

      // Step 3: Start PTY lifecycle
      console.log('[OpenCodeLauncher] Step 3: Starting PTY lifecycle...');
      this.lifecycleManager.createPTY(ptyHandle.id);
      this.lifecycleManager.spawnPTY(ptyHandle.id);

      // Step 4: Attach PTY to process
      console.log('[OpenCodeLauncher] Step 4: Attaching PTY to process...');
      this.lifecycleManager.attachPTY(ptyHandle.id);

      // Step 5: Spawn actual OpenCode process
      console.log('[OpenCodeLauncher] Step 5: Spawning actual OpenCode process...');
      
      // Build OpenCode command based on provider
      let openCodeCommand = this.getOpenCodeCommand();
      let openCodeArgs = this.getOpenCodeArgs(config);

      if (config.provider && config.provider !== 'local') {
        // Remote provider mode
        openCodeCommand = `npx opencode@latest`;
        openCodeArgs = [
          '--provider', config.provider,
          '--model', config.model || 'default',
          '--api-key', config.apiKey || '',
          '--max-tokens', config.maxTokens?.toString() || '4096',
          '--workspace', config.workspacePath || process.cwd()
        ];
      } else {
        // Local mode
        openCodeCommand = 'npx opencode@latest';
        openCodeArgs = [
          '--workspace', config.workspacePath || process.cwd()
        ];
      }

      // Launch OpenCode through PTY
      await ptyHandle.write(`${openCodeCommand} ${openCodeArgs.join(' ')}\r\n`);

      // Step 6: Start PTY
      console.log('[OpenCodeLauncher] Step 6: Starting PTY...');
      this.lifecycleManager.startPTY(ptyHandle.id);
      this.processRegistry.spawnProcess(registeredProcessId);

      // Create OpenCode process object
      const openCodeProcess: OpenCodeProcess = {
        processId: registeredProcessId,
        ptyId: ptyHandle.id,
        workspacePath: config.workspacePath || process.cwd(),
        model: config.model || 'default',
        provider: config.provider || 'local',
        status: 'running',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      console.log(`[OpenCodeLauncher] OpenCode process launched successfully:`, openCodeProcess);
      
      return openCodeProcess;

    } catch (error) {
      console.error('[OpenCodeLauncher] Failed to launch OpenCode:', error);
      
      // Mark as failed in lifecycle
      const processId = this.processRegistry.getProcessesByRuntime('opencode')[0]?.processId;
      if (processId) {
        this.lifecycleManager.errorPTY(processId, error as Error);
        this.processRegistry.errorProcess(processId, error as Error);
      }

      throw error;
    }
  }

  async terminateOpenCode(processId: string): Promise<void> {
    console.log(`[OpenCodeLauncher] Terminating OpenCode process: ${processId}`);
    
    try {
      // Step 1: Start detaching
      const process = this.processRegistry.getProcess(processId);
      if (!process) {
        throw new Error(`OpenCode process ${processId} not found`);
      }

      this.lifecycleManager.detachPTY(process.ptyId);
      this.processRegistry.exitProcess(processId);

      // Step 2: Terminate process tree
      await this.processRegistry.terminateProcess(processId, 15); // SIGTERM

      // Step 3: Mark as exited
      this.lifecycleManager.exitPTY(process.ptyId, 15);
      this.processRegistry.exitProcess(processId);
      
      console.log(`[OpenCodeLauncher] OpenCode process terminated: ${processId}`);
    } catch (error) {
      console.error('[OpenCodeLauncher] Failed to terminate OpenCode:', error);
      this.processRegistry.errorProcess(processId, error as Error);
      throw error;
    }
  }

  getOpenCodeProcess(processId: string): OpenCodeProcess | undefined {
    const process = this.processRegistry.getProcess(processId);
    if (!process || process.runtimeId !== 'opencode') {
      return undefined;
    }
    
    return {
      processId: process.processId,
      ptyId: process.ptyId!,
      workspacePath: process.cwd,
      model: process.env?.OPENCODE_MODEL || 'default',
      provider: process.env?.OPENCODE_PROVIDER || 'local',
      status: process.status,
      createdAt: process.createdAt,
      lastActivity: process.lastActivity,
      exitCode: process.exitCode,
      error: process.error
    };
  }

  getAllOpenCodeProcesses(): OpenCodeProcess[] {
    return this.processRegistry.getProcessesByRuntime('opencode').map(process => ({
      processId: process.processId,
      ptyId: process.ptyId!,
      workspacePath: process.cwd,
      model: process.env?.OPENCODE_MODEL || 'default',
      provider: process.env?.OPENCODE_PROVIDER || 'local',
      status: process.status,
      createdAt: process.createdAt,
      lastActivity: process.lastActivity,
      exitCode: process.exitCode,
      error: process.error
    }));
  }

  getOpenCodeStatistics(): {
    total: number;
    running: number;
    byProvider: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const processes = this.getAllOpenCodeProcesses();
    
    const byStatus = processes.reduce((acc, process) => {
      acc[process.status] = (acc[process.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byProvider = processes.reduce((acc, process) => {
      acc[process.provider] = (acc[process.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: processes.length,
      running: byStatus.running || 0,
      byProvider,
      byStatus
    };
  }

  // Private helper methods
  private getOpenCodeCommand(): string {
    return process.platform === 'win32' ? 'npx' : 'npx';
  }

  private getOpenCodeArgs(config: OpenCodeConfig): string[] {
    const args: string[] = [];

    // Add workspace argument
    if (config.workspacePath) {
      args.push('--workspace', config.workspacePath);
    }

    // Add model argument
    if (config.model && config.model !== 'default') {
      args.push('--model', config.model);
    }

    // Add provider arguments
    if (config.provider && config.provider !== 'local') {
      args.push('--provider', config.provider);
      
      if (config.apiKey) {
        args.push('--api-key', config.apiKey);
      }
      
      if (config.maxTokens) {
        args.push('--max-tokens', config.maxTokens.toString());
      }
      
      if (config.temperature) {
        args.push('--temperature', config.temperature.toString());
      }
    }

    // Add additional arguments
    if (config.cols) {
      args.push('--cols', config.cols.toString());
    }

    if (config.rows) {
      args.push('--rows', config.rows.toString());
    }

    return args;
  }

  // Event handling
  on(event: string, listener: Function): void {
    this.lifecycleManager.on(event, listener);
    this.processRegistry.on(event, listener);
    this.ptyService.on(event, listener);
  }

  off(event: string, listener: Function): void {
    this.lifecycleManager.off(event, listener);
    this.processRegistry.off(event, listener);
    this.ptyService.off(event, listener);
  }

  // Cleanup
  async destroy(): Promise<void> {
    console.log('[OpenCodeLauncher] Destroying...');
    
    // Terminate all OpenCode processes
    const openCodeProcesses = this.getAllOpenCodeProcesses();
    const terminatePromises = openCodeProcesses.map(process => 
      this.terminateOpenCode(process.processId).catch(error => 
        console.error(`Failed to terminate OpenCode process ${process.processId}:`, error)
      )
    );

    await Promise.all(terminatePromises);

    // Cleanup services
    this.lifecycleManager.destroy();
    this.processRegistry.destroy();

    console.log('[OpenCodeLauncher] Destroyed');
  }
}

// Singleton instance
let globalOpenCodeLauncher: OpenCodeLauncher | null = null;

export function getOpenCodeLauncher(): OpenCodeLauncher {
  if (!globalOpenCodeLauncher) {
    globalOpenCodeLauncher = new OpenCodeLauncher();
  }
  return globalOpenCodeLauncher;
}
