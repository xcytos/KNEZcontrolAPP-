import React, { useState, useCallback } from 'react';

interface CreateViewDialogProps {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const CreateViewDialog: React.FC<CreateViewDialogProps> = ({ defaultName, onSave, onClose }) => {
  const [name, setName] = useState(defaultName);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }, [name, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  }, [handleSave, onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-80 pointer-events-auto"
          onKeyDown={handleKeyDown}
        >
          <div className="px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-200">Save View</h3>
          </div>
          <div className="px-4 py-3">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="View name..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
