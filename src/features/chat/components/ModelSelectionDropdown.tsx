/**
 * Model Selection Dropdown
 * Displays available models with health status and allows selection
 */

import React from 'react';
import { Check, ChevronDown, Settings, RefreshCw } from 'lucide-react';
import { ModelInfo } from '../../../services/models/ModelSelectionService';
import {
  getModelDisplayName,
  getModelProvider,
  getModelIcon,
  getStatusBadgeColor,
  getStatusDotColor,
  modelRequiresApiKey,
  sortModelsByPriority,
  formatLatency,
  formatTokensPerSec,
  shouldShowModel
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
  loading = false
}) => {
  // Filter out test models and models without display info
  const filteredModels = models.filter(m => shouldShowModel(m.model_id));
  const selectedModel = filteredModels.find(m => m.model_id === selectedModelId);
  const sortedModels = sortModelsByPriority(filteredModels);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
        title="Select AI Model"
      >
        {selectedModel ? (
          <>
            <span className="text-lg">{getModelIcon(selectedModel.model_id)}</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDotColor(selectedModel.status)}`} />
              <span className="text-xs text-zinc-300 font-medium hidden md:inline">
                {getModelDisplayName(selectedModel.model_id)}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="text-lg">🤖</span>
            <span className="text-xs text-zinc-400">Select Model</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={onToggle}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">AI Models</h3>
                <button
                  onClick={onClearSelection}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center gap-1"
                  title="Clear selection (automatic mode)"
                >
                  <RefreshCw className="w-3 h-3" />
                  Auto
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {filteredModels.length} models available
              </p>
            </div>

            {/* Model List */}
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
                  const requiresKey = modelRequiresApiKey(model.model_id);

                  return (
                    <div
                      key={model.model_id}
                      className={`p-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${
                        isSelected ? 'bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <span className="text-2xl flex-shrink-0">{getModelIcon(model.model_id)}</span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-zinc-100 truncate">
                                {getModelDisplayName(model.model_id)}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {getModelProvider(model.model_id)}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getStatusBadgeColor(model.status)}`}>
                              {model.status}
                            </span>
                            {model.latency_ms !== null && model.latency_ms !== undefined && (
                              <span className="text-[10px] text-zinc-500">
                                {formatLatency(model.latency_ms)}
                              </span>
                            )}
                            {model.tokens_per_sec !== null && model.tokens_per_sec !== undefined && (
                              <span className="text-[10px] text-zinc-500">
                                {formatTokensPerSec(model.tokens_per_sec)}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSelectModel(model.model_id)}
                              disabled={isSelected}
                              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors"
                            >
                              {isSelected ? 'Selected' : 'Use This'}
                            </button>
                            {requiresKey && (
                              <button
                                onClick={() => onConfigureModel(model.model_id)}
                                className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                                title="Configure API Key"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 text-center">
              Polling health every 10s
            </div>
          </div>
        </>
      )}
    </div>
  );
};
