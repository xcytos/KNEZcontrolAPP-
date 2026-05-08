import { 
  RuntimeConfig,
  RuntimeType,
  Platform,
  PTYHandle,
  RuntimeMetrics
} from './PlaygroundTypes';
import { PlaygroundRuntime } from './PlaygroundRuntime';

export class OpenCodeRuntime extends PlaygroundRuntime {
  constructor() {
    super({
      id: 'opencode',
      name: 'OpenCode',
      runtimeType: 'opencode' as RuntimeType,
      icon: 'code',
      capabilities: {
        supportsMultiSession: true,
        supportsBackground: true,
        supportsProviderInjection: true,
        supportsWorkspace: true,
        requiredShell: ['bash', 'zsh', 'powershell', 'cmd'],
        supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
      },
      launchStrategy: 'pty_spawn' as any,
      healthCheck: async () => {
        return { status: 'healthy', lastCheck: new Date() };
      }
    });
  }

  async launch(config: RuntimeConfig): Promise<void> {
    console.log('OpenCode runtime launching with config:', config);
    // TODO: Implement actual OpenCode process launch
    this.setStatus('running' as any);
  }

  async attach(pty: PTYHandle): Promise<void> {
    console.log('OpenCode runtime attaching to PTY:', pty.id);
    // TODO: Implement PTY attachment
  }

  async suspend(): Promise<void> {
    console.log('OpenCode runtime suspending');
    // TODO: Implement suspension
  }

  async resume(): Promise<void> {
    console.log('OpenCode runtime resuming');
    // TODO: Implement resumption
  }

  async dispose(): Promise<void> {
    console.log('OpenCode runtime disposing');
    // TODO: Implement disposal
  }

  protected async doStart(): Promise<void> {
    console.log('OpenCode runtime starting');
    // TODO: Implement start logic
  }

  protected async doStop(): Promise<void> {
    console.log('OpenCode runtime stopping');
    // TODO: Implement stop logic
  }

  async getMetrics(): Promise<RuntimeMetrics> {
    return {
      sessionId: '',
      runtimeId: 'opencode',
      startTime: new Date(),
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkBytesIn: 0,
      networkBytesOut: 0,
      activeStreams: 0,
      totalCommands: 0,
      errors: 0
    };
  }
}
