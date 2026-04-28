import { logger } from '../utils/LogService';
import { 
  WebSocketMessage, 
  ReconnectionConfig, 
  MessageQueueConfig, 
  BackpressureConfig, 
  HealthMonitorConfig,
  ConnectionState
} from '../../domain/WebSocketProtocol';
import { MessageQueue } from './MessageQueue';
import { HealthMonitor } from './HealthMonitor';
import { BackpressureHandler } from './BackpressureHandler';

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectConfig: ReconnectionConfig;
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private isConnected = false;
  private reconnectTimer: number | null = null;
  
  // New components
  private messageQueue: MessageQueue;
  private healthMonitor: HealthMonitor;
  private backpressureHandler: BackpressureHandler;
  private sequenceNumber: number = 0;
  private pendingAcks: Map<number, number> = new Map(); // sequence -> timestamp
  private messageBuffer: Map<number, WebSocketMessage> = new Map(); // sequence -> message for ordering

  constructor(
    reconnectConfig?: Partial<ReconnectionConfig>,
    queueConfig?: Partial<MessageQueueConfig>,
    backpressureConfig?: Partial<BackpressureConfig>,
    healthConfig?: Partial<HealthMonitorConfig>
  ) {
    this.reconnectConfig = { 
      maxDelay: 30000,
      initialDelay: 1000,
      backoffMultiplier: 2,
      jitter: true,
      maxAttempts: Infinity,
      ...reconnectConfig 
    };
    this.messageQueue = new MessageQueue(queueConfig);
    this.healthMonitor = new HealthMonitor(healthConfig);
    this.backpressureHandler = new BackpressureHandler(backpressureConfig);

    // Auto-reconnect on window focus
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (!this.isConnected && this.sessionId) {
          this.connect(this.sessionId);
        }
      });

      // Handle online/offline events
      window.addEventListener('online', () => {
        if (!this.isConnected && this.sessionId) {
          this.connect(this.sessionId);
        }
      });

      window.addEventListener('offline', () => {
        logger.warn('websocket', 'network_offline', { sessionId: this.sessionId });
      });
    }

    // Log all WebSocket messages for verification
    this.on('*', (message) => {
      logger.debug('websocket', 'message_received', { type: message.type, data: message.data });
    });

    // Load connection state from localStorage
    this.loadConnectionState();
  }

  connect(sessionId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('websocket', 'already_connected', { sessionId });
      return;
    }

    this.sessionId = sessionId;
    const wsUrl = this.getWebSocketUrl(sessionId);
    
    logger.info('websocket', 'connecting', { sessionId, wsUrl });
    console.log('[WebSocketClient] Connecting to:', wsUrl, 'sessionId:', sessionId);

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        logger.info('websocket', 'connected', { sessionId });
        logger.info('websocket', 'websocket_connected', { sessionId });
        console.log('[WebSocketClient] Connected to WebSocket, sessionId:', sessionId);
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Start health monitoring
        this.healthMonitor.start((timestamp) => {
          this.send({ type: 'ping', data: { timestamp } });
        });

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

        // Save connection state
        this.saveConnectionState();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('[WebSocketClient] Message received:', message);
          
          // Handle sequence ordering
          if (message.sequence !== undefined) {
            this.handleSequencedMessage(message);
          } else {
            this.handleMessage(message);
          }
        } catch (e) {
          logger.error('websocket', 'message_parse_error', { error: String(e) });
          console.error('[WebSocketClient] Message parse error:', e);
          this.healthMonitor.recordError();
        }
      };

      this.ws.onerror = (error) => {
        logger.error('websocket', 'error', { error: String(error) });
        console.error('[WebSocketClient] WebSocket error:', error);
        this.healthMonitor.recordError();
      };

      this.ws.onclose = () => {
        logger.warn('websocket', 'disconnected', { sessionId });
        console.log('[WebSocketClient] Disconnected from WebSocket, sessionId:', sessionId);
        this.isConnected = false;
        this.ws = null;
        
        // Stop health monitoring
        this.healthMonitor.stop();
        
        // Schedule reconnection
        this.scheduleReconnect();
      };
    } catch (e) {
      logger.error('websocket', 'connection_failed', { error: String(e) });
      console.error('[WebSocketClient] Connection failed:', e);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Stop health monitoring
    this.healthMonitor.stop();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    
    // Clear connection state
    this.clearConnectionState();
  }

  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('websocket', 'send_failed_not_connected', { messageType: message.type });
      // Queue message for later
      this.messageQueue.enqueue(message);
      return;
    }

    try {
      // Add sequence number
      const messageWithSequence = {
        ...message,
        sequence: this.sequenceNumber++,
      };
      
      this.ws.send(JSON.stringify(messageWithSequence));
      logger.debug('websocket', 'message_sent', { type: message.type, sequence: messageWithSequence.sequence });
      
      // Track pending ACK
      this.pendingAcks.set(messageWithSequence.sequence, Date.now());
    } catch (e) {
      logger.error('websocket', 'send_failed', { error: String(e) });
      this.healthMonitor.recordError();
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
    // Handle special message types
    if (message.type === 'pong') {
      this.healthMonitor.recordPong(message.data.timestamp);
      this.healthMonitor.recordMessage();
    } else if (message.type === 'ack') {
      this.handleAck(message);
    } else {
      // Use backpressure handler for normal messages
      if (this.backpressureHandler.addMessage(message)) {
        this.backpressureHandler.processMessages((msg) => {
          this.dispatchMessage(msg);
        });
      }
    }
  }

  private handleSequencedMessage(message: WebSocketMessage): void {
    const sequence = message.sequence!;
    
    // Buffer message for ordering
    this.messageBuffer.set(sequence, message);
    
    // Send ACK
    this.send({ type: 'ack', data: { sequence } });
    
    // Process buffered messages in order
    let nextSequence = this.sequenceNumber;
    while (this.messageBuffer.has(nextSequence)) {
      const bufferedMessage = this.messageBuffer.get(nextSequence)!;
      this.messageBuffer.delete(nextSequence);
      this.dispatchMessage(bufferedMessage);
      this.sequenceNumber = nextSequence + 1;
      nextSequence = this.sequenceNumber;
    }
  }

  private handleAck(message: WebSocketMessage): void {
    const sequence = message.data.sequence;
    this.pendingAcks.delete(sequence);
    this.messageQueue.removeAcknowledged(sequence);
  }

  private dispatchMessage(message: WebSocketMessage): void {
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
    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      logger.error('websocket', 'max_reconnect_attempts_reached', { 
        attempts: this.reconnectAttempts 
      });
      return;
    }

    // Calculate delay with exponential backoff
    let delay = this.reconnectConfig.initialDelay * Math.pow(this.reconnectConfig.backoffMultiplier, this.reconnectAttempts);
    
    // Cap at max delay
    delay = Math.min(delay, this.reconnectConfig.maxDelay);
    
    // Add jitter if enabled
    if (this.reconnectConfig.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

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

  private saveConnectionState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const state: ConnectionState = {
          connected: this.isConnected,
          sessionId: this.sessionId,
          lastConnectedAt: Date.now(),
          reconnectAttempts: this.reconnectAttempts,
          queueSize: this.messageQueue.size(),
          health: this.healthMonitor.getHealth(),
        };
        localStorage.setItem('websocket_connection_state', JSON.stringify(state));
      } catch (e) {
        console.error('[WebSocketClient] Failed to save connection state:', e);
      }
    }
  }

  private loadConnectionState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('websocket_connection_state');
        if (stored) {
          // Restore sequence number from queue stats
          const stats = this.messageQueue.getStats();
          if (stats.sequenceNumber > 0) {
            this.sequenceNumber = stats.sequenceNumber;
          }
        }
      } catch (e) {
        console.error('[WebSocketClient] Failed to load connection state:', e);
      }
    }
  }

  private clearConnectionState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('websocket_connection_state');
      } catch (e) {
        console.error('[WebSocketClient] Failed to clear connection state:', e);
      }
    }
  }

  private getWebSocketUrl(sessionId: string): string {
    // STEP 1: Use backend URL directly with configurable port instead of hardcoded 8000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const knezPort = (import.meta.env.VITE_KNEZ_PORT as string) || "8000";
    const host = `127.0.0.1:${knezPort}`; // Backend server, not frontend dev server

    return `${protocol}//${host}/ws/${sessionId}`;
  }

  getConnectionState(): ConnectionState {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      lastConnectedAt: null, // TODO: Track last connected timestamp
      reconnectAttempts: this.reconnectAttempts,
      queueSize: this.messageQueue.size(),
      health: this.healthMonitor.getHealth(),
    };
  }

  getHealthStats() {
    return this.healthMonitor.getStats();
  }

  getQueueStats() {
    return this.messageQueue.getStats();
  }

  getBackpressureStatus() {
    return this.backpressureHandler.getStatus();
  }
}

export const webSocketClient = new WebSocketClient();
