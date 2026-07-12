import React from 'react';
import { PlaygroundContainer } from '../../../playgrounds/PlaygroundContainer';

export const PlaygroundLens: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <PlaygroundContainer />
    </div>
  );
};
