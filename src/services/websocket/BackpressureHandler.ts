/**
 * Backpressure Handler
 * Manages receive buffer monitoring and throttles message processing
 */

import { BackpressureConfig } from '../../domain/WebSocketProtocol';

const DEFAULT_CONFIG: BackpressureConfig = {
  bufferSize: 100,
  threshold: 80,
  resumeThreshold: 50,
};

export class BackpressureHandler {
  private config: BackpressureConfig;
  private buffer: any[] = [];
  private isPaused: boolean = false;
  private processingTimer: number | null = null;

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add message to buffer
   */
  addMessage(message: any): boolean {
    if (this.isPaused) {
      // Buffer is full, reject message
      console.warn('[BackpressureHandler] Buffer paused, rejecting message');
      return false;
    }

    this.buffer.push(message);

    // Check if we need to pause
    if (this.buffer.length >= this.config.threshold) {
      this.pause();
    }

    return true;
  }

  /**
   * Process buffered messages
   */
  processMessages(processor: (message: any) => void): void {
    if (this.processingTimer) {
      return; // Already processing
    }

    this.processingTimer = window.setTimeout(() => {
      const messages = [...this.buffer];
      this.buffer = [];

      messages.forEach(message => {
        try {
          processor(message);
        } catch (e) {
          console.error('[BackpressureHandler] Error processing message:', e);
        }
      });

      this.processingTimer = null;

      // Check if we can resume
      if (this.isPaused && this.buffer.length < this.config.resumeThreshold) {
        this.resume();
      }
    }, 0);
  }

  /**
   * Pause message processing
   */
  private pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      console.warn('[BackpressureHandler] Pausing due to backpressure');
      // Emit backpressure event
      this.emitEvent('backpressure_paused', { bufferSize: this.buffer.length });
    }
  }

  /**
   * Resume message processing
   */
  private resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      console.log('[BackpressureHandler] Resuming');
      // Emit resume event
      this.emitEvent('backpressure_resumed', { bufferSize: this.buffer.length });
    }
  }

  /**
   * Get buffer status
   */
  getStatus() {
    return {
      bufferSize: this.buffer.length,
      isPaused: this.isPaused,
      threshold: this.config.threshold,
      resumeThreshold: this.config.resumeThreshold,
      utilization: this.buffer.length / this.config.bufferSize,
    };
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    this.resume();
  }

  /**
   * Emit backpressure event (placeholder for event bus integration)
   */
  private emitEvent(event: string, data: any): void {
    // TODO: Integrate with event bus
    console.log(`[BackpressureHandler] Event: ${event}`, data);
  }
}
