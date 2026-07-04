/**
 * 9Router Service
 * Integration with 9Router proxy for access to 40+ AI providers
 * Endpoint: http://localhost:20128/v1
 */

export interface RouterModel {
  id: string;
  object: string;
  owned_by: string;
  provider?: string;
  category?: 'free' | 'oauth' | 'api-key';
}

export interface RouterProvider {
  id: string;
  name: string;
  category: 'oauth' | 'free' | 'api-key' | 'custom';
  status: 'connected' | 'ready' | 'no-connections' | 'error';
  connectionCount?: number;
  icon?: string;
}

export interface RouterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime?: number;
  totalProviders: number;
  activeConnections: number;
}

export interface RouterUsage {
  totalRequests: number;
  totalTokens: number;
  tokensSaved: number;
  savingsPercent: number;
}

// Provider categories based on 9Router dashboard
export const PROVIDER_CATEGORIES = {
  oauth: [
    { id: 'claude', name: 'Claude Code', icon: '🤖' },
    { id: 'antigravity', name: 'Antigravity', icon: '🚀' },
    { id: 'codex', name: 'OpenAI Codex', icon: '💻' },
    { id: 'github', name: 'GitHub Copilot', icon: '🐙' },
    { id: 'cursor', name: 'Cursor IDE', icon: '✨' },
    { id: 'kilocode', name: 'Kilo Code', icon: '⚡' },
    { id: 'cline', name: 'Cline', icon: '🔧' },
    { id: 'codebuddy-cn', name: 'CodeBuddy CN', icon: '🇨🇳' },
    { id: 'kimchi', name: 'Kimchi', icon: '🥬' },
    { id: 'xai', name: 'xAI (Grok)', icon: '🎯' },
  ],
  free: [
    { id: 'mimo-free', name: 'MiMo Code Free', icon: '🎁' },
    { id: 'opencode', name: 'OpenCode Free', icon: '🔓' },
    { id: 'gemini-cli', name: 'Gemini CLI', icon: '💎' },
    { id: 'kiro', name: 'Kiro AI', icon: '🤖' },
    { id: 'qoder', name: 'Qoder', icon: '📝' },
    { id: 'openrouter', name: 'OpenRouter', icon: '🔀' },
    { id: 'nvidia', name: 'NVIDIA NIM', icon: '🟢' },
    { id: 'ollama', name: 'Ollama Cloud', icon: '🦙' },
    { id: 'vertex', name: 'Vertex AI', icon: '☁️' },
    { id: 'gemini', name: 'Gemini', icon: '✨' },
    { id: 'cloudflare-ai', name: 'Cloudflare', icon: '🔶' },
    { id: 'byteplus', name: 'BytePlus ModelArk', icon: '📦' },
  ],
  apiKey: [
    { id: 'alicode', name: 'Alibaba', icon: '🛒' },
    { id: 'alicode-intl', name: 'Alibaba Intl', icon: '🌍' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
    { id: 'azure', name: 'Azure OpenAI', icon: '☁️' },
    { id: 'blackbox', name: 'Blackbox AI', icon: '⬛' },
    { id: 'cerebras', name: 'Cerebras', icon: '⚡' },
    { id: 'chutes', name: 'Chutes AI', icon: '🎯' },
    { id: 'cohere', name: 'Cohere', icon: '🗣️' },
    { id: 'commandcode', name: 'Command Code', icon: '💻' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
    { id: 'fireworks', name: 'Fireworks AI', icon: '🎆' },
    { id: 'glm-cn', name: 'GLM (China)', icon: '🇨🇳' },
    { id: 'glm', name: 'GLM Coding', icon: '💻' },
    { id: 'groq', name: 'Groq', icon: '🚀' },
    { id: 'hyperbolic', name: 'Hyperbolic', icon: '🌀' },
    { id: 'kimi', name: 'Kimi', icon: '🌙' },
    { id: 'minimax-cn', name: 'Minimax (China)', icon: '🇨🇳' },
    { id: 'minimax', name: 'Minimax Coding', icon: '📊' },
    { id: 'mistral', name: 'Mistral', icon: '🌬️' },
    { id: 'nebius', name: 'Nebius AI', icon: '☁️' },
  ],
};

class NineRouterService {
  private baseUrl: string;
  private dashboardUrl: string;
  private cache: {
    models: RouterModel[] | null;
    providers: RouterProvider[] | null;
    lastFetch: number;
  };

  constructor() {
    this.baseUrl = 'http://localhost:20128/v1';
    this.dashboardUrl = 'http://localhost:20128';
    this.cache = {
      models: null,
      providers: null,
      lastFetch: 0,
    };
  }

  /**
   * Check if 9Router is available
   */
  async checkHealth(): Promise<RouterHealth | null> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          version: 'unknown',
          totalProviders: 0,
          activeConnections: 0,
        };
      }

      const data = await response.json();
      const models = data.data || [];
      
      // Group by provider (owned_by)
      const providers = new Set(models.map((m: RouterModel) => m.owned_by));
      
      return {
        status: 'healthy',
        version: '0.5.15',
        totalProviders: providers.size,
        activeConnections: models.length,
      };
    } catch (error) {
      console.error('[NineRouter] Health check failed:', error);
      return null;
    }
  }

  /**
   * Get available models from 9Router
   */
  async getModels(): Promise<RouterModel[]> {
    // Cache for 30 seconds
    if (this.cache.models && Date.now() - this.cache.lastFetch < 30000) {
      return this.cache.models;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models: RouterModel[] = (data.data || []).map((m: any) => ({
        id: m.id,
        object: m.object,
        owned_by: m.owned_by,
        provider: this.extractProvider(m.id),
        category: this.categorizeModel(m.id, m.owned_by),
      }));

      this.cache.models = models;
      this.cache.lastFetch = Date.now();

      return models;
    } catch (error) {
      console.error('[NineRouter] Failed to get models:', error);
      return [];
    }
  }

  /**
   * Get providers grouped by category
   */
  async getProviders(): Promise<RouterProvider[]> {
    const providers: RouterProvider[] = [];

    // Add OAuth providers
    for (const p of PROVIDER_CATEGORIES.oauth) {
      providers.push({
        id: p.id,
        name: p.name,
        category: 'oauth',
        status: 'no-connections',
        icon: p.icon,
      });
    }

    // Add Free providers
    for (const p of PROVIDER_CATEGORIES.free) {
      providers.push({
        id: p.id,
        name: p.name,
        category: 'free',
        status: 'ready',
        icon: p.icon,
      });
    }

    // Add API Key providers
    for (const p of PROVIDER_CATEGORIES.apiKey) {
      providers.push({
        id: p.id,
        name: p.name,
        category: 'api-key',
        status: 'no-connections',
        icon: p.icon,
      });
    }

    return providers;
  }

  /**
   * Get models grouped by provider
   */
  async getModelsByProvider(): Promise<Map<string, RouterModel[]>> {
    const models = await this.getModels();
    const grouped = new Map<string, RouterModel[]>();

    for (const model of models) {
      const provider = model.provider || model.owned_by;
      if (!grouped.has(provider)) {
        grouped.set(provider, []);
      }
      grouped.get(provider)!.push(model);
    }

    return grouped;
  }

  /**
   * Test connection to a specific provider
   */
  async testProviderConnection(providerId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Try a minimal request to test the provider
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `${providerId}/test`,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      }

      // Even if it fails, it might be because the model doesn't exist
      // but the provider is reachable
      if (response.status === 400 || response.status === 404) {
        return { success: true, message: 'Provider reachable (model not found)' };
      }

      return { success: false, message: `Error: ${response.status}` };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Stream chat completions via 9Router (OpenAI-compatible)
   */
  async *chatCompletionsStream(
    messages: Array<{ role: string; content: string }>,
    _sessionId: string,
    options?: { signal?: AbortSignal; onMeta?: (meta: { model?: string; totalTokens?: number }) => void; model?: string }
  ): AsyncGenerator<string, void, void> {
    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      messages,
      stream: true,
      model: options?.model,
    };

    const externalSignal = options?.signal;
    if (externalSignal?.aborted) {
      throw new DOMException("Request cancelled", "AbortError");
    }

    const controller = new AbortController();
    if (externalSignal) {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const connectTimeoutId = window.setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(connectTimeoutId);

    if (!resp.ok) {
      throw new Error(`9Router completions failed: ${resp.status}`);
    }
    if (!resp.body) throw new Error("No response body");

    const hdrModel =
      resp.headers.get("x-model-id") ??
      resp.headers.get("openai-model") ??
      resp.headers.get("x-openai-model");
    if (hdrModel && options?.onMeta) {
      try { options.onMeta({ model: hdrModel }); } catch {}
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let inactivityTimeoutId = window.setTimeout(() => controller.abort(), 25000);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      window.clearTimeout(inactivityTimeoutId);
      inactivityTimeoutId = window.setTimeout(() => controller.abort(), 25000);
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd === -1) break;
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!line || line.startsWith(":")) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content;
            if (content) {
              yield content;
            }
            const usage = parsed.usage;
            if (usage && options?.onMeta) {
              try { options.onMeta({ totalTokens: usage.total_tokens }); } catch {}
            }
          } catch {
            // skip parse errors
          }
        }
      }
    }

    window.clearTimeout(inactivityTimeoutId);
  }

  /**
   * Get usage statistics
   */
  async getUsage(): Promise<RouterUsage> {
    // This would require authenticated API access to 9Router
    // For now, return placeholder data
    return {
      totalRequests: 0,
      totalTokens: 0,
      tokensSaved: 0,
      savingsPercent: 0,
    };
  }

  /**
   * Open 9Router dashboard in browser
   */
  openDashboard(): void {
    window.open(this.dashboardUrl, '_blank');
  }

  /**
   * Get provider icon
   */
  getProviderIcon(providerId: string): string {
    const allProviders = [
      ...PROVIDER_CATEGORIES.oauth,
      ...PROVIDER_CATEGORIES.free,
      ...PROVIDER_CATEGORIES.apiKey,
    ];
    const provider = allProviders.find(p => p.id === providerId);
    return provider?.icon || '🤖';
  }

  /**
   * Extract provider from model ID
   */
  private extractProvider(modelId: string): string {
    // Model IDs are like "gc/gemini-2.5-pro" or "groq/llama-3.3-70b"
    const parts = modelId.split('/');
    if (parts.length > 1) {
      return parts[0];
    }
    return 'unknown';
  }

  /**
   * Categorize model based on ID and owner
   */
  private categorizeModel(modelId: string, ownedBy: string): 'free' | 'oauth' | 'api-key' {
    const provider = this.extractProvider(modelId);
    
    // Check if it's a free provider
    if (PROVIDER_CATEGORIES.free.some(p => p.id === provider || p.id === ownedBy)) {
      return 'free';
    }
    
    // Check if it's an OAuth provider
    if (PROVIDER_CATEGORIES.oauth.some(p => p.id === provider || p.id === ownedBy)) {
      return 'oauth';
    }
    
    // Default to API key
    return 'api-key';
  }

  /**
   * Check if a provider is configured (has API key or OAuth)
   */
  async isProviderConfigured(providerId: string): Promise<boolean> {
    // Check if provider is in free tier (always configured)
    if (PROVIDER_CATEGORIES.free.some(p => p.id === providerId)) {
      return true;
    }
    
    // For OAuth and API key providers, we'd need to check 9Router's state
    // This would require authenticated API access
    return false;
  }
}

export const nineRouterService = new NineRouterService();
