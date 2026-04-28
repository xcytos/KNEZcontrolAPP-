/**
 * ConnectionManager - Central orchestrator for dual-channel communication.
 * 
 * Manages:
 * - WebSocket lifecycle (connect, reconnect, heartbeat)
 * - SSE request tracking (start, abort)
 * - System state model (connection, backend, model)
 * 
 * Following Claude/Codex pattern:
 * - SSE for chat streaming (tokens, tool execution)
 * - WebSocket for system events (agents, notifications, sync, heartbeat)
 */

import { WebSocketClient } from '../websocket/WebSocketClient';
import { logger } from '../utils/LogService';

export interface ConnectionState {
  ws: 'connected' | 'reconnecting' | 'disconnected' | 'dead';
  backend: 'healthy' | 'degraded' | 'unreachable';
  model: 'loaded' | 'unloaded';
  lastConnectedAt?: number;
  reconnectAttempts: number;
  activeConnectionType: 'sse' | 'websocket';
}

export interface SSERequest {
  id: string;
  sessionId: string;
  controller: AbortController;
  startTime: number;
  status: 'active' | 'aborted' | 'completed' | 'error';
}

export interface SystemState {
  connection: ConnectionState;
  activeSSERequests: Map<string, SSERequest>;
  modelStatus: Map<string, ModelStatus>;
  notifications: Notification[];
}

export interface ModelStatus {
  modelId: string;
  state: 'unknown' | 'unknown' | 'loading' | 'loaded' | 'unloaded' | 'error';
  ollamaState: 'unknown' | 'unknown' | 'running' | 'stopped' | 'error';
  loadedAt?: number;
  lastCheck: number;
  error?: string;
}

export interface Notification {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  action?: string;
}

export class ConnectionManager {
  private wsClient: WebSocketClient;
  private state: SystemState;
  private listeners: Map<string, Set<(data: any) => void>>;
  private heartbeatInterval: number | null = null;
  private heartbeatIntervalMs = 30000; // 30 seconds

  constructor() {
    this.wsClient = new WebSocketClient();
    this.state = {
      connection: {
        ws: 'disconnected',
        backend: 'unreachable',
        model: 'unloaded',
        reconnectAttempts: 0,
        activeConnectionType: 'websocket'
      },
      activeSSERequests: new Map(),
      modelStatus: new Map(),
      notifications: []
    };
    this.listeners = new Map();

    this.setupWebSocketHandlers();
  }

  /**
   * Connect WebSocket for system events.
   */
  connect(sessionId: string): void {
    this.wsClient.connect(sessionId);
    this.state.connection.ws = 'reconnecting';
    this.state.connection.reconnectAttempts = 0;
    this.emit('connection_change', this.state.connection);
  }

  /**
   * Disconnect WebSocket.
   */
  disconnect(): void {
    this.wsClient.disconnect();
    this.state.connection.ws = 'disconnected';
    this.emit('connection_change', this.state.connection);
    this.stopHeartbeat();
  }

