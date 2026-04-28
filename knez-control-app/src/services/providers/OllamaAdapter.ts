/**
 * Ollama Provider Adapter
 * Normalizes Ollama streaming to unified SSE format
 */

import { ProviderAdapter, StreamContext } from './ProviderAdapter';
import type { SSEEvent } from '../streaming/UnifiedEventSchema';
import { logger } from '../utils/LogService';

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  done?: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaAdapter extends ProviderAdapter {
  constructor() {
    const port = (import.meta.env.VITE_OLLAMA_PORT as string) || '11434';
    super('ollama', {
      endpoint: `http://localhost:${port}`,
      defaultModel: 'qwen2.5:7b-instruct-q4_K_M',
      timeoutMs: 120000, // 2 minutes for local models
    });
  }

  async *stream(context: StreamContext): AsyncGenerator<SSEEvent, void, void> {
    const startTime = Date.now();
    let tokenIndex = 0;

    logger.info('ollama_adapter', 'stream_started', {
      executionId: context.executionId,
      model: context.model,
      messageCount: context.messages.length,
    });

    // Emit stream start
    yield* this.emitStreamStart(context);

    try {
      const response = await fetch(`${this.config.endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: context.model,
          messages: context.messages,
          stream: true,
          options: {
            temperature: context.temperature ?? 0.7,
            num_predict: context.maxTokens ?? 2048,
          },
        }),
        signal: context.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body from Ollama');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (context.signal?.aborted) {
          reader.releaseLock();
          throw new DOMException('Request cancelled', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(line);

            if (chunk.message?.content) {
              yield* this.emitTokenDelta(context, chunk.message.content, tokenIndex++);
            }

            if (chunk.done) {
              const totalTokens = (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0);
              const totalTime = Date.now() - startTime;

              yield* this.emitStreamEnd(
                context,
                'stop',
                totalTokens,
                totalTime
              );

              reader.releaseLock();
              return;
            }
          } catch (parseError) {
            logger.warn('ollama_adapter', 'parse_error', {
              line: line.slice(0, 100),
              error: String(parseError),
            });
          }
        }
      }

      // If we get here without 'done', emit end anyway
      yield* this.emitStreamEnd(context, 'stop', tokenIndex, Date.now() - startTime);

    } catch (error) {
      yield* this.handleStreamError(context, error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch (error) {
      logger.error('ollama_adapter', 'get_models_error', { error: String(error) });
      return [];
    }
  }
}

// Singleton instance
export const ollamaAdapter = new OllamaAdapter();
