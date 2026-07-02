export enum PlaygroundType {
  TERMINAL = 'terminal',
  OPENCODE = 'opencode',
  DASHBOARD = 'dashboard',
  REPOSITORY = 'repository',
  SESSION = 'session'
}

export enum PanelPosition {
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
  NONE = 'none'
}

export interface PanelState {
  position: PanelPosition;
  isVisible: boolean;
  height?: number;
  width?: number;
  activeTabId: string | null;
  lastScrollPositions: Record<string, number>;
}

export interface ViewState {
  panel: PanelState;
  expandedPlayground: string | null;
  savedSessions: SavedSession[];
}

export interface SavedSession {
  id: string;
  type: PlaygroundType;
  name: string;
  lastActivity: number;
  scrollPosition: number;
  isPinned: boolean;
}

export interface PlaygroundConfig {
  // Basic information
  name: string;
  description: string;
  version: string;
  author: string;
  
  // Capabilities
  capabilities: PlaygroundCapabilities;
  
  // Resource requirements
  resourceRequirements: ResourceRequirements;
  
  // UI configuration
  ui: UIConfig;
  
  // Session configuration
  session: SessionConfig;
  
  // Feature flags
  features: FeatureFlags;
}

export interface PlaygroundCapabilities {
  supportsMultiSession: boolean;
  supportsBackgroundAgents: boolean;
  supportsFileAccess: boolean;
  supportsTerminalAccess: boolean;
  supportsNetworkAccess: boolean;
  supportsMCPTools: boolean;
}

export interface ResourceRequirements {
  minMemory: number; // MB
  maxMemory: number; // MB
  minCpuCores: number;
  requiredPermissions: string[];
  optionalPermissions: string[];
}

export interface UIConfig {
  theme: 'dark' | 'light' | 'auto';
  layout: string;
  compactMode: boolean;
  advancedMode: boolean;
}

export interface SessionConfig {
  id?: string;
  name?: string;
  type: PlaygroundType;
  provider?: string;
  model?: string;
  workspace?: string;
  settings?: Record<string, any>;
  autoSave?: boolean;
  persistence?: boolean;
  sharing?: boolean;
  isolation?: 'session' | 'shared_workspace' | 'shared_context' | 'full';
  createdAt?: Date;
  lastActivity?: Date;
  resourceAllocation?: string;
  lsp?: {
    enabled: boolean;
    server?: string;
    port?: number;
  };
  execution?: {
    mode: 'interactive' | 'batch' | 'automated';
    autoSave: boolean;
    timeout?: number;
  };
}

export interface FeatureFlags {
  // Core features
  multiSession: boolean;
  backgroundAgents: boolean;
  sessionSharing: boolean;
  
  // UI features
  darkMode: boolean;
  compactMode: boolean;
  advancedMode: boolean;
  
  // Development features
  debugMode: boolean;
  experimentalFeatures: boolean;
  betaFeatures: boolean;
  
  // Performance features
  hardwareAcceleration: boolean;
  virtualization: boolean;
  caching: boolean;
}

export interface ModelInfo {
  provider: string;
  model: string;
  capabilities: string[];
  contextWindow: number;
  maxTokens: number;
  description?: string;
  pricing?: {
    input: number;
    output: number;
    currency: string;
  };
}

export interface ProviderInfo {
  name: string;
  type: 'local' | 'cloud' | 'enterprise';
  description: string;
  endpoint?: string;
  apiKey?: string;
  models: ModelInfo[];
  status: 'active' | 'inactive' | 'error';
  lastCheck?: Date;
  configuration?: Record<string, any>;
}

export interface StreamData {
  type: string;
  data: any;
  timestamp: number;
  sessionId?: string;
  provider?: string;
  model?: string;
}

export interface StreamConfig {
  type: string;
  sessionId: string;
  provider: string;
  model: string;
  config?: Record<string, any>;
}

export interface MemoryContext {
  sessionId: string;
  context: any;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchResult {
  id: string;
  content: any;
  relevance: number;
  metadata: Record<string, any>;
  sessionId?: string;
  createdAt: Date;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  lastActivity?: Date;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returns?: Record<string, any>;
}

export interface PlaygroundEvent {
  type: string;
  sessionId?: string;
  playgroundId?: string;
  data?: any;
  timestamp: number;
  error?: string;
}

export interface Notification {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

export interface Dialog {
  title: string;
  message: string;
  type: 'info' | 'confirm' | 'warning' | 'error';
  buttons: DialogButton[];
  input?: {
    label: string;
    type: 'text' | 'password' | 'number';
    placeholder?: string;
    required?: boolean;
  };
}

export interface DialogButton {
  label: string;
  value: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface DialogResult {
  button: string;
  input?: string;
  cancelled: boolean;
}

export interface ProgressIndicator {
  id: string;
  title: string;
  progress: number; // 0-100
  status?: string;
  cancelable?: boolean;
}

export interface ResourceAllocation {
  id: string;
  allocated: ResourceRequirements;
  available: ResourceRequirements;
  expires: Date;
}

export interface OpenCodeConfig extends PlaygroundConfig {
  terminal: {
    shell: string;
    workingDirectory: string;
    environment: Record<string, string>;
    theme: 'dark' | 'light';
  };
  lsp: {
    enabled: boolean;
    languages: string[];
    workspace: string;
  };
  execution: {
    mode: 'suggest' | 'confirm' | 'autonomous';
    autoSave: boolean;
    maxConcurrentSessions: number;
  };
  provider: {
    name: string;
    model: string;
    endpoint?: string;
    apiKey?: string;
  };
}
