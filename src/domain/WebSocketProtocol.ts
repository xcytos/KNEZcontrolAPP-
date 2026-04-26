/**
 * WebSocket Protocol Types for Advanced Features
 * Defines message types, acknowledgment, sequencing, and health monitoring
 */

export type WebSocketMessageType = 
  | 'connected'
  | 'disconnected'
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'subscribed'
  | 'event'
  | 'ack'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  sequence?: number;
  timestamp?: number;
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping';
  data: {
    timestamp: number;
  };
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong';
  data: {
    timestamp: number;
  };
}

export interface AckMessage extends WebSocketMessage {
  type: 'ack';
  data: {
    sequence: number;
  };
}

export interface QueuedMessage {
  message: WebSocketMessage;
  timestamp: number;
  sequence: number;
  retries: number;
}

export interface ConnectionHealth {
  connectedAt: number;
  lastPong: number;
  lastMessage: number;
  messageCount: number;
  errorCount: number;
  healthScore: number;
  latency: number;
  qualityScore: number;
}

export interface ConnectionState {
  connected: boolean;
  sessionId: string | null;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  queueSize: number;
  health: ConnectionHealth | null;
}

export interface ReconnectionConfig {
  maxDelay: number; // Maximum delay in ms (default: 30000)
  initialDelay: number; // Initial delay in ms (default: 1000)
  backoffMultiplier: number; // Exponential backoff multiplier (default: 2)
  jitter: boolean; // Add random jitter to prevent thundering herd (default: true)
  maxAttempts: number; // Max reconnection attempts (default: Infinity)
}

export interface MessageQueueConfig {
  maxSize: number; // Max queue size (default: 1000)
  persistToLocalStorage: boolean; // Persist to localStorage (default: true)
  maxAge: number; // Max age of queued messages in ms (default: 3600000 = 1 hour)
}

export interface BackpressureConfig {
  bufferSize: number; // Buffer size in messages (default: 100)
  threshold: number; // Threshold to trigger backpressure (default: 80)
  resumeThreshold: number; // Threshold to resume (default: 50)
}

export interface HealthMonitorConfig {
  pingInterval: number; // Ping interval in ms (default: 30000)
  pongTimeout: number; // Pong timeout in ms (default: 60000)
  healthCheckInterval: number; // Health check interval in ms (default: 60000)
}

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';

export interface PrioritizedMessage extends WebSocketMessage {
  priority: MessagePriority;
}
