import { useEffect, useState } from 'react';
import { X, GitCommit, Clock, FileText } from 'lucide-react';
import type { FileNodeData } from '../../../services/repo/types';
import { repoScannerService } from '../../../services/repo/RepoScannerService';

interface FileDetailPanelProps {
  node: FileNodeData;
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string; changes?: string[] }>;
  onClose: () => void;
  sessions: Array<{ session_id: string; display_id: string; name: string }>;
}

export const FileDetailPanel = ({ node, sessionFileMap, onClose, sessions }: FileDetailPanelProps) => {
  const [gitLog, setGitLog] = useState<Array<{ hash: string; date: string; message: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const log = await repoScannerService.getFileLog(node.path);
      setGitLog(log);
      setLoading(false);
    };
    load();
  }, [node.path]);

  const info = sessionFileMap[node.path];

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-200 truncate">{node.name}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors">
          <X className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Path</h3>
          <p className="text-xs text-zinc-300 font-mono break-all">{node.path}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Size</div>
            <div className="text-xs text-zinc-200 font-mono mt-0.5">
              {node.size > 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`}
            </div>
          </div>
          {info && (
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Access Count</div>
              <div className="text-xs text-zinc-200 font-mono mt-0.5">{info.accessCount}</div>
            </div>
          )}
        </div>

        {info && info.sessionIds.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Sessions</h3>
            <div className="space-y-1">
              {info.sessionIds.map(sid => {
                const s = sessions.find(s => s.session_id === sid);
                return (
                  <div key={sid} className="flex items-center gap-2 bg-zinc-800/30 rounded px-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-xs text-zinc-300 truncate">
                      {s?.display_id || sid.slice(0, 8)}
                    </span>
                    {s?.name && (
                      <span className="text-[10px] text-zinc-500 truncate">— {s.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {info && info.lastAccessed && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            <span>Last accessed: {new Date(info.lastAccessed).toLocaleString()}</span>
          </div>
        )}

        {info && info.changes && info.changes.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Changes</h3>
            <div className="flex flex-wrap gap-1">
              {info.changes.map((change, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {change}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
            <GitCommit className="w-3 h-3" />
            Git History
          </h3>
          {loading ? (
            <div className="text-xs text-zinc-600">Loading...</div>
          ) : gitLog.length === 0 ? (
            <div className="text-xs text-zinc-600">No commits found</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {gitLog.slice(0, 20).map(commit => (
                <div key={commit.hash} className="flex items-start gap-2 text-[11px]">
                  <div className="w-1 h-1 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-zinc-300 truncate font-mono">{commit.hash.slice(0, 8)} {commit.message}</div>
                    <div className="text-zinc-600">{new Date(commit.date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
