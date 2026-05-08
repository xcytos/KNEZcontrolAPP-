import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';
import { getTerminalManager } from './TerminalRuntimeManager';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundConfig } from '../domain/PlaygroundTypes';

interface OpenCodePlaygroundProps {
  sdk: PlaygroundSDK;
  config: PlaygroundConfig;
  isActive?: boolean;
}

export const OpenCodePlayground: React.FC<OpenCodePlaygroundProps> = ({ 
  sdk: _sdk, 
  config: _config,
  isActive
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ptyHandle, setPtyHandle] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected' | 'spawning'>('connecting');
  const [sessionId, setSessionId] = useState<string>('');
  const handleResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isActive && handleResizeRef.current) {
      // Small delay to ensure the DOM has finished its layout transition
      setTimeout(() => {
        handleResizeRef.current?.();
      }, 50);
    }
  }, [isActive]);

  useEffect(() => {
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let cleanup: (() => void) | null = null;
    let unlistenPtyOutput: (() => void) | null = null;
    let localPty: any = null;
    let localIsConnected = false;
    let isUnmounted = false;
    let currentSessionId = '';

    const initializeTerminal = async () => {
      if (!terminalRef.current) return;

      setStatus('spawning');

      // Create xterm.js instance
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selectionBackground: '#444444',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#79d8ff',
          magenta: '#bd93f9',
          cyan: '#8be9fd',
          white: '#bfbfbf',
          brightBlack: '#4d4d4d',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#b6d7ff',
          brightMagenta: '#d6acff',
          brightCyan: '#69ffff',
          brightWhite: '#ffffff'
        },
        cols: 80,
        rows: 24,
        scrollback: 10000,
        tabStopWidth: 4,
      });

      // Add addons
      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Mount terminal
      terminal.open(terminalRef.current);

      // Store references
      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Defer first fit until the container has committed layout
      await new Promise<void>(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      ));
      try { fitAddon.fit(); } catch { /* ignore pre-layout errors */ }

      // Handle terminal resize
      const handleResize = () => {
        if (fitAddon && terminal && terminalRef.current && terminalRef.current.offsetHeight > 0) {
          try {
            fitAddon.fit();
            
            // Resize PTY if connected
            if (ptyHandle && isConnected) {
              ptyHandle.resize(terminal.cols, terminal.rows).catch((error: any) => {
                console.warn('Failed to resize OpenCode PTY:', error);
              });
            }
            // Force a refresh of the terminal renderer
            terminal.refresh(0, terminal.rows - 1);
          } catch (error) {
            console.error('Failed to handle terminal resize:', error);
          }
        }
      };

      handleResizeRef.current = handleResize;
      window.addEventListener('resize', handleResize);
      
      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }

      // Handle terminal input
      terminal.onData((data) => {
        if (localPty && localIsConnected) {
          try {
            localPty.write(data);
          } catch (error) {
            console.error('Failed to write to OpenCode PTY:', error);
          }
        }
      });

      // Spawn terminal and connect
      try {
        const terminalManager = getTerminalManager();
        
        currentSessionId = `opencode-${Date.now()}`;
        setSessionId(currentSessionId);
        
        const session = await terminalManager.createOpenCodeTerminal(currentSessionId, {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: 'C:\\Users\\' // Windows-compatible default directory
        });

        const pty = terminalManager.getPTY(session.ptyId);
        if (!pty) {
          throw new Error('PTY not found after session creation');
        }

        localPty = pty;
        localIsConnected = true;

        setPtyHandle(pty);
        setPid(session.pid);
        setIsConnected(true);
        setStatus('connected');

        if (isUnmounted) {
          await terminalManager.destroyTerminal(currentSessionId);
          terminal.dispose();
          return;
        }

        // Listen for output
        listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (event.payload.pty_id !== pty.id || !terminal) return;
          try { terminal.write(event.payload.data); } catch { /* disposed */ }
        }).then(fn => { unlistenPtyOutput = fn; }).catch(err => {
          console.error('[OpenCodePlayground] Failed to subscribe pty-output:', err);
        });

        // Handle PTY exit/errors through PTYService lifecycle events
        const { getPTYService } = await import('./runtime/PTYService');
        const ptyService = getPTYService();

        ptyService.on('exit', (event: any) => {
          if (event.ptyId === localPty?.id) {
            console.log(`[OPENCODE_EXITED] Process exited with code: ${event.exitCode}`);
            localIsConnected = false;
            setIsConnected(false);
            setStatus('disconnected');
            setPid(null);
            if (terminal) {
              terminal.write('\r\n\x1b[31m[OpenCode Process Terminated]\x1b[0m\r\n');
            }
          }
        });

        ptyService.on('error', (event: any) => {
          if (event.ptyId === localPty?.id) {
            console.error('OpenCode PTY error:', event.error);
            if (terminal) {
              terminal.write(`\r\n\x1b[31m[ERROR] ${event.error?.message || 'Unknown error'}\x1b[0m\r\n`);
            }
          }
        });

      } catch (error) {
        console.error('Failed to initialize OpenCode terminal:', error);
        setStatus('error');
        if (terminal) {
          terminal.write(`\r\n\x1b[31m[FAILED TO SPAWN OPENCODE] ${error}\x1b[0m\r\n`);
        }
      }

      cleanup = async () => {
        window.removeEventListener('resize', handleResize);
        if (resizeObserver) resizeObserver.disconnect();
        if (unlistenPtyOutput) { unlistenPtyOutput(); unlistenPtyOutput = null; }

        const terminalManager = getTerminalManager();
        try {
          if (currentSessionId) {
            await terminalManager.destroyTerminal(currentSessionId);
          }
        } catch (error) {
          console.error('Failed to destroy terminal via manager:', error);
          if (localPty) {
            localPty.destroy();
          }
        }
        
        if (terminal) {
          terminal.dispose();
        }
      };
    };

    initializeTerminal();

    return () => {
      isUnmounted = true;
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

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#000000' }}>
      {/* Header with status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '8px 16px',
        backgroundColor: '#111111',
        borderBottom: '1px solid #333333',
        height: '36px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>OpenCode AI TUI</span>
          <span style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
            PID {pid || '...'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%',
              backgroundColor: status === 'connected' ? '#3fb950' : 
                             status === 'spawning' ? '#d29922' : '#f85149',
              boxShadow: status === 'connected' ? '0 0 8px rgba(63, 185, 80, 0.4)' : 'none'
            }} />
            <span style={{ fontSize: '12px', color: '#8b949e', textTransform: 'capitalize' }}>
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Container */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          backgroundColor: '#000000',
          position: 'relative',
          padding: '4px'
        }}
      >
        <div 
          ref={terminalRef} 
          style={{ width: '100%', height: '100%' }} 
          className="terminal-container"
        />
      </div>

      {/* Footer Status Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 16px',
        backgroundColor: '#111111',
        borderTop: '1px solid #333333',
        height: '24px',
        flexShrink: 0,
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#8b949e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: isConnected ? '#3fb950' : '#8b949e' }}>
            {isConnected ? 'PTY CONNECTED' : 'PTY DISCONNECTED'}
          </span>
          <span>•</span>
          <span>{sessionId || 'no session'}</span>
        </div>
      </div>
    </div>
  );
};

export default OpenCodePlayground;
