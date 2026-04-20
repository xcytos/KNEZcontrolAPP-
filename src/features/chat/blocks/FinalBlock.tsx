import React from 'react';
import { Block } from '../../../domain/DataContracts';

interface FinalBlockProps {
  block: Extract<Block, { type: 'final' }>;
}

export const FinalBlock: React.FC<FinalBlockProps> = ({ block }) => {
  return (
    <div className="my-2 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
      {block.content}
    </div>
  );
};
