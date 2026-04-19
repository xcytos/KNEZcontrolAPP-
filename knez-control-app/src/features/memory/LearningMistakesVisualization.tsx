/**
 * Learning and Mistakes Visualization Component
 * 
 * Specialized visualization for learning and mistake memories
 * 
 * Applied Learnings:
 * - Learning 51-53: Knowledge Graph Benefits for learning tracking
 * - Learning 99-102: Taxonomy vs Ontology for learning organization
 * - Learning 122-124: Columnar storage for learning analytics
 */

import React, { useEffect, useState } from 'react';
import { getMemoryEventSourcingService, MemoryState } from '../../services/MemoryEventSourcingService';

export const LearningMistakesVisualization: React.FC = () => {
  const [learnings, setLearnings] = useState<MemoryState[]>([]);
  const [mistakes, setMistakes] = useState<MemoryState[]>([]);
  const [selectedTab, setSelectedTab] = useState<'timeline' | 'patterns' | 'growth'>('timeline');
  const [domainFilter, setDomainFilter] = useState<string>('all');

  const memoryService = getMemoryEventSourcingService();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allMemories = memoryService.getAllMemories();
    setLearnings(allMemories.filter(m => m.type === 'learning'));
    setMistakes(allMemories.filter(m => m.type === 'mistake'));
  };

  const filteredLearnings = domainFilter === 'all' 
    ? learnings 
    : learnings.filter(l => l.domain === domainFilter);

  const filteredMistakes = domainFilter === 'all' 
    ? mistakes 
    : mistakes.filter(m => m.domain === domainFilter);

  const domains = Array.from(new Set([...learnings, ...mistakes].map(m => m.domain)));

  // Calculate growth metrics
  const calculateGrowthMetrics = () => {
    const monthlyLearnings = new Map<string, number>();
    const monthlyMistakes = new Map<string, number>();

    learnings.forEach(learning => {
      const month = learning.createdAt.substring(0, 7); // YYYY-MM
      monthlyLearnings.set(month, (monthlyLearnings.get(month) || 0) + 1);
    });

    mistakes.forEach(mistake => {
      const month = mistake.createdAt.substring(0, 7);
      monthlyMistakes.set(month, (monthlyMistakes.get(month) || 0) + 1);
    });

    return { monthlyLearnings, monthlyMistakes };
  };

  const { monthlyLearnings, monthlyMistakes } = calculateGrowthMetrics();

  // Calculate mistake patterns
  const calculateMistakePatterns = () => {
    const patterns = new Map<string, number>();
    
    mistakes.forEach(mistake => {
      mistake.tags.forEach(tag => {
        patterns.set(tag, (patterns.get(tag) || 0) + 1);
      });
    });

    return Array.from(patterns.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const mistakePatterns = calculateMistakePatterns();

  // Calculate resolution rate
  const calculateResolutionRate = () => {
    const resolvedMistakes = mistakes.filter(m => 
      m.relations.some(r => r.relationship === 'resolved')
    );
    return mistakes.length > 0 ? (resolvedMistakes.length / mistakes.length) * 100 : 0;
  };

  const resolutionRate = calculateResolutionRate();

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-zinc-100">Learning & Mistakes</h3>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
          >
            <option value="all">All Domains</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTab('timeline')}
            className={`text-xs px-3 py-1.5 rounded ${
              selectedTab === 'timeline' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setSelectedTab('patterns')}
            className={`text-xs px-3 py-1.5 rounded ${
              selectedTab === 'patterns' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Patterns
          </button>
          <button
            onClick={() => setSelectedTab('growth')}
            className={`text-xs px-3 py-1.5 rounded ${
              selectedTab === 'growth' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Growth
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{filteredLearnings.length}</div>
            <div className="text-xs text-zinc-500">Learnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{filteredMistakes.length}</div>
            <div className="text-xs text-zinc-500">Mistakes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{resolutionRate.toFixed(0)}%</div>
            <div className="text-xs text-zinc-500">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{domains.length}</div>
            <div className="text-xs text-zinc-500">Domains</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedTab === 'timeline' && (
          <div className="space-y-4">
            {/* Timeline visualization */}
            <div className="relative">
              {filteredLearnings.slice(0, 10).map((learning, i) => (
                <div key={learning.id} className="relative pl-8 pb-4">
                  <div className="absolute left-0 top-0 w-3 h-3 bg-green-500 rounded-full" />
                  <div className="absolute left-1.5 top-3 w-0.5 h-full bg-zinc-800" />
                  <div className="bg-zinc-900 border border-zinc-800 rounded p-3">
                    <div className="text-sm font-medium text-zinc-200">{learning.title}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(learning.createdAt).toLocaleDateString()} • {learning.domain}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {learning.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-green-900/30 text-green-300 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'patterns' && (
          <div className="space-y-6">
            {/* Mistake Patterns */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Mistake Patterns</h4>
              <div className="space-y-2">
                {mistakePatterns.map(({ tag, count }) => (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-32">{tag}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${(count / mistakes.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Distribution */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Domain Distribution</h4>
              <div className="space-y-2">
                {domains.map(domain => {
                  const learningsInDomain = filteredLearnings.filter(l => l.domain === domain).length;
                  const mistakesInDomain = filteredMistakes.filter(m => m.domain === domain).length;
                  const total = learningsInDomain + mistakesInDomain;
                  return (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-32">{domain}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 flex">
                        <div 
                          className="bg-green-500 h-2 rounded-l-full" 
                          style={{ width: `${(learningsInDomain / total) * 100}%` }}
                        />
                        <div 
                          className="bg-red-500 h-2 rounded-r-full" 
                          style={{ width: `${(mistakesInDomain / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-16">{learningsInDomain}L / {mistakesInDomain}M</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'growth' && (
          <div className="space-y-6">
            {/* Monthly Growth Chart */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Monthly Growth</h4>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <div className="flex items-end gap-2 h-40">
                  {Array.from(monthlyLearnings.entries()).map(([month, count]) => {
                    const maxCount = Math.max(...Array.from(monthlyLearnings.values()));
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-green-500/50 rounded-t" style={{ height: `${height}%` }} />
                        <div className="text-[10px] text-zinc-500 mt-1">{month.split('-')[1]}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-zinc-500">
                  <span>Learnings</span>
                  <span>Total: {learnings.length}</span>
                </div>
              </div>
            </div>

            {/* Learning vs Mistake Ratio */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Learning vs Mistake Ratio</h4>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <div className="flex h-8 rounded overflow-hidden">
                  <div 
                    className="bg-green-500 flex items-center justify-center text-xs font-bold text-white"
                    style={{ width: `${(learnings.length / (learnings.length + mistakes.length)) * 100}%` }}
                  >
                    {learnings.length}
                  </div>
                  <div 
                    className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                    style={{ width: `${(mistakes.length / (learnings.length + mistakes.length)) * 100}%` }}
                  >
                    {mistakes.length}
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-zinc-500">
                  <span>Learnings</span>
                  <span>Mistakes</span>
                </div>
              </div>
            </div>

            {/* Resolution Trend */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Resolution Rate</h4>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-blue-400">{resolutionRate.toFixed(0)}%</div>
                  <div className="flex-1">
                    <div className="w-full bg-zinc-800 rounded-full h-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all" 
                        style={{ width: `${resolutionRate}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {mistakes.filter(m => m.relations.some(r => r.relationship === 'resolved')).length} of {mistakes.length} mistakes resolved
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
