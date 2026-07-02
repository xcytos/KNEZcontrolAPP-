import React from 'react';
import { PlaygroundContainer } from '../../../playgrounds/PlaygroundContainer';
import { playgroundSDK } from '../../../services/playground/PlaygroundSDK';

export const TerminalLens: React.FC = () => {
  return (
    <div className="h-full bg-zinc-950 flex flex-col">
      <div className="flex-1 overflow-hidden">
        <PlaygroundContainer sdk={playgroundSDK} mode="normal" />
      </div>
    </div>
  );
};
