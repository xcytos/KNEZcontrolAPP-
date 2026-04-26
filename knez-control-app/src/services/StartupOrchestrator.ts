/**
 * Startup Orchestrator
 * 
 * Ensures backend-first boot sequence:
 * 1. Wait for backend health check to pass
 * 2. Start WebSocket connection
 * 3. Enable UI
 * 
 * This prevents connection errors and inconsistent state.
 */

import { getConnectionManager } from './connection/ConnectionManager';
import { logger } from './utils/LogService';

export enum BootState {
  INITIALIZING = 'initializing',
  WAITING_FOR_BACKEND = 'waiting_for_backend',
  BACKEND_READY = 'backend_ready',
  CONNECTING_WEBSOCKET = 'connecting_websocket',
  READY = 'ready',
  FAILED = 'failed'
}

export class StartupOrchestrator {
  private static instance: StartupOrchestrator;
  private state: BootState = BootState.INITIALIZING;
  private healthCheckInterval: number | null = null;
  private backendUrl: string;
  private maxRetries: number = 30; // 30 seconds max wait
  private retryCount: number = 0;

  private constructor(backendUrl: string = 'http://127.0.0.1:8000') {
    this.backendUrl = backendUrl;
  }

  static getInstance(backendUrl?: string): StartupOrchestrator {
    if (!StartupOrchestrator.instance) {
      StartupOrchestrator.instance = new StartupOrchestrator(backendUrl);
    }
    return StartupOrchestrator.instance;
  }

  /**
   * Start the boot sequence
   */
  async boot(sessionId: string): Promise<BootState> {
    this.state = BootState.WAITING_FOR_BACKEND;
    logger.info('startup_orchestrator', 'boot_sequence_started', { sessionId });

    try {
      // Step 1: Wait for backend health
      await this.waitForBackend();
      
      // Step 2: Connect WebSocket
      this.state = BootState.CONNECTING_WEBSOCKET;
      const connectionManager = getConnectionManager();
      connectionManager.connect(sessionId);
      
      // Step 3: Wait for WebSocket connection
      await this.waitForWebSocketConnection();
      
      // Step 4: Ready
      this.state = BootState.READY;
      logger.info('startup_orchestrator', 'boot_sequence_complete', { sessionId, state: this.state });
      
      return this.state;
    } catch (error) {
      this.state = BootState.FAILED;
      logger.error('startup_orchestrator', 'boot_sequence_failed', { error: String(error) });
      return this.state;
    }
  }

  /**
   * Wait for backend to be healthy
   */
  private async waitForBackend(): Promise<void> {
    logger.info('startup_orchestrator', 'waiting_for_backend', { url: this.backendUrl });
    
    return new Promise((resolve, reject) => {
      this.healthCheckInterval = window.setInterval(async () => {
        this.retryCount++;
        
        try {
          const response = await fetch(`${this.backendUrl}/health`);
          if (response.ok) {
            logger.info('startup_orchestrator', 'backend_healthy', { attempts: this.retryCount });
            this.state = BootState.BACKEND_READY;
            this.clearHealthCheck();
            resolve();
          } else {
            logger.debug('startup_orchestrator', 'backend_not_ready', { status: response.status });
          }
        } catch (error) {
          logger.debug('startup_orchestrator', 'health_check_failed', { error: String(error) });
        }

        if (this.retryCount >= this.maxRetries) {
          this.clearHealthCheck();
          reject(new Error(`Backend health check failed after ${this.maxRetries} attempts`));
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Wait for WebSocket connection
   */
  private async waitForWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionManager = getConnectionManager();
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000); // 10 second timeout

      const checkConnection = () => {
        const wsState = connectionManager.getConnectionState();
        
        if (wsState.ws === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Clear health check interval
   */
  private clearHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get current boot state
   */
  getState(): BootState {
    return this.state;
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.clearHealthCheck();
    this.state = BootState.INITIALIZING;
    this.retryCount = 0;
  }
}

export function getStartupOrchestrator(backendUrl?: string): StartupOrchestrator {
  return StartupOrchestrator.getInstance(backendUrl);
}
