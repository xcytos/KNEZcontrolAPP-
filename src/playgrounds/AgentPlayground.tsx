import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { getTerminalManager } from './TerminalRuntimeManager';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { AgentDefinition } from '../domain/AgentTypes';

interface AgentPlaygroundProps {
  sdk: PlaygroundSDK;
  agent: AgentDefinition;
  isActive?: boolean;
  headerVisible?: boolean;
}

export const AgentPlayground: React.FC<AgentPlaygroundProps> = ({
  sdk: _sdk,
  agent,
  isActive,
  headerVisible = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<'connecting' | 'spawning' | 'connected' | 'error' | 'disconnected'>('connecting');
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

      terminal = new Terminal({
        smoothScrollDuration: 150,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 14,
        fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: agent.color || '#58a6ff',
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

      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(terminalRef.current);

      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      await new Promise<void>(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      ));
      try { fitAddon.fit(); } catch { /* ignore pre-layout errors */ }

      const handleResize = () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          if (fitAddon && terminal && terminalRef.current && terminalRef.current.offsetHeight > 0) {
            try {
              fitAddon.fit();
              if (localPty && localIsConnected) {
                localPty.resize(terminal.cols, terminal.rows).catch((error: any) => {
                  console.warn(`[AgentPlayground:${agent.id}] Failed to resize PTY:`, error);
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

      terminal.onData((data) => {
        if (localPty && localIsConnected) {
          try {
            localPty.write(data);
          } catch (error) {
            console.error('Failed to write to PTY:', error);
          }
        }
      });

      try {
        const terminalManager = getTerminalManager();

        currentSessionId = `agent-${agent.id}-${Date.now()}`;

        const launchCmd = [...agent.launchCommand, ...(agent.launchArgs || [])];
        const session = await terminalManager.createAgentTerminal(currentSessionId, {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: agent.workingDirectory || 'C:\\Users\\',
          env: agent.environment,
          agentLaunchCommand: launchCmd,
        });

        const pty = terminalManager.getPTY(session.ptyId);
        if (!pty) {
          throw new Error('PTY not found after session creation');
        }

        localPty = pty;
        localIsConnected = true;

        setPid(session.pid);
        setStatus('connected');

        if (isUnmounted) {
          await terminalManager.destroyTerminal(currentSessionId);
          terminal.dispose();
          return;
        }

        listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (event.payload.pty_id !== pty.id || !terminal) return;
          try { terminal.write(event.payload.data); } catch { /* disposed */ }
        }).then(fn => { unlistenPtyOutput = fn; }).catch(err => {
          console.error(`[AgentPlayground:${agent.id}] Failed to subscribe pty-output:`, err);
        });

        const { getPTYService } = await import('./runtime/PTYService');
        const ptyService = getPTYService();

        ptyService.on('exit', (event: any) => {
          if (event.ptyId === localPty?.id) {
            localIsConnected = false;
            setStatus('disconnected');
            setPid(null);
            if (terminal) {
              terminal.write(`\r\n\x1b[33m[${agent.name} EXITED] Process terminated\x1b[0m\r\n`);
            }
          }
        });

        ptyService.on('error', (event: any) => {
          if (event.ptyId === localPty?.id && terminal) {
            const errorMsg = event.error?.message || 'Unknown PTY error';
            console.error(`[AgentPlayground:${agent.id}] PTY Error:`, errorMsg);
            terminal.write(`\r\n\x1b[31m[PTY ERROR] ${errorMsg}\x1b[0m\r\n`);
          }
        });

        terminal.write(`\x1b[32m[${agent.name} STARTED] Launching...\x1b[0m\r\n`);
        terminal.write(`\x1b[32m[SESSION ID] ${session.id}\x1b[0m\r\n`);
        terminal.write(`\x1b[32m[PID] ${session.pid}\x1b[0m\r\n`);

      } catch (error) {
        console.error(`Failed to initialize agent terminal:`, error);
        setStatus('error');
        if (terminal) {
          terminal.write(`\r\n\x1b[31m[FAILED TO SPAWN ${agent.name}] ${error}\x1b[0m\r\n`);
          terminal.write(`\r\n\x1b[33m[ERROR] Ensure ${agent.name} is installed\x1b[0m\r\n`);
          terminal.write(`\x1b[33m[INFO] Use Agent Manager to install\x1b[0m\r\n`);
        }
      }

      cleanup = async () => {
        window.removeEventListener('resize', handleResize);
        if (resizeObserver) resizeObserver.disconnect();
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        if (unlistenPtyOutput) { unlistenPtyOutput(); unlistenPtyOutput = null; }

        const terminalManager = getTerminalManager();
        try {
          if (currentSessionId) {
            await terminalManager.destroyTerminal(currentSessionId);
          }
        } catch (error) {
          console.error('Failed to destroy terminal:', error);
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
  }, [agent]);

  const statusColor = status === 'connected' ? '#3fb950' :
                      status === 'spawning' ? '#d29922' :
                      status === 'error' ? '#f85149' : '#8b949e';

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
        flexShrink: 0,
        borderLeft: `3px solid ${agent.color || '#58a6ff'}`,
      }}>
        <div>
          <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{agent.icon}</span>
            <span>{agent.name}</span>
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>
            {agent.description}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              gap: '4px',
            }}
            title="Force Terminal Refit"
          >
            <Activity size={12} />
            Refresh UI
          </button>

          <div style={{ textAlign: 'right' }}>
            <div>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusColor,
                boxShadow: status === 'connected' ? `0 0 8px ${statusColor}40` : 'none',
                marginRight: '6px',
              }} />
              <span style={{ color: statusColor, textTransform: 'capitalize' }}>
                {status}
              </span>
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              PID: {pid || 'N/A'}
            </div>
          </div>
        </div>
      </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={terminalRef}
          style={{
            height: '100%',
            width: '100%',
            backgroundColor: '#0d1117',
          }}
        />
      </div>
    </div>
  );
};

export default AgentPlayground;
