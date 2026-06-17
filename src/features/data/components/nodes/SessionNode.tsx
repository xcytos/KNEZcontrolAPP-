import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, GitBranch } from 'lucide-react';

export const SessionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="group">
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 !bg-blue-600"
      />
      
      <div className="w-[180px] bg-blue-900/40 border-2 border-blue-600 rounded-lg p-3 shadow-lg hover:shadow-blue-600/50 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-blue-300 font-semibold">SESSION</div>
          <div className="text-[10px] text-blue-200 font-mono bg-blue-950/50 px-1.5 py-0.5 rounded">
            {data.session.display_id}
          </div>
        </div>

        <div className="text-xs font-semibold text-blue-100 line-clamp-2 min-h-[32px]">
          {data.session.name || 'Unnamed Session'}
        </div>

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-700/50">
          <div className="flex items-center gap-1 text-xs text-blue-200">
            <FileText className="w-3 h-3" />
            <span>{data.documentCount}</span>
          </div>
          {data.session.checkpoint_count !== undefined && (
            <div className="flex items-center gap-1 text-xs text-blue-200">
              <GitBranch className="w-3 h-3" />
              <span>{data.session.checkpoint_count}</span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 !bg-blue-600"
      />
    </div>
  );
});

SessionNode.displayName = 'SessionNode';
