import React, { useEffect } from 'react';
import { Terminal } from 'lucide-react';

export const TerminalLens: React.FC = () => {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('knez-navigate', { detail: { view: 'terminal-sandbox' } }));
  }, []);

  return (
    <div className="h-full flex items-center justify-center text-zinc-500 bg-zinc-950">
      <div className="text-center">
        <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Redirecting to Terminal Sandbox...</p>
        <p className="text-xs text-zinc-600 mt-1">Terminals open in the bottom panel</p>
      </div>
    </div>
  );
};