  /**
   * Start SSE request for chat streaming.
   * Smart switching: Try SSE first, only switch to WebSocket if SSE fails.
   */
  startSSERequest(sessionId: string, url: string, options: RequestInit = {}): SSERequest {
    const requestId = `${sessionId}-${Date.now()}`;
    const controller = new AbortController();
    
    const request: SSERequest = {
      id: requestId,
      sessionId,
      controller,
      startTime: Date.now(),
      status: 'active'
    };

    this.state.activeSSERequests.set(requestId, request);
    this.state.connection.activeConnectionType = 'sse';
    this.emit('connection_change', this.state.connection);

    // Start SSE stream
    fetch(url, {
      ...options,
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`SSE request failed: ${response.status}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }
        this.readSSEStream(reader, request);
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          request.status = 'error';
          this.emit('sse_error', { requestId, error: error.message });
          // Smart switching: Only switch to WebSocket if SSE fails
          this.state.connection.activeConnectionType = 'websocket';
          this.emit('connection_change', this.state.connection);
          this.emit('connection_switch', { from: 'sse', to: 'websocket', reason: 'sse_failed' });
        }
        this.state.activeSSERequests.delete(requestId);
      });

    return request;
  }

  /**
   * Abort SSE request.
   */
  abortSSERequest(requestId: string): void {
    const request = this.state.activeSSERequests.get(requestId);
    if (request && request.status === 'active') {
      request.controller.abort();
      request.status = 'aborted';
      this.state.activeSSERequests.delete(requestId);
      this.emit('sse_aborted', { requestId });
    }
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): ConnectionState {
    return { ...this.state.connection };
  }

  /**
   * Get all active SSE requests.
   */
  getActiveSSERequests(): SSERequest[] {
    return Array.from(this.state.activeSSERequests.values());
  }

  /**
   * Get model status.
   */
  getModelStatus(modelId: string): ModelStatus | undefined {
    return this.state.modelStatus.get(modelId);
  }

  /**
   * Get all model statuses.
   */
  getAllModelStatuses(): Map<string, ModelStatus> {
    return new Map(this.state.modelStatus);
  }

  /**
   * Get notifications.
   */
  getNotifications(): Notification[] {
    return [...this.state.notifications];
  }

  /**
   * Clear notifications.
   */
  clearNotifications(): void {
    this.state.notifications = [];
    this.emit('notifications_cleared', {});
  }

  /**
   * Register event listener.
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unregister event listener.
   */
  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners.
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Setup WebSocket event handlers.
   */
  private setupWebSocketHandlers(): void {
    // Connected
    this.wsClient.on('connected', () => {
      this.state.connection.ws = 'connected';
      this.state.connection.lastConnectedAt = Date.now();
      this.state.connection.reconnectAttempts = 0;
      this.state.connection.backend = 'healthy';
      this.emit('connection_change', this.state.connection);
      this.startHeartbeat();
    });

    // Disconnected
    this.wsClient.on('disconnected', () => {
      this.state.connection.ws = 'disconnected';
      this.state.connection.backend = 'unreachable';
      this.emit('connection_change', this.state.connection);
      this.stopHeartbeat();
    });

    // System events
    this.wsClient.on('event', (message: any) => {
      if (message.data?.event_type?.startsWith('system_')) {
        this.handleSystemEvent(message);
      }
    });

    // Error
    this.wsClient.on('error', (error: any) => {
      this.emit('websocket_error', error);
      // No automatic fallback - WebSocket is for system events only, not streaming
    });
  }

  /**
   * Handle system events from WebSocket.
   */
  private handleSystemEvent(message: any): void {
    const eventType = message.data?.event_type;
    const eventData = message.data;

    switch (eventType) {
      case 'system_stream_start':
        this.emit('stream_start', eventData);
        break;
      case 'system_stream_end':
        this.emit('stream_end', eventData);
        break;
      case 'system_agent_state':
        this.emit('agent_state', eventData);
        break;
      case 'model_status':
        this.handleModelStatus(eventData);
        break;
      case 'notification':
        this.handleNotification(eventData);
        break;
      default:
        console.log('Unknown system event:', eventType);
    }
  }

  /**
   * Handle model status event.
   */
  private handleModelStatus(data: any): void {
    const modelStatus: ModelStatus = {
      modelId: data.model_id,
      state: data.state,
      ollamaState: data.ollama_state,
      loadedAt: data.loaded_at,
      lastCheck: data.last_check,
      error: data.error
    };
    this.state.modelStatus.set(modelStatus.modelId, modelStatus);
    this.state.connection.model = modelStatus.state === 'loaded' ? 'loaded' : 'unloaded';
    this.emit('model_status', modelStatus);
  }

  /**
   * Handle notification event.
   */
  private handleNotification(data: any): void {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      level: data.level,
      title: data.title,
      message: data.message,
      timestamp: Date.now(),
      action: data.action
    };
    this.state.notifications.push(notification);
    this.emit('notification', notification);
  }

  /**
   * Read SSE stream and emit data events.
   * STRICT ENFORCEMENT: SSE is the ONLY source for token/stream data.
   */
  private async readSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>, request: SSERequest): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              // Event firewall: Tag SSE data as SSE source
              this.emit('sse_data', { requestId: request.id, data: parsed, source: 'sse' });
            } catch (error) {
              logger.error('connection_manager', 'sse_parse_error', { error: String(error), data });
            }
          }
        }
      }

      request.status = 'completed';
      this.state.activeSSERequests.delete(request.id);
      // Set back to websocket when SSE completes
      this.state.connection.activeConnectionType = 'websocket';
      this.emit('connection_change', this.state.connection);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        request.status = 'error';
        this.emit('sse_error', { requestId: request.id, error: String(error) });
      }
      this.state.activeSSERequests.delete(request.id);
    }
  }

  /**
   * Start heartbeat.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      this.wsClient.send({ type: 'ping', data: { timestamp: Date.now() } });
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get active connection type.
   */
  getActiveConnectionType(): 'sse' | 'websocket' {
    return this.state.connection.activeConnectionType;
  }

  /**
   * Set active connection type.
   */
  setActiveConnectionType(type: 'sse' | 'websocket'): void {
    this.state.connection.activeConnectionType = type;
    this.emit('connection_change', this.state.connection);
  }
}

// Global instance
let connectionManager: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!connectionManager) {
    connectionManager = new ConnectionManager();
  }
  return connectionManager;
}
