import React from 'react';
import { Check, ChevronDown, Settings, RefreshCw, X } from 'lucide-react';
import { ModelInfo } from '../../../services/models/ModelSelectionService';
import {
  getModelDisplayName,
  getModelProviderDisplayName,
  getProviderMeta,
  sortModelsByPriority,
  formatLatency,
} from '../../../utils/modelUtils';

interface ModelSelectionDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  models: ModelInfo[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  onConfigureModel: (modelId: string) => void;
  onClearSelection: () => void;
  loading?: boolean;
}

export const ModelSelectionDropdown: React.FC<ModelSelectionDropdownProps> = ({
  isOpen,
  onToggle,
  models,
  selectedModelId,
  onSelectModel,
  onConfigureModel,
  onClearSelection,
  loading = false,
}) => {
  const selectedModel = models.find(m => m.model_id === selectedModelId);
  const sortedModels = sortModelsByPriority(models);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
        title="Select AI Model"
      >
        {selectedModel ? (
          <>
            <span className="text-lg">{getProviderMeta(selectedModel.provider).icon}</span>
            <span className="text-xs text-zinc-300 font-medium hidden md:inline">
              {getModelDisplayName(selectedModel)}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg">🤖</span>
            <span className="text-xs text-zinc-400">Select Model</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 max-h-80 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">AI Models</h3>
                <button
                  onClick={onClearSelection}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center gap-1"
                  title="Automatic mode"
                >
                  <RefreshCw className="w-3 h-3" />
                  Auto
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {models.length} models available
              </p>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading models...
                </div>
              ) : sortedModels.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  No models available
                </div>
              ) : (
                sortedModels.map((model) => {
                  const isSelected = model.model_id === selectedModelId;
                  const isUnhealthy = model.status === 'unhealthy';
                  const meta = getProviderMeta(model.provider);
                  const requiresKey = meta.apiKeyVar !== null;

                  return (
                    <div
                      key={model.model_id}
                      onClick={() => !isSelected && onSelectModel(model.model_id)}
                      className={`flex items-center gap-3 px-3 py-2.5 border-b border-zinc-800 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-900/20'
                          : 'hover:bg-zinc-800/50'
                      } ${isUnhealthy ? 'opacity-50' : ''}`}
                    >
                      <span className="text-lg flex-shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {getModelDisplayName(model)}
                          </span>
                          {isUnhealthy && <X className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{getModelProviderDisplayName(model.provider)}</span>
                          {model.latency_ms !== null && model.latency_ms !== undefined && (
                            <span>{formatLatency(model.latency_ms)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                        {requiresKey && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onConfigureModel(model.model_id); }}
                            className="p-1 hover:bg-zinc-700 rounded transition-colors"
                            title="Configure API Key"
                          >
                            <Settings className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
