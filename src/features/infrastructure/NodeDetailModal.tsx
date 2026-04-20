import React from 'react';
import { X, FileText, Clock, AlertCircle } from 'lucide-react';
import { LayerNode, getStatusColor, getStatusLabel } from './knezArchitecture';

interface NodeDetailModalProps {
  node: LayerNode;
  onClose: () => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({ node, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(node.status)}`} />
            <h3 className="font-bold text-zinc-200">{node.name}</h3>
            <span className={`text-xs px-2 py-1 rounded ${getStatusColor(node.status).replace('bg-', 'bg-').replace('500', '900/30')} ${getStatusColor(node.status).replace('bg-', 'text-')} font-bold`}>
              {getStatusLabel(node.status)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Description */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-zinc-400 mb-2">Description</h4>
            <p className="text-zinc-300">{node.description}</p>
          </div>

          {/* File Reference */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2">
              <FileText size={16} />
              File Reference
            </h4>
            <code className="block bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-400 break-all">
              {node.fileRef}
            </code>
          </div>

          {/* Dependencies */}
          {node.dependencies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-zinc-400 mb-2">Dependencies</h4>
              <div className="space-y-1">
                {node.dependencies.map((dep) => (
                  <div key={dep} className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    {dep}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          {node.metrics && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {node.metrics.lastActive && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Last Active</p>
                    <p className="text-xs text-zinc-400">{node.metrics.lastActive}</p>
                  </div>
                )}
                {node.metrics.errorCount !== undefined && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Error Count</p>
                    <p className="text-xs text-zinc-400">{node.metrics.errorCount}</p>
                  </div>
                )}
                {node.metrics.performance !== undefined && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Performance</p>
                    <p className="text-xs text-zinc-400">{node.metrics.performance}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Information */}
          <div className="bg-zinc-950 border border-zinc-800 rounded px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-zinc-500 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-400">Status Information</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {node.status === 'working' && 'This component is fully functional and actively used.'}
                  {node.status === 'partial' && 'This component is partially implemented with some features working.'}
                  {node.status === 'not_working' && 'This component is currently not functional.'}
                  {node.status === 'planned' && 'This component is planned but not yet implemented.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
