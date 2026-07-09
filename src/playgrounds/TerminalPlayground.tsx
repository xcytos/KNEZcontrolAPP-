import React, { useRef } from 'react';
import { Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from './useTerminal';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { PlaygroundConfig } from '../domain/PlaygroundTypes';

interface TerminalPlaygroundProps {
  sdk: PlaygroundSDK;
  config: PlaygroundConfig;
  isActive?: boolean;
  headerVisible?: boolean;
}

const terminalTheme = {
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
};

export const TerminalPlayground: React.FC<TerminalPlaygroundProps> = ({
  sdk: _sdk,
  config: _config,
  isActive,
  headerVisible = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const { pid, status, sessionId, refreshTerminal } = useTerminal({
    terminalRef,
    sessionIdPrefix: 'terminal-',
    theme: terminalTheme,
    cursorStyle: 'bar',
    isActive,
    createSession: async (manager, cols, rows, sid) => {
      const session = await manager.createTerminal(sid, {
        cols,
        rows,
        cwd: 'C:\\Users\\',
      });
      return { ptyId: session.ptyId, pid: session.pid };
    },
    deps: [],
  });

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 0, left: 4, fontSize: 8, color: '#ff4444', fontWeight: 'bold', zIndex: 20 }}>⬤TERMINAL</span>
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
