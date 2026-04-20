import React from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset
}) => {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.5}
        className="p-1 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom Out"
      >
        <Minus size={16} className="text-zinc-400" />
      </button>
      <span className="text-xs text-zinc-400 w-12 text-center font-mono">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= 3}
        className="p-1 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom In"
      >
        <Plus size={16} className="text-zinc-400" />
      </button>
      <div className="w-px h-4 bg-zinc-800" />
      <button
        onClick={onReset}
        className="p-1 hover:bg-zinc-800 rounded transition-colors"
        title="Reset Zoom"
      >
        <RotateCcw size={16} className="text-zinc-400" />
      </button>
    </div>
  );
};
