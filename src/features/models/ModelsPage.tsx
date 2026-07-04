/**
 * Models Configuration Page
 * VS Code-style layout with provider sidebar and compact model cards
 */

import React, { useMemo, useState } from 'react';
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
  Search,
  ExternalLink,
  X,
  Power,
  Globe,
} from 'lucide-react';
import { ModelSelectionService, ModelInfo } from '../../services/models/ModelSelectionService';
import {
  getModelDisplayName,
  getModelProvider,
  getModelIcon,
  getStatusDotColor,
  modelRequiresApiKey,
  getApiKeyVar,
  getSetupUrl,
  formatLatency,
  formatTokensPerSec,
} from '../../utils/modelUtils';
import { useToast } from '../../components/ui/Toast';
import { useModel } from '../../contexts/ModelContext';

interface ModelsPageProps {}

interface ProviderItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  models: ModelInfo[];
}

export const ModelsPage: React.FC<ModelsPageProps> = () => {
  const { availableModels, loading, routerHealthy, refreshModels } = useModel();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [configuringKey, setConfiguringKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const { showToast } = useToast();

  const providers: ProviderItem[] = useMemo(() => {
    const groups: ProviderItem[] = [
      {
        id: 'groq',
        label: 'Groq',
        icon: <Cloud className="w-4 h-4 text-purple-400" />,
        models: availableModels.filter(m => m.model_id.includes('llama') || m.model_id.includes('groq')),
      },
      {
        id: 'zai',
        label: 'Z.ai',
        icon: <Zap className="w-4 h-4 text-yellow-400" />,
        models: availableModels.filter(m => m.model_id.includes('glm') || m.model_id.includes('z.ai')),
      },
      {
        id: 'ollama',
        label: 'Ollama',
        icon: <HardDrive className="w-4 h-4 text-green-400" />,
        models: availableModels.filter(m => !m.model_id.includes('llama') && !m.model_id.includes('glm') && !m.model_id.includes('groq') && !m.model_id.includes('z.ai')),
      },
    ];
    return groups.filter(g => g.models.length > 0);
  }, [availableModels]);

  const filteredModels = useMemo(() => {
    let list = selectedProvider === 'all'
      ? availableModels
      : providers.find(p => p.id === selectedProvider)?.models || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        getModelDisplayName(m.model_id).toLowerCase().includes(q) ||
        m.model_id.toLowerCase().includes(q) ||
        getModelProvider(m.model_id).toLowerCase().includes(q)
      );
    }
    return list;
  }, [availableModels, selectedProvider, searchQuery, providers]);

  const handleTestConnection = async (modelId: string) => {
    setTestingModels(prev => new Set(prev).add(modelId));
    setTestResults(prev => { const n = { ...prev }; delete n[modelId]; return n; });

    try {
      const result = await ModelSelectionService.testModel(modelId);
      setTestResults(prev => ({ ...prev, [modelId]: result }));
      showToast(`${getModelDisplayName(modelId)}: ${result.message}`, result.success ? 'success' : 'error');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {routerHealthy ? (
            <a
              href="http://localhost:20128"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              9Router
            </a>
          ) : (
            <button
              onClick={() => window.open('http://localhost:20128', '_blank')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              Turn On 9Router
            </button>
          )}
          <button
            onClick={refreshModels}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title="Refresh models"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Provider Sidebar */}
        <div className="w-44 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
          <div className="p-2">
            <button
              onClick={() => setSelectedProvider('all')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                selectedProvider === 'all'
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Server className="w-4 h-4" />
              All Models
              <span className="ml-auto text-zinc-500">{availableModels.length}</span>
            </button>
            {providers.map(p => {
              const hasUnhealthy = p.models.some(m => m.status === 'unhealthy');
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors mt-0.5 ${
                    selectedProvider === p.id
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {p.icon}
                  {p.label}
                  <span className="ml-auto flex items-center gap-1">
                    {hasUnhealthy && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    <span className="text-zinc-500">{p.models.length}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {filteredModels.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-zinc-500">
                {searchQuery ? 'No models match your search' : 'No models available'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredModels.map((model) => {
                  const isTesting = testingModels.has(model.model_id);
                  const testResult = testResults[model.model_id];
                  const requiresKey = modelRequiresApiKey(model.model_id);
                  const isHealthy = model.status === 'healthy';

                  return (
                    <div key={model.model_id} className="group flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-800/40 transition-colors">
                      <span className="text-xl flex-shrink-0">{getModelIcon(model.model_id)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusDotColor(model.status)}`} />
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {getModelDisplayName(model.model_id)}
                          </span>
                          {!isHealthy && <X className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{getModelProvider(model.model_id)}</span>
                          {model.latency_ms !== null && model.latency_ms !== undefined && (
                            <span>{formatLatency(model.latency_ms)}</span>
                          )}
                          {model.tokens_per_sec !== null && model.tokens_per_sec !== undefined && (
                            <span>{formatTokensPerSec(model.tokens_per_sec)}</span>
                          )}
                        </div>
                        {testResult && (
                          <div className={`mt-1.5 text-xs flex items-center gap-1 ${
                            testResult.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {testResult.success ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTestConnection(model.model_id)}
                          disabled={isTesting}
                          className="px-2.5 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded transition-colors flex items-center gap-1"
                        >
                          {isTesting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <TestTube className="w-3 h-3" />
                          )}
                          Test
                        </button>
                        {requiresKey && (
                          <button
                            onClick={() => { setConfiguringKey(model.model_id); setApiKeyValue(''); }}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
                            title="Configure API Key"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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

      {/* Status Bar */}
      <div className="px-4 py-1.5 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 flex items-center gap-3">
        <span>{availableModels.length} models</span>
        <span>·</span>
        <span>{routerHealthy ? '9Router Connected' : '9Router Offline'}</span>
        <span>·</span>
        <span>Polling every 10s</span>
      </div>
    </div>
  );
};
