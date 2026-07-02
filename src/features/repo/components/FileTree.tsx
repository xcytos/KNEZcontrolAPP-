import { useMemo, useState } from 'react';
import { Search, File } from 'lucide-react';
import type { FileNodeData } from '../../../services/repo/types';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeProps {
  files: FileNodeData[];
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }>;
  currentSessionId?: string;
  onFileSelect: (node: FileNodeData) => void;
  selectedPath?: string;
}

export const FileTree = ({ files, sessionFileMap, currentSessionId, onFileSelect, selectedPath }: FileTreeProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();

    const filterNodes = (nodes: FileNodeData[]): FileNodeData[] => {
      return nodes.reduce<FileNodeData[]>((acc, node) => {
        if (node.name.toLowerCase().includes(query)) {
          acc.push(node);
        } else if (node.type === 'directory' && node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren });
          }
        }
        return acc;
      }, []);
    };

    return filterNodes(files);
  }, [files, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 flex-1 bg-zinc-900 rounded-lg px-2 py-1.5 border border-zinc-800">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 outline-none flex-1 placeholder-zinc-600"
          />
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">{files.length} files</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
            <File className="w-8 h-8" />
            <span className="text-xs">No files found</span>
          </div>
        ) : (
          filteredFiles.map(node => (
            <FileTreeNode
              key={node.path}
              node={node}
              sessionFileMap={sessionFileMap}
              currentSessionId={currentSessionId}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))
        )}
      </div>
    </div>
  );
};
