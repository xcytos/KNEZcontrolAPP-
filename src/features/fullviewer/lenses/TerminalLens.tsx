import React from 'react';
import { PlaygroundContainer } from '../../../playgrounds/PlaygroundContainer';
import { playgroundSDK } from '../../../services/playground/PlaygroundSDK';

export const TerminalLens: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <PlaygroundContainer sdk={playgroundSDK} mode="normal" />
    </div>
  );
};
