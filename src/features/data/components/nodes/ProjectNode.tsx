import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, FileText } from 'lucide-react';

export const ProjectNode = memo(({ data }: NodeProps) => {
  return (
    <div className="group">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-600"
      />
      
      <div className="w-[220px] bg-purple-900/40 border-2 border-purple-600 rounded-lg p-4 shadow-lg hover:shadow-purple-600/50 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="text-xs text-purple-300 font-semibold mb-1">PROJECT</div>
            <div className="text-sm font-bold text-purple-100 line-clamp-2">
              {data.project.project_name}
            </div>
          </div>
        </div>

        <div className="text-xs text-purple-300 font-mono mt-2 truncate">
          {data.project.project_id}
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-purple-700/50">
          <div className="flex items-center gap-1 text-xs text-purple-200">
            <Database className="w-3 h-3" />
            <span>{data.sessionCount} sessions</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-purple-200">
            <FileText className="w-3 h-3" />
            <span>{data.documentCount} docs</span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-purple-600"
      />
    </div>
  );
});

ProjectNode.displayName = 'ProjectNode';
