/**
 * Model Utilities
 * Helper functions for model display, status, and configuration
 */

import { ModelInfo } from '../services/models/ModelSelectionService';

export interface ModelDisplayInfo {
  displayName: string;
  provider: string;
  speed: string;
  cost: string;
  apiKeyVar: string | null;
  setupUrl: string | null;
  icon: string;
}

/**
 * Model display name and metadata mapping
 */
export const MODEL_INFO_MAP: Record<string, ModelDisplayInfo> = {
  'llama-3.3-70b-versatile': {
    displayName: 'Groq Llama 3.3 70B',
    provider: 'Groq Cloud',
    speed: '800+ tok/s',
    cost: 'Free tier',
    apiKeyVar: 'GROQ_API_KEY',
    setupUrl: 'https://console.groq.com/keys',
    icon: '🚀'
  },
  'glm-4.7-flash': {
    displayName: 'Z.ai GLM-4.7 Flash',
    provider: 'Z.ai Cloud',
    speed: '~100 tok/s',
    cost: 'Free',
    apiKeyVar: 'ZAI_API_KEY',
    setupUrl: 'https://z.ai/manage-apikey/apikey-list',
    icon: '⚡'
  },
  'qwen2.5:7b-instruct-q4_K_M': {
    displayName: 'Local Qwen 2.5',
    provider: 'Ollama Local',
    speed: '30 tok/s',
    cost: 'Free',
    apiKeyVar: null,
    setupUrl: null,
    icon: '🏠'
  }
};

/**
 * Test/development model IDs to filter out from UI
 */
const TEST_MODEL_IDS = ['cloud-b', 'cloud-c', 'test-model'];

/**
 * Check if model ID should be shown in UI
 */
export function shouldShowModel(modelId: string): boolean {
  // Filter out test models
  if (TEST_MODEL_IDS.includes(modelId)) {
    return false;
  }
  
  // Only show models that have display info defined
  return modelId in MODEL_INFO_MAP;
}

/**
 * Get display name for a model
 */
export function getModelDisplayName(modelId: string): string {
  return MODEL_INFO_MAP[modelId]?.displayName || modelId;
}

/**
 * Get provider name for a model
 */
export function getModelProvider(modelId: string): string {
  return MODEL_INFO_MAP[modelId]?.provider || 'Unknown';
}

/**
 * Get model icon
 */
export function getModelIcon(modelId: string): string {
  return MODEL_INFO_MAP[modelId]?.icon || '🤖';
}

/**
 * Check if model requires API key
 */
export function modelRequiresApiKey(modelId: string): boolean {
  return MODEL_INFO_MAP[modelId]?.apiKeyVar !== null;
}

/**
 * Get API key variable name for a model
 */
export function getApiKeyVar(modelId: string): string | null {
  return MODEL_INFO_MAP[modelId]?.apiKeyVar || null;
}

/**
 * Get setup URL for API key
 */
export function getSetupUrl(modelId: string): string | null {
  return MODEL_INFO_MAP[modelId]?.setupUrl || null;
}

/**
 * Get status badge color class
 */
export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-900/30 text-green-400 border-green-800';
    case 'degraded':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
    case 'unhealthy':
      return 'bg-red-900/30 text-red-400 border-red-800';
    default:
      return 'bg-zinc-800/30 text-zinc-400 border-zinc-700';
  }
}

/**
 * Get status dot color class
 */
export function getStatusDotColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'unhealthy':
      return 'bg-red-500';
    default:
      return 'bg-zinc-500';
  }
}

/**
 * Format latency for display
 */
export function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs === null || latencyMs === undefined) return 'N/A';
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * Format tokens per second for display
 */
export function formatTokensPerSec(tokensPerSec: number | null | undefined): string {
  if (tokensPerSec === null || tokensPerSec === undefined) return 'N/A';
  return `${Math.round(tokensPerSec)} tok/s`;
}

/**
 * Format failure rate as percentage
 */
export function formatFailureRate(failureRate: number | null | undefined): string {
  if (failureRate === null || failureRate === undefined) return 'N/A';
  return `${(failureRate * 100).toFixed(1)}%`;
}

/**
 * Check if model is cloud-based
 */
export function isCloudModel(modelId: string): boolean {
  return modelId.includes('llama') || modelId.includes('glm') || modelId.includes('gpt');
}

/**
 * Check if model is local
 */
export function isLocalModel(modelId: string): boolean {
  return !isCloudModel(modelId);
}

/**
 * Sort models by priority (healthy first, then by provider)
 */
export function sortModelsByPriority(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    // Priority: healthy > degraded > unhealthy
    const statusPriority = { healthy: 0, degraded: 1, unhealthy: 2 };
    const aStatus = statusPriority[a.status] ?? 3;
    const bStatus = statusPriority[b.status] ?? 3;
    
    if (aStatus !== bStatus) {
      return aStatus - bStatus;
    }
    
    // Cloud models before local
    const aIsCloud = isCloudModel(a.model_id);
    const bIsCloud = isCloudModel(b.model_id);
    
    if (aIsCloud !== bIsCloud) {
      return aIsCloud ? -1 : 1;
    }
    
    // Alphabetical by display name
    return getModelDisplayName(a.model_id).localeCompare(getModelDisplayName(b.model_id));
  });
}

/**
 * Get model info with display metadata
 */
export function enrichModelInfo(model: ModelInfo): ModelInfo & ModelDisplayInfo {
  const displayInfo = MODEL_INFO_MAP[model.model_id] || {
    displayName: model.model_id,
    provider: model.provider || 'Unknown',
    speed: 'N/A',
    cost: 'Unknown',
    apiKeyVar: null,
    setupUrl: null,
    icon: '🤖'
  };

  return {
    ...model,
    ...displayInfo
  };
}
