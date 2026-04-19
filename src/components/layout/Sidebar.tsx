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
  Zap,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { tabErrorStore } from '../../services/TabErrorStore';
import { features } from '../../config/features';
import { Badge } from '../ui/core/Badge';

export type View = 'chat' | 'memory' | 'timeline' | 'reflection' | 'infrastructure' | 'mcp' | 'governance' | 'agent' | 'logs' | 'replay' | 'updates' | 'extraction' | 'diagnostics' | 'skills';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  tabErrors?: Partial<Record<View, boolean>>;
}

interface Category {
  id: string;
  label: string;
  icon: React.FC<any>;
  items: { id: View; label: string; icon: React.FC<any>; locked?: boolean }[];
}

export const Sidebar: FC<SidebarProps> = ({ activeView, onViewChange, tabErrors }) => {
  const [errors, setErrors] = useState(() => tabErrorStore.get());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  useEffect(() => tabErrorStore.subscribe(setErrors), []);
  const mergedErrors = { ...errors, ...(tabErrors ?? {}) };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const isCategoryActive = (category: Category) => {
    return category.items.some(item => item.id === activeView);
  };

  const categories: Category[] = [
    {
      id: 'ai-ops',
      label: 'AI Operations',
      icon: Brain,
      items: [
        { id: 'chat', label: 'Chat', icon: MessageSquare },
        { id: 'agent', label: 'Agent Loop', icon: Activity },
        { id: 'memory', label: 'Memory', icon: Brain },
      ]
    },
    {
      id: 'dev-tools',
      label: 'Development',
      icon: Wrench,
      items: [
        { id: 'skills', label: 'Skills', icon: Wrench },
        ...(features.mcpViews ? [{ id: 'mcp' as const, label: 'MCP Registry', icon: Puzzle }] : []),
        { id: 'diagnostics', label: 'Diagnostics', icon: Cpu },
      ]
    },
    {
      id: 'observability',
      label: 'Observability',
      icon: Server,
      items: [
        { id: 'timeline', label: 'Timeline', icon: Clock },
        { id: 'infrastructure', label: 'Observatory', icon: Server },
        ...(features.logViews ? [{ id: 'logs' as const, label: 'System Logs', icon: TerminalSquare }] : []),
        { id: 'updates', label: 'Updates', icon: Zap },
      ]
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: Shield,
      items: [
        { id: 'replay', label: 'Replay', icon: PlayCircle },
        { id: 'extraction', label: 'Extractor', icon: Database },
        { id: 'reflection', label: 'Reflection', icon: BookOpen, locked: false },
        { id: 'governance', label: 'Governance', icon: Shield },
      ]
    }
  ];

  return (
    <div className="group/sidebar w-16 hover:w-64 transition-all duration-200 flex flex-col items-center hover:items-stretch py-4 bg-zinc-900 border-r border-zinc-800 h-full scrollbar-hide overflow-y-auto">
      <div className="mb-6 flex-shrink-0 px-2">
        <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-white border border-zinc-700 shadow-lg mx-auto group-hover/sidebar:mx-0">
          <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">K</span>
        </div>
      </div>
      <div className="flex flex-col space-y-1 w-full px-2">
        {categories.map((category) => {
          const isCollapsed = collapsedCategories.has(category.id);
          const isActive = isCategoryActive(category);
          
          return (
            <div key={category.id} className="flex flex-col">
              <button
                onClick={() => toggleCategory(category.id)}
                className={`w-full h-9 flex items-center justify-center group-hover/sidebar:justify-start gap-2 rounded-lg transition-all duration-200 relative group px-0 group-hover/sidebar:px-2 ${
                  isActive && !isCollapsed
                    ? 'bg-blue-600/20 text-blue-400' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
                title={category.label}
              >
                <category.icon size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                <span className="hidden group-hover/sidebar:block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
                  {category.label}
                </span>
                <span className="hidden group-hover/sidebar:block ml-auto">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
              </button>
              
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => !item.locked && onViewChange(item.id)}
                      disabled={item.locked}
                      className={`w-full h-9 flex items-center justify-center group-hover/sidebar:justify-start gap-3 rounded-lg transition-all duration-200 relative group px-0 group-hover/sidebar:px-3 ${
                        activeView === item.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                      } ${item.locked ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title={item.locked ? `${item.label} (Phase Locked)` : item.label}
                      role="menuitem"
                      aria-current={activeView === item.id ? 'true' : undefined}
                      aria-disabled={item.locked}
                      aria-label={item.label}
                    >
                      <item.icon size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                      <span className="hidden group-hover/sidebar:block text-xs font-medium text-zinc-200 whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.label}
                      </span>
                      {!!mergedErrors?.[item.id] && (
                        <Badge variant="error" className="absolute right-2 top-2 px-1" data-testid={`sidebar-error-${item.id}`} aria-label={`${item.label} has errors`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 block" />
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
