import React from 'react';
import { Block } from '../../../domain/DataContracts';

interface FinalBlockProps {
  block: Extract<Block, { type: 'final' }>;
}

export const FinalBlock: React.FC<FinalBlockProps> = ({ block }) => {
  return (
    <div className="my-4 p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="text-sm font-medium text-green-800 mb-2">
        Result
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {block.content}
      </div>
    </div>
  );
};
