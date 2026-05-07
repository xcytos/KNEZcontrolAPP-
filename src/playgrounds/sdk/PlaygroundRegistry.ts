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
        const { OpenCodeRuntime } = await import('./runtimes/OpenCodeRuntime');
        return OpenCodeRuntime;
      case RuntimeType.CLAUDECODE:
        const { ClaudeCodeRuntime } = await import('./runtimes/ClaudeCodeRuntime');
        return ClaudeCodeRuntime;
      case RuntimeType.AIDER:
        const { AiderRuntime } = await import('./runtimes/AiderRuntime');
        return AiderRuntime;
      case RuntimeType.GEMINI_CLI:
        const { GeminiCliRuntime } = await import('./runtimes/GeminiCliRuntime');
        return GeminiCliRuntime;
      case RuntimeType.MCP_STUDIO:
        const { McpStudioRuntime } = await import('./runtimes/McpStudioRuntime');
        return McpStudioRuntime;
      default:
        throw new Error(`Unknown runtime type: ${runtimeId}`);
    }
  }
}

// Built-in runtime manifests
export const BUILTIN_MANIFESTS: PlaygroundManifest[] = [
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
  },
  {
    id: RuntimeType.CLAUDECODE,
    name: 'ClaudeCode',
    runtimeType: RuntimeType.CLAUDECODE,
    icon: 'brain',
    capabilities: {
      supportsMultiSession: false,
      supportsBackground: true,
      supportsProviderInjection: true,
      supportsWorkspace: true,
      requiredShell: ['bash', 'zsh'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.PTY_SPAWN,
    healthCheck: async () => {
      // TODO: Implement ClaudeCode health check
      return { status: 'healthy', lastCheck: new Date() };
    }
  },
  {
    id: RuntimeType.AIDER,
    name: 'Aider',
    runtimeType: RuntimeType.AIDER,
    icon: 'wrench',
    capabilities: {
      supportsMultiSession: false,
      supportsBackground: false,
      supportsProviderInjection: true,
      supportsWorkspace: true,
      requiredShell: ['bash', 'zsh'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.PTY_SPAWN,
    healthCheck: async () => {
      // TODO: Implement Aider health check
      return { status: 'healthy', lastCheck: new Date() };
    }
  },
  {
    id: RuntimeType.GEMINI_CLI,
    name: 'Gemini CLI',
    runtimeType: RuntimeType.GEMINI_CLI,
    icon: 'sparkles',
    capabilities: {
      supportsMultiSession: false,
      supportsBackground: true,
      supportsProviderInjection: true,
      supportsWorkspace: true,
      requiredShell: ['bash', 'zsh'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.PTY_SPAWN,
    healthCheck: async () => {
      // TODO: Implement Gemini CLI health check
      return { status: 'healthy', lastCheck: new Date() };
    }
  },
  {
    id: RuntimeType.MCP_STUDIO,
    name: 'MCP Studio',
    runtimeType: RuntimeType.MCP_STUDIO,
    icon: 'layers',
    capabilities: {
      supportsMultiSession: true,
      supportsBackground: true,
      supportsProviderInjection: true,
      supportsWorkspace: true,
      requiredShell: ['bash', 'zsh', 'powershell'],
      supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS]
    },
    launchStrategy: LaunchStrategy.IPC_BRIDGE,
    healthCheck: async () => {
      // TODO: Implement MCP Studio health check
      return { status: 'healthy', lastCheck: new Date() };
    }
  }
];
