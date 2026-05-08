import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Code, Settings, Plus, X } from 'lucide-react';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundType, PlaygroundConfig } from '../domain/PlaygroundTypes';
import OpenCodePlayground from './OpenCodePlayground';
import { TerminalPlayground } from './TerminalPlayground';
// Using native notifications for now - can be replaced with toast library later

interface PlaygroundInstance {
  id: string;
  type: PlaygroundType;
  name: string;
  component: React.ComponentType<{ sdk: PlaygroundSDK; config: any }>;
  config: PlaygroundConfig;
  status: 'loading' | 'active' | 'inactive' | 'error';
  lastActivity: Date;
}

interface PlaygroundContainerProps {
  sdk: PlaygroundSDK;
}

const PLAYGROUND_CONFIGS: Record<PlaygroundType, PlaygroundConfig> = {
  [PlaygroundType.TERMINAL]: {
    name: 'Terminal Playground',
    description: 'Real PTY terminal with shell integration',
    version: '1.0.0',
    author: 'KNEZ Team',
    capabilities: {
      supportsMultiSession: true,
      supportsBackgroundAgents: false,
      supportsFileAccess: true,
      supportsTerminalAccess: true,
      supportsNetworkAccess: false,
      supportsMCPTools: false
    },
    resourceRequirements: {
      minMemory: 256,
      maxMemory: 512,
      minCpuCores: 1,
      requiredPermissions: ['terminal', 'filesystem'],
      optionalPermissions: ['network']
    },
    ui: {
      theme: 'dark',
      layout: 'terminal-focused',
      compactMode: false,
      advancedMode: false
    },
    session: {
      type: PlaygroundType.TERMINAL,
      autoSave: false,
      persistence: false,
      sharing: false,
      isolation: 'session'
    },
    features: {
      multiSession: true,
      backgroundAgents: false,
      sessionSharing: false,
      darkMode: true,
      compactMode: false,
      advancedMode: false,
      debugMode: true,
      experimentalFeatures: false,
      betaFeatures: false,
      hardwareAcceleration: false,
      virtualization: false,
      caching: false
    }
  },
  [PlaygroundType.OPENCODE]: {
    name: 'OpenCode Playground',
    description: 'Terminal-native AI coding agent',
    version: '1.0.0',
    author: 'KNEZ Team',
    capabilities: {
      supportsMultiSession: true,
      supportsBackgroundAgents: true,
      supportsFileAccess: true,
      supportsTerminalAccess: true,
      supportsNetworkAccess: true,
      supportsMCPTools: true
    },
    resourceRequirements: {
      minMemory: 512,
      maxMemory: 2048,
      minCpuCores: 2,
      requiredPermissions: ['network', 'filesystem', 'terminal'],
      optionalPermissions: ['camera', 'microphone', 'system']
    },
    ui: {
      theme: 'dark',
      layout: 'terminal-focused',
      compactMode: false,
      advancedMode: true
    },
    session: {
      type: PlaygroundType.OPENCODE,
      autoSave: true,
      persistence: true,
      sharing: false,
      isolation: 'shared_workspace' as 'shared_workspace' | 'session' | 'shared_context' | 'full'
    },
    features: {
      multiSession: true,
      backgroundAgents: true,
      sessionSharing: true,
      darkMode: true,
      compactMode: false,
      advancedMode: true,
      debugMode: true,
      experimentalFeatures: true,
      betaFeatures: true,
      hardwareAcceleration: true,
      virtualization: true,
      caching: true
    }
  }
};

const PLAYGROUND_COMPONENTS: any = {
  [PlaygroundType.TERMINAL]: TerminalPlayground,
  [PlaygroundType.OPENCODE]: OpenCodePlayground,
};

const PLAYGROUND_ICONS: any = {
  [PlaygroundType.TERMINAL]: Monitor,
  [PlaygroundType.OPENCODE]: Code,
};

