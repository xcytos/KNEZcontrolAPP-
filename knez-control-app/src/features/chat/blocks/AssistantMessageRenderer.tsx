import React from 'react';
import { Block } from '../../../domain/DataContracts';
import { MCPBlock } from './MCPBlock';
import { ApprovalBlock } from './ApprovalBlock';
import { TextBlock } from './TextBlock';
import { FinalBlock } from './FinalBlock';
import { Loader2 } from 'lucide-react';

interface AssistantMessageRendererProps {
  blocks: Block[];
  onApprovalApprove?: () => void;
  onApprovalReject?: () => void;
}

export const AssistantMessageRenderer: React.FC<AssistantMessageRendererProps> = ({
  blocks,
  onApprovalApprove,
  onApprovalReject,
}) => {
  // Filter out empty text blocks
  const visibleBlocks = blocks.filter(block => {
    if (block.type === 'text') {
      return block.content && block.content.trim() !== '';
    }
    return true;
  });

  // If no visible blocks, show thinking/loading indicator
  if (visibleBlocks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Thinking...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleBlocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={index} block={block} />;
          case 'approval':
            return (
              <ApprovalBlock
                key={index}
                block={block}
                onApprove={onApprovalApprove || (() => {})}
                onReject={onApprovalReject || (() => {})}
              />
            );
          case 'mcp_call':
            return <MCPBlock key={index} block={block} />;
          case 'final':
            return <FinalBlock key={index} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
