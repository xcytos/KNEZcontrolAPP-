import React, { useState, useCallback } from 'react';
import { ViewManager } from './ViewManager';

interface SavedViewSelectorProps {
  activeViewId: string | null;
  onSelect: (viewId: string) => void;
}

export const SavedViewSelector: React.FC<SavedViewSelectorProps> = ({ activeViewId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const views = ViewManager.getAll();

  const handleSelect = useCallback((viewId: string) => {
    onSelect(viewId);
    setOpen(false);
  }, [onSelect]);

  const handleDelete = useCallback((e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    ViewManager.delete(viewId);
    if (activeViewId === viewId) {
      ViewManager.setActive(null);
    }
  }, [activeViewId]);

  if (views.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        Views ({views.length})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
            {views.map(view => (
              <div
                key={view.id}
                onClick={() => handleSelect(view.id)}
                className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer ${
                  view.id === activeViewId
                    ? 'bg-blue-900/30 text-blue-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{view.name}</div>
                  <div className="text-[10px] text-zinc-600">{view.sessionId}</div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, view.id)}
                  className="ml-2 p-0.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-400 flex-shrink-0"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
