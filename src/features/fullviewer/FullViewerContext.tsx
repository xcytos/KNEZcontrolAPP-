import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { LensType, LayoutMode, RightPanelContent, SessionContext, FullViewerState, NavigationState, DashboardSubTab, ViewLevel } from './types';

interface FullViewerContextType extends FullViewerState {
  setActiveLens: (lens: LensType) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSecondaryLens: (lens?: LensType) => void;
  setRightPanel: (panel: RightPanelContent) => void;
  setSessionContext: (ctx: SessionContext) => void;
  toggleActivityBar: () => void;
  cycleLayoutMode: () => void;
  setActiveSubTab: (tab: DashboardSubTab) => void;
  setViewLevel: (level: ViewLevel) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedSessionId: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
  setViewMode: (mode: 'timeline' | 'sections') => void;
}

const defaultNavigation: NavigationState = {
  activeSubTab: 'hierarchy',
  viewLevel: 'projects',
  selectedProjectId: null,
  selectedSessionId: null,
  searchTerm: '',
  viewMode: 'timeline',
};

const defaultState: FullViewerState = {
  activeLens: 'dashboard',
  layoutMode: 'full',
  rightPanel: 'agent',
  sessionContext: {},
  showActivityBar: true,
  navigation: defaultNavigation,
};

const FullViewerContext = createContext<FullViewerContextType | null>(null);

export const FullViewerProvider: React.FC<{ children: ReactNode; initialState?: Partial<FullViewerState> }> = ({
  children,
  initialState,
}) => {
  const [state, setState] = useState<FullViewerState>({
    ...defaultState,
    ...initialState,
    navigation: { ...defaultNavigation, ...initialState?.navigation },
  });

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
    setState(prev => {
      if (Object.keys(ctx).length === 0) {
        return { ...prev, sessionContext: {} };
      }
      return { ...prev, sessionContext: { ...prev.sessionContext, ...ctx } };
    });
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

  const setActiveSubTab = useCallback((tab: DashboardSubTab) => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, activeSubTab: tab } }));
  }, []);

  const setViewLevel = useCallback((level: ViewLevel) => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, viewLevel: level } }));
  }, []);

  const setSelectedProjectId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, selectedProjectId: id } }));
  }, []);

  const setSelectedSessionId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, selectedSessionId: id } }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, searchTerm: term } }));
  }, []);

  const setViewMode = useCallback((mode: 'timeline' | 'sections') => {
    setState(prev => ({ ...prev, navigation: { ...prev.navigation, viewMode: mode } }));
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
      setActiveSubTab,
      setViewLevel,
      setSelectedProjectId,
      setSelectedSessionId,
      setSearchTerm,
      setViewMode,
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
