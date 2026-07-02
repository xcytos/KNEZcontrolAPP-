import React from 'react';
import { TaqwinAgentPanel } from '../../dashboard/TaqwinAgentPanel';
import type { SessionContext } from '../types';

interface AgentChatPanelProps {
  sessionContext: SessionContext;
  onClose?: () => void;
}

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({ sessionContext, onClose }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200">TAQWIN Agent</h3>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">Close</button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <TaqwinAgentPanel
          sessionId={sessionContext.sessionId}
          projectId={sessionContext.projectId}
          onClose={() => {}}
        />
      </div>
    </div>
  );
};
