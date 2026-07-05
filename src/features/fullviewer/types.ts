export type LensType =
  | 'dashboard'
  | 'evolution'
  | 'explorer'
  | 'graph'
  | 'repository'
  | 'terminal'
  | 'chat';

export type LayoutMode = 'compact' | 'full' | 'split' | 'focus';

export type RightPanelContent = 'agent' | 'metadata' | 'filedetail' | 'none';

export interface SessionContext {
  sessionId?: string;
  sessionName?: string;
  projectId?: string;
  projectName?: string;
}

export type DashboardSubTab = 'hierarchy' | 'sessions';
export type ViewLevel = 'projects' | 'sessions' | 'session-detail';

export interface NavigationState {
  activeSubTab: DashboardSubTab;
  viewLevel: ViewLevel;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  searchTerm: string;
  viewMode: 'timeline' | 'sections';
}

export interface FullViewerState {
  activeLens: LensType;
  layoutMode: LayoutMode;
  secondaryLens?: LensType;
  rightPanel: RightPanelContent;
  sessionContext: SessionContext;
  showActivityBar: boolean;
  navigation: NavigationState;
}

export interface LensDefinition {
  id: LensType;
  label: string;
  icon: string;
  description: string;
}

export const LENS_REGISTRY: LensDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', description: 'AI Operations overview, hierarchy, active sessions' },
  { id: 'evolution', label: 'Evolution', icon: 'BarChart3', description: 'Session evolution timeline & metrics' },
  { id: 'explorer', label: 'Explorer', icon: 'HardDrive', description: 'Data sources: Hierarchy, SQLite, Postgres, Git' },
  { id: 'graph', label: 'Graph', icon: 'Network', description: 'Relationship graph with zoom & pan' },
  { id: 'repository', label: 'Repository', icon: 'GitBranch', description: 'File tree & visualization with session overlay' },
  { id: 'terminal', label: 'Terminal', icon: 'Terminal', description: 'OpenCode & terminal playground' },
  { id: 'chat', label: 'Chat', icon: 'MessageSquare', description: 'TAQWIN Agent & chat pane' },
];
