import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';

/**
 * RAW POWERSHELL TEST - Bypass ALL abstractions
 * Direct PTY → PowerShell → xterm connection
 */
export const RawPowerShellTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready');
  const [processId, setProcessId] = useState<number | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const ptyHandle = useRef<any>(null);

  const launchRawPowerShell = async () => {
    try {
      console.log('[FRONTEND_REQUEST_PTY] Raw PowerShell test starting');
      setStatus('Creating PTY...');
      
      // Create terminal
      const terminal = new Terminal({
        theme: {
          background: '#000000',
          foreground: '#00ff00',
          cursor: '#ffffff'
        },
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        cursorBlink: true
      });
      
      terminalInstance.current = terminal;
      
      // Open terminal in DOM
      if (terminalRef.current) {
        console.log('[XTERM_OPEN] Opening terminal in DOM');
        terminal.open(terminalRef.current);
        
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        fitAddon.fit();
      }
      
      // Direct Tauri PTY call - NO ABSTRACTIONS
      console.log('[RUST_COMMAND_ENTERED] Invoking pty_spawn_command directly');
      const result = await (window as any).__TAURI__.invoke('pty_spawn_command', {
        ptyId: `raw-powershell-${Date.now()}`,
        command: process.platform === 'win32' ? 'powershell.exe' : 'bash',
        args: [],
        cols: 80,
        rows: 24,
        cwd: undefined,
        env: {}
      });
      
      console.log('[PTY_CREATED] Raw PTY created:', result);
      setProcessId(result.processId);
      setStatus(`PowerShell running (PID: ${result.processId})`);
      
      // Set up direct event listener for PTY events
      const handlePTYEvent = (event: any) => {
        console.log('[EVENT_EMITTED] PTY event:', event.detail);
        console.log('[FRONTEND_EVENT_RECEIVED] Event received in frontend');
        
        if (event.detail?.ptyId === result.ptyId) {
          const { type, data } = event.detail;
          
          if (type === 'data') {
            console.log(`[STDOUT_CHUNK] ${data?.length || 0} bytes: "${data?.replace(/\r?\n/g, '\\n')}"`);
            console.log(`[XTERM_WRITE_BEFORE] About to write to terminal: "${data?.replace(/\r?\n/g, '\\n')}"`);
            console.log(`[XTERM_WRITE_START] terminal.write() called`);
            terminal.write(data || '');
            console.log(`[XTERM_WRITE_SUCCESS] terminal.write() completed`);
          } else if (type === 'exit') {
            console.log(`[SHELL_EXITED] PowerShell exited with code: ${event.detail.exitCode}`);
            terminal.write(`\r\n\x1b[31mPowerShell exited (code: ${event.detail.exitCode})\x1b[0m\r\n`);
            setStatus('PowerShell exited');
          } else if (type === 'error') {
            console.error('[PTY_ERROR]', event.detail);
            terminal.write(`\r\n\x1b[31mError: ${event.detail?.error || 'Unknown'}\x1b[0m\r\n`);
            setStatus('Error');
          }
        }
      };
      
      window.addEventListener('pty-event', handlePTYEvent);
      
      // Set up terminal input handler
      terminal.onData((data: string) => {
        console.log(`[STDIN_SENT] ${data.length} bytes: "${data.replace(/\r?\n/g, '\\n')}"`);
        
        // Direct Tauri write call - NO ABSTRACTIONS
        (window as any).__TAURI__.invoke('pty_write', {
          ptyId: result.ptyId,
          data: data
        }).catch((error: unknown) => {
          console.error('[STDIN_ERROR]', error);
        });
      });
      
      // Store cleanup function
      ptyHandle.current = {
        ptyId: result.ptyId,
        cleanup: () => {
          window.removeEventListener('pty-event', handlePTYEvent);
          (window as any).__TAURI__.invoke('pty_kill', {
            ptyId: result.ptyId,
            signal: undefined
          });
        }
      };
      
    } catch (error) {
      console.error('[RAW_POWERSHELL_ERROR]', error);
      setStatus(`Error: ${error}`);
    }
  };

  const killPowerShell = async () => {
    if (ptyHandle.current) {
      console.log('[KILL_POWERSHELL] Terminating process');
      ptyHandle.current.cleanup();
      ptyHandle.current = null;
      setProcessId(null);
      setStatus('Terminated');
    }
  };

  useEffect(() => {
    return () => {
      if (ptyHandle.current) {
        ptyHandle.current.cleanup();
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>RAW POWERSHELL TEST - No Abstractions</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <button 
            onClick={launchRawPowerShell}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007acc', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Launch Raw PowerShell
          </button>
          <button 
            onClick={killPowerShell}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#ff4444', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Kill PowerShell
          </button>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
            Status: <strong>{status}</strong>
          </span>
          {processId && (
            <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              PID: <strong>{processId}</strong>
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
          This bypasses ALL abstractions - Direct Tauri PTY → PowerShell → xterm
        </div>
      </div>
      
      <div 
        ref={terminalRef}
        style={{ 
          flex: 1, 
          backgroundColor: '#000000', 
          border: '1px solid #333',
          borderRadius: '4px',
          minHeight: '400px'
        }} 
      />
    </div>
  );
};

export default RawPowerShellTest;
