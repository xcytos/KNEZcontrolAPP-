import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ModelSelectionService, ModelInfo, ModelSelectionResponse } from '../services/models/ModelSelectionService';
import { nineRouterService, RouterModel, RouterHealth } from '../services/router/NineRouterService';

interface ModelContextValue {
  availableModels: ModelInfo[];
  selectedModelId: string | null;
  selectionMode: 'manual' | 'automatic';
  loading: boolean;
  selectModel: (modelId: string) => Promise<ModelSelectionResponse>;
  setSelectedModelId: (modelId: string | null) => void;
  clearSelection: () => Promise<ModelSelectionResponse>;
  refreshModels: () => Promise<void>;
  routerModels: RouterModel[];
  routerHealth: RouterHealth | null;
  routerHealthy: boolean;
  routerLoading: boolean;
  routerStarting: boolean;
  startRouter: () => Promise<void>;
  stopRouter: () => Promise<void>;
}

export const ModelContext = createContext<ModelContextValue | null>(null);

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'manual' | 'automatic'>('automatic');
  const [loading, setLoading] = useState(true);
  const [routerModels, setRouterModels] = useState<RouterModel[]>([]);
  const [routerHealth, setRouterHealth] = useState<RouterHealth | null>(null);
  const [routerHealthy, setRouterHealthy] = useState(false);
  const [routerLoading, setRouterLoading] = useState(true);
  const [routerStarting, setRouterStarting] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      const data = await ModelSelectionService.getAvailableModels();
      setAvailableModels(data.models || []);
      setSelectedModelId(data.preferred_model_id || null);
      setSelectionMode(data.selection_mode);
    } catch (error) {
      console.error('[ModelContext] Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRouter = useCallback(async () => {
    try {
      const health = await nineRouterService.checkHealth();
      setRouterHealth(health);
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
  }, []);

  useEffect(() => {
    fetchModels();
    fetchRouter();
    const modelsInterval = setInterval(fetchModels, 10000);
    const routerInterval = setInterval(fetchRouter, 15000);
    return () => {
      clearInterval(modelsInterval);
      clearInterval(routerInterval);
    };
  }, [fetchModels, fetchRouter]);

  const selectModel = useCallback(async (modelId: string) => {
    try {
      const data = await ModelSelectionService.selectModel(modelId);
      setSelectedModelId(modelId);
      setSelectionMode('manual');
      return data;
    } catch (error) {
      console.error('[ModelContext] Model selection error:', error);
      throw error;
    }
  }, []);

  const clearSelection = useCallback(async () => {
    try {
      const data = await ModelSelectionService.clearSelection();
      setSelectedModelId(null);
      setSelectionMode('automatic');
      return data;
    } catch (error) {
      console.error('[ModelContext] Clear selection error:', error);
      throw error;
    }
  }, []);

  const setSelectedModelIdDirect = useCallback((modelId: string | null) => {
    setSelectedModelId(modelId);
  }, []);

  const startRouter = useCallback(async () => {
    setRouterStarting(true);
    try {
      await nineRouterService.startProcess();
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const health = await nineRouterService.checkHealth();
        if (health?.status === 'healthy') break;
      }
      await fetchRouter();
    } finally {
      setRouterStarting(false);
    }
  }, [fetchRouter]);

  const stopRouter = useCallback(async () => {
    await nineRouterService.stopProcess();
    setRouterHealthy(false);
    setRouterModels([]);
  }, []);

  return (
    <ModelContext.Provider value={{
      availableModels,
      selectedModelId,
      selectionMode,
      loading,
      selectModel,
      setSelectedModelId: setSelectedModelIdDirect,
      clearSelection,
      refreshModels: fetchModels,
      routerModels,
      routerHealth,
      routerHealthy,
      routerLoading,
      routerStarting,
      startRouter,
      stopRouter,
    }}>
      {children}
    </ModelContext.Provider>
  );
};

export function useModel(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error('useModel must be used within ModelProvider');
  return ctx;
}
