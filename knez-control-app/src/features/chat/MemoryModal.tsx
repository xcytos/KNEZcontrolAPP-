import React, { useEffect, useState } from 'react';
import { MemoryData } from '../../services/StaticMemoryLoader';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onInject: (memory: MemoryData) => Promise<void>;
};

export const MemoryModal: React.FC<Props> = ({ isOpen, onClose, onInject }) => {
  const [availableMemories, setAvailableMemories] = useState<MemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [injectedMemories, setInjectedMemories] = useState<Set<string>>(new Set());
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAvailableMemories();
    }
  }, [isOpen]);

  const loadAvailableMemories = async () => {
    setLoading(true);
    try {
      // Load memories from public/memory files
      const response = await fetch('/memory/knez-control-app.md');
      if (response.ok) {
        const content = await response.text();
        const memories = parseMarkdown(content);
        setAvailableMemories(memories);
      }
    } catch (error) {
      console.error('Failed to load available memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseMarkdown = (content: string): MemoryData[] => {
    const lines = content.split('\n');
    let title = '';
    let type: 'learning' | 'mistake' | 'decision' | 'pattern' = 'learning';
    let domain = 'default';
    let tags: string[] = [];
    let contentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.substring(2);
      } else if (line.toLowerCase().startsWith('domain:')) {
        domain = line.split(':', 2)[1]?.trim() || 'default';
      } else if (line.toLowerCase().startsWith('tags:')) {
        tags = line.split(':', 2)[1]?.trim().split(',').map(t => t.trim()) || [];
      } else if (line.toLowerCase().startsWith('type:')) {
        const typeValue = line.split(':', 2)[1]?.trim().toLowerCase();
        if (['learning', 'mistake', 'decision', 'pattern'].includes(typeValue)) {
          type = typeValue as 'learning' | 'mistake' | 'decision' | 'pattern';
        }
      } else if (line.trim() !== '' && !line.startsWith('---')) {
        contentLines.push(line);
      }
    }

    if (title && contentLines.length > 0) {
      return [{
        type,
        title,
        content: contentLines.join('\n'),
        domain,
        tags
      }];
    }

    return [];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Inject Memory</h3>
        
        {loading ? (
          <div className="text-zinc-500">Loading memories...</div>
        ) : availableMemories.length === 0 ? (
          <div className="text-zinc-500">No memories available for injection.</div>
        ) : (
          <div className="space-y-3">
            {availableMemories.map((memory, idx) => (
              <div key={idx} className="bg-zinc-800 border border-zinc-700 rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-zinc-200">{memory.title}</h4>
                  <span className="text-[10px] text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
                    {memory.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-2 line-clamp-3">{memory.content.slice(0, 200)}...</p>
                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
                    {memory.tags.map((tag, tagIdx) => (
                      <span key={tagIdx} className="text-[9px] text-zinc-500 bg-zinc-700 px-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      setInjecting(true);
                      try {
                        await onInject(memory);
                        setInjectedMemories(prev => new Set(prev).add(memory.title));
                      } catch (error) {
                        console.error('Injection failed:', error);
                      } finally {
                        setInjecting(false);
                      }
                    }}
                    disabled={injectedMemories.has(memory.title) || injecting}
                    className={`px-3 py-1 rounded text-xs ${
                      injectedMemories.has(memory.title)
                        ? 'bg-green-600 text-white cursor-not-allowed'
                        : injecting
                        ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {injectedMemories.has(memory.title) ? 'Injected' : injecting ? 'Injecting...' : 'Inject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
