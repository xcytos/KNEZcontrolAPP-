import { ModelInfo } from '../services/models/ModelSelectionService';

export interface ProviderMeta {
  displayName: string;
  icon: string;
  apiKeyVar: string | null;
  setupUrl: string | null;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  'groq': { displayName: 'Groq Cloud', icon: '🚀', apiKeyVar: 'GROQ_API_KEY', setupUrl: 'https://console.groq.com/keys' },
  'z.ai': { displayName: 'Z.ai Cloud', icon: '⚡', apiKeyVar: 'ZAI_API_KEY', setupUrl: 'https://z.ai/manage-apikey/apikey-list' },
  'ollama': { displayName: 'Ollama Local', icon: '🏠', apiKeyVar: null, setupUrl: null },
};

export function getProviderMeta(provider: string): ProviderMeta {
  return PROVIDER_META[provider.toLowerCase()] || {
    displayName: provider,
    icon: '🤖',
    apiKeyVar: null,
    setupUrl: null,
  };
}

export function getModelDisplayName(model: ModelInfo): string {
  const meta = getProviderMeta(model.provider);
  const modelName = model.model_id.includes('/')
    ? model.model_id.split('/').pop() || model.model_id
    : model.model_id;
  return `${meta.displayName} ${modelName}`;
}

export function getModelProviderDisplayName(provider: string): string {
  return getProviderMeta(provider).displayName;
}

export function modelRequiresApiKey(provider: string): boolean {
  return getProviderMeta(provider).apiKeyVar !== null;
}

export function getApiKeyVar(provider: string): string | null {
  return getProviderMeta(provider).apiKeyVar;
}

export function getSetupUrl(provider: string): string | null {
  return getProviderMeta(provider).setupUrl;
}

export function getNineRouterModelName(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length === 2) {
    const provider = parts[0];
    const model = parts[1];
    const providerName = getProviderDisplayName(provider);
    const modelName = model
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    return `${providerName} ${modelName}`;
  }
  return modelId;
}

function getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    'gc': 'Google',
    'groq': 'Groq',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'mistral': 'Mistral',
    'cohere': 'Cohere',
    'deepseek': 'DeepSeek',
    'kiro': 'Kiro AI',
    'gemini': 'Gemini',
    'nvidia': 'NVIDIA',
    'fireworks': 'Fireworks',
    'hyperbolic': 'Hyperbolic',
    'nebius': 'Nebius',
    'cerebras': 'Cerebras',
    'minimax': 'MiniMax',
    'blackbox': 'Blackbox',
    'chutes': 'Chutes',
    'alicode': 'Alibaba',
    'azure': 'Azure',
    'ollama': 'Ollama',
    'openrouter': 'OpenRouter',
    'mimo-free': 'MiMo',
    'opencode': 'OpenCode',
    'gemini-cli': 'Gemini CLI',
    'qoder': 'Qoder',
    'vertex': 'Vertex AI',
    'cloudflare-ai': 'Cloudflare',
    'byteplus': 'BytePlus',
  };
  return names[providerId] || providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

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

export function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs === null || latencyMs === undefined) return 'N/A';
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

export function formatTokensPerSec(tokensPerSec: number | null | undefined): string {
  if (tokensPerSec === null || tokensPerSec === undefined) return 'N/A';
  return `${Math.round(tokensPerSec)} tok/s`;
}

export function formatFailureRate(failureRate: number | null | undefined): string {
  if (failureRate === null || failureRate === undefined) return 'N/A';
  return `${(failureRate * 100).toFixed(1)}%`;
}

export function sortModelsByPriority(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    const statusPriority = { healthy: 0, degraded: 1, unhealthy: 2 };
    const aStatus = statusPriority[a.status] ?? 3;
    const bStatus = statusPriority[b.status] ?? 3;
    if (aStatus !== bStatus) {
      return aStatus - bStatus;
    }
    return a.model_id.localeCompare(b.model_id);
  });
}
