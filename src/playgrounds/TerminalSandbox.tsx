import React, { useEffect, useRef } from 'react';
import { TerminalHost } from './runtime/TerminalHost';
import '@xterm/xterm/css/xterm.css';

/**
 * TerminalSandbox — minimal, self-contained terminal panel.
 *
 * Mounts a TerminalHost into the page and handles the React lifecycle
 * cleanly, including StrictMode double-invocation.
 */
const TerminalSandbox: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<TerminalHost | null>(null);
  // Guard against React StrictMode double-mount
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const container = terminalRef.current;
    if (!container) return;

    const host = new TerminalHost();
    hostRef.current = host;

    // Two rAF cycles ensure the flex-box layout has committed real pixel
    // dimensions before TerminalHost tries to read getBoundingClientRect().
    let rafId1: number;
    let rafId2: number;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        if (!mountedRef.current) return; // unmounted before paint
        host.initialize(container).catch((err) => {
          console.error('[TerminalSandbox] initialize error:', err);
        });
      });
    });

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      if (hostRef.current) {
        hostRef.current.dispose();
        hostRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#0d1117',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '6px 14px',
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#8b949e',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#3fb950',
          }}
        />
        <span style={{ fontWeight: 600, color: '#c9d1d9' }}>PowerShell</span>
        <span style={{ color: '#484f58' }}>│</span>
        <span>Integrated Terminal</span>
      </div>

      {/* Terminal container — must have explicit flex:1 so getBoundingClientRect
          returns non-zero dimensions before FitAddon runs */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          minHeight: 0,   // ← critical: prevents flex child from overflowing
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export default TerminalSandbox;
