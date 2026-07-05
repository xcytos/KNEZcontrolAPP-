import React, { useState, useEffect } from 'react';
import { FileText, Folder, Clock, Code, X, GitBranch, Terminal } from 'lucide-react';

interface FileDetail {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  content?: string;
  language?: string;
}

export const FileDetailPanel: React.FC<{
  onClose?: () => void;
  file?: FileDetail | null;
}> = ({ onClose, file: externalFile }) => {
  const [file, setFile] = useState<FileDetail | null>(externalFile || null);

  useEffect(() => {
    if (externalFile) setFile(externalFile);
  }, [externalFile]);

  useEffect(() => {
    const handler = (e: CustomEvent<FileDetail>) => {
      setFile(e.detail);
    };
    window.addEventListener('fullviewer:file-selected' as any, handler as any);
    return () => window.removeEventListener('fullviewer:file-selected' as any, handler as any);
  }, []);

  if (!file) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">File Detail</h3>
          {onClose && (
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs p-4 text-center">
          Select a file from Repository or Explorer lens
        </div>
      </div>
    );
  }

  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLanguage = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
      rs: 'Rust', py: 'Python', go: 'Go', java: 'Java', rb: 'Ruby',
      css: 'CSS', scss: 'SCSS', html: 'HTML', json: 'JSON', md: 'Markdown',
      yml: 'YAML', yaml: 'YAML', toml: 'TOML', sql: 'SQL', sh: 'Shell',
      ps1: 'PowerShell', xml: 'XML', svg: 'SVG',
    };
    return ext ? langMap[ext] || ext.toUpperCase() : 'Unknown';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200">File Detail</h3>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="flex items-center gap-3">
          {file.type === 'directory' ? (
            <Folder className="w-8 h-8 text-yellow-500" />
          ) : (
            <FileText className="w-8 h-8 text-blue-400" />
          )}
          <div>
            <h4 className="text-sm font-medium text-zinc-200 break-all">{file.name}</h4>
            <span className="text-xs text-zinc-500">{getLanguage(file.name)}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Folder className="w-3 h-3 shrink-0" />
            <span className="truncate">{file.path}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Code className="w-3 h-3 shrink-0" />
            <span>{formatSize(file.size)}</span>
          </div>
          {file.lastModified && (
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{new Date(file.lastModified).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('knez-navigate', { detail: { view: 'terminal-sandbox' } }));
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-all"
            >
              <Terminal className="w-3 h-3" />
              Open in Terminal
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('fullviewer:git-log', { detail: { filePath: file.path } }));
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-all"
            >
              <GitBranch className="w-3 h-3" />
              Git Log
            </button>
          </div>
        </div>

        {file.content && (
          <div className="border-t border-zinc-800 pt-3">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Preview</h4>
            <pre className="text-xs text-zinc-400 bg-zinc-900 rounded-lg p-3 overflow-x-auto max-h-60">
              {file.content.slice(0, 2000)}
              {file.content.length > 2000 && '\n... (truncated)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDetailPanel;
