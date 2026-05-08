import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalHost {
  terminal: Terminal | null;
  fitAddon: FitAddon | null;
  ptyId: string | null;
  unlisten: (() => void) | null;
}

const TerminalSandbox: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<TerminalHost>({
    terminal: null,
    fitAddon: null,
    ptyId: null,
    unlisten: null
  });

  useEffect(() => {
    const host = hostRef.current;
    let mounted = true;

    const initializeTerminal = async () => {
      if (!terminalRef.current || !mounted) return;

      try {
        // Create xterm instance with modern settings
        const terminal = new Terminal({
          cols: 80,
          rows: 24,
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 14,
          theme: {
            background: '#1e1e1e',
            foreground: '#cccccc',
            cursor: '#ffffff',
            selectionBackground: '#264f78',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5'
          },
          cursorBlink: true,
          cursorStyle: 'bar',
          scrollback: 10000,
          allowTransparency: false,
          macOptionIsMeta: true,
          rightClickSelectsWord: true
        });

        // Add fit addon for responsive sizing
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // Open terminal in container
        terminal.open(terminalRef.current);
        fitAddon.fit();

        // Store references
        host.terminal = terminal;
        host.fitAddon = fitAddon;

        // Create PTY
        const ptyId = await invoke('pty_create', {
          config: {
            cols: terminal.cols,
            rows: terminal.rows,
            cwd: 'C:\\Users\\',
            env: {},
            shell: 'powershell.exe'
          }
        }) as string;

        host.ptyId = ptyId;

        // Listen for PTY output
        host.unlisten = await listen('pty-output', (event) => {
          const payload = event.payload as { ptyId: string; data: string };
          if (payload.ptyId === ptyId) {
            terminal.write(payload.data);
          }
        });

        // Handle terminal input -> PTY
        terminal.onData((data) => {
          if (host.ptyId) {
            invoke('pty_write', { ptyId: host.ptyId, data }).catch(console.error);
          }
        });

        // Handle resize
        const handleResize = () => {
          if (host.fitAddon && host.ptyId) {
            host.fitAddon.fit();
            const { cols, rows } = host.terminal!;
            invoke('pty_resize', { ptyId: host.ptyId, cols, rows }).catch(console.error);
          }
        };

        window.addEventListener('resize', handleResize);

        // Return cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (error) {
        console.error('Terminal initialization error:', error);
      }
    };

    let cleanupFn: (() => void) | undefined;

    initializeTerminal().then(cleanup => {
      cleanupFn = cleanup;
    });

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
      
      if (host.unlisten) {
        host.unlisten();
      }
      
      if (host.ptyId) {
        invoke('pty_destroy', { ptyId: host.ptyId }).catch(console.error);
      }
      
      if (host.terminal) {
        host.terminal.dispose();
      }
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1e1e1e'
    }}>
      {/* Minimal header */}
      <div style={{
        padding: '8px 16px',
        background: '#252526',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: '#cccccc'
      }}>
        <span style={{ fontWeight: 600 }}>PowerShell</span>
        <span style={{ color: '#666' }}>|</span>
        <span style={{ color: '#888' }}>Integrated Terminal</span>
      </div>

      {/* Terminal container - edge to edge */}
      <div 
        ref={terminalRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '4px'
        }}
      />
    </div>
  );
};

export default TerminalSandbox;
