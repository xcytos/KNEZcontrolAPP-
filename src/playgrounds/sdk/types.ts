export interface PlaygroundManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  type: string;
  platform: string;
  main: string;
  config?: Record<string, any>;
}

export interface RuntimeConfig {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface RuntimeStatus {
  isRunning: boolean;
  uptime: number;
  memory: number;
  cpu: number;
}

export interface SessionConfig {
  id: string;
  name: string;
  runtimeId: string;
  config: RuntimeConfig;
}

export interface RuntimeSession {
  id: string;
  runtimeId: string;
  status: 'initializing' | 'running' | 'suspended' | 'terminated';
  config: SessionConfig;
  createdAt: Date;
  lastActivity: Date;
  pty?: any;
}

export interface SessionStatus {
  isActive: boolean;
  isAttached: boolean;
  hasStdio: boolean;
}

export interface StreamConfig {
  id: string;
  type: string;
  config: Record<string, any>;
}

export interface RuntimeStream {
  id: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  config: StreamConfig;
  data?: any;
}

export interface StreamStatus {
  isOpen: boolean;
  isReadable: boolean;
  isWritable: boolean;
  bytesReceived: number;
  bytesSent: number;
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: {
    responseTime: number;
    errorRate: number;
    uptime: number;
  };
}

export interface RuntimeMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface PTYHandle {
  id: string;
  processId: number;
  cols: number;
  rows: number;
  cwd: string;
  isActive: boolean;
  stdin: WritableStream<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
  resize: (cols: number, rows: number) => Promise<void>;
  kill: (signal?: number) => Promise<void>;
  write: (data: string) => Promise<void>;
  destroy: () => Promise<void>;
}
