import { memo, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FileEdit, FileText, Image, Code, Terminal } from 'lucide-react';
import type { FileNodeData } from '../../../services/repo/types';

interface FileTreeNodeProps {
  node: FileNodeData;
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }>;
  currentSessionId?: string;
  onFileSelect: (node: FileNodeData) => void;
  selectedPath?: string;
}

const fileIcon = (name: string): React.ReactNode => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <Code className="w-3.5 h-3.5 text-blue-400" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileText className="w-3.5 h-3.5 text-pink-400" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return <FileEdit className="w-3.5 h-3.5 text-amber-400" />;
    case 'png':
    case 'jpg':
    case 'svg':
    case 'ico':
      return <Image className="w-3.5 h-3.5 text-purple-400" />;
    case 'rs':
      return <Terminal className="w-3.5 h-3.5 text-orange-400" />;
    default:
      return <File className="w-3.5 h-3.5 text-zinc-500" />;
  }
};

const getFileColor = (
  node: FileNodeData,
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }>,
  currentSessionId?: string,
): string => {
  const info = sessionFileMap[node.path];
  if (!info) {
    if (node.gitStatus) return 'text-amber-400';
    if (node.type === 'directory') return 'text-zinc-400';
    return 'text-zinc-600';
  }
  if (currentSessionId && info.sessionIds.includes(currentSessionId)) {
    return 'text-emerald-400';
  }
  if (info.sessionIds.length > 0) {
    return 'text-blue-400';
  }
  return 'text-zinc-600';
};

const getRowBg = (
  node: FileNodeData,
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }>,
  currentSessionId?: string,
  selectedPath?: string,
): string => {
  if (selectedPath === node.path) return 'bg-blue-600/20';
  const info = sessionFileMap[node.path];
  if (!info) {
    if (node.gitStatus) return 'hover:bg-amber-900/10';
    return 'hover:bg-zinc-800/30';
  }
  if (currentSessionId && info.sessionIds.includes(currentSessionId)) {
    return 'hover:bg-emerald-900/20';
  }
  if (info.sessionIds.length > 0) {
    return 'hover:bg-blue-900/20';
  }
  return 'hover:bg-zinc-800/30';
};

export const FileTreeNode = memo(({ node, sessionFileMap, currentSessionId, onFileSelect, selectedPath }: FileTreeNodeProps) => {
  const [expanded, setExpanded] = useState(node.depth <= 2);

  const isDir = node.type === 'directory';
  const color = getFileColor(node, sessionFileMap, currentSessionId);
  const bg = getRowBg(node, sessionFileMap, currentSessionId, selectedPath);
  const paddingLeft = `${node.depth * 16 + 8}px`;
  const hasSession = !!sessionFileMap[node.path];

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onFileSelect(node);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded transition-colors ${bg} group`}
        style={{ paddingLeft }}
        onClick={handleClick}
        title={node.path}
      >
        {isDir ? (
          <span className="w-4 h-4 flex items-center justify-center text-zinc-600">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-4" />
        )}

        <span className="shrink-0">{isDir ? <Folder className={`w-3.5 h-3.5 ${color}`} /> : fileIcon(node.name)}</span>

        <span className={`text-xs truncate flex-1 ${color} ${!hasSession && !node.gitStatus && !isDir ? 'opacity-50' : ''}`}>
          {node.name}
        </span>

        {node.gitStatus && (
          <span className={`text-[10px] font-mono uppercase ${
            node.gitStatus.startsWith('?') ? 'text-amber-400' :
            node.gitStatus.startsWith('M') ? 'text-yellow-400' :
            node.gitStatus.startsWith('D') ? 'text-red-400' :
            'text-zinc-500'
          }`}>
            {node.gitStatus.startsWith('??') ? 'U' :
             node.gitStatus.startsWith('M') ? 'M' :
             node.gitStatus.startsWith('D') ? 'D' : node.gitStatus}
          </span>
        )}

        {hasSession && (
          <span className="text-[10px] text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            {sessionFileMap[node.path].accessCount}
          </span>
        )}
      </div>

      {isDir && expanded && node.children?.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          sessionFileMap={sessionFileMap}
          currentSessionId={currentSessionId}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
});

FileTreeNode.displayName = 'FileTreeNode';
