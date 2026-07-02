import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { File, Code, FileText, Terminal } from 'lucide-react';

const fileIcon = (name: string): React.ReactNode => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx':
      return <Code className="w-3 h-3 text-blue-400" />;
    case 'css': case 'scss':
      return <FileText className="w-3 h-3 text-pink-400" />;
    case 'json': case 'yaml': case 'toml':
      return <FileText className="w-3 h-3 text-amber-400" />;
    case 'rs':
      return <Terminal className="w-3 h-3 text-orange-400" />;
    default:
      return <File className="w-3 h-3 text-zinc-500" />;
  }
};

const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
  emerald: { border: 'border-emerald-600', bg: 'bg-emerald-900/20', text: 'text-emerald-300' },
  blue: { border: 'border-blue-600', bg: 'bg-blue-900/20', text: 'text-blue-300' },
  amber: { border: 'border-amber-600', bg: 'bg-amber-900/20', text: 'text-amber-300' },
  zinc: { border: 'border-zinc-700', bg: 'bg-zinc-900/40', text: 'text-zinc-400' },
};

export const FileNode = memo(({ data }: NodeProps) => {
  const colorKey = (typeof data.sessionColor === 'string' ? data.sessionColor : 'zinc') as string;
  const cs = colorStyles[colorKey] || colorStyles.zinc;
  const hasSession = data.sessionIds?.length > 0;

  return (
    <div className="group">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-zinc-600" />
      <div className={`w-[180px] ${cs.bg} border ${cs.border} rounded-lg p-2.5 shadow-lg hover:shadow-xl transition-shadow cursor-pointer`}>
        <div className="flex items-center gap-1.5 mb-1">
          {fileIcon(data.name)}
          <div className={`text-[10px] font-mono truncate ${cs.text}`}>
            {data.name}
          </div>
        </div>
        <div className="text-[9px] text-zinc-600 font-mono truncate">
          {data.path}
        </div>
        {hasSession && (
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-zinc-800">
            <div className={`text-[9px] ${colorKey === 'emerald' ? 'text-emerald-400' : 'text-blue-400'}`}>
              {data.sessionIds.length} session{data.sessionIds.length !== 1 ? 's' : ''}
            </div>
            <div className="text-[9px] text-zinc-600">{data.accessCount} hits</div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-zinc-600" />
    </div>
  );
});

FileNode.displayName = 'FileNode';
