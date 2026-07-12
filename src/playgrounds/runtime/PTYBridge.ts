import { recordPtySpawn } from '../../observability/StartupMetrics';

export interface PTYBridgeConfig {
  cols: number;
  rows: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PTYBridgeHandle {
  id: string;
  isActive: boolean;
  
  // Stream interfaces
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  destroy: () => Promise<void>;
  
  // Event handlers
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onExit?: (exitCode: number) => void;
}

export class PTYBridge {
  private bridges: Map<string, PTYBridgeHandle> = new Map();
  private nextId = 1;
  private eventListeners: Map<string, Function[]> = new Map();

  // Public API
  async createBridge(config: PTYBridgeConfig): Promise<PTYBridgeHandle> {
    const bridgeId = `bridge-${this.nextId++}`;
    
    const handle: PTYBridgeHandle = {
      id: bridgeId,
      isActive: true,
      
      write: async (data: string) => {
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_write', { 
              ptyId: bridgeId, 
              data 
            });
          } catch (error) {
            console.error('Bridge write failed:', error);
            throw error;
          }
        } else {
          // Fallback for development
          console.log(`[Bridge ${bridgeId}] Write:`, data);
        }
      },
      
      resize: async (cols: number, rows: number) => {
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_resize', { 
              ptyId: bridgeId, 
              cols, 
              rows 
            });
          } catch (error) {
            console.error('Bridge resize failed:', error);
            throw error;
          }
        } else {
          console.log(`[Bridge ${bridgeId}] Resize: ${cols}x${rows}`);
        }
      },
      
      destroy: async () => {
        handle.isActive = false;
        if (window.__TAURI__?.invoke) {
          try {
            await window.__TAURI__.invoke('pty_destroy', { 
              ptyId: bridgeId 
            });
          } catch (error) {
            console.error('Bridge destroy failed:', error);
          }
        } else {
          console.log(`[Bridge ${bridgeId}] Destroyed`);
        }
      }
    };

    this.bridges.set(bridgeId, handle);
    
    // Initialize PTY in Tauri backend
    if (window.__TAURI__?.invoke) {
      try {
        const t0 = performance.now();
        await window.__TAURI__.invoke('pty_create', {
          cols: config.cols,
          rows: config.rows,
          cwd: config.cwd,
          env: config.env
        });
        
        recordPtySpawn();
        console.log(`PTY bridge ${bridgeId} created with Tauri backend (${(performance.now() - t0).toFixed(0)}ms)`);
      } catch (error) {
        console.error('Failed to create PTY bridge:', error);
        throw error;
      }
    } else {
      console.log(`PTY bridge ${bridgeId} created (development mode)`);
    }

    this.emitEvent('bridge_created', { bridgeId, handle });
    return handle;
  }

  async destroyBridge(bridgeId: string): Promise<void> {
    const handle = this.bridges.get(bridgeId);
    if (!handle) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    try {
      await handle.destroy();
      this.bridges.delete(bridgeId);
      this.emitEvent('bridge_destroyed', { bridgeId });
    } catch (error) {
      this.emitEvent('bridge_error', { bridgeId, error });
      throw error;
    }
  }

  getBridge(bridgeId: string): PTYBridgeHandle | undefined {
    return this.bridges.get(bridgeId);
  }

  getActiveBridges(): PTYBridgeHandle[] {
    return Array.from(this.bridges.values()).filter(bridge => bridge.isActive);
  }

  getAllBridges(): PTYBridgeHandle[] {
    return Array.from(this.bridges.values());
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
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in PTYBridge event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    const destroyPromises = Array.from(this.bridges.keys()).map(bridgeId => 
      this.destroyBridge(bridgeId).catch(error => 
        console.error(`Failed to destroy bridge ${bridgeId}:`, error)
      )
    );

    await Promise.all(destroyPromises);
    this.bridges.clear();
    this.eventListeners.clear();
  }
}

// Singleton instance
let globalPTYBridge: PTYBridge | null = null;

export function getPTYBridge(): PTYBridge {
  if (!globalPTYBridge) {
    globalPTYBridge = new PTYBridge();
  }
  return globalPTYBridge;
}
