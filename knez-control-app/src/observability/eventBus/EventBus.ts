/**
 * Event Bus Core - WebSocket-based event system with bi-directional communication
 * 
 * This is the REAL-TIME CORE of the KNEZ Observatory System
 * All system components emit structured events through this bus
 * 
 * CRITICAL: NO POLLING - Event-driven only
 */

import { SystemEvent } from './EventSchema';
import { NodeIds } from '../NodeRegistry';

type EventCallback = (event: SystemEvent) => void;
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface EventBusConfig {
  wsUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

export class EventBus {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private subscribers: Map<string, Set<EventCallback>> = new Map();
  private config: EventBusConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventQueue: SystemEvent[] = [];
  private isProcessingQueue = false;

  constructor(config: EventBusConfig) {
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   * Emits websocket_connected event on success
   */
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.state = 'connecting';
    console.log('[EventBus] Connecting to', this.config.wsUrl);

    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        console.log('[EventBus] websocket_connected');
        
        // Emit connection event
        this.emit({
          event_id: this.generateUUID(),
          trace_id: 'system',
          timestamp: Date.now(),
          source_node: NodeIds.EventBus,
          target_node: NodeIds.System,
          event_type: 'websocket_connected',
          payload: { state: 'connected' },
          latency_ms: 0,
          status: 'success'
        });

        // Process queued events
        this.processEventQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data as SystemEvent);
        } catch (error) {
          console.error('[EventBus] Failed to parse event:', error);
        }
      };

      this.ws.onerror = (error) => {
        this.state = 'error';
        console.error('[EventBus] WebSocket error:', error);
        this.handleReconnect();
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        console.log('[EventBus] WebSocket closed');
        this.handleReconnect();
      };

    } catch (error) {
      this.state = 'error';
      console.error('[EventBus] Connection failed:', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = 'disconnected';
  }

  /**
   * Subscribe to events by type
   */
  subscribe(eventType: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Emit event to all subscribers and WebSocket
   * CRITICAL: This is the ONLY way to emit events
   */
  emit(event: SystemEvent): void {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add event_id if not provided
    if (!event.event_id) {
      event.event_id = this.generateUUID();
    }

    // Notify local subscribers
    this.notifySubscribers(event);

    // Send to WebSocket if connected
    if (this.state === 'connected' && this.ws) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (error) {
        console.error('[EventBus] Failed to send event:', error);
        this.queueEvent(event);
      }
    } else {
      // Queue event for when connection is restored
      this.queueEvent(event);
    }
  }

  /**
   * Handle incoming event from WebSocket
   */
  private handleIncomingEvent(event: SystemEvent): void {
    console.log('[EventBus] event_stream_active:', event.event_type);
    this.notifySubscribers(event);
  }

  /**
   * Notify all subscribers for an event type
   */
  private notifySubscribers(event: SystemEvent): void {
    const callbacks = this.subscribers.get(event.event_type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[EventBus] Subscriber error:', error);
        }
      });
    }

    // Also notify wildcard subscribers
    const wildcardCallbacks = this.subscribers.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[EventBus] Wildcard subscriber error:', error);
        }
      });
    }
  }

  /**
   * Queue event for later delivery
   */
  private queueEvent(event: SystemEvent): void {
    this.eventQueue.push(event);
    console.log('[EventBus] Event queued:', event.event_id);
  }

  /**
   * Process queued events
   */
  private processEventQueue(): void {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event && this.state === 'connected' && this.ws) {
        try {
          this.ws.send(JSON.stringify(event));
        } catch (error) {
          console.error('[EventBus] Failed to send queued event:', error);
          this.queueEvent(event); // Re-queue
          break;
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[EventBus] Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    console.log(`[EventBus] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function getEventBus(config?: EventBusConfig): EventBus {
  if (!eventBusInstance) {
    // PHASE 6: Use default config with configurable WebSocket URL
    const knezPort = (import.meta.env.VITE_KNEZ_PORT as string) || "8000";
    const defaultConfig: EventBusConfig = {
      wsUrl: `ws://127.0.0.1:${knezPort}/ws`,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5
    };
    eventBusInstance = new EventBus(config || defaultConfig);
  }
  return eventBusInstance;
}
