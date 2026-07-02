import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { LensType, LayoutMode, RightPanelContent, SessionContext, FullViewerState } from './types';

interface FullViewerContextType extends FullViewerState {
  setActiveLens: (lens: LensType) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSecondaryLens: (lens?: LensType) => void;
  setRightPanel: (panel: RightPanelContent) => void;
  setSessionContext: (ctx: SessionContext) => void;
  toggleActivityBar: () => void;
  cycleLayoutMode: () => void;
}

const defaultState: FullViewerState = {
  activeLens: 'dashboard',
  layoutMode: 'full',
  rightPanel: 'agent',
  sessionContext: {},
  showActivityBar: true,
};

const FullViewerContext = createContext<FullViewerContextType | null>(null);

export const FullViewerProvider: React.FC<{ children: ReactNode; initialState?: Partial<FullViewerState> }> = ({
  children,
  initialState,
}) => {
  const [state, setState] = useState<FullViewerState>({ ...defaultState, ...initialState });

  const setActiveLens = useCallback((lens: LensType) => {
    setState(prev => ({ ...prev, activeLens: lens }));
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setState(prev => ({ ...prev, layoutMode: mode }));
  }, []);

  const setSecondaryLens = useCallback((lens?: LensType) => {
    setState(prev => ({ ...prev, secondaryLens: lens }));
  }, []);

  const setRightPanel = useCallback((panel: RightPanelContent) => {
    setState(prev => ({ ...prev, rightPanel: panel }));
  }, []);

  const setSessionContext = useCallback((ctx: SessionContext) => {
    setState(prev => ({ ...prev, sessionContext: ctx }));
  }, []);

  const toggleActivityBar = useCallback(() => {
    setState(prev => ({ ...prev, showActivityBar: !prev.showActivityBar }));
  }, []);

  const cycleLayoutMode = useCallback(() => {
    setState(prev => {
      const modes: LayoutMode[] = ['full', 'compact', 'split', 'focus'];
      const idx = modes.indexOf(prev.layoutMode);
      const next = modes[(idx + 1) % modes.length];
      return { ...prev, layoutMode: next };
    });
  }, []);

  return (
    <FullViewerContext.Provider value={{
      ...state,
      setActiveLens,
      setLayoutMode,
      setSecondaryLens,
      setRightPanel,
      setSessionContext,
      toggleActivityBar,
      cycleLayoutMode,
    }}>
      {children}
    </FullViewerContext.Provider>
  );
};

export const useFullViewer = (): FullViewerContextType => {
  const ctx = useContext(FullViewerContext);
  if (!ctx) throw new Error('useFullViewer must be used within FullViewerProvider');
  return ctx;
};
