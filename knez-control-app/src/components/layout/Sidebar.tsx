import { FC, useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Activity, 
  Brain, 
  Clock, 
  PlayCircle, 
  Database, 
  Cpu, 
  Wrench, 
  BookOpen, 
  Shield, 
  Server, 
  Puzzle, 
  TerminalSquare, 
  Zap
} from 'lucide-react';
import { tabErrorStore } from '../../services/TabErrorStore';
import { features } from '../../config/features';

export type View = 'chat' | 'memory' | 'timeline' | 'reflection' | 'infrastructure' | 'mcp' | 'governance' | 'agent' | 'logs' | 'replay' | 'updates' | 'extraction' | 'diagnostics' | 'skills';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  tabErrors?: Partial<Record<View, boolean>>;
}

export const Sidebar: FC<SidebarProps> = ({ activeView, onViewChange, tabErrors }) => {
  const [errors, setErrors] = useState(() => tabErrorStore.get());
  useEffect(() => tabErrorStore.subscribe(setErrors), []);
  const mergedErrors = { ...errors, ...(tabErrors ?? {}) };
  const items: { id: View; label: string; icon: React.FC<any>; locked?: boolean }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'agent', label: 'Agent Loop', icon: Activity },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'replay', label: 'Replay', icon: PlayCircle },
    { id: 'extraction', label: 'Extractor', icon: Database },
    { id: 'diagnostics', label: 'Diagnostics', icon: Cpu },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'reflection', label: 'Reflection', icon: BookOpen, locked: false },
    { id: 'governance', label: 'Governance', icon: Shield },
    { id: 'infrastructure', label: 'Observatory', icon: Server },
    ...(features.mcpViews ? [{ id: 'mcp' as const, label: 'MCP Registry', icon: Puzzle }] : []),
    ...(features.logViews ? [{ id: 'logs' as const, label: 'System Logs', icon: TerminalSquare }] : []),
    { id: 'updates', label: 'Updates', icon: Zap },
  ];

  return (
    <div className="group/sidebar w-16 hover:w-56 transition-all duration-200 flex flex-col items-center hover:items-stretch py-4 bg-zinc-900 border-r border-zinc-800 h-full scrollbar-hide overflow-y-auto">
      <div className="mb-8 flex-shrink-0 px-2">
        <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-white border border-zinc-700 shadow-lg mx-auto group-hover/sidebar:mx-0">
          <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">K</span>
        </div>
      </div>
      <div className="flex flex-col space-y-2 w-full px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.locked && onViewChange(item.id)}
            disabled={item.locked}
            className={`w-full h-11 flex items-center justify-center group-hover/sidebar:justify-start gap-3 rounded-xl transition-all duration-200 relative group px-0 group-hover/sidebar:px-3 ${
              activeView === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            } ${item.locked ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={item.locked ? `${item.label} (Phase Locked)` : item.label}
          >
            <item.icon size={20} strokeWidth={2} className="shrink-0" />
            <span className="hidden group-hover/sidebar:block text-xs font-medium text-zinc-200 whitespace-nowrap overflow-hidden text-ellipsis">
              {item.label}
            </span>
            {!!mergedErrors?.[item.id] && (
              <span data-testid={`sidebar-error-${item.id}`} className="absolute right-2 top-2 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
