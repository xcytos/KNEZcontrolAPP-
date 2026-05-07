import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Play, Pause, Square, Settings, Terminal as TerminalIcon, Code, Cpu, Globe, Zap } from 'lucide-react';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { SessionConfig, PlaygroundConfig, PlaygroundType } from '../domain/PlaygroundTypes';
import { toast } from 'react-hot-toast';

interface OpenCodeConfig extends PlaygroundConfig {
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

interface OpenCodeSession {
  id: string;
  name: string;
  terminal: Terminal;
  workspace: string;
  provider: string;
  model: string;
  status: 'active' | 'paused' | 'stopped';
  createdAt: Date;
  lastActivity: Date;
}

interface ModelInfo {
  provider: string;
  model: string;
  capabilities: string[];
  contextWindow: number;
  maxTokens: number;
}

export const OpenCodePlayground: React.FC<{
  sdk: PlaygroundSDK;
  config: OpenCodeConfig;
}> = ({ sdk, config }) => {
  const [sessions, setSessions] = useState<OpenCodeSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [, ] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState((config as any).provider?.name || 'Default');
  const [selectedModel, setSelectedModel] = useState((config as any).provider?.model || 'Default');
  const [executionMode, setExecutionMode] = useState<OpenCodeConfig['execution']['mode']>((config as any).execution?.mode || 'interactive');
  const [showSettings, setShowSettings] = useState(false);
  
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionTerminals = useRef<Map<string, Terminal>>(new Map());

  // Initialize OpenCode playground
  useEffect(() => {
    const initializePlayground = async () => {
      try {
        // Load available models from our multi-provider system
        const models = await sdk.getModelRouter().getAvailableModels();
        setAvailableModels(models);
        
        // Initialize first session
        await createNewSession();
        
        toast.success('OpenCode playground initialized successfully');
      } catch (error) {
        console.error('Failed to initialize OpenCode playground:', error);
        toast.error('Failed to initialize OpenCode playground');
      }
    };

    void initializePlayground();
  }, [sdk]);

  // Create new coding session
  const createNewSession = useCallback(async () => {
    const sessionId = `session-${Date.now()}`;
    const sessionName = `Session ${sessions.length + 1}`;
    
    try {
      // Create session through SDK
      const sessionConfig: SessionConfig = {
        id: sessionId,
        name: sessionName,
        type: PlaygroundType.OPENCODE,
        provider: selectedProvider,
        model: selectedModel,
        workspace: `${(config as OpenCodeConfig).terminal?.workingDirectory || '/tmp'}/workspace-${sessionId}`,
        settings: {
          executionMode,
          autoSave: (config as OpenCodeConfig).execution?.autoSave || false,
          lspEnabled: (config as OpenCodeConfig).lsp?.enabled || false,
          theme: (config as OpenCodeConfig).terminal?.theme || 'dark'
        }
      };

      await sdk.createSession(sessionConfig);

      // Initialize terminal
      const terminal = new Terminal({
        theme: (config as OpenCodeConfig).terminal?.theme === 'dark' ? {
          background: '#1e1e1e',
          foreground: '#ffffff',
          cursor: '#ffffff',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#79d8ff',
          magenta: '#bd93f9',
          cyan: '#8be9fd',
          black: '#000000',
          white: '#bfbfbf',
          brightBlack: '#4d4d4d',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#b6d7ff',
          brightMagenta: '#d6acff',
          brightCyan: '#69ffff',
          brightWhite: '#ffffff'
        } : {
          background: '#ffffff',
          foreground: '#000000',
          cursor: '#000000',
          red: '#cc5555',
          green: '#55cc55',
          yellow: '#cccc55',
          blue: '#5555cc',
          magenta: '#cc55cc',
          cyan: '#55cccc',
          white: '#cccccc',
          brightBlack: '#555555',
          brightRed: '#ff5555',
          brightGreen: '#55ff55',
          brightYellow: '#ffffa5',
          brightBlue: '#5555ff',
          brightMagenta: '#ff55ff',
          brightCyan: '#55ffff',
          brightWhite: '#ffffff'
        },
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        tabStopWidth: 4
      });

      // Load terminal addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);

      const newSession: OpenCodeSession = {
        id: sessionId,
        name: sessionName,
        terminal,
        workspace: sessionConfig.workspace || '',
        provider: selectedProvider || 'unknown',
        model: selectedModel || 'unknown',
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      setSessions(prev => [...prev, newSession]);
      setActiveSession(sessionId);
      
      // Store terminal reference
      sessionTerminals.current.set(sessionId, terminal);

      // Connect to OpenCode backend through our provider system
      await connectToOpenCode(sessionId, terminal, sessionConfig);

      toast.success(`Created ${sessionName}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create session');
    }
  }, [sessions.length, selectedProvider, selectedModel, executionMode, sdk, config]);

  // Connect terminal to OpenCode backend
  const connectToOpenCode = async (sessionId: string, terminal: Terminal, config: SessionConfig) => {
    try {
      // Get stream controller from SDK
      const streamController = sdk.getStreamController();
      
      // Create bidirectional stream for OpenCode
      const stream = await streamController.createStream({
        type: 'opencode',
        sessionId,
        provider: selectedProvider || 'unknown',
        model: selectedModel || 'unknown',
        config: {
          shell: 'powershell',
          workingDirectory: config.workspace || '/tmp',
          executionMode,
          lspEnabled: config.lsp?.enabled || false,
          autoSave: config.execution?.autoSave || false
        }
      });

      // Handle incoming data from OpenCode
      stream.onData((data: any) => {
        if (data.type === 'terminal_output') {
          terminal.write(data.output);
        } else if (data.type === 'suggestion') {
          terminal.write(`\r\n\x1b[36m💡 Suggestion: ${data.suggestion}\x1b[0m\r\n`);
        } else if (data.type === 'error') {
          terminal.write(`\r\n\x1b[31m❌ Error: ${data.error}\x1b[0m\r\n`);
        }
      });

      // Handle terminal input
      terminal.onData((data: string) => {
        stream.write({
          type: 'terminal_input',
          data,
          timestamp: Date.now()
        });
      });

      // Send initial connection message
      stream.write({
        type: 'connect',
        sessionId,
        config: {
          provider: selectedProvider || 'unknown',
          model: selectedModel || 'unknown',
          executionMode
        }
      });

    } catch (error) {
      console.error('Failed to connect to OpenCode:', error);
      toast.error('Failed to connect to OpenCode backend');
    }
  };

  // Fit terminal to container
  useEffect(() => {
    if (activeSession && terminalRefs.current.has(activeSession)) {
      const terminal = sessionTerminals.current.get(activeSession);
      
      // Fit terminal to container
      setTimeout(() => {
        if (terminal) {
          const fitAddon = new FitAddon();
          terminal.loadAddon(fitAddon);
          fitAddon.fit();
        }
      }, 100);
    }
  }, [activeSession, sessions]);

  // Toggle session execution
  const toggleSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        const newStatus = session.status === 'active' ? 'paused' : 'active';
        return { ...session, status: newStatus };
      }
      return session;
    }));
  }, [activeSession, sessions]);

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId));
    if (activeSession === sessionId) {
      setActiveSession(sessions.length > 1 ? sessions[0].id : null);
    }
    
    // Clean up terminal
    const terminal = sessionTerminals.current.get(sessionId);
    if (terminal) {
      terminal.dispose();
      sessionTerminals.current.delete(sessionId);
    }
  }, [activeSession, sessions]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold">OpenCode Playground</h2>
          </div>
          
          {/* Provider/Model Selection */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {Array.from(new Set(availableModels.map(m => m.provider))).map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
            
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {availableModels
                .filter(m => m.provider === selectedProvider)
                .map(model => (
                  <option key={`${model.provider}:${model.model}`} value={model.model}>
                    {model.model}
                  </option>
                ))}
            </select>
          </div>

          {/* Execution Mode */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">Mode:</label>
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as OpenCodeConfig['execution']['mode'])}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="suggest">Suggest</option>
              <option value="confirm">Confirm</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => createNewSession()}
            className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            <Code className="w-4 h-4" />
            New Session
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session Tabs */}
      <div className="flex border-b border-gray-700">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center space-x-2 px-4 py-2 border-r border-gray-700 cursor-pointer ${
              activeSession === session.id ? 'bg-gray-800' : 'hover:bg-gray-800'
            }`}
            onClick={() => setActiveSession(session.id)}
          >
            <div className={`w-2 h-2 rounded-full ${
              session.status === 'active' ? 'bg-green-400' : 
              session.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            <span className="text-sm">{session.name}</span>
            <span className="text-xs text-gray-400">
              {session.provider}:{session.model}
            </span>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSession(session.id);
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                {session.status === 'active' ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden">
        {sessions.map((session) => (
          <div
            key={session.id}
            ref={(el) => {
              if (el) terminalRefs.current.set(session.id, el);
            }}
            className={`h-full ${activeSession === session.id ? 'block' : 'hidden'}`}
            style={{ padding: '8px' }}
          />
        ))}
        
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TerminalIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">No active sessions</p>
              <button
                onClick={() => createNewSession()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
              >
                Create First Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>{sessions.filter(s => s.status === 'active').length} active</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-green-400" />
            <span>{selectedProvider}:{selectedModel}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>{executionMode} mode</span>
          </div>
        </div>
        
        <div className="text-gray-400">
          {activeSession && (
            <span>
              Workspace: {sessions.find(s => s.id === activeSession)?.workspace}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenCodePlayground;
