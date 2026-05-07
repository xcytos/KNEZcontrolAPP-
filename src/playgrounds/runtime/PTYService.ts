export interface PTYConfig {
  cols: number;
  rows: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export interface PTYHandle {
  id: string;
  processId: number;
  cols: number;
  rows: number;
  cwd: string;
  isActive: boolean;
  
  // Stream interfaces
  stdin: WritableStream<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
  
  // Control methods
  resize(cols: number, rows: number): Promise<void>;
  write(data: string): Promise<void>;
  kill(signal?: number): Promise<void>;
  destroy(): Promise<void>;
}

export interface PTYEvent {
  type: 'data' | 'resize' | 'exit' | 'error';
  ptyId: string;
  data?: string;
  cols?: number;
  rows?: number;
  exitCode?: number;
  error?: Error;
}

export class PTYService {
  private activePTYs: Map<string, PTYHandle> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private nextId = 1;

  constructor() {
    this.initializeConPTY();
  }

  // Public API
  async createPTY(config: PTYConfig): Promise<PTYHandle> {
    const ptyId = `pty-${this.nextId++}`;
    
    try {
      const handle = await this.createConPTYProcess(ptyId, config);
      this.activePTYs.set(ptyId, handle);
      
      this.emitEvent('data', { ptyId, data: `PTY ${ptyId} created in ${config.cwd || process.cwd()}\r\n` });
      
      return handle;
    } catch (error) {
      this.emitEvent('error', { ptyId, error: error as Error });
      throw error;
    }
  }

  async destroyPTY(ptyId: string): Promise<void> {
    const handle = this.activePTYs.get(ptyId);
    if (!handle) {
      throw new Error(`PTY ${ptyId} not found`);
    }

    try {
      await handle.destroy();
      this.activePTYs.delete(ptyId);
      this.emitEvent('exit', { ptyId, exitCode: 0 });
    } catch (error) {
      this.emitEvent('error', { ptyId, error: error as Error });
      throw error;
    }
  }

  getActivePTYs(): PTYHandle[] {
    return Array.from(this.activePTYs.values());
  }

  getPTY(ptyId: string): PTYHandle | undefined {
    return this.activePTYs.get(ptyId);
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
  private async initializeConPTY(): Promise<void> {
    // Initialize ConPTY subsystem
    if (typeof window !== 'undefined') {
      // Browser environment - use WebPTY or WebSocket bridge
      console.log('PTY Service: Browser environment detected, using bridge');
    } else {
      // Node.js environment - use native ConPTY
      console.log('PTY Service: Node.js environment detected, using ConPTY');
    }
  }

  private async createConPTYProcess(ptyId: string, config: PTYConfig): Promise<PTYHandle> {
    if (typeof window !== 'undefined') {
      return this.createWebPTY(ptyId, config);
    } else {
      return this.createNativePTY(ptyId, config);
    }
  }

  private async createWebPTY(ptyId: string, config: PTYConfig): Promise<PTYHandle> {
    // Web-based PTY using WebSocket bridge to Tauri backend
    const stdinController = new TransformStream();
    const stdoutController = new TransformStream();
    const stderrController = new TransformStream();

    const handle: PTYHandle = {
      id: ptyId,
      processId: -1, // Web PTY has no native process ID
      cols: config.cols,
      rows: config.rows,
      cwd: config.cwd || '/',
      isActive: true,
      
      stdin: stdinController.writable,
      stdout: stdoutController.readable,
      stderr: stderrController.readable,
      
      resize: async (cols: number, rows: number) => {
        handle.cols = cols;
        handle.rows = rows;
        
        // Send resize command to Tauri backend
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_resize', { ptyId, cols, rows });
            this.emitEvent('resize', { ptyId, cols, rows });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      },
      
      write: async (data: string) => {
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_write', { ptyId, data });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      },
      
      kill: async (signal?: number) => {
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_kill', { ptyId, signal });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      },
      
      destroy: async () => {
        handle.isActive = false;
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_destroy', { ptyId });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      }
    };

    // Set up WebSocket connection to Tauri PTY bridge
    this.setupWebSocketBridge(ptyId, handle, stdoutController, stderrController);
    
    return handle;
  }

  private async createNativePTY(ptyId: string, config: PTYConfig): Promise<PTYHandle> {
    // Native Node.js PTY implementation (for Tauri backend)
    const { spawn } = require('child_process');
    const { EventEmitter } = require('events');
    
    const stdinController = new TransformStream();
    const stdoutController = new TransformStream();
    const stderrController = new TransformStream();
    
    // Launch process with ConPTY (Windows) or pty.py (Unix)
    const shell = config.shell || process.platform === 'win32' ? 'cmd.exe' : 'bash';
    const args = config.shell ? [] : [];
    
    const childProcess = spawn(shell, args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const handle: PTYHandle = {
      id: ptyId,
      processId: childProcess.pid || -1,
      cols: config.cols,
      rows: config.rows,
      cwd: config.cwd || process.cwd(),
      isActive: true,
      
      stdin: stdinController.writable,
      stdout: stdoutController.readable,
      stderr: stderrController.readable,
      
      resize: async (cols: number, rows: number) => {
        handle.cols = cols;
        handle.rows = rows;
        // Native resize would use ConPTY APIs
        this.emitEvent('resize', { ptyId, cols, rows });
      },
      
      write: async (data: string) => {
        if (childProcess.stdin) {
          childProcess.stdin.write(data);
        }
      },
      
      kill: async (signal?: number) => {
        if (childProcess.pid) {
          process.kill(childProcess.pid, signal || 'SIGTERM');
        }
      },
      
      destroy: async () => {
        handle.isActive = false;
        if (childProcess.pid) {
          process.kill(childProcess.pid, 'SIGTERM');
        }
      }
    };

    // Set up process event handlers
    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.emitEvent('data', { ptyId, data: text });
      
      // Push to stdout stream
      const writer = stdoutController.writable.getWriter();
      writer.write(text).finally(() => writer.releaseLock());
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.emitEvent('data', { ptyId, data: text });
      
      // Push to stderr stream
      const writer = stderrController.writable.getWriter();
      writer.write(text).finally(() => writer.releaseLock());
    });

    childProcess.on('exit', (code: number | null) => {
      handle.isActive = false;
      this.emitEvent('exit', { ptyId, exitCode: code || 0 });
    });

    childProcess.on('error', (error: Error) => {
      this.emitEvent('error', { ptyId, error });
    });

    return handle;
  }

  private setupWebSocketBridge(
    ptyId: string, 
    handle: PTYHandle,
    stdoutController: TransformStream,
    stderrController: TransformStream
  ): void {
    // WebSocket connection to Tauri PTY bridge
    const ws = new WebSocket(`ws://localhost:8080/pty/${ptyId}`);
    
    ws.onopen = () => {
      console.log(`PTY ${ptyId} WebSocket connected`);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'data') {
        this.emitEvent('data', { ptyId, data: message.data });
        
        // Route to appropriate stream
        const writer = message.stream === 'stderr' 
          ? stderrController.writable.getWriter()
          : stdoutController.writable.getWriter();
          
        writer.write(message.data).finally(() => writer.releaseLock());
      } else if (message.type === 'exit') {
        handle.isActive = false;
        this.emitEvent('exit', { ptyId, exitCode: message.exitCode });
      }
    };
    
    ws.onerror = (error) => {
      this.emitEvent('error', { ptyId, error: new Error(`WebSocket error: ${error}`) });
    };
    
    ws.onclose = () => {
      handle.isActive = false;
      this.emitEvent('exit', { ptyId, exitCode: 0 });
    };
  }

  private emitEvent(type: string, data: any): void {
    const event: PTYEvent = {
      type: type as PTYEvent['type'],
      ptyId: data.ptyId,
      ...data
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in PTYService event listener for ${type}:`, error);
        }
      });
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    const destroyPromises = Array.from(this.activePTYs.keys()).map(ptyId => 
      this.destroyPTY(ptyId).catch(error => 
        console.error(`Failed to destroy PTY ${ptyId}:`, error)
      )
    );

    await Promise.all(destroyPromises);
    this.activePTYs.clear();
    this.eventListeners.clear();
  }
}

// Singleton instance
let globalPTYService: PTYService | null = null;

export function getPTYService(): PTYService {
  if (!globalPTYService) {
    globalPTYService = new PTYService();
  }
  return globalPTYService;
}
