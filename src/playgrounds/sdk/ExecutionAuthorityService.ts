import { RuntimeManager } from './RuntimeManager';
import { ExecutionCommand, ExecutionResult, ProcessConfig, IsolatedProcess } from './ExecutionAuthorityManager';

// Re-export types for use by other modules
export type { ExecutionCommand, ExecutionResult, ProcessConfig, IsolatedProcess };

export interface ExecutionAuthorityConfig {
  enableProcessIsolation: boolean;
  maxConcurrentProcesses: number;
  defaultTimeout: number;
  securityPolicy: 'strict' | 'permissive';
}

export interface ExecutionEvent {
  type: 'execution_started' | 'execution_completed' | 'execution_error' | 
        'process_created' | 'process_terminated' | 'pty_created' | 'pty_error';
  timestamp: Date;
  data: any;
}

export class ExecutionAuthorityService {
  private runtimeManager: RuntimeManager;
  private config: ExecutionAuthorityConfig;
  private eventListeners: Map<string, Function[]> = new Map();
  private activeExecutions: Map<string, ExecutionCommand> = new Map();
  private isolatedProcesses: Map<string, IsolatedProcess> = new Map();
  private executionQueue: ExecutionCommand[] = [];
  private isProcessingQueue = false;

  constructor(config: Partial<ExecutionAuthorityConfig> = {}) {
    this.runtimeManager = new RuntimeManager();
    this.config = {
      enableProcessIsolation: true,
      maxConcurrentProcesses: 5,
      defaultTimeout: 30000,
      securityPolicy: 'permissive',
      ...config
    };

    // Initialize runtime manager
    this.initializeRuntimeManager();
  }

  // Public API
  async executeCommand(command: ExecutionCommand): Promise<ExecutionResult> {
    // Validate command
    this.validateCommand(command);

    // Add to queue if too many concurrent executions
    if (this.activeExecutions.size >= this.config.maxConcurrentProcesses) {
      return this.queueExecution(command);
    }

    return this.performExecution(command);
  }

