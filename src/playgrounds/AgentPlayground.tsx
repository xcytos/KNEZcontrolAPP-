import React, { useRef } from 'react';
import { Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from './useTerminal';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';
import { AgentDefinition } from '../domain/AgentTypes';

interface AgentPlaygroundProps {
  sdk: PlaygroundSDK;
  agent: AgentDefinition;
  isActive?: boolean;
  headerVisible?: boolean;
}

const agentTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
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

export const AgentPlayground: React.FC<AgentPlaygroundProps> = ({
  sdk: _sdk,
  agent,
  isActive,
  headerVisible = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const { pid, status, refreshTerminal } = useTerminal({
    terminalRef,
    sessionIdPrefix: `agent-${agent.id}-`,
    theme: { ...agentTheme, cursor: agent.color || '#58a6ff' },
    cursorStyle: 'bar',
    isActive,
    createSession: async (manager, cols, rows, sid) => {
      if (agent.id === 'opencode') {
        const session = await manager.createOpenCodeTerminal(sid, { cols, rows, cwd: agent.workingDirectory || 'C:\\Users\\' });
        return { ptyId: session.ptyId, pid: session.pid };
      }
      const launchCmd = [...agent.launchCommand, ...(agent.launchArgs || [])];
      const session = await manager.createAgentTerminal(sid, {
        cols,
        rows,
        cwd: agent.workingDirectory || 'C:\\Users\\',
        env: agent.environment,
        agentLaunchCommand: launchCmd,
      });
      return { ptyId: session.ptyId, pid: session.pid };
    },
    deps: [agent.id, agent.launchCommand, agent.launchArgs, agent.workingDirectory, agent.environment],
  });

  const statusColor = status === 'connected' ? '#3fb950' :
    status === 'spawning' ? '#d29922' :
    status === 'error' ? '#f85149' : '#8b949e';

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 0, left: 4, fontSize: 8, color: '#ff4444', fontWeight: 'bold', zIndex: 20 }}>⬤AGENT</span>
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
