/**
 * Memory Dashboard Component
 * 
 * A comprehensive dashboard for memory management with visualization capabilities
 * Provides a working foundation for memory GUI without complex D3 dependencies
 * 
 * Features:
 * - Memory list with filtering and search
 * - Session management
 * - Analytics overview
 * - Memory creation and editing
 * - Simple relationship visualization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getUnifiedMemoryAPI } from '../../services/memory/shared/UnifiedMemoryAPI';
import { UnifiedMemory, UnifiedSession } from '../../services/memory/shared/UnifiedMemoryDatabase';

interface MemoryFilters {
  type: string;
  domain: string;
  importance: number;
  tags: string[];
  search: string;
}

interface MemoryStats {
  totalMemories: number;
  totalSessions: number;
  memoriesByType: Record<string, number>;
  memoriesByDomain: Record<string, number>;
  averageImportance: number;
}

export const MemoryDashboard: React.FC = () => {
  const [memories, setMemories] = useState<UnifiedMemory[]>([]);
  const [sessions, setSessions] = useState<UnifiedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<UnifiedMemory | null>(null);
  const [filters, setFilters] = useState<MemoryFilters>({
    type: '',
    domain: '',
    importance: 0,
    tags: [],
    search: ''
  });
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  const [newMemory, setNewMemory] = useState({
    title: '',
    content: '',
    type: 'learning' as const,
    domain: 'general',
    importance: 5,
    tags: [] as string[]
  });

  const api = getUnifiedMemoryAPI();

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [memoriesData, sessionsData, analyticsData] = await Promise.all([
        api.getMemories({ session_id: selectedSession || undefined, limit: 100 }),
        api.getSessions({ limit: 50 }),
        api.getMemoryAnalytics()
      ]);

      setMemories(memoriesData);
      setSessions(sessionsData);
      // Calculate average importance from memories data
      const avgImportance = memoriesData.length > 0 
        ? memoriesData.reduce((sum, mem) => sum + mem.importance, 0) / memoriesData.length 
        : 0;

      setStats({
        totalMemories: analyticsData.total_memories,
        totalSessions: sessionsData.length,
        memoriesByType: analyticsData.memories_by_type,
        memoriesByDomain: analyticsData.memories_by_domain,
        averageImportance: avgImportance
      });
    } catch (error) {
      console.error('Failed to load memory data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSession, api]);

  // Filter memories
  const filteredMemories = memories.filter(memory => {
    if (filters.type && memory.type !== filters.type) return false;
    if (filters.domain && memory.domain !== filters.domain) return false;
    if (filters.importance > 0 && memory.importance < filters.importance) return false;
    if (filters.tags.length > 0 && !filters.tags.some(tag => memory.tags?.includes(tag))) return false;
    if (filters.search && !memory.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !memory.content.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // Create new memory
  const handleCreateMemory = async () => {
    if (!newMemory.title || !newMemory.content || !selectedSession) return;

    setIsCreatingMemory(true);
    try {
      await api.createMemory({
        session_id: selectedSession,
        type: newMemory.type,
        title: newMemory.title,
        content: newMemory.content,
        domain: newMemory.domain,
        tags: newMemory.tags,
        importance: newMemory.importance,
        confidence: 1.0,
        system_origin: 'knez'
      });

      // Reset form and reload data
      setNewMemory({
        title: '',
        content: '',
        type: 'learning',
        domain: 'general',
        importance: 5,
        tags: []
      });
      setIsCreatingMemory(false);
      loadData();
    } catch (error) {
      console.error('Failed to create memory:', error);
      setIsCreatingMemory(false);
    }
  };

  // Delete memory
  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await api.deleteMemory(memoryId);
      loadData();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  // Get memory type color
  const getMemoryTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      learning: 'bg-green-100 text-green-800',
      mistake: 'bg-red-100 text-red-800',
      decision: 'bg-blue-100 text-blue-800',
      pattern: 'bg-purple-100 text-purple-800',
      fact: 'bg-cyan-100 text-cyan-800',
      preference: 'bg-yellow-100 text-yellow-800',
      event: 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Get importance color
  const getImportanceColor = (importance: number): string => {
    if (importance >= 8) return 'text-red-600';
    if (importance >= 6) return 'text-orange-600';
    if (importance >= 4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading memory dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Memory Management Dashboard</h1>
        <p className="text-gray-600">Unified memory system for TAQWIN and KNEZ</p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalMemories}</div>
            <div className="text-sm text-gray-600">Total Memories</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-green-600">{stats.totalSessions}</div>
            <div className="text-sm text-gray-600">Total Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-purple-600">{stats.averageImportance.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Importance</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-orange-600">{filteredMemories.length}</div>
            <div className="text-sm text-gray-600">Filtered Results</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Sessions and Filters */}
        <div className="lg:col-span-1 space-y-4">
          {/* Session Selection */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="font-semibold text-gray-900 mb-3">Sessions</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <button
                onClick={() => setSelectedSession(null)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  !selectedSession ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                All Sessions
              </button>
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    selectedSession === session.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{session.name}</div>
                  <div className="text-xs text-gray-500">{session.system_origin}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="font-semibold text-gray-900 mb-3">Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Search memories..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Types</option>
                  <option value="learning">Learning</option>
                  <option value="mistake">Mistake</option>
                  <option value="decision">Decision</option>
                  <option value="pattern">Pattern</option>
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <select
                  value={filters.domain}
                  onChange={(e) => setFilters(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Domains</option>
                  <option value="general">General</option>
                  <option value="development">Development</option>
                  <option value="learning">Learning</option>
                  <option value="tasks">Tasks</option>
                  <option value="chat">Chat</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Importance: {filters.importance}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.importance}
                  onChange={(e) => setFilters(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Create Memory */}
          {selectedSession && (
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="font-semibold text-gray-900 mb-3">Create Memory</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newMemory.title}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Memory title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={newMemory.content}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={3}
                    placeholder="Memory content..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newMemory.type}
                      onChange={(e) => setNewMemory(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="learning">Learning</option>
                      <option value="mistake">Mistake</option>
                      <option value="decision">Decision</option>
                      <option value="pattern">Pattern</option>
                      <option value="fact">Fact</option>
                      <option value="preference">Preference</option>
                      <option value="event">Event</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importance</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newMemory.importance}
                      onChange={(e) => setNewMemory(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateMemory}
                  disabled={!newMemory.title || !newMemory.content || isCreatingMemory}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isCreatingMemory ? 'Creating...' : 'Create Memory'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Memory List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                Memories {filteredMemories.length > 0 && `(${filteredMemories.length})`}
              </h3>
            </div>
            
            <div className="divide-y max-h-96 overflow-y-auto">
              {filteredMemories.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No memories found matching your filters
                </div>
              ) : (
                filteredMemories.map(memory => (
                  <div
                    key={memory.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedMemory(memory)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{memory.title}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getMemoryTypeColor(memory.type)}`}>
                            {memory.type}
                          </span>
                          <span className={`text-xs font-medium ${getImportanceColor(memory.importance)}`}>
                            {'⭐'.repeat(memory.importance)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {memory.content}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{memory.domain}</span>
                          <span>{memory.system_origin}</span>
                          <span>{new Date(memory.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {memory.tags && memory.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {memory.tags?.map((tag: string) => (
                              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMemory(memory.id);
                        }}
                        className="ml-4 text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedMemory.title}</h2>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded text-sm font-medium ${getMemoryTypeColor(selectedMemory.type)}`}>
                    {selectedMemory.type}
                  </span>
                  <span className={`text-sm font-medium ${getImportanceColor(selectedMemory.importance)}`}>
                    {'⭐'.repeat(selectedMemory.importance)} ({selectedMemory.importance}/10)
                  </span>
                </div>
                
                <div className="text-gray-700 whitespace-pre-wrap">
                  {selectedMemory.content}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Domain:</span>
                    <span className="ml-2 text-gray-600">{selectedMemory.domain}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">System:</span>
                    <span className="ml-2 text-gray-600">{selectedMemory.system_origin}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Created:</span>
                    <span className="ml-2 text-gray-600">
                      {new Date(selectedMemory.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Updated:</span>
                    <span className="ml-2 text-gray-600">
                      {new Date(selectedMemory.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {selectedMemory.tags && selectedMemory.tags.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-900 text-sm">Tags:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedMemory.tags?.map((tag: string) => (
                        <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryDashboard;