export const PlaygroundContainer: React.FC<PlaygroundContainerProps> = ({ sdk }) => {
  const [playgrounds, setPlaygrounds] = useState<PlaygroundInstance[]>(() => {
    try {
      const saved = localStorage.getItem('knez_opened_playgrounds');
      if (saved) {
        const types = JSON.parse(saved) as PlaygroundType[];
        return types.map(type => ({
          id: `${type}-${crypto.randomUUID()}`,
          type,
          name: PLAYGROUND_CONFIGS[type].name,
          component: PLAYGROUND_COMPONENTS[type],
          config: PLAYGROUND_CONFIGS[type],
          status: 'active',
          lastActivity: new Date()
        }));
      }
    } catch (e) {
      console.error('Failed to parse saved playgrounds', e);
    }
    return [];
  });
  
  const [activePlayground, setActivePlayground] = useState<string | null>(() => {
    return localStorage.getItem('knez_active_playground') || null;
  });
  const [showSettings, setShowSettings] = useState(false);

  // Sync state to localStorage
  useEffect(() => {
    const types = playgrounds.map(p => p.type);
    localStorage.setItem('knez_opened_playgrounds', JSON.stringify(types));
  }, [playgrounds]);

  useEffect(() => {
    if (activePlayground) {
      localStorage.setItem('knez_active_playground', activePlayground);
    } else {
      localStorage.removeItem('knez_active_playground');
    }
  }, [activePlayground]);

  // Load a playground
  const loadPlayground = useCallback(async (type: PlaygroundType) => {
    // Check if already loaded
    const existing = playgrounds.find(p => p.type === type);
    if (existing) {
      setActivePlayground(existing.id);
      return;
    }

    const config = PLAYGROUND_CONFIGS[type];
    const Component = PLAYGROUND_COMPONENTS[type];

    const newPlayground: PlaygroundInstance = {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      name: config.name,
      component: Component,
      config,
      status: 'loading',
      lastActivity: new Date()
    };

    setPlaygrounds(prev => [...prev, newPlayground]);
    setActivePlayground(newPlayground.id);

    try {
      // Initialize playground
      // Component will handle its own initialization through SDK
      setPlaygrounds(prev => prev.map(p => 
        p.id === newPlayground.id 
          ? { ...p, status: 'active' as const }
          : p
      ));

      console.log(`Loaded ${config.name}`);
    } catch (error) {
      console.error(`Failed to load ${config.name}:`, error);
      setPlaygrounds(prev => prev.map(p => 
        p.id === newPlayground.id 
          ? { ...p, status: 'error' as const }
          : p
      ));
      console.error(`Failed to load ${config.name}`);
    }
  }, [playgrounds]);

  // Unload a playground
  const unloadPlayground = useCallback((playgroundId: string) => {
    const playground = playgrounds.find(p => p.id === playgroundId);
    if (!playground) return;

    setPlaygrounds(prev => prev.filter(p => p.id !== playgroundId));
    if (activePlayground === playgroundId) {
      setActivePlayground(playgrounds.length > 1 ? playgrounds[0].id : null);
    }

    console.log(`Unloaded ${playground.name}`);
  }, [activePlayground, playgrounds]);

  // Initialize with Terminal playground
  useEffect(() => {
    const initializePlaygrounds = async () => {
      // Prevent double initialization if already loading or loaded
      if (playgrounds.length > 0) return;
      
      try {
        // Start with Terminal playground as default
        await loadPlayground(PlaygroundType.TERMINAL);
        console.log('Playground container initialized');
      } catch (error) {
        console.error('Failed to initialize playground container:', error);
      }
    };

    void initializePlaygrounds();
  }, [sdk, loadPlayground, playgrounds.length]);

  // Get active playground component
  const activePlaygroundInstance = playgrounds.find(p => p.id === activePlayground);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-white">Playground Runtime</h1>
          
          {/* Playground Tabs */}
          <div className="flex space-x-1">
            {playgrounds.map(p => ({
    ...p,
    Icon: PLAYGROUND_ICONS[p.type] || Settings,
  })).map((playground) => {
              const IconComponent = playground.Icon;
              return (
                <div
                  key={playground.id}
                  className={`flex items-center space-x-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                    activePlayground === playground.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => setActivePlayground(playground.id)}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="text-sm font-medium">{playground.name}</span>
                  
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full ${
                    playground.status === 'active' ? 'bg-green-400' :
                    playground.status === 'loading' ? 'bg-yellow-400 animate-pulse' :
                    playground.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                  }`} />
                  
                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unloadPlayground(playground.id);
                    }}
                    className="ml-1 p-1 hover:bg-white/10 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Add Playground Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Playground
            </button>
            
            {/* Playground Selection Dropdown */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Available Playgrounds
                  </div>
                  
                  {Object.values(PlaygroundType).map((type) => {
                    const config = PLAYGROUND_CONFIGS[type];
                    const Icon = PLAYGROUND_ICONS[type];
                    const isLoaded = playgrounds.some(p => p.type === type);
                    
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          loadPlayground(type);
                          setShowSettings(false);
                        }}
                        disabled={isLoaded}
                        className={`w-full flex items-center space-x-3 p-2 rounded text-left transition-colors ${
                          isLoaded
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'hover:bg-gray-700 text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{config.name}</div>
                          <div className="text-xs text-gray-400 truncate">{config.description}</div>
                        </div>
                        {isLoaded && (
                          <div className="text-xs text-green-400">Loaded</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Settings Button */}
          <button
            className="p-2 hover:bg-gray-800 rounded"
            onClick={() => {
              sdk.showDialog({
                title: 'Playground Settings',
                message: 'Configure playground runtime settings',
                type: 'info',
                buttons: [
                  { label: 'Close', value: 'close', style: 'primary' }
                ]
              });
            }}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Playground Content */}
      <div className="flex-1 overflow-hidden relative">
        {playgrounds.length > 0 ? (
          playgrounds.map(playground => {
            const Component = playground.component;
            return (
              <div 
                key={playground.id}
                style={{
                  visibility: activePlayground === playground.id ? 'visible' : 'hidden',
                  pointerEvents: activePlayground === playground.id ? 'auto' : 'none',
                  height: '100%',
                  width: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: activePlayground === playground.id ? 10 : 0
                }}
              >
                <Component sdk={sdk} config={playground.config} />
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <Monitor className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Playground Active</h2>
              <p className="text-gray-500 mb-6">Select a playground to get started</p>
              
              <button
                onClick={() => loadPlayground(PlaygroundType.TERMINAL)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Load Terminal Playground
              </button>
            </div>
            
            {/* Quick Start Options */}
            <div className="grid grid-cols-2 gap-4 mt-8 max-w-2xl">
              {Object.entries(PLAYGROUND_CONFIGS).slice(0, 4).map(([type, config]) => {
                const Icon = PLAYGROUND_ICONS[type as PlaygroundType];
                return (
                  <button
                    key={type}
                    onClick={() => loadPlayground(type as PlaygroundType)}
                    className="flex flex-col items-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Icon className="w-8 h-8 mb-2 text-blue-400" />
                    <div className="text-sm font-medium text-white">{config.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{config.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-gray-400">
              {playgrounds.filter(p => p.status === 'active').length} Active
            </span>
          </div>
          
          {activePlaygroundInstance && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Current:</span>
              <span className="text-white font-medium">{activePlaygroundInstance.name}</span>
            </div>
          )}
        </div>
        
        <div className="text-gray-400">
          Runtime v1.0.0 • {playgrounds.length} Playgrounds Loaded
        </div>
      </div>
    </div>
  );
};

export default PlaygroundContainer;
