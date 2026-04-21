// ─── ContextCompressionEngine.ts ───────────────────────────────────────────
// T9: Context Compression Engine — compresses context using semantic summarization,
//     key extraction, and temporal decay. Manages token budget dynamically.
// ─────────────────────────────────────────────────────────────────────────────

import { TIMEOUT_CONFIG } from '../../../config/features';

export interface CompressionStrategy {
  name: string;
  description: string;
  priority: number; // Lower = higher priority
}

export interface CompressionResult {
  originalMessages: Array<{ role: string; content: string }>;
  compressedMessages: Array<{ role: string; content: string }>;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  strategy: string;
  preservedKeyPoints: string[];
}

export interface CompressionStats {
  totalCompressions: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  averageCompressionRatio: number;
  strategyUsage: Map<string, number>;
}

// Approximate token count (rough estimate: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(message: { role: string; content: string }): number {
  return estimateTokens(message.role) + estimateTokens(message.content);
}

// Extract key points from content using simple heuristics
function extractKeyPoints(content: string, maxPoints: number = 5): string[] {
  const points: string[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Prioritize sentences with key indicators
  const indicators = ['important', 'critical', 'key', 'essential', 'must', 'should', 'note', 'warning', 'error'];
  const scored = sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    const score = indicators.reduce((sum, indicator) => 
      sum + (lower.includes(indicator) ? 1 : 0), 0);
    return { sentence, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  for (const item of scored.slice(0, maxPoints)) {
    points.push(item.sentence.trim());
  }
  
  return points;
}

// Semantic summarization using extraction-based approach
function semanticSummarize(content: string, targetLength: number): string {
  if (content.length <= targetLength) return content;
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length === 0) return content.substring(0, targetLength);
  
  // Extract key sentences
  const keyPoints = extractKeyPoints(content, Math.min(10, sentences.length));
  const summary = keyPoints.join('. ');
  
  if (summary.length <= targetLength) {
    return summary;
  }
  
  // Truncate if still too long
  return summary.substring(0, targetLength) + '...';
}

// Temporal decay: weight messages by recency
function applyTemporalDecay(messages: Array<{ role: string; content: string }>, decayFactor: number = 0.9): Array<{ role: string; content: string; weight: number }> {
  const weighted = messages.map((msg, index) => {
    const weight = Math.pow(decayFactor, messages.length - index - 1);
    return { ...msg, weight };
  });
  
  return weighted;
}

/**
 * Context compression engine with multiple strategies.
 */
export class ContextCompressionEngine {
  private stats: CompressionStats = {
    totalCompressions: 0,
    totalOriginalTokens: 0,
    totalCompressedTokens: 0,
    averageCompressionRatio: 0,
    strategyUsage: new Map()
  };

  private strategies: CompressionStrategy[] = [
    {
      name: 'semantic_summarization',
      description: 'Extract key points and summarize semantically',
      priority: 1
    },
    {
      name: 'key_extraction',
      description: 'Extract only key sentences and important information',
      priority: 2
    },
    {
      name: 'temporal_decay',
      description: 'Weight recent messages higher, compress older ones',
      priority: 3
    },
    {
      name: 'truncation',
      description: 'Simple truncation of older messages',
      priority: 4
    }
  ];

  /**
   * Check if context should be compressed based on size.
   */
  shouldCompress(contextSize: number, maxTokens: number = TIMEOUT_CONFIG.CONTEXT_WINDOW_TOKENS): boolean {
    return contextSize > (maxTokens * 0.8); // Compress at 80% of capacity
  }

  /**
   * Compress context to fit within token budget.
   */
  compressContext(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number = TIMEOUT_CONFIG.CONTEXT_WINDOW_TOKENS
  ): CompressionResult {
    const originalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
    
    if (originalTokens <= maxTokens) {
      return {
        originalMessages: messages,
        compressedMessages: messages,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1,
        strategy: 'none',
        preservedKeyPoints: []
      };
    }

    // Try strategies in priority order
    for (const strategy of this.strategies) {
      const result = this.applyStrategy(messages, strategy.name, maxTokens);
      if (result.compressedTokens <= maxTokens) {
        this.updateStats(result);
        return result;
      }
    }

    // Fallback: keep only most recent messages
    const fallback = this.keepRecentMessages(messages, maxTokens);
    this.updateStats(fallback);
    return fallback;
  }

  /**
   * Apply specific compression strategy.
   */
  private applyStrategy(
    messages: Array<{ role: string; content: string }>,
    strategy: string,
    maxTokens: number
  ): CompressionResult {
    const compressed: Array<{ role: string; content: string }> = [];
    let currentTokens = 0;
    const keyPoints: string[] = [];

    switch (strategy) {
      case 'semantic_summarization':
        for (const msg of messages) {
          const targetLength = Math.max(100, Math.floor((maxTokens - currentTokens) * 3));
          const summarized = semanticSummarize(msg.content, targetLength);
          const tokens = estimateTokens(msg.role) + estimateTokens(summarized);
          
          if (currentTokens + tokens <= maxTokens) {
            compressed.push({ role: msg.role, content: summarized });
            currentTokens += tokens;
            keyPoints.push(...extractKeyPoints(msg.content, 2));
          }
        }
        break;

      case 'key_extraction':
        for (const msg of messages) {
          const points = extractKeyPoints(msg.content, 3);
          const extracted = points.join('. ');
          const tokens = estimateTokens(msg.role) + estimateTokens(extracted);
          
          if (currentTokens + tokens <= maxTokens) {
            compressed.push({ role: msg.role, content: extracted });
            currentTokens += tokens;
            keyPoints.push(...points);
          }
        }
        break;

      case 'temporal_decay':
        const weighted = applyTemporalDecay(messages);
        const sorted = weighted.sort((a, b) => b.weight - a.weight);
        
        for (const msg of sorted) {
          const tokens = estimateMessageTokens(msg);
          if (currentTokens + tokens <= maxTokens) {
            compressed.push({ role: msg.role, content: msg.content });
            currentTokens += tokens;
            keyPoints.push(...extractKeyPoints(msg.content, 1));
          }
        }
        break;

      case 'truncation':
        for (const msg of messages) {
          const remainingTokens = maxTokens - currentTokens;
          const maxLength = remainingTokens * 3;
          const truncated = msg.content.length > maxLength 
            ? msg.content.substring(0, maxLength) + '...' 
            : msg.content;
          const tokens = estimateTokens(msg.role) + estimateTokens(truncated);
          
          if (currentTokens + tokens <= maxTokens) {
            compressed.push({ role: msg.role, content: truncated });
            currentTokens += tokens;
          }
        }
        break;

      default:
        return {
          originalMessages: messages,
          compressedMessages: messages,
          originalTokens: messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0),
          compressedTokens: currentTokens,
          compressionRatio: 1,
          strategy: 'none',
          preservedKeyPoints: []
        };
    }

    const compressedTokens = compressed.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
    const compressionRatio = compressedTokens / messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

    return {
      originalMessages: messages,
      compressedMessages: compressed,
      originalTokens: messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0),
      compressedTokens,
      compressionRatio,
      strategy,
      preservedKeyPoints: keyPoints
    };
  }

  /**
   * Keep only recent messages to fit token budget.
   */
  private keepRecentMessages(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number
  ): CompressionResult {
    const reversed = [...messages].reverse();
    const compressed: Array<{ role: string; content: string }> = [];
    let currentTokens = 0;

    for (const msg of reversed) {
      const tokens = estimateMessageTokens(msg);
      if (currentTokens + tokens <= maxTokens) {
        compressed.unshift(msg);
        currentTokens += tokens;
      }
    }

    const compressedTokens = compressed.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
    const originalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

    return {
      originalMessages: messages,
      compressedMessages: compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      strategy: 'recent_only',
      preservedKeyPoints: []
    };
  }

  /**
   * Update compression statistics.
   */
  private updateStats(result: CompressionResult): void {
    this.stats.totalCompressions++;
    this.stats.totalOriginalTokens += result.originalTokens;
    this.stats.totalCompressedTokens += result.compressedTokens;
    this.stats.averageCompressionRatio = 
      this.stats.totalCompressedTokens / this.stats.totalOriginalTokens;
    
    const usage = this.stats.strategyUsage.get(result.strategy) || 0;
    this.stats.strategyUsage.set(result.strategy, usage + 1);
  }

  /**
   * Get compression statistics.
   */
  getCompressionStats(): CompressionStats {
    return { ...this.stats, strategyUsage: new Map(this.stats.strategyUsage) };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      averageCompressionRatio: 0,
      strategyUsage: new Map()
    };
  }

  /**
   * Get available strategies.
   */
  getStrategies(): CompressionStrategy[] {
    return [...this.strategies];
  }

  /**
   * Add custom compression strategy.
   */
  addStrategy(strategy: CompressionStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a strategy.
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name);
  }

  /**
   * Estimate token count for a message.
   */
  estimateTokens(message: { role: string; content: string }): number {
    return estimateMessageTokens(message);
  }

  /**
   * Estimate token count for an array of messages.
   */
  estimateTotalTokens(messages: Array<{ role: string; content: string }>): number {
    return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  }
}

// Global instance
export const contextCompressionEngine = new ContextCompressionEngine();
