import { 
  RuntimeManager
} from './RuntimeManager';
import { PTYHandle } from '../runtime/PTYService';

export interface ExecutionCommand {
  id: string;
  runtimeId: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface ExecutionResult {
  id: string;
  runtimeId: string;
  success: boolean;
  output?: string;
  error?: Error;
  exitCode?: number;
  executionTime: number;
}

export interface ProcessConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  shell?: string;
  detached?: boolean;
  stdio?: 'inherit' | 'pipe' | 'ignore';
}

export interface IsolatedProcess {
  id: string;
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  status: 'running' | 'stopped' | 'completed' | 'error';
  stdin: WritableStream<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
  
  // Process control
  kill(signal?: number): Promise<void>;
  wait(): Promise<number>;
  terminate(): Promise<void>;
}

export class ExecutionAuthorityManager {
  private runtimeManager: RuntimeManager;
  private ptyService: any; // Will be injected PTY service
  private isolatedProcesses: Map<string, IsolatedProcess>;

  constructor(runtimeManager: RuntimeManager, ptyService: any) {
    this.runtimeManager = runtimeManager;
    this.ptyService = ptyService;
    this.isolatedProcesses = new Map();
  }

  // Authority delegation
  async delegateExecution(runtimeId: string, command: ExecutionCommand): Promise<ExecutionResult> {
    try {
      const runtime = this.runtimeManager.getRuntime(runtimeId);
      if (!runtime) {
        throw new Error(`Runtime ${runtimeId} not found`);
      }

      // Execute command through runtime
      const result = await this.executeCommand(runtime, command);
      this.emit('executionCompleted', { runtimeId, command, result });
      return result;
    } catch (error) {
      this.emit('executionError', { runtimeId, command, error });
      throw error;
    }
  }

  async requestPTY(runtimeId: string, config: any): Promise<PTYHandle> {
    try {
      const pty = await this.ptyService.createPTY(config);
      this.emit('ptyCreated', { runtimeId, pty });
      return pty;
    } catch (error) {
      this.emit('ptyError', { runtimeId, error });
      throw error;
    }
  }

  // Process isolation
  async createIsolatedProcess(config: ProcessConfig): Promise<IsolatedProcess> {
    try {
      // Create isolated process through native service
      const process = await this.ptyService.createProcess(config);
      
      const isolatedProcess: IsolatedProcess = {
        id: `proc-${Date.now()}`,
        pid: process.pid,
        command: config.command,
        args: config.args || [],
        cwd: config.cwd || process.cwd?.() || '/',
        env: config.env || {},
        status: 'running',
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        
        // Process control
        kill: async (signal?: number) => {
          await process.kill(signal);
          isolatedProcess.status = 'stopped';
        },
        wait: async () => {
          const exitCode = await process.wait();
          isolatedProcess.status = 'completed';
          return exitCode;
        },
        terminate: async () => {
          await process.terminate();
          isolatedProcess.status = 'stopped';
        }
      };

      this.isolatedProcesses.set(isolatedProcess.id, isolatedProcess);
      this.emit('processCreated', { process: isolatedProcess });
      return isolatedProcess;
    } catch (error) {
      this.emit('processError', { config, error });
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
      this.emit('processTerminated', { processId });
    } catch (error) {
      this.emit('processError', { processId, error });
      throw error;
    }
  }

  // Stream routing
  async routeStream(sessionId: string, stream: any): Promise<void> {
    try {
      // Route stream to appropriate handler
      await this.attachStreamToSession(sessionId, stream);
      this.emit('streamRouted', { sessionId, stream });
    } catch (error) {
      this.emit('streamError', { sessionId, stream, error });
      throw error;
    }
  }

  async closeStream(streamId: string): Promise<void> {
    try {
      const session = await this.runtimeManager.getSession(sessionId);
      if (session) {
        const stream = session.streams.get(streamId);
        if (stream) {
          await this.runtimeManager.destroyStream(streamId);
          this.emit('streamClosed', { sessionId, streamId });
        }
      }
    } catch (error) {
      this.emit('streamError', { streamId, error });
      throw error;
    }
  }

  // Private helper methods
  private async executeCommand(runtime: any, command: ExecutionCommand): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Execute command through runtime's PTY or IPC
      const output = await runtime.execute({
        command: command.command,
        args: command.args,
        env: command.env,
        cwd: command.cwd
      });

      const executionTime = Date.now() - startTime;

      return {
        id: command.id,
        runtimeId: command.runtimeId,
        success: true,
        output,
        executionTime
      };
    } catch (error) {
      return {
        id: command.id,
        runtimeId: command.runtimeId,
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async attachStreamToSession(sessionId: string, stream: any): Promise<void> {
    const session = await this.runtimeManager.getSession(sessionId);
    if (session) {
      await this.runtimeManager.attachStream(sessionId, stream);
    }
  }

  // Event handling
  private eventListeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in ExecutionAuthorityManager event listener for ${event}:`, error);
        }
      });
    }
  }
}
