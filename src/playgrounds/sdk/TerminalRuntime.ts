import { PlaygroundManifest, RuntimeConfig } from './PlaygroundTypes';
import { getTerminalManager } from '../TerminalRuntimeManager';

export class TerminalRuntime {
  private manifest: PlaygroundManifest;
  private terminalManager = getTerminalManager();

  constructor(manifest: PlaygroundManifest) {
    this.manifest = manifest;
  }

  async launch(config: RuntimeConfig): Promise<void> {
    console.log(`[TerminalRuntime] Launching terminal with config:`, config);
    
    try {
      await this.terminalManager.createTerminal(config.id, {
        cols: 80,
        rows: 24,
        cwd: config.cwd,
        env: config.env,
        shell: config.shell
      });
      
      console.log(`[TerminalRuntime] Terminal launched successfully`);
    } catch (error) {
      console.error(`[TerminalRuntime] Failed to launch terminal:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(`[TerminalRuntime] Stopping terminal`);
    
    try {
      const terminals = this.terminalManager.getAllTerminals();
      for (const terminal of terminals) {
        await this.terminalManager.destroyTerminal(terminal.id);
      }
      
      console.log(`[TerminalRuntime] All terminals stopped`);
    } catch (error) {
      console.error(`[TerminalRuntime] Failed to stop terminal:`, error);
      throw error;
    }
  }

  async createSession(config: RuntimeConfig): Promise<any> {
    console.log(`[TerminalRuntime] Creating session:`, config);
    
    try {
      const session = await this.terminalManager.createTerminal(config.id, {
        cols: 80,
        rows: 24,
        cwd: config.cwd,
        env: config.env,
        shell: config.shell
      });
      
      return session;
    } catch (error) {
      console.error(`[TerminalRuntime] Failed to create session:`, error);
      throw error;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    console.log(`[TerminalRuntime] Destroying session: ${sessionId}`);
    
    try {
      await this.terminalManager.destroyTerminal(sessionId);
    } catch (error) {
      console.error(`[TerminalRuntime] Failed to destroy session:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<any> {
    const terminals = this.terminalManager.getAllTerminals();
    const activeTerminals = this.terminalManager.getActiveTerminals();
    
    return {
      status: terminals.length > 0 ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
      metrics: {
        totalTerminals: terminals.length,
        activeTerminals: activeTerminals.length
      }
    };
  }

  async getMetrics(): Promise<any> {
    const activeTerminals = this.terminalManager.getActiveTerminals();
    
    return {
      sessionId: 'terminal-runtime',
      runtimeId: this.manifest.id,
      startTime: new Date(),
      executionTime: Date.now() - Date.now(), // Placeholder
      memoryUsage: 0, // Placeholder
      cpuUsage: 0, // Placeholder
      networkBytesIn: 0, // Placeholder
      networkBytesOut: 0, // Placeholder
      activeStreams: activeTerminals.length,
      totalCommands: 0, // Placeholder
      errors: 0 // Placeholder
    };
  }
}
