export type AgentInstallMethod = 'npm' | 'pip' | 'manual' | 'bundled';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'coding' | 'research' | 'terminal' | 'mcp';
  color: string;

  detectionCommand: string[];
  detectionPath?: string;

  installMethod: AgentInstallMethod;
  installCommand: string[];
  installUrl?: string;
  postInstallNotes?: string;

  launchCommand: string[];
  launchArgs?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;

  supportsProviderSelection: boolean;
  configFilePath?: string;
  configDocUrl?: string;

  homepage: string;
  version?: string;
}

export interface AgentStatus {
  id: string;
  installed: boolean;
  detected: boolean;
  version?: string;
  error?: string;
  lastCheck: number;
}

export interface AgentInstallProgress {
  agentId: string;
  phase: 'downloading' | 'installing' | 'verifying' | 'done' | 'error';
  progress: number;
  message: string;
}

export interface AgentProviderConfig {
  agentId: string;
  providerId: string;
  modelId?: string;
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
}

export const AGENT_PRESET_COLORS: Record<string, string> = {
  claude: '#d97706',
  codex: '#10b981',
  opencode: '#6366f1',
  cowork: '#8b5cf6',
  hermes: '#ec4899',
  droid: '#f97316',
  cursor: '#06b6d4',
  cline: '#14b8a6',
  kilo: '#eab308',
  roo: '#84cc16',
  continue: '#22d3ee',
  amp: '#a855f7',
  qwen: '#3b82f6',
  deepseek: '#0ea5e9',
  jcode: '#ef4444',
};
