import React, { useEffect, useState } from 'react';
import { getChatMemorySyncService, MemoryCandidate, SyncAnalysisResult } from '../../services/ChatMemorySyncService';
import { X, Check, RefreshCw, Database, Filter } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onInjected?: (count: number) => void;
};

export const ChatMemorySyncModal: React.FC<Props> = ({ isOpen, onClose, onInjected }) => {
  const [analysisResult, setAnalysisResult] = useState<SyncAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'learning' | 'mistake' | 'decision' | 'pattern'>('all');
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    if (isOpen && !analysisResult) {
      analyzeChats();
    }
  }, [isOpen]);

  const analyzeChats = async () => {
    setLoading(true);
    try {
      const syncService = getChatMemorySyncService();
      const result = await syncService.analyzeAllChats();
      setAnalysisResult(result);
      setSelectedCandidates(new Set()); // Reset selection on new analysis
    } catch (error) {
      console.error('Failed to analyze chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (!analysisResult) return;
    
    const filteredCandidates = getFilteredCandidates();
    const allIds = new Set(filteredCandidates.map(c => c.id));
    
    if (selectedCandidates.size === filteredCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(allIds);
    }
  };

  const getFilteredCandidates = (): MemoryCandidate[] => {
    if (!analysisResult) return [];
    
    if (filterType === 'all') {
      return analysisResult.candidates;
    }
    
    return analysisResult.candidates.filter(c => c.type === filterType);
  };

  const injectSelected = async () => {
    if (!analysisResult || selectedCandidates.size === 0) return;
    
    setInjecting(true);
    try {
      const syncService = getChatMemorySyncService();
      const candidatesToInject = analysisResult.candidates.filter(c => selectedCandidates.has(c.id));
      const injectedIds = await syncService.injectCandidates(candidatesToInject);
      
      // Re-analyze to update the list
      await analyzeChats();
      
      if (onInjected) {
        onInjected(injectedIds.length);
      }
    } catch (error) {
      console.error('Failed to inject candidates:', error);
    } finally {
      setInjecting(false);
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'learning':
        return 'bg-blue-600';
      case 'mistake':
        return 'bg-red-600';
      case 'decision':
        return 'bg-green-600';
      case 'pattern':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getFilteredCandidatesCount = (): number => {
    return getFilteredCandidates().length;
  };

  const allSelected = (): boolean => {
    const filtered = getFilteredCandidates();
    return filtered.length > 0 && selectedCandidates.size === filtered.length;
  };

  if (!isOpen) return null;

  const filteredCandidates = getFilteredCandidates();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Chat Memory Sync</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="animate-spin text-zinc-400 mr-2" size={20} />
            <span className="text-zinc-400">Analyzing chat data...</span>
          </div>
        ) : analysisResult ? (
          <div>
            {/* Summary */}
            <div className="bg-zinc-800 border border-zinc-700 rounded p-4 mb-4">
              <div className="flex items-center mb-2">
                <Database className="text-zinc-400 mr-2" size={18} />
                <span className="text-sm font-bold text-zinc-200">Analysis Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-zinc-400">
                <div>Total Sessions: {analysisResult.totalSessions}</div>
                <div>Total Messages: {analysisResult.totalMessages}</div>
                <div>Existing Memories: {analysisResult.existingMemories}</div>
                <div>New Candidates: {analysisResult.candidates.length}</div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-blue-400 font-bold">{analysisResult.summary.learnings}</div>
                  <div className="text-zinc-500">Learnings</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold">{analysisResult.summary.mistakes}</div>
                  <div className="text-zinc-500">Mistakes</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold">{analysisResult.summary.decisions}</div>
                  <div className="text-zinc-500">Decisions</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-400 font-bold">{analysisResult.summary.patterns}</div>
                  <div className="text-zinc-500">Patterns</div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-zinc-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1"
                >
                  <option value="all">All Types</option>
                  <option value="learning">Learnings</option>
                  <option value="mistake">Mistakes</option>
                  <option value="decision">Decisions</option>
                  <option value="pattern">Patterns</option>
                </select>
                <span className="text-xs text-zinc-500">
                  ({getFilteredCandidatesCount()} candidates)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAll}
                  disabled={filteredCandidates.length === 0}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded disabled:opacity-50"
                >
                  {allSelected() ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={analyzeChats}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Candidates List */}
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No memory candidates found
              </div>
            ) : (
              <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`bg-zinc-800 border rounded p-4 ${
                      selectedCandidates.has(candidate.id)
                        ? 'border-blue-500'
                        : 'border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] text-white px-2 py-0.5 rounded ${getTypeColor(candidate.type)}`}>
                            {candidate.type}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {candidate.sourceSessionName}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            Confidence: {(candidate.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-200 mb-1">{candidate.title}</h4>
                        <p className="text-xs text-zinc-400 line-clamp-3">{candidate.content}</p>
                        <div className="flex gap-1 mt-2">
                          {candidate.tags.map((tag, idx) => (
                            <span key={idx} className="text-[9px] text-zinc-500 bg-zinc-700 px-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
              <span className="text-xs text-zinc-500">
                {selectedCandidates.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm"
                >
                  Close
                </button>
                <button
                  onClick={injectSelected}
                  disabled={selectedCandidates.size === 0 || injecting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {injecting ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      Injecting...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Inject Selected ({selectedCandidates.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            No analysis data available
          </div>
        )}
      </div>
    </div>
  );
};
