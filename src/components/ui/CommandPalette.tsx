
import React, { useEffect, useState } from "react";
import { View } from "../layout/Sidebar";
import { exportDiagnosticsBundle } from "../../services/DiagnosticsService";
import { logger } from "../../services/LogService";
import { features } from "../../config/features";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onOpenSettings?: () => void;
  onOpenTaqwinTools?: () => void;
  onTaqwinActivate?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, onOpenSettings, onOpenTaqwinTools, onTaqwinActivate }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    { id: 'chat', label: 'Go to Chat', icon: 'CHAT', action: () => onNavigate('chat') },
    { id: 'extractor', label: 'Open Web Extractor', icon: 'EXT', action: () => onNavigate('extraction') },
    { id: 'memory', label: 'View Memory Graph', icon: 'MEM', action: () => onNavigate('memory') },
    { id: 'replay', label: 'Session Replay', icon: 'RPL', action: () => onNavigate('replay') },
    ...(features.logViews ? [{ id: 'logs', label: 'System Logs', icon: 'LOG', action: () => onNavigate('logs' as View) }] : []),
    { id: 'skills', label: 'Skills', icon: 'SKL', action: () => onNavigate('skills') },
    { id: 'governance', label: 'Governance Settings', icon: 'GOV', action: () => onNavigate('governance') },
    { id: 'diagnostics', label: 'Run Diagnostics (Test Suite)', icon: 'DIAG', action: () => onNavigate('diagnostics') },
    { id: 'updates', label: 'Check Updates', icon: 'UPD', action: () => onNavigate('updates') },
    ...(onOpenSettings ? [{ id: 'settings', label: 'Open Settings', icon: 'SET', action: () => onOpenSettings() }] : []),
    ...(features.taqwinTools && onOpenTaqwinTools ? [{ id: 'taqwin-tools', label: 'Open TAQWIN Tools', icon: 'TAQ', action: () => onOpenTaqwinTools() }] : []),
    ...(features.taqwinTools && onTaqwinActivate ? [{ id: 'taqwin-activate', label: 'TAQWIN ACTIVATE', icon: 'ACT', action: () => onTaqwinActivate() }] : []),
    {
      id: "export-diag",
      label: "Export Diagnostics Bundle",
      icon: "EXP",
      action: () => {
        void (async () => {
          try {
            const res = await exportDiagnosticsBundle();
            logger.info("diagnostics", "Exported diagnostics bundle (command palette)", res);
          } catch (e) {
            logger.error("diagnostics", "Failed to export diagnostics bundle (command palette)", { error: String(e) });
          }
        })();
      }
    }
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
           filtered[selectedIndex].action();
           onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-zinc-800 flex items-center gap-3">
           <span className="text-zinc-500">🔍</span>
           <input 
             autoFocus
             className="bg-transparent text-lg text-white placeholder-zinc-500 outline-none w-full"
             placeholder="Type a command..."
             value={query}
             onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
           />
           <div className="text-[10px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded">ESC</div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
           {filtered.map((cmd, i) => (
             <button
               key={cmd.id}
               onClick={() => { cmd.action(); onClose(); }}
               className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${i === selectedIndex ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
               onMouseEnter={() => setSelectedIndex(i)}
             >
               <span className="text-[10px] px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-800 text-zinc-300">{cmd.icon}</span>
               <span>{cmd.label}</span>
               {i === selectedIndex && <span className="ml-auto text-[10px] opacity-70">↵</span>}
             </button>
           ))}
           {filtered.length === 0 && (
             <div className="p-4 text-center text-zinc-500 text-sm">No commands found</div>
           )}
        </div>
      </div>
    </div>
  );
};
