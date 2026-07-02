import React from 'react';
import { TaqwinAgentPanel } from '../../dashboard/TaqwinAgentPanel';
import type { SessionContext } from '../types';

interface ChatLensProps {
  sessionContext: SessionContext;
}

export const ChatLens: React.FC<ChatLensProps> = ({ sessionContext }) => {
  return (
    <div className="h-full bg-zinc-950">
      <TaqwinAgentPanel
        sessionId={sessionContext.sessionId}
        projectId={sessionContext.projectId}
      />
    </div>
  );
};
