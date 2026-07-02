import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { getTerminalManager } from './TerminalRuntimeManager';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundConfig } from '../domain/PlaygroundTypes';

interface TerminalPlaygroundProps {
  sdk: PlaygroundSDK;
  config: PlaygroundConfig;
  isActive?: boolean;
  headerVisible?: boolean;
}

export const TerminalPlayground: React.FC<TerminalPlaygroundProps> = ({ 
  sdk: _sdk, 
  config: _config,
  isActive,
  headerVisible = true
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ptyHandle, setPtyHandle] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'spawning' | 'connected' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string>('');
  const handleResizeRef = useRef<(() => void) | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isActive && handleResizeRef.current) {
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
        smoothScrollDuration: 150,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 14,
        fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
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

      // Mount terminal — FitAddon MUST be called after the browser layout pass,
      // not synchronously after open(), to avoid the scrollBarWidth crash.
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
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          if (fitAddon && terminal && terminalRef.current && terminalRef.current.offsetHeight > 0) {
            try {
              fitAddon.fit();

              if (ptyHandle && isConnected) {
                ptyHandle.resize(terminal.cols, terminal.rows).catch((error: any) => {
                  console.warn('Failed to resize PTY:', error);
                });
              }
              terminal.refresh(0, terminal.rows - 1);
            } catch (error) {
              console.error('Failed to handle terminal resize:', error);
            }
          }
        }, 150);
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
        
        currentSessionId = `terminal-${Date.now()}`;
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

        localPty = pty;
        localIsConnected = true;

        setPtyHandle(pty);
        setPid(session.pid);
        setIsConnected(true);
        setStatus('connected');

        if (isUnmounted) {
          // If component unmounted while we were spawning, destroy it immediately
          await terminalManager.destroyTerminal(currentSessionId);
          terminal.dispose();
          return;
        }

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

        // Set up PTY output directly via canonical Tauri event.
        // PTYService.on('data') was silently broken — it listened for 'pty-event'
        // but the Rust backend emits 'pty-output'.
        listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (event.payload.pty_id !== pty.id || !terminal) return;
          try { terminal.write(event.payload.data); } catch { /* disposed */ }
        }).then(fn => { unlistenPtyOutput = fn; }).catch(err => {
          console.error('[TerminalPlayground] Failed to subscribe pty-output:', err);
        });

        // Handle PTY exit/errors through PTYService lifecycle events
        const { getPTYService } = await import('./runtime/PTYService');
        const ptyService = getPTYService();

        // Handle PTY exit
        ptyService.on('exit', (event: any) => {
          if (event.ptyId === localPty?.id) {
            localIsConnected = false;
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
          if (event.ptyId === localPty?.id && terminal) {
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
        if (resizeObserver) resizeObserver.disconnect();
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        if (unlistenPtyOutput) { unlistenPtyOutput(); unlistenPtyOutput = null; }

        // Clean up terminal via TerminalRuntimeManager
        const terminalManager = getTerminalManager();
        try {
          if (currentSessionId) {
            await terminalManager.destroyTerminal(currentSessionId);
          }
        } catch (error) {
          console.error('Failed to destroy terminal via manager:', error);
          // Fallback: direct PTY cleanup
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
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117' }}>
      {headerVisible && (
      <div style={{ 
        padding: '6px 14px', 
        backgroundColor: '#161b22', 
        color: '#c9d1d9', 
        fontFamily: 'Cascadia Code, Consolas, monospace',
        fontSize: '12px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => handleResizeRef.current?.()}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#333333',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Force Terminal Refit"
          >
            <Activity size={12} />
            Refresh UI
          </button>

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
      </div>
      )}

      {/* Terminal */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div 
          ref={terminalRef} 
          style={{ 
            height: '100%', 
            width: '100%',
            backgroundColor: '#0d1117'
          }} 
        />
      </div>
    </div>
  );
};
