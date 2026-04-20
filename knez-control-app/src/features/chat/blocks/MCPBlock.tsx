import React, { useState } from 'react';
import { Block } from '../../../domain/DataContracts';

interface MCPBlockProps {
  block: Extract<Block, { type: 'mcp_call' }>;
}

export const MCPBlock: React.FC<MCPBlockProps> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = () => {
    switch (block.status) {
      case 'pending': return 'text-yellow-600';
      case 'running': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (block.status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '⚡';
    }
  };


  return (
    <div className="my-2 border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className="font-medium text-sm text-gray-700">
          {block.tool}
        </span>
        {block.status === 'success' && (
          <span className="text-xs text-gray-500">
            → success
          </span>
        )}
        {block.executionTimeMs && (
          <span className="text-xs text-gray-500 ml-auto">
            {block.executionTimeMs}ms
          </span>
        )}
        <span className="text-gray-400 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="p-3 bg-white border-t border-gray-200">
          {/* Request */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">request:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(block.args, null, 2)}
            </pre>
          </div>

          {/* Response */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">response:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
              {typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2)}
            </pre>
          </div>

          {/* Error */}
          {block.error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3">
              <span className="font-semibold">Error:</span> {block.error}
            </div>
          )}

          {/* MCP Latency */}
          {block.mcpLatencyMs && (
            <div className="text-xs text-gray-500">
              MCP Latency: {block.mcpLatencyMs}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
};
