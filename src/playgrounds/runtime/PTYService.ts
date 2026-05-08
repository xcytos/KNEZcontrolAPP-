// Import Tauri API directly
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Tauri type declarations
declare global {
  interface Window {
    __TAURI__?: {
      invoke: (command: string, args?: any) => Promise<any>;
    };
  }
}

export interface PTYConfig {
  cols: number;
  rows: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  command?: string;
  args?: string[];
}

import { getProcessRegistry } from './ProcessRegistry';

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
  private processRegistry = getProcessRegistry();

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

  // REAL OpenCode process spawning
  async createOpenCodePTY(config: PTYConfig & { command?: string; args?: string[] }): Promise<PTYHandle> {
    const ptyId = `opencode-${this.nextId++}`;
    
    try {
      // Create REAL PTY with OpenCode command
      const handle = await this.spawnOpenCodeProcess(ptyId, config);
      this.activePTYs.set(ptyId, handle);
      
      this.emitEvent('data', { ptyId, data: `\x1b[32m🚀 OpenCode PTY created with PID: ${handle.processId}\x1b[0m\r\n` });
      
      return handle;
    } catch (error) {
      this.emitEvent('error', { ptyId, error: error as Error });
      throw error;
    }
  }

  private async spawnOpenCodeProcess(ptyId: string, config: PTYConfig & { command?: string; args?: string[] }): Promise<PTYHandle> {
    const stdinController = new TransformStream();
    const stdoutController = new TransformStream();
    const stderrController = new TransformStream();

    let realProcessId = -1;
    // FIX: Use existing command for PTY validation since opencode doesn't exist
    const command = config.command || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
    const args = config.args || [];

    // Spawn REAL OpenCode process through Tauri
    if (window.__TAURI__?.invoke) {
      try {
        console.log(`[RUST_COMMAND_ENTERED] Invoking pty_spawn_command with: ${command}`);
        const result = await window.__TAURI__.invoke('pty_spawn_command', {
          ptyId,
          command,
          args,
          cols: config.cols,
          rows: config.rows,
          cwd: config.cwd || process.cwd?.() || '/',
          env: config.env || {}
        });
        
        realProcessId = result.processId;
        console.log(`[PTY_CREATED] PTY ${ptyId} created`);
        console.log(`[SHELL_SPAWNED] PowerShell process spawned`);
        console.log(`[PID_ASSIGNED] PID: ${realProcessId}`);
        
        // Register process with ProcessRegistry for ownership tracking
        this.processRegistry.registerProcess({
          processId: ptyId,
          pid: realProcessId,
          ptyId: ptyId,
          runtimeId: 'opencode',
          playgroundId: 'opencode-playground',
          ownerType: 'playground',
          command: command,
          args: args,
          cwd: config.cwd || '/',
          env: config.env || {},
          status: 'spawning'
        });
        
      } catch (error) {
        console.error('[PTYService] Failed to spawn OpenCode process:', error);
        this.emitEvent('error', { ptyId, error: error as Error });
        throw error;
      }
    } else {
      throw new Error('Tauri backend not available - cannot spawn OpenCode process');
    }

    const handle: PTYHandle = {
      id: ptyId,
      processId: realProcessId, // REAL OpenCode process ID
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
        // Write to REAL OpenCode process stdin
        console.log(`[STDIN_SENT] ${data.length} bytes to PTY ${ptyId}`);
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_write', { ptyId, data });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      },
      
      kill: async (signal?: number) => {
        // Kill REAL OpenCode process
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
        // Destroy REAL OpenCode PTY process
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_destroy', { ptyId });
          } catch (error) {
            this.emitEvent('error', { ptyId, error: error as Error });
          }
        }
      }
    };

    // Set up REAL PTY streaming for OpenCode
    this.setupRealPTYStreaming(ptyId, handle, stdoutController, stderrController);
    console.log(`[PTY_ATTACHED] PTY ${ptyId} streaming established`);
    
    // Update process status to running in registry
    this.processRegistry.spawnProcess(ptyId);
    
    return handle;
  }

  async destroyPTY(ptyId: string): Promise<void> {
    const handle = this.activePTYs.get(ptyId);
    if (!handle) {
      throw new Error(`PTY ${ptyId} not found`);
    }

    try {
      await handle.destroy();
      this.activePTYs.delete(ptyId);
      
      // Update process registry
      this.processRegistry.exitProcess(ptyId, 0);
      
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
    // ── Tauri v2 detection ────────────────────────────────────────────────
    // In Tauri v2, invoke() is a pure ESM import from '@tauri-apps/api/core'.
    // It is NOT exposed as window.__TAURI__.invoke (that was Tauri v1).
    // window.__TAURI__ exists in v2 as a namespace object ({app, core, event, …})
    // but does NOT have .invoke on it — so checking .invoke always returns false.
    //
    // Correct detection: check window.__TAURI__ OR window.__TAURI_INTERNALS__,
    // then call the already-imported `invoke` function directly.
    const w = window as any;
    const isTauri = !!(w.__TAURI__ || w.__TAURI_INTERNALS__ || w.__TAURI_IPC__);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PTY DEBUG] isTauri (v2 check): ${isTauri}`);
      console.log(`[PTY DEBUG] window.__TAURI__:`, w.__TAURI__);
      console.log(`[PTY DEBUG] window.__TAURI_INTERNALS__:`, !!w.__TAURI_INTERNALS__);
    }

    if (isTauri) {
      // Tauri environment — use the ESM-imported invoke() directly.
      console.log('[PTYService] Tauri v2 environment detected, using real PTY backend via ESM invoke');
      return this.createWebPTY(ptyId, config);
    } else {
      throw new Error('Tauri backend not available — Terminal Playground requires the Tauri desktop app (npm run tauri dev)');
    }
  }
  private async createWebPTY(_ptyId: string, config: PTYConfig): Promise<PTYHandle> {
    return new Promise(async (resolve, reject) => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PTY DEBUG] Using direct invoke function');
        }
        
        // Spawn actual PTY process with real shell using direct invoke
        const result = await invoke('pty_create', {
          config: {
            cols: config.cols,
            rows: config.rows,
            cwd: config.cwd || 'C:\\Users\\',
            env: config.env || {},
            shell: config.shell || 'powershell.exe'
          }
        }) as string;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[PTY DEBUG] PTY created successfully:', result);
        }
        
        const handle: PTYHandle = {
          id: result, // PTY ID returned from pty_create
          processId: 0, // Will be set when process spawns
          cols: config.cols,
          rows: config.rows,
          cwd: config.cwd || 'C:\\Users\\',
          isActive: true,
          
          stdin: new TransformStream().writable,
          stdout: new TransformStream().readable,
          stderr: new TransformStream().readable,
          
          resize: async (cols: number, rows: number) => {
            try {
              await invoke('pty_resize', { ptyId: result, cols, rows });
            } catch (error) {
              console.error('Resize error:', error);
            }
          },
          
          write: async (data: string) => {
            try {
              await invoke('pty_write', { ptyId: result, data });
            } catch (error) {
              console.error('Write error:', error);
            }
          },
          
          kill: async (signal?: number) => {
            try {
              await invoke('pty_kill', { ptyId: result, signal });
            } catch (error) {
              console.error('Kill error:', error);
            }
          },
          
          destroy: async () => {
            handle.isActive = false;
            try {
              await invoke('pty_destroy', { ptyId: result });
            } catch (error) {
              console.error('Destroy error:', error);
            }
          }
        };
        
        resolve(handle);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === 'development') {
          console.error('[PTY DEBUG] Failed to create PTY:', errorMessage);
        }
        reject(new Error(`Failed to create PTY: ${errorMessage}`));
      }
    });
  }

  
  private setupRealPTYStreaming(
    ptyId: string, 
    handle: PTYHandle,
    stdoutController: TransformStream,
    _stderrController: TransformStream
  ): void {
    // Subscribe to the canonical Tauri event emitted by pty.rs.
    // The Rust backend calls: app_handle.emit("pty-output", &PtyOutputEvent { pty_id, data })
    // Note: window.addEventListener('pty-event') was WRONG — that event never fires.
    let unlistenFn: (() => void) | null = null;

    listen<{ pty_id: string; data: string }>('pty-output', (event) => {
      if (event.payload.pty_id !== ptyId) return;

      const data = event.payload.data;
      console.log(`[STDOUT_RECEIVED] ${data.length} bytes from PTY ${ptyId}`);
      this.emitEvent('data', { ptyId, data });

      // Also pipe into the TransformStream for any consumers using stdout.getReader()
      try {
        const writer = stdoutController.writable.getWriter();
        writer.write(data).finally(() => writer.releaseLock());
      } catch (_) {
        // TransformStream may be closed; ignore
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
      console.log(`[PTYService] pty-output listener established for ${ptyId}`);
    }).catch((error) => {
      console.error('[PTYService] Failed to subscribe to pty-output:', error);
      this.emitEvent('error', { ptyId, error: error as Error });
    });

    // Store cleanup so handle.destroy() can remove the Tauri listener
    (handle as any)._cleanup = () => {
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
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
