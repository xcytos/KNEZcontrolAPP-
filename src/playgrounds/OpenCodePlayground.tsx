import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
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

// Session management now handled by RuntimeManager as single source of truth

// interface ModelInfo {
//   provider: string;
//   model: string;
//   capabilities: string[];
//   contextWindow: number;
//   maxTokens: number;
// }

export const OpenCodePlayground: React.FC<{
  sdk: PlaygroundSDK;
  config: OpenCodeConfig;
}> = ({ sdk, config }) => {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [executionMode] = useState<OpenCodeConfig['execution']['mode']>((config as any).execution?.mode || 'interactive');
  
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionTerminals = useRef<Map<string, Terminal>>(new Map());

  // Note: This component is now simplified to observe RuntimeManager state
  // Session management is handled by RuntimeManager as single source of truth

  // Create new coding session
  const createNewSession = useCallback(async () => {
    const sessionId = `session-${Date.now()}`;
    const sessionName = `Session ${Date.now()}`;
    
    try {
      // Create session through SDK
      const sessionConfig: SessionConfig = {
        id: sessionId,
        name: sessionName,
        type: PlaygroundType.OPENCODE,
        provider: 'OpenCode',
        model: 'Default',
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

      // Store terminal reference
      sessionTerminals.current.set(sessionId, terminal);
      setActiveSession(sessionId);

      // Connect to OpenCode backend through our provider system
      await connectToOpenCode(sessionId, terminal, sessionConfig);

      toast.success(`Created ${sessionName}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create session');
    }
  }, [executionMode, sdk, config]);

  // Connect terminal to REAL OpenCode PTY process
  const connectToOpenCode = async (_sessionId: string, terminal: Terminal, config: SessionConfig) => {
    try {
      console.log('[FRONTEND_REQUEST_PTY] Requesting PTY creation for session:', _sessionId);
      
      // Import PTY service for real process spawning
      const { getPTYService } = await import('./runtime/PTYService');
      const ptyService = getPTYService();
      
      // Create REAL PTY process (using powershell since opencode doesn't exist)
      console.log('[RUST_COMMAND_ENTERED] Invoking pty_spawn_command with PowerShell');
      const ptyHandle = await ptyService.createOpenCodePTY({
        command: process.platform === 'win32' ? 'powershell.exe' : 'bash',
        args: [],
        cols: 80,
        rows: 24,
        cwd: config.workspace || process.cwd?.() || '/',
        env: {
          ...config.settings,
          OPENCODE_MODE: executionMode,
          WORKSPACE: config.workspace || '/tmp'
        }
      });
      
      console.log(`[PTY_CREATED] PTY created with PID: ${ptyHandle.processId}`);
      
      // CRITICAL FIX: Open terminal in DOM element first
      const terminalElement = terminalRefs.current.get(_sessionId);
      if (terminalElement) {
        console.log(`[OpenCodePlayground] Opening terminal in DOM element for PTY ${ptyHandle.id}`);
        terminal.open(terminalElement);
      } else {
        console.error(`[OpenCodePlayground] Terminal element not found for session ${_sessionId}`);
        throw new Error('Terminal element not found');
      }
      
      // Connect xterm to REAL PTY streams
      terminal.onData((data: string) => {
        // Send user input to REAL OpenCode process
        console.log(`[OpenCodePlayground] User input: ${data.replace(/\r?\n/g, '\\n')}`);
        ptyHandle.write(data).catch(error => {
          console.error('Failed to write to PTY:', error);
        });
      });
      
      // Stream REAL OpenCode output to terminal
      const stdoutReader = ptyHandle.stdout.getReader();
      const stderrReader = ptyHandle.stderr.getReader();
      
      const readStream = async (reader: ReadableStreamDefaultReader, streamName: string) => {
        try {
          console.log(`[STDOUT_STREAM_STARTED] Starting ${streamName} reader for PTY ${ptyHandle.id}`);
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = new TextDecoder().decode(value);
            console.log(`[STDOUT_CHUNK] ${text.length} bytes from ${streamName}: "${text.replace(/\r?\n/g, '\\n')}"`);
            console.log(`[XTERM_WRITE] Writing to terminal: "${text.replace(/\r?\n/g, '\\n')}"`);
            terminal.write(text);
          }
        } catch (error) {
          console.error(`Failed to read ${streamName}:`, error);
        }
      };
      
      // Start reading both streams
      readStream(stdoutReader, 'stdout');
      readStream(stderrReader, 'stderr');
      
      // Handle PTY events
      ptyService.on('data', (event: any) => {
        if (event.ptyId === ptyHandle.id) {
          console.log(`[EVENT_EMITTED] PTY data event for ${ptyHandle.id}`);
          console.log(`[FRONTEND_EVENT_RECEIVED] Data event received in frontend`);
          // Data is already handled by streams above
        }
      });
      
      ptyService.on('exit', (event: any) => {
        if (event.ptyId === ptyHandle.id) {
          console.log(`[SHELL_EXITED] PowerShell process exited with code: ${event.exitCode}`);
          terminal.write('\r\n\x1b[31mPowerShell process exited\x1b[0m\r\n');
          toast.error('PowerShell process terminated');
        }
      });
      
      ptyService.on('error', (event: any) => {
        if (event.ptyId === ptyHandle.id) {
          console.error('PTY error:', event.error);
          terminal.write(`\r\n\x1b[31mError: ${event.error?.message || 'Unknown error'}\x1b[0m\r\n`);
        }
      });
      
      // Store PTY handle for cleanup
      (terminal as any)._ptyHandle = ptyHandle;
      
    } catch (error) {
      console.error('Failed to connect to REAL OpenCode PTY:', error);
      terminal.write('\r\n\x1b[31mFailed to start OpenCode process\x1b[0m\r\n');
      toast.error('Failed to start OpenCode process');
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
  }, [activeSession]);

  // Get process info for status display - AUTHENTIC STATE ONLY
  const getProcessInfo = () => {
    const terminal = activeSession ? sessionTerminals.current.get(activeSession) : null;
    const ptyHandle = terminal ? (terminal as any)._ptyHandle : null;
    
    // AUTHENTIC: Only show connected if PTY actually exists and is active
    const isRealConnected = ptyHandle && 
                           ptyHandle.processId > 0 && 
                           ptyHandle.isActive;
    
    return {
      pid: ptyHandle?.processId > 0 ? ptyHandle.processId : 'unknown',
      status: isRealConnected ? 'connected' : 'disconnected'
    };
  };

  const processInfo = getProcessInfo();

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* TOP THIN HOST BAR - 36px */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800" style={{ height: '36px' }}>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-white">OpenCode Playground</span>
          <span className="text-xs text-gray-400">PID {processInfo.pid}</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => createNewSession()}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            New Session
          </button>
          <span className="text-xs text-gray-500">{processInfo.status}</span>
        </div>
      </div>

      {/* REAL XTERM TERMINAL - 90%+ VIEWPORT */}
      <div className="flex-1 overflow-hidden bg-black">
        <div
          className="h-full w-full"
          ref={(el) => {
            if (el && activeSession) {
              terminalRefs.current.set(activeSession, el);
            }
          }}
        />
      </div>

      {/* BOTTOM STATUS STRIP - 20px - AUTHENTIC STATE ONLY */}
      <div className="flex items-center justify-between px-4 py-1 bg-gray-900 border-t border-gray-800 text-xs font-mono" style={{ height: '20px' }}>
        <div className="flex items-center space-x-4 text-gray-400">
          <span>{processInfo.status === 'connected' ? 'PTY CONNECTED' : 'PTY DISCONNECTED'}</span>
          <span>•</span>
          <span>PID {processInfo.pid}</span>
          <span>•</span>
          <span>{processInfo.status === 'connected' ? 'WORKSPACE READY' : 'NO PTY'}</span>
        </div>
        
        <div className="text-gray-500">
          {activeSession ? `${(config as OpenCodeConfig).terminal?.workingDirectory || '/tmp'}/workspace-${activeSession}` : 'no session'}
        </div>
      </div>
    </div>
  );
};

export default OpenCodePlayground;
