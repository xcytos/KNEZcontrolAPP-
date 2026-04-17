import React, { useState } from 'react';
import { MistakeEntry } from '../../domain/DataContracts';

// TODO: Integrate with TAQWIN mistake tracking system for real mistake data
// Currently using mock data for visualization
const MOCK_MISTAKES: MistakeEntry[] = [
  {
    id: 'mis1',
    summary: 'Ignored Governance Warning',
    context: 'Attempted to modify restricted file without approval.',
    outcome: 'Action blocked by Phase-1 guard.',
    status: 'active',
    recurrenceCount: 2,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mis2',
    summary: 'Rushed Architecture Decision',
    context: 'Skipped "Analyze" step before implementation.',
    outcome: 'Refactoring required later.',
    status: 'archived',
    recurrenceCount: 1,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    resolvedAt: new Date(Date.now() - 43200000).toISOString(),
  }
];

const FILTERS: Array<'active' | 'archived' | 'all'> = ['active', 'archived', 'all'];

export const MistakeLedger: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(MOCK_MISTAKES);

  const filteredMistakes = mistakes.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const handleDispute = (id: string) => {
    // In real app, this would open a modal for reasoning.
    setMistakes(prev => prev.map(m => 
      m.id === id ? { ...m, status: 'disputed', disputeReason: 'User claimed false positive.' } : m
    ));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Mistake Ledger</h3>
        <div className="flex space-x-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === f 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2">
        {filteredMistakes.length === 0 && (
          <p className="text-xs text-zinc-600 italic text-center py-4">No {filter} mistakes found.</p>
        )}
        
        {filteredMistakes.map(m => (
          <div key={m.id} className={`p-3 rounded border border-zinc-800 ${
            m.status === 'active' ? 'bg-red-950/10 border-red-900/30' : 'bg-zinc-900/30'
          }`}>
            <div className="flex justify-between items-start">
              <span className={`text-sm font-medium ${
                m.status === 'active' ? 'text-red-300' : 'text-zinc-400'
              }`}>
                {m.summary}
              </span>
              {m.status === 'active' && (
                <button 
                  onClick={() => handleDispute(m.id)}
                  className="text-[10px] text-zinc-500 hover:text-red-400 underline"
                >
                  Dispute
                </button>
              )}
              {m.status === 'disputed' && (
                 <span className="text-[10px] text-orange-400 uppercase font-bold">Disputed</span>
              )}
            </div>
            
            <p className="text-xs text-zinc-500 mt-1">{m.context}</p>
            
            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
              <span>Recurrence: {m.recurrenceCount}</span>
              <span>{new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
