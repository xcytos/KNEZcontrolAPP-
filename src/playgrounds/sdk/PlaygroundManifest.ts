// Playground Runtime Types and Interfaces

export enum RuntimeType {
  OPENCODE = 'opencode',
  CLAUDECODE = 'claudecode',
  AIDER = 'aider',
  GEMINI_CLI = 'gemini-cli',
  MCP_STUDIO = 'mcp-studio'
}

export enum LaunchStrategy {
  PTY_SPAWN = 'pty_spawn',
  WEBSOCKET = 'websocket',
  IPC_BRIDGE = 'ipc_bridge'
}

export enum Platform {
  WINDOWS = 'windows',
  LINUX = 'linux',
  MACOS = 'macos'
}

export interface PlaygroundCapabilities {
  supportsMultiSession: boolean;
  supportsBackground: boolean;
  supportsProviderInjection: boolean;
  supportsWorkspace: boolean;
  requiredShell: string[];
  supportedPlatforms: Platform[];
}

export interface PlaygroundManifest {
  id: string;
  name: string;
  runtimeType: RuntimeType;
  icon: string;
  capabilities: PlaygroundCapabilities;
  launchStrategy: LaunchStrategy;
  healthCheck: () => Promise<RuntimeHealth>;
}

export enum RuntimeStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  SUSPENDED = 'suspended',
  ERROR = 'error',
  TERMINATING = 'terminating'
}

export enum SessionStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
  ERROR = 'error'
}

export enum StreamType {
  TERMINAL = 'terminal',
  AGENT = 'agent',
  MCP = 'mcp',
  WEBSOCKET = 'websocket'
}

export enum StreamStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

export interface RuntimeConfig {
  id: string;
  runtimeType: RuntimeType;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  provider?: ProviderConfig;
  workspace?: string;
}

export interface ProviderConfig {
  name: string;
  model?: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SessionConfig {
  id: string;
  name: string;
  runtimeId: string;
  provider?: ProviderConfig;
  workspace?: string;
  shell?: string;
  env?: Record<string, string>;
}

export interface StreamConfig {
  id: string;
  type: StreamType;
  sessionId: string;
  encoding?: string;
  bufferSize?: number;
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkLatency?: number;
  lastCheck: Date;
  uptime?: number;
  error?: Error;
}

export interface RuntimeMetrics {
  sessionId: string;
  runtimeId: string;
  startTime: Date;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkBytesIn: number;
  networkBytesOut: number;
  activeStreams: number;
  totalCommands: number;
  errors: number;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface PTYHandle {
  id: string;
  pid: number;
  shell: string;
  cwd: string;
  env: Record<string, string>;
  size: TerminalSize;
  
  // Stream management
  stdin: WritableStream<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
  
  // Process control
  resize(size: TerminalSize): Promise<void>;
  kill(signal?: number): Promise<void>;
  wait(): Promise<number>;
  
  // Event handling
  on(event: PTYEvent, handler: PTYEventHandler): void;
  off(event: PTYEvent, handler: PTYEventHandler): void;
}

export interface RuntimeSession {
  id: string;
  runtimeId: string;
  status: SessionStatus;
  config: SessionConfig;
  pty: PTYHandle;
  streams: Map<string, RuntimeStream>;
  
  created: Date;
  lastActivity: Date;
  
  // Lifecycle methods
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
}

export interface RuntimeStream {
  id: string;
  sessionId: string;
  type: StreamType;
  status: StreamStatus;
  config: StreamConfig;
  
  // Bidirectional communication
  input: WritableStream<any>;
  output: ReadableStream<any>;
  
  // Stream control
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
}

export interface PTYEvent {
  type: 'data' | 'exit' | 'resize' | 'error';
  data?: string;
  code?: number;
  size?: TerminalSize;
  error?: Error;
}

export type PTYEventHandler = (event: PTYEvent) => void;

// Re-export PlaygroundRuntime for runtime classes
export { PlaygroundRuntime } from './PlaygroundRuntime';

// Export all interfaces for runtime classes
export type { PTYEventHandler } from './PlaygroundRuntime';
