/**
 * Provider Registry - Core Component of KNEZ Architecture
 * Manages provider workers, health monitoring, and capabilities
 * Implements Layer 1 (KNEZ Core) functionality
 */

import { ProviderAdapter } from '../providers/ProviderAdapter';
import { ollamaAdapter } from '../providers/OllamaAdapter';
import { logger } from '../utils/LogService';

export interface ProviderCapabilities {
  reasoning: boolean;
  coding: boolean;
  speed: 'fast' | 'medium' | 'slow';
  contextWindow: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  costPerToken: number;
  availability: number; // 0-1 score
}

export interface ProviderRequirements {
  reasoning?: boolean;
  coding?: boolean;
  speed?: 'fast' | 'medium' | 'slow';
  minContextWindow?: number;
  requiresStreaming?: boolean;
  requiresTools?: boolean;
  maxCostPerToken?: number;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: number;
  responseTimeMs: number;
  errorRate: number;
  rateLimitRemaining?: number;
  queueDepth?: number;
}

export interface ProviderWorker {
  id: string;
  adapter: ProviderAdapter;
  capabilities: ProviderCapabilities;
  health: ProviderHealth;
  priority: number; // Lower number = higher priority
}

export interface HealthCache {
  health: ProviderHealth;
  timestamp: number;
  ttl: number;
}

