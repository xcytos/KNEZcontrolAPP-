export interface ViewPlaygroundTab {
  type: 'terminal' | 'opencode' | 'agent';
  label: string;
  agentId?: string;
  agentSessionId?: string;
}

export interface ViewLayout {
  splitPosition: number;
  showEvolution: boolean;
  showPlayground: boolean;
  showRightPanel: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  sessionId: string;
  projectId?: string;
  playgroundTabs: ViewPlaygroundTab[];
  layout: ViewLayout;
}

export interface ViewerStore {
  views: SavedView[];
  activeViewId: string | null;
}

export const DEFAULT_LAYOUT: ViewLayout = {
  splitPosition: 65,
  showEvolution: true,
  showPlayground: true,
  showRightPanel: false,
};

export const VIEWER_STORAGE_KEY = 'knez_saved_views';
