import { 
  PlaygroundManifest, 
  RuntimeConfig, 
  RuntimeType,
  // PlaygroundCapabilities,
  Platform,
  LaunchStrategy 
} from './PlaygroundManifest';

export class PlaygroundRegistry {
  private manifests: Map<string, PlaygroundManifest>;
  private runtimes: Map<string, any>; // Will be typed as PlaygroundRuntime when imported

  constructor() {
    this.manifests = new Map();
    this.runtimes = new Map();
  }

  // Registration
  register(manifest: PlaygroundManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  unregister(runtimeId: string): void {
    this.runtimes.delete(runtimeId);
  }

  // Discovery
  getManifest(runtimeId: string): PlaygroundManifest | undefined {
    return this.manifests.get(runtimeId);
  }

  getAllManifests(): PlaygroundManifest[] {
    return Array.from(this.manifests.values());
  }

  getAvailableRuntimes(): PlaygroundManifest[] {
    return Array.from(this.manifests.values()).filter(
      manifest => this.isPlatformSupported(manifest)
    );
  }

  // Runtime management
  async createRuntime(runtimeId: string, _config: RuntimeConfig): Promise<any> {
    const manifest = this.manifests.get(runtimeId);
    if (!manifest) {
      throw new Error(`Runtime ${runtimeId} not found`);
    }

    // Dynamically import runtime class
    const RuntimeClass = await this.loadRuntimeClass(runtimeId);
    const runtime = new RuntimeClass(manifest);
    
    this.runtimes.set(runtimeId, runtime);
    return runtime;
  }

  getRuntime(runtimeId: string): any | undefined {
    return this.runtimes.get(runtimeId);
  }

  getAllRuntimes(): any[] {
    return Array.from(this.runtimes.values());
  }

  // Platform support check
  private isPlatformSupported(manifest: PlaygroundManifest): boolean {
    const currentPlatform = this.detectPlatform();
    return manifest.capabilities.supportedPlatforms.includes(currentPlatform);
  }

  private detectPlatform(): Platform {
    if (typeof window !== 'undefined') {
      // Browser environment
      return Platform.WINDOWS; // Default assumption
    }
    
    if (typeof process !== 'undefined') {
      const platform = process.platform;
      switch (platform) {
        case 'win32':
          return Platform.WINDOWS;
        case 'linux':
          return Platform.LINUX;
        case 'darwin':
          return Platform.MACOS;
        default:
          return Platform.WINDOWS; // Default
      }
    }
    
    return Platform.WINDOWS; // Default
  }

  // Dynamic runtime loading
  private async loadRuntimeClass(runtimeId: string): Promise<any> {
    switch (runtimeId) {
      case RuntimeType.OPENCODE:
        const { OpenCodeRuntime } = await import('./OpenCodeRuntime');
        return OpenCodeRuntime;
      case RuntimeType.TERMINAL:
        const { TerminalRuntime } = await import('./TerminalRuntime');
        return TerminalRuntime;
      default:
        throw new Error(`Unknown runtime type: ${runtimeId}`);
    }
  }
}

// Built-in runtime manifests
export const BUILTIN_MANIFESTS: PlaygroundManifest[] = [
  {
    id: RuntimeType.TERMINAL,
    name: 'Terminal Playground',
    runtimeType: RuntimeType.TERMINAL,
    icon: 'terminal',
    capabilities: {
      supportsMultiSession: true,
      supportsBackground: true,
      supportsProviderInjection: false,
      supportsWorkspace: false,
      requiredShell: ['pwsh.exe', 'powershell.exe', 'cmd.exe'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.PTY_SPAWN,
    healthCheck: async () => {
      return { status: 'healthy', lastCheck: new Date() };
    }
  },
  {
    id: RuntimeType.OPENCODE,
    name: 'OpenCode',
    runtimeType: RuntimeType.OPENCODE,
    icon: 'code',
    capabilities: {
      supportsMultiSession: true,
      supportsBackground: true,
      supportsProviderInjection: true,
      supportsWorkspace: true,
      requiredShell: ['bash', 'zsh', 'powershell', 'cmd'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.PTY_SPAWN,
    healthCheck: async () => {
      // TODO: Implement OpenCode health check
      return { status: 'healthy', lastCheck: new Date() };
    }
  }
];
