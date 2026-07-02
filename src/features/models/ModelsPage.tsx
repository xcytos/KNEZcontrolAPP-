/**
 * Models Configuration Page
 * Comprehensive view of all AI models with provider organization, health status, and testing
 */

import React, { useState, useEffect } from 'react';
import { 
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
  AlertCircle,
  ExternalLink,
  X
} from 'lucide-react';
import { ModelSelectionService, ModelInfo } from '../../services/models/ModelSelectionService';
import { nineRouterService, RouterModel } from '../../services/router/NineRouterService';
import {
  getModelDisplayName,
  getNineRouterModelName,
  getStatusBadgeColor,
  getStatusDotColor,
  modelRequiresApiKey,
  getApiKeyVar,
  getSetupUrl,
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
  const [loading, setLoading] = useState(true);
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [configuringKey, setConfiguringKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['Groq', 'Z.ai', 'Ollama']));
  const [routerModels, setRouterModels] = useState<RouterModel[]>([]);
  const [routerHealthy, setRouterHealthy] = useState(false);
  const [routerLoading, setRouterLoading] = useState(true);
  const { showToast } = useToast();

  // Load models on mount and poll for updates
  useEffect(() => {
    fetchModels();
    fetchRouterModels();
    const interval = setInterval(fetchModels, 10000);
    const routerInterval = setInterval(fetchRouterModels, 15000);
    return () => {
      clearInterval(interval);
      clearInterval(routerInterval);
    };
  }, []);

  const fetchModels = async () => {
    try {
      const data = await ModelSelectionService.getAvailableModels();
      const filteredModels = (data.models || []).filter(m => shouldShowModel(m.model_id));
      setModels(filteredModels);
    } catch (error) {
      console.error('[ModelsPage] Failed to fetch models:', error);
      showToast('Failed to load models', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRouterModels = async () => {
    try {
      const health = await nineRouterService.checkHealth();
      setRouterHealthy(health?.status === 'healthy');
      if (health?.status === 'healthy') {
        const models = await nineRouterService.getModels();
        setRouterModels(models);
      }
    } catch {
      setRouterHealthy(false);
    } finally {
      setRouterLoading(false);
    }
  };

  const handleTestConnection = async (modelId: string) => {
    setTestingModels(prev => new Set(prev).add(modelId));
    setTestResults(prev => { const n = { ...prev }; delete n[modelId]; return n; });
    
    try {
      const result = await ModelSelectionService.testModel(modelId);
      setTestResults(prev => ({ ...prev, [modelId]: result }));
      
      if (result.success) {
        showToast(`${getModelDisplayName(modelId)}: ${result.message}`, 'success');
      } else {
        showToast(`${getModelDisplayName(modelId)}: ${result.message}`, 'error');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setTestResults(prev => ({ ...prev, [modelId]: { success: false, message: errorMsg } }));
      showToast(errorMsg, 'error');
    } finally {
      setTestingModels(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  const handleSaveApiKey = async () => {
    if (!configuringKey || !apiKeyValue.trim()) return;
    setSavingKey(true);
    try {
      const keyVar = getApiKeyVar(configuringKey);
      if (keyVar) {
        await ModelSelectionService.saveApiKey(keyVar, apiKeyValue.trim());
        showToast(`API key saved for ${getModelDisplayName(configuringKey)}`, 'success');
      }
      setConfiguringKey(null);
      setApiKeyValue('');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSavingKey(false);
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
                  const isTesting = testingModels.has(model.model_id);
                  const testResult = testResults[model.model_id];

                  return (
                    <div
                      key={model.model_id}
                      className="p-4 border-b border-zinc-800 last:border-b-0"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getStatusDotColor(model.status)}`} />
                            <span className="text-sm font-medium text-zinc-100">
                              {getModelDisplayName(model.model_id)}
                            </span>
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
                          onClick={() => handleTestConnection(model.model_id)}
                          disabled={isTesting}
                          className="flex-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
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
                            onClick={() => {
                              setConfiguringKey(model.model_id);
                              setApiKeyValue('');
                            }}
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

      {/* 9Router Provider Section */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">9Router Proxy</h2>
          <div className={`ml-2 px-2 py-0.5 text-[10px] font-medium rounded-full border ${
            routerHealthy
              ? 'bg-green-900/30 text-green-400 border-green-800'
              : 'bg-red-900/30 text-red-400 border-red-800'
          }`}>
            {routerHealthy ? 'Connected' : 'Offline'}
          </div>
          <span className="text-[10px] text-zinc-600 ml-1">localhost:20128</span>
        </div>

        {routerHealthy && routerModels.length > 0 && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleProvider('9Router')}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-zinc-100">All Models</div>
                  <div className="text-xs text-zinc-500">
                    {routerModels.length} model{routerModels.length !== 1 ? 's' : ''} across 40+ providers
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {expandedProviders.has('9Router') ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </button>

            {expandedProviders.has('9Router') && (
              <div className="border-t border-zinc-800 bg-zinc-900/30">
                {routerModels.map((model) => (
                  <div
                    key={model.id}
                    className="p-4 border-b border-zinc-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${
                            model.category === 'free' ? 'bg-green-500' :
                            model.category === 'oauth' ? 'bg-blue-500' :
                            'bg-zinc-500'
                          }`} />
                          <span className="text-sm font-medium text-zinc-100">
                            {getNineRouterModelName(model.id)}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${
                            model.category === 'free'
                              ? 'bg-green-900/30 text-green-400 border-green-800'
                              : model.category === 'oauth'
                                ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                                : 'bg-zinc-900/30 text-zinc-400 border-zinc-700'
                          }`}>
                            {model.category}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className="font-mono">{model.id}</span>
                          <span className="mx-2">·</span>
                          <span>{model.owned_by}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!routerHealthy && !routerLoading && (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-zinc-500" />
              <div className="text-sm text-zinc-500">
                9Router is not running. Start it to access 40+ AI providers including free models.
              </div>
            </div>
          </div>
        )}

        {routerLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        )}
      </div>

      {/* API Key Configuration Modal */}
      {configuringKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">
                API Key: {getModelDisplayName(configuringKey)}
              </h3>
              <button
                onClick={() => { setConfiguringKey(null); setApiKeyValue(''); }}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Environment Variable: <code className="text-blue-400">{getApiKeyVar(configuringKey)}</code>
                </label>
                <input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-600 transition-colors"
                  autoFocus
                />
              </div>
              {getSetupUrl(configuringKey) && (
                <a
                  href={getSetupUrl(configuringKey)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Get API key from {getSetupUrl(configuringKey)}
                </a>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={savingKey || !apiKeyValue.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {savingKey ? 'Saving...' : 'Save API Key'}
                </button>
                <button
                  onClick={() => { setConfiguringKey(null); setApiKeyValue(''); }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
