import { PTYHandle, PTYConfig, getPTYService } from './runtime/PTYService';

export interface TerminalSession {
  id: string;
  ptyId: string;
  pid: number;
  shell: string;
  cwd: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export class TerminalRuntimeManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private ptyHandles: Map<string, PTYHandle> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    console.log('[TerminalRuntimeManager] Initialized');
  }

  // Terminal lifecycle
  async createTerminal(sessionId: string, config: PTYConfig): Promise<TerminalSession> {
    console.log(`[TerminalRuntimeManager] Creating terminal session: ${sessionId}`);
    
    const ptyService = getPTYService();
    
    // Try Windows shells in order
    const shells = ['pwsh.exe', 'powershell.exe', 'cmd.exe'];
    let pty: PTYHandle | null = null;
    let selectedShell = '';
    let lastError = null;

    for (const shell of shells) {
      try {
        console.log(`[TerminalRuntimeManager] Attempting to spawn shell: ${shell}`);
        pty = await ptyService.createPTY({
          ...config,
          shell
        });
        selectedShell = shell;
        console.log(`[TerminalRuntimeManager] Successfully spawned shell: ${shell} with PID: ${pty.processId}`);
        break;
      } catch (error) {
        lastError = error;
        console.warn(`[TerminalRuntimeManager] Failed to spawn ${shell}:`, error);
      }
    }

    if (!pty) {
      const errorMsg = `Failed to spawn any shell. Last error: ${lastError}`;
      console.error('[TerminalRuntimeManager]', errorMsg);
      throw new Error(errorMsg);
    }

    const session: TerminalSession = {
      id: sessionId,
      ptyId: pty.id,
      pid: pty.processId,
      shell: selectedShell,
      cwd: config.cwd || 'C:\\Users\\',
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    this.ptyHandles.set(pty.id, pty);

    this.emit('terminalCreated', { sessionId, session });

    console.log(`[TerminalRuntimeManager] Terminal session created: ${sessionId} (PID: ${pty.processId})`);
    return session;
  }

  async createOpenCodeTerminal(sessionId: string, config: PTYConfig): Promise<TerminalSession> {
    console.log(`[TerminalRuntimeManager] Creating OpenCode terminal session: ${sessionId}`);
    
    const ptyService = getPTYService();
    
    // Explicitly use the opencode absolute path
    const shell = 'C:\\Users\\syedm\\AppData\\Roaming\\npm\\node_modules\\opencode-windows-x64\\bin\\opencode.exe';
    let pty: PTYHandle | null = null;
    let lastError = null;

    try {
      console.log(`[TerminalRuntimeManager] Attempting to spawn OpenCode: ${shell}`);
      pty = await ptyService.createPTY({
        ...config,
        shell
      });
      console.log(`[TerminalRuntimeManager] Successfully spawned OpenCode with PID: ${pty.processId}`);
    } catch (error) {
      lastError = error;
      console.warn(`[TerminalRuntimeManager] Failed to spawn OpenCode:`, error);
    }

    if (!pty) {
      const errorMsg = `Failed to spawn OpenCode. Last error: ${lastError}`;
      console.error('[TerminalRuntimeManager]', errorMsg);
      throw new Error(errorMsg);
    }

    const session: TerminalSession = {
      id: sessionId,
      ptyId: pty.id,
      pid: pty.processId,
      shell: 'opencode',
      cwd: config.cwd || 'C:\\Users\\',
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    this.ptyHandles.set(pty.id, pty);

    this.emit('terminalCreated', { sessionId, session });

    console.log(`[TerminalRuntimeManager] OpenCode session created: ${sessionId} (PID: ${pty.processId})`);
    return session;
  }

  async destroyTerminal(sessionId: string): Promise<void> {
    console.log(`[TerminalRuntimeManager] Destroying terminal session: ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const pty = this.ptyHandles.get(session.ptyId);
    if (pty) {
      try {
        await pty.destroy();
        this.ptyHandles.delete(session.ptyId);
        console.log(`[TerminalRuntimeManager] PTY destroyed: ${session.ptyId}`);
      } catch (error) {
        console.error(`[TerminalRuntimeManager] Failed to destroy PTY ${session.ptyId}:`, error);
      }
    }

    this.sessions.delete(sessionId);
    this.emit('terminalDestroyed', { sessionId });

    console.log(`[TerminalRuntimeManager] Terminal session destroyed: ${sessionId}`);
  }

  getTerminal(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllTerminals(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveTerminals(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  // PTY operations
  getPTY(ptyId: string): PTYHandle | undefined {
    return this.ptyHandles.get(ptyId);
  }

  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const pty = this.ptyHandles.get(session.ptyId);
    if (!pty) {
      throw new Error(`PTY ${session.ptyId} not found`);
    }

    try {
      await pty.resize(cols, rows);
      session.lastActivity = new Date();
      this.emit('terminalResized', { sessionId, cols, rows });
      console.log(`[TerminalRuntimeManager] Terminal resized: ${sessionId} to ${cols}x${rows}`);
    } catch (error) {
      console.error(`[TerminalRuntimeManager] Failed to resize terminal ${sessionId}:`, error);
      throw error;
    }
  }

  async writeToTerminal(sessionId: string, data: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const pty = this.ptyHandles.get(session.ptyId);
    if (!pty) {
      throw new Error(`PTY ${session.ptyId} not found`);
    }

    try {
      await pty.write(data);
      session.lastActivity = new Date();
      console.log(`[TerminalRuntimeManager] Data written to terminal ${sessionId}: ${data.length} bytes`);
    } catch (error) {
      console.error(`[TerminalRuntimeManager] Failed to write to terminal ${sessionId}:`, error);
      throw error;
    }
  }

  // Health and status
  getTerminalCount(): number {
    return this.sessions.size;
  }

  getActiveTerminalCount(): number {
    return this.getActiveTerminals().length;
  }

  isTerminalActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.isActive || false;
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

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in TerminalRuntimeManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('[TerminalRuntimeManager] Shutting down all terminals');
    
    const destroyPromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.destroyTerminal(sessionId).catch(error => 
        console.error(`Failed to destroy terminal ${sessionId}:`, error)
      )
    );

    await Promise.all(destroyPromises);
    
    this.sessions.clear();
    this.ptyHandles.clear();
    this.eventListeners.clear();
    
    console.log('[TerminalRuntimeManager] Shutdown complete');
  }
}

// Singleton instance
let globalTerminalManager: TerminalRuntimeManager | null = null;

export function getTerminalManager(): TerminalRuntimeManager {
  if (!globalTerminalManager) {
    globalTerminalManager = new TerminalRuntimeManager();
  }
  return globalTerminalManager;
}
