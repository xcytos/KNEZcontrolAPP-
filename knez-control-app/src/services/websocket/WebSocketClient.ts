import { logger } from '../utils/LogService';

export type WebSocketMessage = {
  type: string;
  data: any;
};

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private isConnected = false;
  private reconnectTimer: number | null = null;

  constructor() {
    // Auto-reconnect on window focus
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (!this.isConnected && this.sessionId) {
          this.connect(this.sessionId);
        }
      });
    }

    // Log all WebSocket messages for verification
    this.on('*', (message) => {
      logger.debug('websocket', 'message_received', { type: message.type, data: message.data });
    });
  }

  connect(sessionId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('websocket', 'already_connected', { sessionId });
      return;
    }

    this.sessionId = sessionId;
    const wsUrl = this.getWebSocketUrl(sessionId);
    
    logger.info('websocket', 'connecting', { sessionId, wsUrl });

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        logger.info('websocket', 'connected', { sessionId });
        logger.info('websocket', 'websocket_connected', { sessionId }); // STEP 1: Explicit log
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Emit connected event for ChatService to track
        this.handlers.get('connected')?.forEach(handler => {
          try {
            handler({ type: 'connected', data: { sessionId } });
          } catch (e) {
            logger.error('websocket', 'connected_handler_error', { error: String(e) });
          }
        });

        // Subscribe to all events by default
        this.send({
          type: 'subscribe',
          data: { channels: ['*'] }
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (e) {
          logger.error('websocket', 'message_parse_error', { error: String(e) });
        }
      };

      this.ws.onerror = (error) => {
        logger.error('websocket', 'error', { error: String(error) });
      };

      this.ws.onclose = () => {
        logger.warn('websocket', 'disconnected', { sessionId });
        this.isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (e) {
      logger.error('websocket', 'connection_failed', { error: String(e) });
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
  }

  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('websocket', 'send_failed_not_connected', { messageType: message.type });
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      logger.debug('websocket', 'message_sent', { type: message.type });
    } catch (e) {
      logger.error('websocket', 'send_failed', { error: String(e) });
    }
  }

  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (e) {
          logger.error('websocket', 'handler_error', { 
            eventType: message.type, 
            error: String(e) 
          });
        }
      });
    }

    // Also call wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (e) {
          logger.error('websocket', 'wildcard_handler_error', { 
            eventType: message.type, 
            error: String(e) 
          });
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('websocket', 'max_reconnect_attempts_reached', { 
        attempts: this.reconnectAttempts 
      });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    logger.info('websocket', 'scheduling_reconnect', { 
      attempt: this.reconnectAttempts + 1, 
      delay 
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      if (this.sessionId) {
        this.connect(this.sessionId);
      }
    }, delay);
  }

  private getWebSocketUrl(sessionId: string): string {
    // Determine the WebSocket URL based on the current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // If in Tauri dev mode, use the proxied backend
    // Otherwise, use the same host as the current page
    return `${protocol}//${host}/ws/${sessionId}`;
  }

  getConnectionState(): { connected: boolean; sessionId: string | null } {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId
    };
  }

  ping(): void {
    this.send({
      type: 'ping',
      data: { timestamp: Date.now() }
    });
  }
}

export const webSocketClient = new WebSocketClient();
