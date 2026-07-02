import React from 'react';
import { Maximize2, Minimize2, Columns, Layout, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { LensType, LayoutMode, RightPanelContent } from './types';
import { LENS_REGISTRY } from './types';

const LAYOUT_ICONS: Record<LayoutMode, React.ReactNode> = {
  full: <Layout className="w-4 h-4" />,
  compact: <Minimize2 className="w-4 h-4" />,
  split: <Columns className="w-4 h-4" />,
  focus: <Maximize2 className="w-4 h-4" />,
};

interface ToolbarProps {
  activeLens: LensType;
  layoutMode: LayoutMode;
  rightPanel: RightPanelContent;
  onCycleLayout: () => void;
  onToggleRightPanel: () => void;
  sessionContextName?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeLens,
  layoutMode,
  rightPanel,
  onCycleLayout,
  onToggleRightPanel,
  sessionContextName,
}) => {
  const lensDef = LENS_REGISTRY.find(l => l.id === activeLens);

  return (
    <div className="h-10 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-zinc-100">
          {lensDef?.label || 'Dashboard'}
        </h1>
        {sessionContextName && (
          <span className="text-xs text-zinc-500">/ {sessionContextName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCycleLayout}
          className="w-7 h-7 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
          title={`Layout: ${layoutMode}`}
        >
          {LAYOUT_ICONS[layoutMode]}
        </button>
        <button
          onClick={onToggleRightPanel}
          className="w-7 h-7 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
          title={rightPanel === 'none' ? 'Show Panel' : 'Hide Panel'}
        >
          {rightPanel === 'none' ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
