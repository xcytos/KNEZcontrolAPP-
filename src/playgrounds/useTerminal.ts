import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { getTerminalManager, TerminalRuntimeManager } from './TerminalRuntimeManager';
import { pushOutput, getOutput, clearOutput, pushSession } from './terminalStorage';

export type TerminalStatus = 'idle' | 'spawning' | 'connected' | 'error' | 'disconnected';

export interface UseTerminalOptions {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  sessionIdPrefix: string;
  theme?: Record<string, string>;
  cursorStyle?: 'block' | 'underline' | 'bar';
  background?: string;
  isActive?: boolean;
  /** Key used for persisting terminal output across restarts. Omit to disable persistence. */
  tabId?: string;
  tabLabel?: string;
  createSession: (
    manager: TerminalRuntimeManager,
    cols: number,
    rows: number,
    sessionId: string,
  ) => Promise<{ ptyId: string; pid: number }>;
  deps?: React.DependencyList;
}

export interface UseTerminalReturn {
  pid: number | null;
  status: TerminalStatus;
  sessionId: string;
  isConnected: boolean;
  refreshTerminal: () => void;
}

const SESSION_MARKER = '\x1b[2m\x1b[3m';
const MARKER_RESET = '\x1b[23m\x1b[22m';

export function useTerminal({
  terminalRef,
  sessionIdPrefix,
  theme = {},
  cursorStyle = 'bar',
  isActive,
  tabId,
  tabLabel,
  createSession,
  deps = [],
}: UseTerminalOptions): UseTerminalReturn {
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<TerminalStatus>('idle');
  const [sessionId, setSessionId] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const handleResizeRef = useRef<(() => void) | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent refs that survive effect re-runs so terminal is never destroyed on tab switch
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const localPtyRef = useRef<any>(null);
  const localConnectedRef = useRef(false);
  const currentSessionIdRef = useRef('');
  const unlistenPtyOutputRef = useRef<Promise<() => void> | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const unlistenErrorRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Already initialized → just re-fit on re-activation
    if (terminalInstanceRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          terminalInstanceRef.current?.refresh(0, terminalInstanceRef.current.rows - 1);
        } catch { /* ignore */ }
      }, 50);
      return;
    }

    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let localPty: any = null;
    let localIsConnected = false;
    let currentSessionId = '';
    let firstOutputFired = false;
    let isUnmounted = false;

    const initializeTerminal = async () => {
      if (!terminalRef.current) return;

      setStatus('spawning');

      terminal = new Terminal({
        smoothScrollDuration: 150,
        cursorBlink: true,
        cursorStyle,
        fontSize: 14,
        fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
        theme,
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

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (isUnmounted) {
        terminal.dispose();
        return;
      }
      try { fitAddon.fit(); } catch { /* pre-layout */ }

      // Restore previous session output before starting the new PTY
      if (tabId) {
        const stored = getOutput(tabId);
        if (stored && stored.lines.length > 0) {
          const restoredAt = new Date(stored.timestamp).toLocaleString();
          terminal.write(`\r\n${SESSION_MARKER}┌────────────────────────────────────────────┐${MARKER_RESET}\r\n`);
          terminal.write(`${SESSION_MARKER}│ SESSION RESTORED from ${restoredAt.padEnd(25)}│${MARKER_RESET}\r\n`);
          terminal.write(`${SESSION_MARKER}└────────────────────────────────────────────┘${MARKER_RESET}\r\n\n`);
          for (const line of stored.lines) {
            if (isUnmounted) return;
            terminal.write(line);
          }
          terminal.write(`\r\n\n${SESSION_MARKER}── END OF RESTORED SESSION ──${MARKER_RESET}\r\n\n`);
          clearOutput(tabId);
        }
      }

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

      const resizeObserver = new ResizeObserver(() => { handleResize(); });
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }

      terminal.onData((data) => {
        if (localPty && localIsConnected) {
          try { localPty.write(data); } catch (error) {
            console.error('Failed to write to PTY:', error);
          }
        }
      });

      try {
        const terminalManager = getTerminalManager();
        currentSessionId = `${sessionIdPrefix}${Date.now()}`;
        setSessionId(currentSessionId);

        const session = await createSession(
          terminalManager,
          terminal.cols,
          terminal.rows,
          currentSessionId,
        );

        const pty = terminalManager.getPTY(session.ptyId);
        if (!pty) throw new Error('PTY not found after session creation');

        localPty = pty;
        localIsConnected = true;
        setPid(session.pid);
        setIsConnected(true);
        setStatus('connected');

        if (isUnmounted) {
          await terminalManager.destroyTerminal(currentSessionId);
          terminal.dispose();
          return;
        }

        if (terminal) {
          terminal.write(`\x1b[32m[NEW SESSION] ${currentSessionId}\x1b[0m\r\n`);
          terminal.write(`\x1b[32m[PID] ${session.pid}\x1b[0m\r\n`);
        }

        // Store promise immediately — cleanup can always unsubscribe even if component unmounts mid-resolution
        unlistenPtyOutputRef.current = listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (event.payload.pty_id !== pty.id || !terminal) return;
          try { terminal.write(event.payload.data); } catch { /* disposed */ }

          if (tabId) {
            pushOutput(tabId, tabLabel || sessionIdPrefix, event.payload.data);
          }

          if (!firstOutputFired) {
            firstOutputFired = true;
            setTimeout(() => {
              try {
                fitAddon?.fit();
                terminal?.refresh(0, terminal?.rows - 1);
              } catch { /* ignore */ }
            }, 300);
          }
        });

        const { getPTYService } = await import('./runtime/PTYService');

        if (isUnmounted) {
          const manager = getTerminalManager();
          manager.destroyTerminal(currentSessionId).catch(() => {
            if (localPty) localPty.destroy();
          });
          if (terminal) terminal.dispose();
          return;
        }

        const ptyService = getPTYService();

        const onExit = (event: any) => {
          if (event.ptyId === localPty?.id) {
            localIsConnected = false;
            setIsConnected(false);
            setStatus('disconnected');
            setPid(null);
            if (terminal) {
              terminal.write('\r\n\x1b[33m[PROCESS EXITED]\x1b[0m\r\n');
            }
          }
        };
        ptyService.on('exit', onExit);
        unlistenExitRef.current = () => ptyService.off('exit', onExit);

        const onError = (event: any) => {
          if (event.ptyId === localPty?.id && terminal) {
            const errorMsg = event.error?.message || 'Unknown PTY error';
            console.error('PTY Error:', errorMsg);
            terminal.write(`\r\n\x1b[31m[PTY ERROR] ${errorMsg}\x1b[0m\r\n`);
          }
        };
        ptyService.on('error', onError);
        unlistenErrorRef.current = () => ptyService.off('error', onError);

      } catch (error) {
        if (isUnmounted) return;
        console.error('[useTerminal] Failed to initialize:', error);
        setStatus('error');
        if (terminal) {
          terminal.write(`\r\n\x1b[31m[FAILED TO SPAWN] ${error}\x1b[0m\r\n`);
        }
      }

      // Store persistent refs so the terminal survives effect re-runs
      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;
      localPtyRef.current = localPty;
      localConnectedRef.current = localIsConnected;
      currentSessionIdRef.current = currentSessionId;
    };

    initializeTerminal();

    return () => {
      isUnmounted = true;
    };
    // isActive needed in deps to wake up on tab switch and to re-fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sessionIdPrefix, tabId, tabLabel, ...deps]);

  // Separate effect for actual cleanup — runs only on component unmount
  useEffect(() => {
    return () => {
      const terminal = terminalInstanceRef.current;
      const currentSessionId = currentSessionIdRef.current;

      window.removeEventListener('resize', handleResizeRef.current!);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);

      if (unlistenPtyOutputRef.current) {
        unlistenPtyOutputRef.current.then(unsub => unsub());
        unlistenPtyOutputRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }
      if (unlistenErrorRef.current) {
        unlistenErrorRef.current();
        unlistenErrorRef.current = null;
      }

      if (tabId && currentSessionId) {
        pushSession({ tabId, type: sessionIdPrefix, label: tabLabel || sessionIdPrefix, timestamp: Date.now() });
      }

      const terminalManager = getTerminalManager();
      if (currentSessionId) {
        terminalManager.destroyTerminal(currentSessionId).catch((error: any) => {
          console.error('Failed to destroy terminal:', error);
          if (localPtyRef.current) localPtyRef.current.destroy();
        });
      }

      if (terminal) terminal.dispose();
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
      localPtyRef.current = null;
      localConnectedRef.current = false;
      currentSessionIdRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTerminal = useCallback(() => {
    handleResizeRef.current?.();
  }, []);

  useEffect(() => {
    if (isActive && handleResizeRef.current) {
      setTimeout(() => {
        handleResizeRef.current?.();
      }, 50);
    }
  }, [isActive]);

  return { pid, status, sessionId, isConnected, refreshTerminal };
}
