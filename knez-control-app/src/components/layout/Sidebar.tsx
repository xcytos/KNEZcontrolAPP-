import { FC } from 'react';

export type View = 'chat' | 'memory' | 'timeline' | 'reflection' | 'infrastructure' | 'mcp' | 'governance';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export const Sidebar: FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const items: { id: View; label: string; icon: string; locked?: boolean }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'timeline', label: 'Timeline', icon: '⏳' },
    { id: 'reflection', label: 'Reflection', icon: '🔮', locked: false },
    { id: 'governance', label: 'Governance', icon: '⚖️' },
    { id: 'infrastructure', label: 'Observatory', icon: '🔭' },
    { id: 'mcp', label: 'MCP Registry', icon: '🧩' },
  ];

  return (
    <div className="w-16 flex flex-col items-center py-4 bg-zinc-900 border-r border-zinc-800 h-full">
      <div className="mb-8">
        <div className="w-8 h-8 bg-zinc-700 rounded-md flex items-center justify-center font-bold text-white">
          K
        </div>
      </div>
      <div className="flex flex-col space-y-4 w-full">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.locked && onViewChange(item.id)}
            disabled={item.locked}
            className={`w-full h-12 flex items-center justify-center transition-colors duration-200 relative group ${
              activeView === item.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            } ${item.locked ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={item.locked ? `${item.label} (Phase Locked)` : item.label}
          >
            <span className="text-xl">{item.icon}</span>
            {activeView === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
