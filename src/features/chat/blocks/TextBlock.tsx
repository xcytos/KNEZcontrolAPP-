import React from 'react';
import { Block } from '../../../domain/DataContracts';

interface TextBlockProps {
  block: Extract<Block, { type: 'text' }>;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block }) => {
  // Don't render if content is empty
  if (!block.content || block.content.trim() === '') {
    return null;
  }

  return (
    <div className="my-2 text-sm text-zinc-300 whitespace-pre-wrap">
      {block.content}
    </div>
  );
};
