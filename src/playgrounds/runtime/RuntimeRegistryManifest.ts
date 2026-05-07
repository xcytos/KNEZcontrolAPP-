import React from 'react';

/**
 * Runtime Registry Manifest
 * 
 * Authoritative mapping of runtime types to their loaders, components, and classes.
 * Eliminates hardcoded switch chains and provides dynamic runtime loading.
 */

export interface RuntimeManifest {
  type: string;
  name: string;
  description: string;
  platform: 'windows' | 'linux' | 'macos' | 'all';
  loader: () => Promise<any>;
  component: () => Promise<React.ComponentType<any>>;
  classPath?: string;
  dependencies?: string[];
  config?: Record<string, any>;
}

export const RUNTIME_REGISTRY_MANIFEST: Record<string, RuntimeManifest> = {
  // OpenCode Runtime - EXISTING
  opencode: {
    type: 'opencode',
    name: 'OpenCode Playground',
    description: 'AI-powered coding assistant with real PTY integration',
    platform: 'all',
    loader: async () => {
      // Use existing OpenCodeRuntime if available, otherwise create placeholder
      try {
        const module = await import('../OpenCodePlayground');
        return { default: module.default };
      } catch (error) {
        console.warn(`[RuntimeManifest] OpenCode runtime not found, using placeholder`);
        return { default: () => null };
      }
    },
    component: async () => {
      const module = await import('../OpenCodePlayground');
      return module.default;
    },
    dependencies: ['pty-service', 'xterm'],
    config: {
      terminal: {
        shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
        workingDirectory: '/tmp',
        theme: 'dark'
      },
      execution: {
        mode: 'interactive',
        autoSave: false
      }
    }
  },

  // ClaudeCode Runtime - PLACEHOLDER (404 fix)
  claudcode: {
    type: 'claudcode',
    name: 'ClaudeCode Playground',
    description: 'Anthropic Claude Code integration with real terminal',
    platform: 'all',
    loader: async () => {
      console.warn(`[RuntimeManifest] ClaudeCode runtime not implemented yet`);
      return { default: () => null };
    },
    component: async () => {
      // Return fallback component for now
      return () => React.createElement('div', null, 'ClaudeCode Playground - Coming Soon');
    },
    dependencies: ['pty-service', 'xterm'],
    config: {
      terminal: {
        shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
        workingDirectory: '/tmp',
        theme: 'dark'
      }
    }
  },

  // MCP Runtime - PLACEHOLDER (404 fix)
  mcp: {
    type: 'mcp',
    name: 'MCP Playground',
    description: 'Model Context Protocol integration playground',
    platform: 'all',
    loader: async () => {
      console.warn(`[RuntimeManifest] MCP runtime not implemented yet`);
      return { default: () => null };
    },
    component: async () => {
      return () => React.createElement('div', null, 'MCP Playground - Coming Soon');
    },
    dependencies: ['mcp-client', 'pty-service'],
    config: {
      mcp: {
        serverTimeout: 30000,
        maxConnections: 5
      }
    }
  },

  // Chat Runtime - PLACEHOLDER (404 fix)
  chat: {
    type: 'chat',
    name: 'Chat Playground',
    description: 'AI chat interface with tool execution',
    platform: 'all',
    loader: async () => {
      console.warn(`[RuntimeManifest] Chat runtime not implemented yet`);
      return { default: () => null };
    },
    component: async () => {
      return () => React.createElement('div', null, 'Chat Playground - Coming Soon');
    },
    dependencies: ['chat-service', 'tool-execution'],
    config: {
      chat: {
        maxTokens: 4096,
        temperature: 0.7
      }
    }
  }
};

export class RuntimeRegistry {
  private static instance: RuntimeRegistry;
  private loadedRuntimes: Map<string, any> = new Map();
  private loadedComponents: Map<string, React.ComponentType<any>> = new Map();

  static getInstance(): RuntimeRegistry {
    if (!RuntimeRegistry.instance) {
      RuntimeRegistry.instance = new RuntimeRegistry();
    }
    return RuntimeRegistry.instance;
  }

  // Get runtime manifest by type
  getManifest(runtimeType: string): RuntimeManifest | undefined {
    return RUNTIME_REGISTRY_MANIFEST[runtimeType];
  }

  // Check if runtime type is supported
  isRuntimeSupported(runtimeType: string): boolean {
    const manifest = RUNTIME_REGISTRY_MANIFEST[runtimeType];
    if (!manifest) return false;

    // Check platform compatibility
    if (manifest.platform !== 'all' && manifest.platform !== process.platform) {
      return false;
    }

    return true;
  }

  // Load runtime class dynamically
  async loadRuntimeClass(runtimeType: string): Promise<any> {
    if (this.loadedRuntimes.has(runtimeType)) {
      return this.loadedRuntimes.get(runtimeType);
    }

    const manifest = this.getManifest(runtimeType);
    if (!manifest) {
      throw new Error(`Runtime ${runtimeType} not found in manifest`);
    }

    try {
      console.log(`[RuntimeRegistry] Loading runtime class for ${runtimeType}`);
      const RuntimeClass = await manifest.loader();
      this.loadedRuntimes.set(runtimeType, RuntimeClass);
      return RuntimeClass;
    } catch (error) {
      console.error(`[RuntimeRegistry] Failed to load runtime ${runtimeType}:`, error);
      throw new Error(`Failed to load runtime ${runtimeType}: ${error}`);
    }
  }

  // Load React component dynamically
  async loadRuntimeComponent(runtimeType: string): Promise<React.ComponentType<any>> {
    if (this.loadedComponents.has(runtimeType)) {
      return this.loadedComponents.get(runtimeType)!;
    }

    const manifest = this.getManifest(runtimeType);
    if (!manifest) {
      throw new Error(`Runtime ${runtimeType} not found in manifest`);
    }

    try {
      console.log(`[RuntimeRegistry] Loading component for ${runtimeType}`);
      const component = await manifest.component();
      this.loadedComponents.set(runtimeType, component);
      return component;
    } catch (error) {
      console.error(`[RuntimeRegistry] Failed to load component ${runtimeType}:`, error);
      throw new Error(`Failed to load component ${runtimeType}: ${error}`);
    }
  }

  // Get all available runtime types
  getAvailableRuntimes(): string[] {
    return Object.keys(RUNTIME_REGISTRY_MANIFEST).filter(type => 
      this.isRuntimeSupported(type)
    );
  }

  // Get runtime config
  getRuntimeConfig(runtimeType: string): Record<string, any> {
    const manifest = this.getManifest(runtimeType);
    return manifest?.config || {};
  }

  // Clear cached runtimes (useful for development)
  clearCache(): void {
    this.loadedRuntimes.clear();
    this.loadedComponents.clear();
  }
}

export default RuntimeRegistry;
