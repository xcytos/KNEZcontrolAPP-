import React from 'react';
import { LayerNode, getStatusColor, getStatusLabel } from './knezArchitecture';

interface NodeBoxProps {
  node: LayerNode;
  onClick: () => void;
}

export const NodeBox: React.FC<NodeBoxProps> = ({ node, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group relative bg-zinc-900 border border-zinc-800 rounded-lg p-3 min-w-[200px] max-w-[250px] cursor-pointer hover:border-zinc-700 hover:bg-zinc-800 transition-all duration-200"
    >
      {/* Status Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor(node.status)}`} />
        <span className={`text-[10px] uppercase font-bold ${getStatusColor(node.status).replace('bg-', 'text-')}`}>
          {getStatusLabel(node.status)}
        </span>
      </div>

      {/* Node Name */}
      <h4 className="font-semibold text-zinc-200 text-sm mb-1 truncate" title={node.name}>
        {node.name}
      </h4>

      {/* Node Description */}
      <p className="text-xs text-zinc-500 line-clamp-2" title={node.description}>
        {node.description}
      </p>

      {/* File Reference */}
      <div className="mt-2 pt-2 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600 truncate" title={node.fileRef}>
          {node.fileRef}
        </p>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-lg" />
    </div>
  );
};
