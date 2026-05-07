import { 
  PlaygroundManifest, 
  RuntimeConfig, 
  RuntimeSession, 
  RuntimeHealth,
  RuntimeMetrics,
  PTYEvent,
  PTYEventHandler
} from './PlaygroundManifest';
import { PTYHandle, PTYConfig } from '../runtime/PTYService';

// Re-export types that are used by other modules
export { RuntimeConfig, RuntimeSession, PTYEvent, PTYHandle };

export class RuntimeManager {
  private runtimes: Map<string, any>; // Will be typed as PlaygroundRuntime when imported
  private sessions: Map<string, RuntimeSession>;
  private ptyHandles: Map<string, PTYHandle>;
  private eventListeners: Map<string, Function[]>;

  constructor() {
    this.runtimes = new Map();
    this.sessions = new Map();
    this.ptyHandles = new Map();
    this.eventListeners = new Map();
  }

  // Runtime lifecycle
  async launchRuntime(runtimeId: string, config: RuntimeConfig): Promise<any> {
    const manifest = this.getManifest(runtimeId);
    if (!manifest) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    // Check platform compatibility
    if (!this.isPlatformSupported(manifest)) {
      throw new Error(`Runtime ${runtimeId} not supported on current platform`);
    }

    // Create runtime instance
    const RuntimeClass = await this.loadRuntimeClass(runtimeId);
    const runtime = new RuntimeClass(manifest);
    
    this.runtimes.set(runtimeId, runtime);
    
    try {
      await runtime.launch(config);
      this.emit('runtimeLaunched', { runtimeId, config });
    } catch (error) {
      this.emit('runtimeError', { runtimeId, error });
      throw error;
    }

    return runtime;
  }

