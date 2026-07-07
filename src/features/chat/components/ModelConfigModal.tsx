import React, { useState } from 'react';
import { X, Key, ExternalLink, Loader, CheckCircle, XCircle } from 'lucide-react';
import { TestConnectionResponse, ModelInfo } from '../../../services/models/ModelSelectionService';
import { getProviderMeta, getModelProviderDisplayName } from '../../../utils/modelUtils';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelInfo;
  onSave: (key: string, value: string) => Promise<void>;
  onTest: () => Promise<TestConnectionResponse>;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  isOpen,
  onClose,
  model,
  onSave,
  onTest
}) => {
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  if (!isOpen) return null;

  const meta = getProviderMeta(model.provider);
  const displayName = getModelProviderDisplayName(model.provider);

  const handleSave = async () => {
    if (!apiKeyValue.trim() || !meta.apiKeyVar) {
      return;
    }

    setSaving(true);
    try {
      await onSave(meta.apiKeyVar, apiKeyValue);
      setApiKeyValue('');
    } catch (error) {
      console.error('[ModelConfigModal] Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Configure API Key</h2>
              <p className="text-xs text-zinc-400">{displayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Instructions */}
          <div className="p-3 bg-blue-900/20 border border-blue-800 rounded text-sm text-blue-300">
            <p className="font-medium mb-1">How to get your API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Visit the provider's website</li>
              <li>Create an account or sign in</li>
              <li>Navigate to API keys section</li>
              <li>Create a new API key</li>
              <li>Copy and paste it below</li>
            </ol>
            {meta.setupUrl && (
              <a
                href={meta.setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open API Key Page</span>
              </a>
            )}
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              API Key
            </label>
            <input
              type="password"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={`Enter your ${meta.apiKeyVar}`}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Your API key will be saved securely. Restart KNEZ backend after saving.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded border ${
              testResult.success
                ? 'bg-green-900/20 border-green-800 text-green-300'
                : 'bg-red-900/20 border-red-800 text-red-300'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className="text-xs mt-1">{testResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {testing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !apiKeyValue.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save API Key'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
