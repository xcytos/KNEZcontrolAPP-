/**
 * Provider Adapter Base Class
 * Normalizes all providers (Ollama, OpenAI, Claude) to unified SSE format
 */

import type { SSEEvent } from '../streaming/UnifiedEventSchema';
import { createSSEEvent } from '../streaming/UnifiedEventSchema';
import { logger } from '../utils/LogService';

export interface AdapterConfig {
  endpoint: string;
  apiKey?: string;
  defaultModel: string;
  timeoutMs: number;
}

export interface StreamContext {
  executionId: string;
  sessionId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export abstract class ProviderAdapter {
  protected config: AdapterConfig;
  protected providerId: string;

  constructor(providerId: string, config: AdapterConfig) {
    this.providerId = providerId;
    this.config = config;
  }

  /**
   * Stream events from provider in unified format
   * All adapters must normalize to SSEEvent format
   */
  abstract stream(context: StreamContext): AsyncGenerator<SSEEvent, void, void>;

  /**
   * Check provider health
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get available models from provider
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Create base event fields
   */
  protected createBaseEvent(context: StreamContext, eventType: SSEEvent['event']) {
    return {
      id: `${context.executionId}-${Date.now()}`,
      timestamp: Date.now(),
      executionId: context.executionId,
      sessionId: context.sessionId,
      provider: this.providerId,
      model: context.model,
      event: eventType,
    };
  }

  /**
   * Emit stream start event
   */
  protected async *emitStreamStart(context: StreamContext): AsyncGenerator<SSEEvent> {
    yield {
      id: `${context.executionId}-${Date.now()}`,
      event: 'stream_start',
      timestamp: Date.now(),
      executionId: context.executionId,
      sessionId: context.sessionId,
      provider: this.providerId,
      model: context.model,
      metadata: {
        provider: this.providerId,
        model: context.model,
        temperature: context.temperature,
        maxTokens: context.maxTokens,
      }
    };
  }

  /**
   * Emit token delta event
   */
  protected async *emitTokenDelta(context: StreamContext, content: string, index: number, finishReason?: string | null): AsyncGenerator<SSEEvent> {
    yield createSSEEvent(
      'token_delta',
      this.createBaseEvent(context, 'token_delta'),
      {
        content,
        index,
        finishReason,
      }
    );
  }

  /**
   * Emit stream end event
   */
  protected async *emitStreamEnd(context: StreamContext, finishReason: string, totalTokens: number, totalExecutionTimeMs: number): AsyncGenerator<SSEEvent> {
    yield createSSEEvent(
      'stream_end',
      this.createBaseEvent(context, 'stream_end'),
      {
        finishReason,
        totalTokens,
        totalExecutionTimeMs,
      }
    );
  }

  /**
   * Emit error event
   */
  protected async *emitError(context: StreamContext, code: string, message: string, recoverable: boolean): AsyncGenerator<SSEEvent> {
    yield createSSEEvent(
      'error',
      this.createBaseEvent(context, 'error'),
      {
        code,
        message,
        recoverable,
        suggestedAction: recoverable ? 'retry' : 'restart',
      }
    );
  }

  /**
   * Handle stream errors with proper logging
   */
  protected handleStreamError(context: StreamContext, error: unknown): AsyncGenerator<SSEEvent> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNetworkError = this.isNetworkError(errorMessage);
    const isTimeout = errorMessage.toLowerCase().includes('timeout');

    logger.error('provider_adapter', 'stream_error', {
      provider: this.providerId,
      executionId: context.executionId,
      error: errorMessage,
      isNetworkError,
      isTimeout,
    });

    return this.emitError(
      context,
      isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK_ERROR' : 'PROVIDER_ERROR',
      errorMessage,
      isNetworkError || isTimeout // Network/timeout errors are recoverable
    );
  }

  private isNetworkError(message: string): boolean {
    const networkKeywords = ['connect', 'network', 'connection refused', 'unreachable', 'econnrefused'];
    return networkKeywords.some(kw => message.toLowerCase().includes(kw));
  }
}
