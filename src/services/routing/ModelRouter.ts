/**
 * ModelRouter - Pre-execution provider selection
 * Enforces: 1 execution = 1 provider (locked at start)
 * No mid-stream model switching
 */

import { logger } from '../utils/LogService';

export type ProviderType = 'ollama' | 'openai' | 'claude' | 'fallback';

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  maxContextLength: number;
  typicalLatencyMs: number;
  codingOptimized: boolean;
  reasoningOptimized: boolean;
}

export interface ProviderConfig {
  id: ProviderType;
  name: string;
  enabled: boolean;
  endpoint: string;
  defaultModel: string;
  capabilities: ModelCapabilities;
  priority: number; // Lower = higher priority
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: number;
}

export interface RoutingContext {
  sessionId: string;
  userPreference?: 'local' | 'cloud' | 'auto';
  taskType?: 'coding' | 'reasoning' | 'general' | 'creative';
  requiresOffline?: boolean;
  requestedModel?: string;
  messageCount: number;
  estimatedTokens: number;
}

export interface RoutingDecision {
  provider: ProviderType;
  model: string;
  executionId: string;
  reason: string;
  confidence: number; // 0-1
  estimatedLatencyMs: number;
  fallbackChain: ProviderType[];
  timestamp: number;
}

export class ModelRouter {
  private providers: Map<ProviderType, ProviderConfig> = new Map();
  private routingHistory: RoutingDecision[] = [];
  private activeExecutions: Set<string> = new Set();

  constructor() {
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders(): void {
    // Ollama (Local)
    this.providers.set('ollama', {
      id: 'ollama',
      name: 'Ollama Local',
      enabled: true,
      endpoint: 'http://localhost:11434',
      defaultModel: 'qwen2.5:7b-instruct-q4_K_M',
      capabilities: {
        supportsStreaming: true,
        supportsTools: true,
        maxContextLength: 32768,
        typicalLatencyMs: 500,
        codingOptimized: true,
        reasoningOptimized: false,
      },
      priority: 1,
      healthStatus: 'healthy',
      lastHealthCheck: Date.now(),
    });

    // OpenAI (Cloud)
    this.providers.set('openai', {
      id: 'openai',
      name: 'OpenAI',
      enabled: false, // Disabled by default for true local
      endpoint: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4',
      capabilities: {
        supportsStreaming: true,
        supportsTools: true,
        maxContextLength: 128000,
        typicalLatencyMs: 2000,
        codingOptimized: true,
        reasoningOptimized: true,
      },
      priority: 3,
      healthStatus: 'healthy',
      lastHealthCheck: Date.now(),
    });

    // Claude (Cloud)
    this.providers.set('claude', {
      id: 'claude',
      name: 'Anthropic Claude',
      enabled: false, // Disabled by default for true local
      endpoint: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-sonnet',
      capabilities: {
        supportsStreaming: true,
        supportsTools: true,
        maxContextLength: 200000,
        typicalLatencyMs: 2500,
        codingOptimized: true,
        reasoningOptimized: true,
      },
      priority: 4,
      healthStatus: 'healthy',
      lastHealthCheck: Date.now(),
    });

    // Fallback (Error recovery)
    this.providers.set('fallback', {
      id: 'fallback',
      name: 'Fallback Provider',
      enabled: true,
      endpoint: '',
      defaultModel: 'error-recovery',
      capabilities: {
        supportsStreaming: false,
        supportsTools: false,
        maxContextLength: 0,
        typicalLatencyMs: 0,
        codingOptimized: false,
        reasoningOptimized: false,
      },
      priority: 99,
      healthStatus: 'healthy',
      lastHealthCheck: Date.now(),
    });
  }

  /**
   * Route request to appropriate provider
   * Enforces: 1 execution = 1 provider (locked at start)
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const executionId = this.generateExecutionId();
    
    logger.info('model_router', 'routing_started', {
      sessionId: context.sessionId,
      executionId,
      userPreference: context.userPreference,
      taskType: context.taskType,
    });

    // Decision logic
    const provider = this.selectProvider(context);
    const model = this.selectModel(provider, context.requestedModel);
    const reason = this.buildReason(provider, context);
    const confidence = this.calculateConfidence(provider, context);
    const estimatedLatency = this.estimateLatency(provider, context);

    // Build fallback chain (excluding selected provider)
    const fallbackChain = this.buildFallbackChain(provider, context);

    const decision: RoutingDecision = {
      provider: provider.id,
      model,
      executionId,
      reason,
      confidence,
      estimatedLatencyMs: estimatedLatency,
      fallbackChain,
      timestamp: Date.now(),
    };

    // Lock execution to provider
    this.activeExecutions.add(executionId);
    this.routingHistory.push(decision);

    logger.info('model_router', 'routing_decision', {
      sessionId: context.sessionId,
      executionId,
      provider: decision.provider,
      model: decision.model,
      reason: decision.reason,
      confidence: decision.confidence,
    });

    return decision;
  }

  /**
   * Release execution lock
   */
  releaseExecution(executionId: string): void {
    this.activeExecutions.delete(executionId);
    logger.info('model_router', 'execution_released', { executionId });
  }

  /**
   * Check if provider is healthy
   */
  async checkHealth(providerId: ProviderType): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    // Simple health check - in production would actually ping endpoint
    const isHealthy = provider.healthStatus === 'healthy' && provider.enabled;
    
    provider.lastHealthCheck = Date.now();
    
    return isHealthy;
  }

