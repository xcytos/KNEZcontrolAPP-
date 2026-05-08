import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getTerminalManager } from './TerminalRuntimeManager';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundConfig } from '../domain/PlaygroundTypes';

interface TerminalPlaygroundProps {
  sdk: PlaygroundSDK;
  config: PlaygroundConfig;
}

export const TerminalPlayground: React.FC<TerminalPlaygroundProps> = ({ 
  sdk: _sdk, 
  config: _config 
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ptyHandle, setPtyHandle] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'spawning' | 'connected' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let cleanup: (() => void) | null = null;

    const initializeTerminal = async () => {
      if (!terminalRef.current) return;

      setStatus('spawning');

      // Create xterm.js instance
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#808080',
          brightRed: '#ff8080',
          brightGreen: '#80ff80',
          brightYellow: '#ffff80',
          brightBlue: '#8080ff',
          brightMagenta: '#ff80ff',
          brightCyan: '#80ffff',
          brightWhite: '#ffffff',
        },
        cols: 80,
        rows: 24,
        scrollback: 1000,
        tabStopWidth: 4,
      });

      // Add addons
      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Mount terminal
      terminal.open(terminalRef.current);
      fitAddon.fit();

      // Store references
      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle terminal resize
      const handleResize = () => {
        if (fitAddon && terminal) {
          try {
            fitAddon.fit();
            
            // Resize PTY if connected
            if (ptyHandle && isConnected) {
              ptyHandle.resize(terminal.cols, terminal.rows).catch((error: any) => {
                console.warn('Failed to resize PTY:', error);
              });
            }
          } catch (error) {
            console.error('Failed to handle terminal resize:', error);
          }
        }
      };

      window.addEventListener('resize', handleResize);

      // Handle terminal input
      terminal.onData((data) => {
        if (ptyHandle && isConnected) {
          try {
            ptyHandle.write(data);
          } catch (error) {
            console.error('Failed to write to PTY:', error);
            if (terminal) {
              terminal.write(`\r\n\x1b[31m[ERROR] Failed to send command\x1b[0m\r\n`);
            }
          }
        } else {
          if (terminal) {
            terminal.write(`\r\n\x1b[33m[NOT CONNECTED] Terminal not ready\x1b[0m\r\n`);
          }
        }
      });

      // Spawn terminal and connect
      try {
        const terminalManager = getTerminalManager();
        
        const currentSessionId = `terminal-${Date.now()}`;
        setSessionId(currentSessionId);
        
        const session = await terminalManager.createTerminal(currentSessionId, {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: 'C:\\Users\\' // Windows-compatible default directory
        });

        const pty = terminalManager.getPTY(session.ptyId);
        if (!pty) {
          throw new Error('PTY not found after session creation');
        }

        setPtyHandle(pty);
        setPid(session.pid);
        setIsConnected(true);
        setStatus('connected');

        // Debug Tauri backend availability
        const tauriAvailable = typeof window !== 'undefined' && window.__TAURI__;
        console.log(`[DEBUG] Tauri available: ${tauriAvailable}`);
        console.log(`[DEBUG] window.__TAURI__:`, window.__TAURI__);
        console.log(`[DEBUG] typeof window:`, typeof window);
        console.log(`[DEBUG] window object keys:`, Object.keys(window));
        console.log(`[DEBUG] __TAURI__ in window:`, '__TAURI__' in window);
        console.log(`[DEBUG] window.__TAURI__ type:`, typeof window.__TAURI__);
        
        // Try to access Tauri API directly
        if (window.__TAURI__) {
          console.log(`[DEBUG] __TAURI__ invoke:`, typeof window.__TAURI__.invoke);
          console.log(`[DEBUG] __TAURI__ methods:`, Object.getOwnPropertyNames(window.__TAURI__));
        }

        // Set up terminal manager events
        terminalManager.on('terminalCreated', (event: any) => {
          console.log('Terminal created:', event);
        });

        terminalManager.on('terminalDestroyed', (event: any) => {
          console.log('Terminal destroyed:', event);
        });

        // Set up PTY data streaming via PTYService
        const { getPTYService } = await import('./runtime/PTYService');
        const ptyService = getPTYService();
        
        ptyService.on('data', (event: any) => {
          if (event.ptyId === pty.id && terminal) {
            try {
              terminal.write(event.data);
            } catch (error) {
              console.error('Failed to write PTY data to terminal:', error);
            }
          }
        });

        // Handle PTY exit
        ptyService.on('exit', (event: any) => {
          if (event.ptyId === pty.id) {
            setIsConnected(false);
            setPid(null);
            setStatus('error');
            if (terminal) {
              terminal.write(`\r\n\x1b[33m[TERMINAL EXIT] Process exited\x1b[0m\r\n`);
            }
          }
        });

        // Handle PTY errors
        ptyService.on('error', (event: any) => {
          if (event.ptyId === pty.id && terminal) {
            const errorMsg = event.error?.message || 'Unknown PTY error';
            console.error('PTY Error:', errorMsg);
            terminal.write(`\r\n\x1b[31m[PTY ERROR] ${errorMsg}\x1b[0m\r\n`);
          }
        });

        // Show welcome message
        terminal.write(`\x1b[32m[TERMINAL CONNECTED] Shell: ${session.shell}\x1b[0m\r\n`);
        terminal.write(`\x1b[32m[SESSION ID] ${session.id}\x1b[0m\r\n`);
        terminal.write(`\x1b[32m[PID] ${session.pid}\x1b[0m\r\n`);
        terminal.write(`\x1b[36m[TERMINAL READY] Type commands below:\x1b[0m\r\n`);

      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        setStatus('error');
        if (terminal) {
          terminal.write(`\r\n\x1b[31m[FAILED TO SPAWN TERMINAL] ${error}\x1b[0m\r\n`);
          terminal.write(`\r\n\x1b[33m[ERROR] Tauri backend not available\x1b[0m\r\n`);
          terminal.write(`\x1b[33m[INFO] Terminal Playground requires Tauri environment\x1b[0m\r\n`);
          terminal.write(`\x1b[33m[INFO] Please run: npm run tauri dev\x1b[0m\r\n`);
        }
      }

      cleanup = async () => {
        window.removeEventListener('resize', handleResize);
        
        // Clean up terminal via TerminalRuntimeManager
        const terminalManager = getTerminalManager();
        try {
          if (sessionId) {
            await terminalManager.destroyTerminal(sessionId);
          }
        } catch (error) {
          console.error('Failed to destroy terminal via manager:', error);
          // Fallback: direct PTY cleanup
          if (ptyHandle) {
            ptyHandle.destroy();
          }
        }
        
        if (terminal) {
          terminal.dispose();
        }
      };
    };

    initializeTerminal();

    return () => {
      if (cleanup) {
        (async () => {
          try {
            await cleanup();
          } catch (error: unknown) {
            console.error('Cleanup error:', error);
          }
        })();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ptyHandle) {
        ptyHandle.destroy();
      }
    };
  }, [ptyHandle]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
      {/* Header with status */}
      <div style={{ 
        padding: '8px 12px', 
        backgroundColor: '#1a1a1a', 
        color: '#fff', 
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 'bold' }}>Terminal Playground</div>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>
            Platform: {typeof window !== 'undefined' ? navigator.platform : 'loading'} | PTY Backend: Tauri
          </div>
          {sessionId && (
            <div style={{ fontSize: '9px', opacity: 0.5 }}>
              Session: {sessionId.slice(-8)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>
            {status === 'connected' ? (
              <span style={{ color: '#00ff00' }}>● Connected</span>
            ) : status === 'spawning' ? (
              <span style={{ color: '#ffaa00' }}>● Spawning...</span>
            ) : status === 'error' ? (
              <span style={{ color: '#ff0000' }}>● Error</span>
            ) : (
              <span style={{ color: '#888888' }}>● Idle</span>
            )}
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>
            PID: {pid || 'N/A'} | Status: {status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div 
          ref={terminalRef} 
          style={{ 
            height: '100%', 
            width: '100%',
            backgroundColor: '#000000'
          }} 
        />
      </div>
    </div>
  );
};
