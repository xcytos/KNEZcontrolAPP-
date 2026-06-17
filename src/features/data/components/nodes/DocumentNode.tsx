import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, FileCode, FileJson, File } from 'lucide-react';

const getDocIcon = (docType: string) => {
  switch (docType) {
    case 'requirement':
      return FileText;
    case 'design':
      return FileCode;
    case 'specification':
      return FileJson;
    default:
      return File;
  }
};

export const DocumentNode = memo(({ data }: NodeProps) => {
  const Icon = getDocIcon(data.document.doc_type);

  return (
    <div className="group">
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-pink-600"
      />
      
      <div className="w-[150px] bg-pink-900/40 border border-pink-600 rounded-md p-2 shadow-lg hover:shadow-pink-600/50 transition-all cursor-pointer">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="w-3 h-3 text-pink-300 flex-shrink-0" />
          <div className="text-[10px] text-pink-300 font-semibold uppercase truncate">
            {data.document.doc_type}
          </div>
        </div>

        <div className="text-xs font-medium text-pink-100 line-clamp-2 min-h-[28px]">
          {data.document.title}
        </div>

        <div className="text-[9px] text-pink-300/70 mt-1">
          {new Date(data.document.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
          })}
        </div>
      </div>
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