/**
 * Provider Registry - Central management of all AI providers
 * Implements provider worker model with dynamic routing capabilities
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderWorker> = new Map();
  private healthCache: Map<string, HealthCache> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CACHE_TTL = 10000; // 10 seconds

  constructor() {
    this.initializeProviders();
    this.startHealthMonitoring();
  }

  /**
   * Initialize all available providers
   */
  private async initializeProviders() {
    // Register Ollama (local provider)
    await this.registerProvider('ollama', ollamaAdapter, {
      reasoning: true,
      coding: true,
      speed: 'medium',
      contextWindow: 32768,
      supportsStreaming: true,
      supportsTools: false,
      costPerToken: 0,
      availability: 0.9,
    }, 1);

    // TODO: Add cloud providers (OpenAI, Claude, Gemini, etc.)
    // await this.registerProvider('openai', openaiAdapter, capabilities, 2);
    // await this.registerProvider('claude', claudeAdapter, capabilities, 3);
  }

  /**
   * Register a new provider worker
   */
  async registerProvider(
    id: string, 
    adapter: ProviderAdapter, 
    capabilities: ProviderCapabilities,
    priority: number
  ): Promise<void> {
    const health: ProviderHealth = {
      providerId: id,
      status: 'offline',
      lastCheck: 0,
      responseTimeMs: 0,
      errorRate: 0,
    };

    const worker: ProviderWorker = {
      id,
      adapter,
      capabilities,
      health,
      priority,
    };

    this.providers.set(id, worker);
    
    logger.info('provider_registry', 'provider_registered', {
      providerId: id,
      capabilities,
      priority,
    });

    // Initial health check
    await this.checkProviderHealth(id);
  }

  /**
   * Get optimal provider for given requirements
   */
  async getOptimalProvider(requirements: ProviderRequirements): Promise<ProviderWorker | null> {
    const candidates = await this.getCandidateProviders(requirements);
    
    if (candidates.length === 0) {
      logger.warn('provider_registry', 'no_candidates', { requirements });
      return null;
    }

    // Sort by priority and health score
    candidates.sort((a, b) => {
      const aScore = this.calculateProviderScore(a, requirements);
      const bScore = this.calculateProviderScore(b, requirements);
      
      // Primary sort by score (higher is better)
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      
      // Secondary sort by priority (lower is better)
      return a.priority - b.priority;
    });

    const optimal = candidates[0];
    
    logger.info('provider_registry', 'provider_selected', {
      providerId: optimal.id,
      score: this.calculateProviderScore(optimal, requirements),
      requirements,
    });

    return optimal;
  }

  /**
   * Get all providers that meet requirements
   */
  private async getCandidateProviders(requirements: ProviderRequirements): Promise<ProviderWorker[]> {
    const candidates: ProviderWorker[] = [];

    for (const worker of this.providers.values()) {
      const health = await this.getCachedHealth(worker.id);
      
      // Skip unhealthy providers
      if (health.status === 'offline' || health.status === 'unhealthy') {
        continue;
      }

      // Check capability requirements
      if (requirements.reasoning && !worker.capabilities.reasoning) continue;
      if (requirements.coding && !worker.capabilities.coding) continue;
      if (requirements.speed && worker.capabilities.speed !== requirements.speed) continue;
      if (requirements.minContextWindow && worker.capabilities.contextWindow < requirements.minContextWindow) continue;
      if (requirements.requiresStreaming && !worker.capabilities.supportsStreaming) continue;
      if (requirements.requiresTools && !worker.capabilities.supportsTools) continue;
      if (requirements.maxCostPerToken && worker.capabilities.costPerToken > requirements.maxCostPerToken) continue;

      candidates.push(worker);
    }

    return candidates;
  }

  /**
   * Calculate provider score for requirements
   */
  private calculateProviderScore(provider: ProviderWorker, requirements: ProviderRequirements): number {
    let score = provider.capabilities.availability * 100;

    // Health factor
    const healthFactor = provider.health.status === 'healthy' ? 1.0 : 
                       provider.health.status === 'degraded' ? 0.5 : 0.0;
    score *= healthFactor;

    // Speed preference
    if (requirements.speed) {
      const speedScore = provider.capabilities.speed === requirements.speed ? 1.0 : 0.5;
      score *= speedScore;
    }

    // Response time factor (inverse - lower is better)
    if (provider.health.responseTimeMs > 0) {
      const responseTimeScore = Math.max(0, 1 - (provider.health.responseTimeMs / 5000)); // 5s = 0 score
      score *= responseTimeScore;
    }

    // Error rate factor (inverse - lower is better)
    const errorRateScore = Math.max(0, 1 - provider.health.errorRate);
    score *= errorRateScore;

    return score;
  }

  /**
   * Get cached health information
   */
  private async getCachedHealth(providerId: string): Promise<ProviderHealth> {
    const cached = this.healthCache.get(providerId);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.health;
    }

    // Cache miss or expired, fetch fresh health
    await this.checkProviderHealth(providerId);
    return this.healthCache.get(providerId)?.health || this.providers.get(providerId)?.health || {
      providerId,
      status: 'offline',
      lastCheck: 0,
      responseTimeMs: 0,
      errorRate: 0,
    };
  }

  /**
   * Check health of a specific provider
   */
  private async checkProviderHealth(providerId: string): Promise<void> {
    const worker = this.providers.get(providerId);
    if (!worker) return;

    const startTime = Date.now();
    let status: ProviderHealth['status'] = 'healthy';
    let responseTimeMs = 0;

    try {
      const isHealthy = await worker.adapter.healthCheck();
      responseTimeMs = Date.now() - startTime;
      
      if (!isHealthy) {
        status = 'unhealthy';
      }
    } catch (error) {
      status = 'offline';
      responseTimeMs = Date.now() - startTime;
      
      logger.warn('provider_registry', 'health_check_failed', {
        providerId,
        error: String(error),
      });
    }

    const health: ProviderHealth = {
      providerId,
      status,
      lastCheck: Date.now(),
      responseTimeMs,
      errorRate: worker.health.errorRate, // TODO: Calculate actual error rate
    };

    // Update worker health
    worker.health = health;

    // Cache health result
    this.healthCache.set(providerId, {
      health,
      timestamp: Date.now(),
      ttl: this.HEALTH_CACHE_TTL,
    });

    logger.debug('provider_registry', 'health_checked', {
      providerId,
      status,
      responseTimeMs,
    });
  }

  /**
   * Start health monitoring for all providers
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const providerId of this.providers.keys()) {
        await this.checkProviderHealth(providerId);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get all providers and their health
   */
  getAllProviders(): Map<string, ProviderWorker> {
    return new Map(this.providers);
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): ProviderWorker | undefined {
    return this.providers.get(id);
  }

  /**
   * Handle provider failure and trigger failover if needed
   */
  async handleProviderFailure(providerId: string, error: Error): Promise<ProviderWorker | null> {
    const worker = this.providers.get(providerId);
    if (!worker) return null;

    // Update error rate
    worker.health.errorRate = Math.min(1.0, worker.health.errorRate + 0.1);
    
    // Mark as unhealthy if error rate is too high
    if (worker.health.errorRate > 0.3) {
      worker.health.status = 'unhealthy';
    }

    logger.warn('provider_registry', 'provider_failure', {
      providerId,
      error: error.message,
      errorRate: worker.health.errorRate,
      status: worker.health.status,
    });

    // Try to find alternative provider
    const requirements: ProviderRequirements = {
      reasoning: worker.capabilities.reasoning,
      coding: worker.capabilities.coding,
      speed: worker.capabilities.speed,
      requiresStreaming: true,
    };

    return await this.getOptimalProvider(requirements);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.providers.clear();
    this.healthCache.clear();
    
    logger.info('provider_registry', 'registry_destroyed');
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
