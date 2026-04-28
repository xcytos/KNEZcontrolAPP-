/**
 * Streaming Execution Engine
 * Orchestrates streaming with ModelRouter and ProviderAdapters
 * Enforces: 1 execution = 1 provider = 1 SSE stream
 */

import { modelRouter, RoutingContext, ProviderType } from '../routing/ModelRouter';
import { ollamaAdapter } from '../providers/OllamaAdapter';
import type { SSEEvent } from '../streaming/UnifiedEventSchema';
import { logger } from '../utils/LogService';

export interface ExecutionContext {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  userPreference?: 'local' | 'cloud' | 'auto';
  taskType?: 'coding' | 'reasoning' | 'general';
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  provider: ProviderType;
  model: string;
  totalTokens: number;
  durationMs: number;
  error?: string;
}

export class StreamingExecutionEngine {
  private activeExecutions: Map<string, AbortController> = new Map();

  /**
   * Execute streaming request with unified flow
   * 1. Route to provider
   * 2. Lock execution
   * 3. Stream events
   * 4. Handle failures with restart (not switch)
   */
  async *execute(
    context: ExecutionContext
  ): AsyncGenerator<SSEEvent, ExecutionResult, void> {
    const startTime = Date.now();

    // Step 1: Route to provider
    const routingContext: RoutingContext = {
      sessionId: context.sessionId,
      userPreference: context.userPreference,
      taskType: context.taskType,
      messageCount: context.messages.length,
      estimatedTokens: this.estimateTokens(context.messages),
    };

    const decision = await modelRouter.route(routingContext);
    logger.info('execution_engine', 'routing_decision', {
      executionId: decision.executionId,
      provider: decision.provider,
      model: decision.model,
      confidence: decision.confidence,
    });

    // Step 2: Create execution controller
    const executionController = new AbortController();
    if (context.signal) {
      context.signal.addEventListener('abort', () => executionController.abort(), { once: true });
    }
    this.activeExecutions.set(decision.executionId, executionController);

    // Step 3: Execute with selected provider
    try {
      const adapter = this.getAdapter(decision.provider);
      const streamContext = {
        executionId: decision.executionId,
        sessionId: context.sessionId,
        model: decision.model,
        messages: context.messages,
        temperature: context.temperature,
        maxTokens: context.maxTokens,
        signal: executionController.signal,
      };

      let totalTokens = 0;
      let streamEnded = false;

      for await (const event of adapter.stream(streamContext)) {
        if (executionController.signal.aborted) {
          throw new DOMException('Execution cancelled', 'AbortError');
        }

        // Track tokens
        if (event.event === 'token_delta') {
          totalTokens++;
        }

        // Track stream end
        if (event.event === 'stream_end') {
          streamEnded = true;
          totalTokens = event.data.totalTokens || totalTokens;
        }

        yield event;

        // Stop on stream end or error
        if (event.event === 'stream_end' || event.event === 'error') {
          break;
        }
      }

      const duration = Date.now() - startTime;

      // Step 4: Cleanup
      this.activeExecutions.delete(decision.executionId);
      modelRouter.releaseExecution(decision.executionId);

      const result: ExecutionResult = {
        success: streamEnded,
        executionId: decision.executionId,
        provider: decision.provider,
        model: decision.model,
        totalTokens,
        durationMs: duration,
      };

      logger.info('execution_engine', 'execution_completed', {
        executionId: decision.executionId,
        success: result.success,
        totalTokens: result.totalTokens,
        durationMs: result.durationMs,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = this.isNetworkError(errorMessage);
      const isTimeout = errorMessage.toLowerCase().includes('timeout');

      logger.error('execution_engine', 'execution_failed', {
        executionId: decision.executionId,
        provider: decision.provider,
        error: errorMessage,
        isNetworkError,
        isTimeout,
        fallbackChain: decision.fallbackChain,
      });

      // Step 5: Failure handling - RESTART, not switch
      // Per strict rules: failures = restart, not switch
      this.activeExecutions.delete(decision.executionId);
      modelRouter.releaseExecution(decision.executionId);

      // Mark provider as degraded
      if (isNetworkError || isTimeout) {
        modelRouter.updateProviderHealth(decision.provider, 'degraded');
      }

      // Emit error event
      yield {
        id: `${decision.executionId}-error-${Date.now()}`,
        event: 'error',
        timestamp: Date.now(),
        executionId: decision.executionId,
        sessionId: context.sessionId,
        provider: decision.provider,
        model: decision.model,
        data: {
          code: isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK_ERROR' : 'PROVIDER_ERROR',
          message: errorMessage,
          recoverable: isNetworkError || isTimeout,
          suggestedAction: 'restart',
        },
      };

      const duration = Date.now() - startTime;

      return {
        success: false,
        executionId: decision.executionId,
        provider: decision.provider,
        model: decision.model,
        totalTokens: 0,
        durationMs: duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel active execution
   */
  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(executionId);
      modelRouter.releaseExecution(executionId);
      logger.info('execution_engine', 'execution_cancelled', { executionId });
      return true;
    }
    return false;
  }

  /**
   * Get adapter for provider
   */
  private getAdapter(provider: ProviderType) {
    switch (provider) {
      case 'ollama':
        return ollamaAdapter;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Estimate token count from messages
   */
  private estimateTokens(messages: Array<{ role: string; content: string }>): number {
    return messages.reduce((total, msg) => {
      // Rough estimate: ~4 chars per token
      return total + Math.ceil(msg.content.length / 4);
    }, 0);
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(message: string): boolean {
    const networkKeywords = ['connect', 'network', 'connection refused', 'unreachable', 'econnrefused'];
    return networkKeywords.some(kw => message.toLowerCase().includes(kw));
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if execution is active
   */
  isExecutionActive(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }
}

// Singleton instance
export const streamingExecutionEngine = new StreamingExecutionEngine();