  async stopRuntime(runtimeId: string): Promise<void> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    try {
      await runtime.stop();
      this.runtimes.delete(runtimeId);
      this.emit('runtimeStopped', { runtimeId });
    } catch (error) {
      this.emit('runtimeError', { runtimeId, error });
      throw error;
    }
  }

  async restartRuntime(runtimeId: string): Promise<any> {
    await this.stopRuntime(runtimeId);
    const manifest = this.getManifest(runtimeId);
    return this.launchRuntime(runtimeId, manifest.defaultConfig || {});
  }

  // Session management
  async createSession(runtimeId: string, config: SessionConfig): Promise<RuntimeSession> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    try {
      const session = await runtime.createSession(config);
      this.sessions.set(config.id, session);
      this.emit('sessionCreated', { runtimeId, session });
      return session;
    } catch (error) {
      this.emit('sessionError', { runtimeId, error });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<RuntimeSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  getAllSessions(): RuntimeSession[] {
    return Array.from(this.sessions.values());
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const runtime = this.runtimes.get(session.runtimeId);
    if (!runtime) {
      throw new Error(`Runtime ${session.runtimeId} not found`);
    }

    try {
      await runtime.destroySession(sessionId);
      this.sessions.delete(sessionId);
      this.emit('sessionDestroyed', { runtimeId: sessionId });
    } catch (error) {
      this.emit('sessionError', { runtimeId: session.runtimeId, error });
      throw error;
    }
  }

  // PTY management
  async createPTY(config: { shell?: string; cwd?: string; env?: Record<string, string> }): Promise<PTYHandle> {
    // TODO: Implement native PTY creation
    // This will be implemented in Tauri PTY service
    const pty: PTYHandle = {
      id: `pty-${Date.now()}`,
      pid: 0,
      shell: config.shell || 'bash',
      cwd: config.cwd || process.cwd?.() || '/',
      env: config.env || {},
      size: { cols: 80, rows: 24 },
      
      // Stream management
      stdin: new WritableStream(),
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
      
      // Process control
      resize: async (size: TerminalSize) => {
        console.log('PTY resize:', size);
      },
      kill: async (signal?: number) => {
        console.log('PTY kill:', signal);
      },
      wait: async () => {
        console.log('PTY wait');
        return 0;
      },
      
      // Event handling
      on: (event: PTYEvent, handler: PTYEventHandler) => {
        console.log('PTY event:', event);
      },
      off: (event: PTYEvent, handler: PTYEventHandler) => {
        console.log('PTY off:', event);
      }
    };

    this.ptyHandles.set(pty.id, pty);
    this.emit('ptyCreated', pty);
    return pty;
  }

  getPTY(ptyId: string): PTYHandle | undefined {
    return this.ptyHandles.get(ptyId);
  }

  async destroyPTY(ptyId: string): Promise<void> {
    const pty = this.ptyHandles.get(ptyId);
    if (!pty) {
      throw new Error(`PTY ${ptyId} not found`);
    }

    try {
      await pty.kill();
      this.ptyHandles.delete(ptyId);
      this.emit('ptyDestroyed', { ptyId });
    } catch (error) {
      this.emit('ptyError', { ptyId, error });
      throw error;
    }
  }

  // Health monitoring
  async healthCheck(runtimeId: string): Promise<RuntimeHealth> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    try {
      const health = await runtime.healthCheck();
      this.emit('healthCheck', { runtimeId, health });
      return health;
    } catch (error) {
      this.emit('healthCheckError', { runtimeId, error });
      throw error;
    }
  }

  async getMetrics(runtimeId: string): Promise<RuntimeMetrics> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    try {
      const metrics = await runtime.getMetrics();
      this.emit('metricsUpdated', { runtimeId, metrics });
      return metrics;
    } catch (error) {
      this.emit('metricsError', { runtimeId, error });
      throw error;
    }
  }

  // Manifest access
  getManifest(runtimeId: string): PlaygroundManifest | undefined {
    // TODO: Implement manifest registry
    // For now, return a default manifest
    return {
      id: runtimeId,
      name: runtimeId,
      runtimeType: runtimeId as any,
      icon: 'code',
      capabilities: {
        supportsMultiSession: true,
        supportsBackground: true,
        supportsProviderInjection: true,
        supportsWorkspace: true,
        requiredShell: ['bash', 'zsh', 'powershell', 'cmd'],
        supportedPlatforms: ['windows', 'linux', 'macos']
      },
      launchStrategy: 'pty_spawn' as any,
      healthCheck: async () => {
        return { status: 'healthy', lastCheck: new Date() };
      }
    };
  }

  getRuntime(runtimeId: string): any | undefined {
    return this.runtimes.get(runtimeId);
  }

  getAllRuntimes(): any[] {
    return Array.from(this.runtimes.values());
  }

  // Platform support check
  private isPlatformSupported(manifest: PlaygroundManifest): boolean {
    const currentPlatform = this.detectPlatform();
    return manifest.capabilities.supportedPlatforms.includes(currentPlatform);
  }

  private detectPlatform(): string {
    if (typeof window !== 'undefined') {
      // Browser environment
      return 'windows'; // Default assumption
    }
    
    if (typeof process !== 'undefined') {
      const platform = process.platform;
      switch (platform) {
        case 'win32':
          return 'windows';
        case 'linux':
          return 'linux';
        case 'darwin':
          return 'macos';
        default:
          return 'windows'; // Default
      }
    }
    
    return 'windows'; // Default
  }

  // Dynamic runtime loading
  private async loadRuntimeClass(runtimeId: string): Promise<any> {
    switch (runtimeId) {
      case 'opencode':
        const { OpenCodeRuntime } = await import('./runtimes/OpenCodeRuntime');
        return OpenCodeRuntime;
      case 'claudecode':
        const { ClaudeCodeRuntime } = await import('./runtimes/ClaudeCodeRuntime');
        return ClaudeCodeRuntime;
      case 'aider':
        const { AiderRuntime } = await import('./runtimes/AiderRuntime');
        return AiderRuntime;
      case 'gemini-cli':
        const { GeminiCliRuntime } = await import('./runtimes/GeminiCliRuntime');
        return GeminiCliRuntime;
      case 'mcp-studio':
        const { McpStudioRuntime } = await import('./runtimes/McpStudioRuntime');
        return McpStudioRuntime;
      default:
        throw new Error(`Unknown runtime type: ${runtimeId}`);
    }
  }

  // Event handling
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
          console.error(`Error in RuntimeManager event listener for ${event}:`, error);
        }
      });
    }
  }
}
