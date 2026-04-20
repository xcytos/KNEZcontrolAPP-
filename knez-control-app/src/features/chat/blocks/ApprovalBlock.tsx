import React from 'react';
import { Block } from '../../../domain/DataContracts';

interface ApprovalBlockProps {
  block: Extract<Block, { type: 'approval' }>;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalBlock: React.FC<ApprovalBlockProps> = ({ block, onApprove, onReject }) => {
  return (
    <div className="my-2 border border-blue-200 bg-blue-50 rounded-lg p-4">
      <div className="text-sm font-medium text-blue-800 mb-2">
        OK if I call this MCP tool?
      </div>
      <div className="text-xs text-blue-700 mb-2">
        <span className="font-semibold">MCP Tool:</span> {block.tool}
      </div>
      <div className="text-xs text-blue-700 mb-4">
        <span className="font-semibold">Args:</span>
        <pre className="mt-1 bg-white p-2 rounded border border-blue-100 overflow-x-auto">
          {JSON.stringify(block.args, null, 2)}
        </pre>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-white border border-green-200 rounded hover:bg-green-50 transition-colors"
        >
          Run
        </button>
        <label className="flex items-center gap-2 text-xs text-gray-600 ml-auto">
          <input type="checkbox" className="rounded" />
          Allow always
        </label>
      </div>
    </div>
  );
};
