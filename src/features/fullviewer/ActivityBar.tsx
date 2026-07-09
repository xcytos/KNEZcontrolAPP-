import React from 'react';
import { LayoutDashboard, BarChart3, Columns2, HardDrive, Network, GitBranch, Terminal, MessageSquare, ChevronLeft } from 'lucide-react';
import type { LensType } from './types';

const LENS_ICONS: Record<LensType, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  evolution: <BarChart3 className="w-5 h-5" />,
  combined: <Columns2 className="w-5 h-5" />,
  explorer: <HardDrive className="w-5 h-5" />,
  graph: <Network className="w-5 h-5" />,
  repository: <GitBranch className="w-5 h-5" />,
  playground: <Terminal className="w-5 h-5" />,
  chat: <MessageSquare className="w-5 h-5" />,
};

const LENS_ORDER: LensType[] = ['dashboard', 'evolution', 'combined', 'explorer', 'graph', 'repository', 'playground', 'chat'];

interface ActivityBarProps {
  activeLens: LensType;
  onLensChange: (lens: LensType) => void;
  showActivityBar: boolean;
  onToggle: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeLens, onLensChange, showActivityBar, onToggle }) => {
  if (!showActivityBar) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-16 bg-zinc-900 border border-zinc-800 rounded-r-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all z-10"
        title="Show Activity Bar"
      >
        <ChevronLeft className="w-4 h-4 rotate-180" />
      </button>
    );
  }

  return (
    <div className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-1">
      {LENS_ORDER.map(lens => (
        <button
          key={lens}
          onClick={() => onLensChange(lens)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            activeLens === lens
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
          title={lens.charAt(0).toUpperCase() + lens.slice(1)}
        >
          {LENS_ICONS[lens]}
        </button>
      ))}
      <div className="flex-1" />
      <button
        onClick={onToggle}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
        title="Hide Activity Bar"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
};