  async createIsolatedProcess(config: ProcessConfig): Promise<IsolatedProcess> {
    if (!this.config.enableProcessIsolation) {
      throw new Error('Process isolation is disabled');
    }

    this.validateProcessConfig(config);

    const processId = `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create isolated process through native implementation
      const isolatedProcess = await this.createNativeProcess(processId, config);
      
      this.isolatedProcesses.set(processId, isolatedProcess);
      this.emitEvent('process_created', { processId, process: isolatedProcess });
      
      return isolatedProcess;
    } catch (error) {
      this.emitEvent('execution_error', { config, error });
      throw error;
    }
  }

  async terminateProcess(processId: string): Promise<void> {
    const process = this.isolatedProcesses.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    try {
      await process.terminate();
      this.isolatedProcesses.delete(processId);
      this.emitEvent('process_terminated', { processId });
    } catch (error) {
      this.emitEvent('execution_error', { processId, error });
      throw error;
    }
  }

  getActiveExecutions(): ExecutionCommand[] {
    return Array.from(this.activeExecutions.values());
  }

  getIsolatedProcesses(): IsolatedProcess[] {
    return Array.from(this.isolatedProcesses.values());
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

  // Private methods
  private async initializeRuntimeManager(): Promise<void> {
    try {
      // Initialize any required runtimes
      this.runtimeManager.on('runtimeLaunched', (data: any) => {
        console.log('Runtime launched:', data);
      });

      this.runtimeManager.on('runtimeError', (data: any) => {
        console.error('Runtime error:', data);
        this.emitEvent('execution_error', data);
      });
    } catch (error) {
      console.error('Failed to initialize runtime manager:', error);
    }
  }

  private validateCommand(command: ExecutionCommand): void {
    if (!command.id || !command.runtimeId || !command.command) {
      throw new Error('Invalid command: missing required fields');
    }

    if (this.config.securityPolicy === 'strict') {
      this.validateSecurity(command);
    }
  }

  private validateProcessConfig(config: ProcessConfig): void {
    if (!config.command) {
      throw new Error('Invalid process config: missing command');
    }

    if (this.config.securityPolicy === 'strict') {
      this.validateProcessSecurity(config);
    }
  }

  private validateSecurity(command: ExecutionCommand): void {
    // Basic security validation for strict mode
    const dangerousCommands = ['rm -rf', 'format', 'del /f', 'sudo rm'];
    const commandLower = command.command.toLowerCase();
    
    for (const dangerous of dangerousCommands) {
      if (commandLower.includes(dangerous)) {
        throw new Error(`Dangerous command detected: ${dangerous}`);
      }
    }
  }

  private validateProcessSecurity(config: ProcessConfig): void {
    // Validate process config for security
    this.validateSecurity({
      id: 'process-validation',
      runtimeId: 'validation',
      command: config.command,
      args: config.args
    } as ExecutionCommand);
  }

  private async performExecution(command: ExecutionCommand): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.activeExecutions.set(command.id, command);
    this.emitEvent('execution_started', { command });

    try {
      // Get runtime and execute
      const runtime = this.runtimeManager.getRuntime(command.runtimeId);
      if (!runtime) {
        throw new Error(`Runtime ${command.runtimeId} not found`);
      }

      const result = await this.executeWithRuntime(runtime, command);
      const executionTime = Date.now() - startTime;

      const executionResult: ExecutionResult = {
        id: command.id,
        runtimeId: command.runtimeId,
        success: true,
        output: result,
        executionTime
      };

      this.activeExecutions.delete(command.id);
      this.emitEvent('execution_completed', { command, result: executionResult });
      
      // Process queue if any pending executions
      this.processExecutionQueue();

      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const errorResult: ExecutionResult = {
        id: command.id,
        runtimeId: command.runtimeId,
        success: false,
        error: error as Error,
        executionTime
      };

      this.activeExecutions.delete(command.id);
      this.emitEvent('execution_error', { command, error: errorResult });
      
      // Process queue if any pending executions
      this.processExecutionQueue();

      return errorResult;
    }
  }

  private async queueExecution(command: ExecutionCommand): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      this.executionQueue.push(command);
      
      // Add listener for this specific execution
      const completionListener = (event: ExecutionEvent) => {
        if (event.type === 'execution_completed' && event.data.command.id === command.id) {
          this.off('execution_completed', completionListener);
          this.off('execution_error', completionListener);
          resolve(event.data.result);
        }
        if (event.type === 'execution_error' && event.data.command.id === command.id) {
          this.off('execution_completed', completionListener);
          this.off('execution_error', completionListener);
          reject(event.data.error);
        }
      };

      this.on('execution_completed', completionListener);
      this.on('execution_error', completionListener);
      
      // Start processing queue if not already processing
      this.processExecutionQueue();
    });
  }

  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessingQueue || this.executionQueue.length === 0) {
      return;
    }

    if (this.activeExecutions.size >= this.config.maxConcurrentProcesses) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.executionQueue.length > 0 && 
           this.activeExecutions.size < this.config.maxConcurrentProcesses) {
      const command = this.executionQueue.shift()!;
      this.performExecution(command).catch(error => {
        console.error('Queued execution failed:', error);
      });
    }

    this.isProcessingQueue = false;
  }

  private async executeWithRuntime(runtime: any, command: ExecutionCommand): Promise<string> {
    // Execute command through runtime
    if (typeof runtime.execute === 'function') {
      return await runtime.execute({
        command: command.command,
        args: command.args,
        env: command.env,
        cwd: command.cwd
      });
    } else {
      throw new Error('Runtime does not support execution');
    }
  }

  private async createNativeProcess(processId: string, config: ProcessConfig): Promise<IsolatedProcess> {
    // This would integrate with native process creation
    // For now, return a mock implementation
    return {
      id: processId,
      pid: Math.floor(Math.random() * 10000),
      command: config.command,
      args: config.args || [],
      cwd: config.cwd || process.cwd?.() || '/',
      env: config.env || {},
      status: 'running',
      stdin: new WritableStream(),
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
      
      kill: async (signal?: number) => {
        console.log(`Killing process ${processId} with signal ${signal}`);
      },
      wait: async () => {
        return 0;
      },
      terminate: async () => {
        console.log(`Terminating process ${processId}`);
      }
    };
  }

  private emitEvent(type: string, data: any): void {
    const event: ExecutionEvent = {
      type: type as ExecutionEvent['type'],
      timestamp: new Date(),
      data
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in execution authority event listener:`, error);
        }
      });
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Terminate all isolated processes
    const terminationPromises = Array.from(this.isolatedProcesses.keys()).map(processId => 
      this.terminateProcess(processId).catch(error => 
        console.error(`Failed to terminate process ${processId}:`, error)
      )
    );

    await Promise.all(terminationPromises);

    // Clear all state
    this.activeExecutions.clear();
    this.isolatedProcesses.clear();
    this.executionQueue.length = 0;
    this.eventListeners.clear();
  }
}

// Singleton instance for global access
let globalExecutionAuthority: ExecutionAuthorityService | null = null;

export function getExecutionAuthority(config?: Partial<ExecutionAuthorityConfig>): ExecutionAuthorityService {
  if (!globalExecutionAuthority) {
    globalExecutionAuthority = new ExecutionAuthorityService(config);
  }
  return globalExecutionAuthority;
}

export function resetExecutionAuthority(): void {
  if (globalExecutionAuthority) {
    globalExecutionAuthority.shutdown();
    globalExecutionAuthority = null;
  }
}
