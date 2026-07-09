import React, { useRef } from 'react';
import { Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from './useTerminal';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundConfig } from '../domain/PlaygroundTypes';

interface OpenCodePlaygroundProps {
  sdk: PlaygroundSDK;
  config: PlaygroundConfig;
  isActive?: boolean;
}

const opencodeTheme = {
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
  brightWhite: '#ffffff',
};

export const OpenCodePlayground: React.FC<OpenCodePlaygroundProps> = ({
  sdk: _sdk,
  config: _config,
  isActive,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const { pid, status, sessionId, isConnected, refreshTerminal } = useTerminal({
    terminalRef,
    sessionIdPrefix: 'opencode-',
    theme: opencodeTheme,
    cursorStyle: 'block',
    isActive,
    createSession: async (manager, cols, rows, sid) => {
      const session = await manager.createOpenCodeTerminal(sid, {
        cols,
        rows,
        cwd: 'C:\\Users\\',
      });
      return { ptyId: session.ptyId, pid: session.pid };
    },
    deps: [],
  });

  const statusColor = status === 'connected' ? '#3fb950' :
    status === 'spawning' ? '#d29922' : '#f85149';

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#000000', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 0, left: 4, fontSize: 8, color: '#ff4444', fontWeight: 'bold', zIndex: 20 }}>⬤OPENCODE</span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#111111',
        borderBottom: '1px solid #333333',
        height: '36px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>OpenCode AI TUI</span>
          <span style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
            PID {pid || '...'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={refreshTerminal}
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
            title="Force Refit"
          >
            <Activity size={12} />
            Refresh UI
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              boxShadow: status === 'connected' ? '0 0 8px rgba(63, 185, 80, 0.4)' : 'none',
            }} />
            <span style={{ fontSize: '12px', color: '#8b949e', textTransform: 'capitalize' }}>
              {status}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#000000',
        position: 'relative',
        padding: '4px',
      }}>
        <div
          ref={terminalRef}
          style={{ width: '100%', height: '100%' }}
          className="terminal-container"
        />
      </div>

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
        color: '#8b949e',
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
