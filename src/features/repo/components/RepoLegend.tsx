import { Circle, FileEdit, GitCommit } from 'lucide-react';

export const RepoLegend = () => {
  return (
    <div className="flex items-center gap-4 text-xs text-zinc-400 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <span className="text-zinc-500 font-semibold uppercase tracking-wider mr-1">Legend</span>
      <div className="flex items-center gap-1.5">
        <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
        <span>Current Session</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Circle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />
        <span>Other Sessions</span>
      </div>
      <div className="flex items-center gap-1.5">
        <FileEdit className="w-3 h-3 text-amber-400" />
        <span>Modified</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Circle className="w-2.5 h-2.5 fill-zinc-700 text-zinc-700" />
        <span>Untouched</span>
      </div>
      <div className="flex items-center gap-1.5">
        <GitCommit className="w-3 h-3 text-zinc-500" />
        <span>Git-tracked</span>
      </div>
    </div>
  );
};
