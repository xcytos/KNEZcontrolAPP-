import { RuntimeManager } from './RuntimeManager';

// Singleton instance for global access
let globalRuntimeManager: RuntimeManager | null = null;

export function getRuntimeManager(): RuntimeManager {
  if (!globalRuntimeManager) {
    globalRuntimeManager = new RuntimeManager();
  }
  return globalRuntimeManager;
}

export function resetRuntimeManager(): void {
  if (globalRuntimeManager) {
    // Cleanup if needed
    globalRuntimeManager = null;
  }
}
