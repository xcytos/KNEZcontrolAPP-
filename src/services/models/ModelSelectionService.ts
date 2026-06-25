/**
 * Model Selection Service
 * Handles model selection, configuration, and health monitoring
 */

export interface ModelInfo {
  model_id: string;
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  display_name?: string;
  description?: string;
  latency_ms?: number | null;
  failure_rate?: number | null;
  tokens_per_sec?: number | null;
}

export interface ModelSelectionResponse {
  success: boolean;
  preferred_model_id?: string;
  mode?: 'manual' | 'automatic';
  message?: string;
  detail?: string;
}

export interface AvailableModelsResponse {
  success: boolean;
  models: ModelInfo[];
  preferred_model_id: string | null;
  selection_mode: 'manual' | 'automatic';
  count: number;
}

export interface EnvConfigResponse {
  success: boolean;
  message?: string;
  detail?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  response?: string;
}

const KNEZ_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Model Selection Service
 * Provides API methods for model selection and configuration
 */
export class ModelSelectionService {
  /**
   * Fetch available models with health status
   */
  static async getAvailableModels(): Promise<AvailableModelsResponse> {
    const response = await fetch(`${KNEZ_BASE_URL}/api/models/available`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Select a model manually
   */
  static async selectModel(modelId: string, force: boolean = false): Promise<ModelSelectionResponse> {
    const response = await fetch(`${KNEZ_BASE_URL}/api/models/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, force })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to select model');
    }

    return await response.json();
  }

  /**
   * Get current model selection
   */
  static async getCurrentSelection(): Promise<ModelSelectionResponse> {
    const response = await fetch(`${KNEZ_BASE_URL}/api/models/select`);
    if (!response.ok) {
      throw new Error(`Failed to get current selection: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Clear model selection (back to automatic)
   */
  static async clearSelection(): Promise<ModelSelectionResponse> {
    const response = await fetch(`${KNEZ_BASE_URL}/api/models/select`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to clear selection');
    }

    return await response.json();
  }

  /**
   * Save API key for a model
   */
  static async saveApiKey(key: string, value: string): Promise<EnvConfigResponse> {
    const response = await fetch(`${KNEZ_BASE_URL}/api/config/env`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to save API key');
    }

    return await response.json();
  }

  /**
   * Test connection to backend
   */
  static async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await fetch(`${KNEZ_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say hello' }],
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connection successful!',
          response: data.choices?.[0]?.message?.content
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          message: error.detail || 'Connection failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Cannot reach backend'
      };
    }
  }

  /**
   * Get health status from backend
   */
  static async getHealth(): Promise<any> {
    const response = await fetch(`${KNEZ_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch health: ${response.statusText}`);
    }
    return await response.json();
  }
}

/**
 * Singleton instance for convenience
 */
export const modelSelectionService = new ModelSelectionService();
