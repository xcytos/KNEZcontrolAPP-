/**
 * Models Configuration Page
 * Comprehensive view of all AI models with provider organization, health status, and testing
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  TestTube,
  Zap,
  Server,
  Cloud,
  HardDrive,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { ModelSelectionService, ModelInfo } from '../../services/models/ModelSelectionService';
import {
  getModelDisplayName,
  getStatusBadgeColor,
  getStatusDotColor,
  modelRequiresApiKey,
  formatLatency,
  formatTokensPerSec,
  shouldShowModel
} from '../../utils/modelUtils';
import { useToast } from '../../components/ui/Toast';

interface ModelsPageProps {}

interface ProviderGroup {
  name: string;
  icon: React.ReactNode;
  models: ModelInfo[];
  status: 'healthy' | 'degraded' | 'unhealthy';
}

export const ModelsPage: React.FC<ModelsPageProps> = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'manual' | 'automatic'>('automatic');
  const [loading, setLoading] = useState(true);
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['Groq', 'Z.ai', 'Ollama']));
  const { showToast } = useToast();

  // Load models on mount and poll for updates
  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchModels = async () => {
    try {
      const data = await ModelSelectionService.getAvailableModels();
      // Filter to only show configured models
      const filteredModels = (data.models || []).filter(m => shouldShowModel(m.model_id));
      setModels(filteredModels);
      setSelectedModelId(data.preferred_model_id);
      setSelectionMode(data.selection_mode);
    } catch (error) {
      console.error('[ModelsPage] Failed to fetch models:', error);
      showToast('Failed to load models', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (modelId: string) => {
    try {
      await ModelSelectionService.selectModel(modelId);
      setSelectedModelId(modelId);
      setSelectionMode('manual');
      showToast(`Switched to ${getModelDisplayName(modelId)}`, 'success');
      await fetchModels();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  const handleClearSelection = async () => {
    try {
      await ModelSelectionService.clearSelection();
      setSelectedModelId(null);
      setSelectionMode('automatic');
      showToast('Switched to automatic model selection', 'success');
      await fetchModels();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  const handleTestConnection = async (modelId: string) => {
    setTestingModels(prev => new Set(prev).add(modelId));
    
    try {
      const result = await ModelSelectionService.testConnection();
      setTestResults(prev => ({
        ...prev,
        [modelId]: result
      }));
      
      if (result.success) {
        showToast(`${getModelDisplayName(modelId)}: Connection successful`, 'success');
      } else {
        showToast(`${getModelDisplayName(modelId)}: ${result.message}`, 'error');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setTestResults(prev => ({
        ...prev,
        [modelId]: { success: false, message: errorMsg }
      }));
      showToast(errorMsg, 'error');
    } finally {
      setTestingModels(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  // Group models by provider
  const providerGroups: ProviderGroup[] = [
    {
      name: 'Groq',
      icon: <Cloud className="w-5 h-5" />,
      models: models.filter(m => m.model_id.includes('llama') || m.model_id.includes('groq')),
      status: 'healthy' as const
    },
    {
      name: 'Z.ai',
      icon: <Zap className="w-5 h-5" />,
      models: models.filter(m => m.model_id.includes('glm') || m.model_id.includes('z.ai')),
      status: 'healthy' as const
    },
    {
      name: 'Ollama',
      icon: <HardDrive className="w-5 h-5" />,
      models: models.filter(m => !m.model_id.includes('llama') && !m.model_id.includes('glm') && !m.model_id.includes('groq') && !m.model_id.includes('z.ai')),
      status: 'healthy' as const
    }
  ].filter(group => group.models.length > 0);

  // Calculate overall health for each provider
  providerGroups.forEach(group => {
    const healthyCount = group.models.filter(m => m.status === 'healthy').length;
    const degradedCount = group.models.filter(m => m.status === 'degraded').length;
    
    if (healthyCount === group.models.length) {
      group.status = 'healthy';
    } else if (degradedCount > 0 || healthyCount > 0) {
      group.status = 'degraded';
    } else {
      group.status = 'unhealthy';
    }
  });

  const toggleProvider = (providerName: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return next;
    });
  };

  const getProviderIcon = (providerName: string) => {
    switch (providerName) {
      case 'Groq':
        return <Cloud className="w-5 h-5 text-purple-400" />;
      case 'Z.ai':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'Ollama':
        return <HardDrive className="w-5 h-5 text-green-400" />;
      default:
        return <Server className="w-5 h-5 text-zinc-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-zinc-100">AI Models</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchModels}
              className="p-2 hover:bg-zinc-800 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          Manage AI model providers, test connectivity, and select preferred models
        </p>
      </div>

      {/* Selection Mode Banner */}
      <div className="mb-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Selection Mode: <span className="text-blue-400">{selectionMode === 'manual' ? 'Manual' : 'Automatic'}</span>
              </div>
              <div className="text-xs text-zinc-500">
                {selectionMode === 'manual' 
                  ? `Using ${getModelDisplayName(selectedModelId || 'unknown')} as preferred model`
                  : 'Router automatically selects best available model'}
              </div>
            </div>
          </div>
          {selectionMode === 'manual' && (
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium transition-colors"
            >
              Switch to Automatic
            </button>
          )}
        </div>
      </div>

      {/* Provider Groups */}
      <div className="space-y-4">
        {providerGroups.map((group) => (
          <div key={group.name} className="border border-zinc-800 rounded-lg overflow-hidden">
            {/* Provider Header */}
            <button
              onClick={() => toggleProvider(group.name)}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getProviderIcon(group.name)}
                <div className="text-left">
                  <div className="text-sm font-semibold text-zinc-100">{group.name}</div>
                  <div className="text-xs text-zinc-500">
                    {group.models.length} model{group.models.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-[10px] font-medium rounded border ${getStatusBadgeColor(group.status)}`}>
                  {group.status}
                </span>
                {expandedProviders.has(group.name) ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </button>

            {/* Models List */}
            {expandedProviders.has(group.name) && (
              <div className="border-t border-zinc-800 bg-zinc-900/30">
                {group.models.map((model) => {
                  const isSelected = model.model_id === selectedModelId;
                  const isTesting = testingModels.has(model.model_id);
                  const testResult = testResults[model.model_id];

                  return (
                    <div
                      key={model.model_id}
                      className={`p-4 border-b border-zinc-800 last:border-b-0 ${
                        isSelected ? 'bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getStatusDotColor(model.status)}`} />
                            <span className="text-sm font-medium text-zinc-100">
                              {getModelDisplayName(model.model_id)}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 text-[10px] bg-blue-900/40 text-blue-300 rounded-full border border-blue-800">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span className={`px-2 py-0.5 rounded border ${getStatusBadgeColor(model.status)}`}>
                              {model.status}
                            </span>
                            {model.latency_ms !== null && model.latency_ms !== undefined && (
                              <span>{formatLatency(model.latency_ms)}</span>
                            )}
                            {model.tokens_per_sec !== null && model.tokens_per_sec !== undefined && (
                              <span>{formatTokensPerSec(model.tokens_per_sec)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Test Result */}
                      {testResult && (
                        <div className={`mb-3 p-2 rounded text-xs ${
                          testResult.success
                            ? 'bg-green-900/20 border border-green-800 text-green-300'
                            : 'bg-red-900/20 border border-red-800 text-red-300'
                        }`}>
                          <div className="flex items-start gap-2">
                            {testResult.success ? (
                              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium">
                                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                              </p>
                              <p className="mt-1 opacity-80">{testResult.message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectModel(model.model_id)}
                          disabled={isSelected}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors"
                        >
                          {isSelected ? 'Selected' : 'Use This Model'}
                        </button>
                        <button
                          onClick={() => handleTestConnection(model.model_id)}
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Test Connection"
                        >
                          {isTesting ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <TestTube className="w-3 h-3" />
                              Test
                            </>
                          )}
                        </button>
                        {modelRequiresApiKey(model.model_id) && (
                          <button
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                            title="Configure API Key"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="mt-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 space-y-2">
            <p>
              <strong className="text-zinc-300">Automatic Mode:</strong> Router selects the best available model based on health, latency, and performance.
            </p>
            <p>
              <strong className="text-zinc-300">Manual Mode:</strong> Use a specific model for all requests. Router will fall back to automatic if the selected model is unhealthy.
            </p>
            <p>
              <strong className="text-zinc-300">Health Status:</strong> Updated every 10 seconds. Healthy models are prioritized in automatic selection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
