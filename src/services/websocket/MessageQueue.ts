/**
 * Message Queue for Offline Scenarios
 * Queues outgoing messages during disconnection and flushes on reconnection
 * Supports localStorage persistence for queue survival across refreshes
 */

import { WebSocketMessage, QueuedMessage, MessageQueueConfig } from '../../domain/WebSocketProtocol';

const DEFAULT_CONFIG: MessageQueueConfig = {
  maxSize: 1000,
  persistToLocalStorage: true,
  maxAge: 3600000, // 1 hour
};

const STORAGE_KEY = 'websocket_message_queue';

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private config: MessageQueueConfig;
  private sequenceNumber: number = 0;

  constructor(config: Partial<MessageQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Add a message to the queue
   */
  enqueue(message: WebSocketMessage): void {
    const queued: QueuedMessage = {
      message,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++,
      retries: 0,
    };

    this.queue.push(queued);
    this.enforceMaxSize();
    this.saveToStorage();
  }

  /**
   * Get all messages from the queue
   */
  dequeue(): QueuedMessage[] {
    const messages = [...this.queue];
    this.queue = [];
    this.saveToStorage();
    return messages;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Remove old messages based on age
   */
  removeOldMessages(): void {
    const now = Date.now();
    this.queue = this.queue.filter(
      msg => now - msg.timestamp < this.config.maxAge
    );
    this.saveToStorage();
  }

  /**
   * Remove acknowledged messages
   */
  removeAcknowledged(sequence: number): void {
    this.queue = this.queue.filter(msg => msg.sequence !== sequence);
    this.saveToStorage();
  }

  /**
   * Increment retry count for a message
   */
  incrementRetry(sequence: number): void {
    const msg = this.queue.find(m => m.sequence === sequence);
    if (msg) {
      msg.retries++;
      this.saveToStorage();
    }
  }

  /**
   * Get messages with retry count above threshold
   */
  getFailedMessages(maxRetries: number = 3): QueuedMessage[] {
    return this.queue.filter(msg => msg.retries >= maxRetries);
  }

  /**
   * Enforce max queue size
   */
  private enforceMaxSize(): void {
    if (this.queue.length > this.config.maxSize) {
      // Remove oldest messages
      this.queue = this.queue.slice(-this.config.maxSize);
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (this.config.persistToLocalStorage && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      } catch (e) {
        console.error('[MessageQueue] Failed to save to localStorage:', e);
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (this.config.persistToLocalStorage && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.queue = JSON.parse(stored);
          // Remove old messages
          this.removeOldMessages();
          // Update sequence number
          if (this.queue.length > 0) {
            this.sequenceNumber = Math.max(...this.queue.map(m => m.sequence)) + 1;
          }
        }
      } catch (e) {
        console.error('[MessageQueue] Failed to load from localStorage:', e);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      size: this.queue.length,
      sequenceNumber: this.sequenceNumber,
      oldestMessage: this.queue.length > 0 ? this.queue[0].timestamp : null,
      newestMessage: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : null,
      failedMessages: this.getFailedMessages().length,
    };
  }
}