  /**
   * Update provider health status
   */
  updateProviderHealth(providerId: ProviderType, status: 'healthy' | 'degraded' | 'unhealthy'): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.healthStatus = status;
      provider.lastHealthCheck = Date.now();
      
      logger.info('model_router', 'health_status_updated', {
        provider: providerId,
        status,
      });
    }
  }

  /**
   * Enable/disable provider
   */
  setProviderEnabled(providerId: ProviderType, enabled: boolean): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.enabled = enabled;
      
      logger.info('model_router', 'provider_enabled_changed', {
        provider: providerId,
        enabled,
      });
    }
  }

  /**
   * Get routing history for analysis
   */
  getRoutingHistory(sessionId?: string): RoutingDecision[] {
    if (sessionId) {
      return this.routingHistory.filter(d => d.executionId.includes(sessionId));
    }
    return [...this.routingHistory];
  }

  private selectProvider(context: RoutingContext): ProviderConfig {
    // Priority 1: User preference for local
    if (context.userPreference === 'local' || context.requiresOffline) {
      const ollama = this.providers.get('ollama');
      if (ollama && ollama.enabled && ollama.healthStatus === 'healthy') {
        return ollama;
      }
    }

    // Priority 2: Task-based selection
    if (context.taskType === 'reasoning') {
      // For reasoning, prefer cloud models if available
      for (const providerId of ['claude', 'openai'] as ProviderType[]) {
        const provider = this.providers.get(providerId);
        if (provider && provider.enabled && provider.healthStatus === 'healthy') {
          return provider;
        }
      }
    }

    // Priority 3: Default to local (true local policy)
    const ollama = this.providers.get('ollama');
    if (ollama && ollama.enabled && ollama.healthStatus === 'healthy') {
      return ollama;
    }

    // Priority 4: Fallback to any available cloud provider
    for (const providerId of ['openai', 'claude'] as ProviderType[]) {
      const provider = this.providers.get(providerId);
      if (provider && provider.enabled && provider.healthStatus === 'healthy') {
        return provider;
      }
    }

    // Priority 5: Fallback provider (error state)
    return this.providers.get('fallback')!;
  }

  private selectModel(provider: ProviderConfig, requestedModel?: string): string {
    // If specific model requested and provider supports it
    if (requestedModel) {
      // In production, would check if provider supports this model
      return requestedModel;
    }
    
    return provider.defaultModel;
  }

  private buildReason(provider: ProviderConfig, context: RoutingContext): string {
    if (context.userPreference === 'local') {
      return `User preference: local. Selected ${provider.name} for true local execution.`;
    }
    
    if (context.taskType === 'reasoning' && provider.id !== 'ollama') {
      return `Task type: reasoning. Selected ${provider.name} for optimized reasoning capabilities.`;
    }
    
    if (provider.id === 'ollama') {
      return `Default policy: true local. Selected ${provider.name} for privacy and low latency.`;
    }
    
    return `Fallback selection. Selected ${provider.name} as local provider unavailable.`;
  }

  private calculateConfidence(provider: ProviderConfig, context: RoutingContext): number {
    let confidence = 0.5;

    // Health bonus
    if (provider.healthStatus === 'healthy') confidence += 0.3;
    if (provider.healthStatus === 'degraded') confidence += 0.1;

    // Preference match bonus
    if (context.userPreference === 'local' && provider.id === 'ollama') confidence += 0.2;
    
    // Task match bonus
    if (context.taskType === 'coding' && provider.capabilities.codingOptimized) confidence += 0.1;
    if (context.taskType === 'reasoning' && provider.capabilities.reasoningOptimized) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private estimateLatency(provider: ProviderConfig, context: RoutingContext): number {
    let latency = provider.capabilities.typicalLatencyMs;

    // Adjust for message count
    if (context.messageCount > 10) {
      latency += context.messageCount * 10; // +10ms per message
    }

    // Adjust for estimated tokens
    if (context.estimatedTokens > 4000) {
      latency += 500; // +500ms for long context
    }

    return latency;
  }

  private buildFallbackChain(primary: ProviderConfig, _context: RoutingContext): ProviderType[] {
    const fallbacks: ProviderType[] = [];
    
    // Add all healthy providers except primary
    for (const [id, provider] of this.providers) {
      if (id !== primary.id && 
          provider.enabled && 
          provider.healthStatus === 'healthy' &&
          id !== 'fallback') {
        fallbacks.push(id);
      }
    }

    // Sort by priority
    fallbacks.sort((a, b) => {
      const providerA = this.providers.get(a)!;
      const providerB = this.providers.get(b)!;
      return providerA.priority - providerB.priority;
    });

    return fallbacks;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const modelRouter = new ModelRouter();
