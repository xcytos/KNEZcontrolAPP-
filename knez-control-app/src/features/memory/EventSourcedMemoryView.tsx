/**
 * Event Sourced Memory View
 * 
 * React component for managing memories using event sourcing pattern
 * Applies Learning 36-39: Event Sourcing Fundamentals, Auditability, Replay
 */

import React, { useEffect, useState } from 'react';
import { 
  getMemoryEventSourcingService, 
  MemoryState, 
  MemoryEventType 
} from '../../services/MemoryEventSourcingService';
import { 
  getMemoryVectorSearchService, 
  MemorySearchResult 
} from '../../services/MemoryVectorSearchService';
import { MemoryGraphVisualization } from './MemoryGraphVisualization';

export const EventSourcedMemoryView: React.FC = () => {
  const [memories, setMemories] = useState<MemoryState[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryState | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'learning' | 'mistake' | 'decision' | 'pattern'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<MemoryState[]>([]);
  const [stats, setStats] = useState<{ totalEvents: number; totalAggregates: number; dbSize: number } | null>(null);
  const [view, setView] = useState<'list' | 'graph'>('list');

  const memoryService = getMemoryEventSourcingService();
  const vectorSearchService = getMemoryVectorSearchService();

  useEffect(() => {
    loadMemories();
    loadStats();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, useSemanticSearch]);

  const performSearch = async () => {
    if (useSemanticSearch) {
      const results = await vectorSearchService.searchMemories(searchQuery, { limit: 20 });
      setSearchResults(results.map(r => r.memory));
    } else {
      const results = memoryService.searchMemories(searchQuery);
      setSearchResults(results);
    }
  };

  const loadMemories = () => {
    const allMemories = memoryService.getAllMemories();
    setMemories(allMemories);
  };

  const loadStats = () => {
    const stats = memoryService.getStats();
    setStats(stats);
  };

  const handleCreateMemory = async (data: {
    type: 'learning' | 'mistake' | 'decision' | 'pattern';
    title: string;
    content: string;
    domain: string;
    tags: string[];
  }) => {
    await memoryService.createMemory(
      data.type,
      data.title,
      data.content,
      data.domain,
      data.tags
    );
    loadMemories();
    loadStats();
    setShowCreateForm(false);
  };

  const handleAddTag = async (memoryId: string, tag: string) => {
    await memoryService.addTag(memoryId, tag);
    loadMemories();
  };

  const handleRemoveTag = async (memoryId: string, tag: string) => {
    await memoryService.removeTag(memoryId, tag);
    loadMemories();
  };

  const handleAddRelation = async (
    memoryId: string,
    relatedMemoryId: string,
    relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on'
  ) => {
    await memoryService.addRelation(memoryId, relatedMemoryId, relationship);
    loadMemories();
  };

  const handleUpdateMemory = async (
    memoryId: string,
    updates: Partial<{
      title: string;
      content: string;
      domain: string;
      tags: string[];
    }>
  ) => {
    await memoryService.updateMemory(memoryId, updates);
    loadMemories();
  };

  const filteredMemories = memories
    .filter(m => filter === 'all' || m.type === filter)
    .filter(m => 
      searchQuery === '' || 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-zinc-100">Event Sourced Memories</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setView(view === 'list' ? 'graph' : 'list')}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
            >
              {view === 'list' ? 'Graph View' : 'List View'}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
            >
              {showCreateForm ? 'Cancel' : 'Create Memory'}
            </button>
            <button
              onClick={loadMemories}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-4 text-[10px] text-zinc-500 mb-4">
            <span>Events: {stats.totalEvents}</span>
            <span>Memories: {stats.totalAggregates}</span>
            <span>DB Size: {(stats.dbSize / 1024).toFixed(1)} KB</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(['all', 'learning', 'mistake', 'decision', 'pattern'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2 py-1 rounded text-xs ${
                filter === type 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search memories..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            onClick={() => setUseSemanticSearch(!useSemanticSearch)}
            className={`px-3 py-1.5 rounded text-xs ${
              useSemanticSearch 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {useSemanticSearch ? 'Semantic' : 'Keyword'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
          <CreateMemoryForm onSubmit={handleCreateMemory} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {/* Memory List or Graph View */}
      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(searchQuery ? searchResults : filteredMemories).map(memory => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onSelect={() => setSelectedMemory(memory)}
              onAddTag={(tag) => handleAddTag(memory.id, tag)}
              onRemoveTag={(tag) => handleRemoveTag(memory.id, tag)}
              onAddRelation={(relatedId, rel) => handleAddRelation(memory.id, relatedId, rel)}
              onUpdate={(updates) => handleUpdateMemory(memory.id, updates)}
            />
          ))}
          {(searchQuery ? searchResults : filteredMemories).length === 0 && (
            <div className="text-center text-zinc-500 text-xs py-8">
              {memories.length === 0 
                ? 'No memories yet. Create your first memory using event sourcing.'
                : searchQuery 
                  ? `No memories found matching "${searchQuery}"`
                  : 'No memories match the current filter.'}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <MemoryGraphVisualization
            onNodeClick={(nodeId) => {
              const memory = memories.find(m => m.id === nodeId);
              if (memory) setSelectedMemory(memory);
            }}
            selectedNodeId={selectedMemory?.id}
          />
        </div>
      )}

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
        />
      )}
    </div>
  );
};

const CreateMemoryForm: React.FC<{
  onSubmit: (data: {
    type: 'learning' | 'mistake' | 'decision' | 'pattern';
    title: string;
    content: string;
    domain: string;
    tags: string[];
  }) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [type, setType] = useState<'learning' | 'mistake' | 'decision' | 'pattern'>('learning');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [domain, setDomain] = useState('development');
  const [tags, setTags] = useState('');
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      title,
      content,
      domain,
      tags: tags.split(',').map(t => t.trim()).filter(t => t)
    });
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setTags(prev => prev ? `${prev},${tagInput.trim()}` : tagInput.trim());
      setTagInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
          >
            <option value="learning">Learning</option>
            <option value="mistake">Mistake</option>
            <option value="decision">Decision</option>
            <option value="pattern">Pattern</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={3}
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none resize-none"
        />
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add tag..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
          >
            Add
          </button>
        </div>
        {tags && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.split(',').map((tag, i) => (
              <span
                key={i}
                className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
        >
          Create Memory
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

const MemoryCard: React.FC<{
  memory: MemoryState;
  onSelect: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddRelation: (relatedId: string, relationship: any) => void;
  onUpdate: (updates: any) => void;
}> = ({ memory, onSelect, onAddTag, onRemoveTag, onAddRelation, onUpdate }) => {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [relationMemoryId, setRelationMemoryId] = useState('');
  const [relationType, setRelationType] = useState<'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on'>('relates_to');

  const handleAddTag = () => {
    if (tagInput.trim()) {
      onAddTag(tagInput.trim());
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleAddRelation = () => {
    if (relationMemoryId.trim()) {
      onAddRelation(relationMemoryId.trim(), relationType);
      setRelationMemoryId('');
      setShowRelationForm(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'learning': return 'bg-green-900/30 text-green-300 border-green-900/50';
      case 'mistake': return 'bg-red-900/30 text-red-300 border-red-900/50';
      case 'decision': return 'bg-blue-900/30 text-blue-300 border-blue-900/50';
      case 'pattern': return 'bg-purple-900/30 text-purple-300 border-purple-900/50';
      default: return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div
      onClick={onSelect}
      className="p-3 border rounded hover:bg-zinc-800 cursor-pointer transition-colors bg-zinc-900 border-zinc-800"
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded border ${getTypeColor(memory.type)}`}>
          {memory.type}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">v{memory.version}</span>
      </div>
      <h3 className="text-sm text-zinc-200 font-medium mb-1">{memory.title}</h3>
      <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{memory.content}</p>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {memory.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-zinc-600">{memory.domain}</span>
      </div>
      
      {/* Tag Input */}
      {showTagInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag..."
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleAddTag(); }}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
          >
            Add
          </button>
        </div>
      )}

      {/* Relation Form */}
      {showRelationForm && (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={relationMemoryId}
            onChange={(e) => setRelationMemoryId(e.target.value)}
            placeholder="Related memory ID..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as any)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="relates_to">Relates to</option>
            <option value="caused">Caused</option>
            <option value="resolved">Resolved</option>
            <option value="similar_to">Similar to</option>
            <option value="depends_on">Depends on</option>
          </select>
          <button
            onClick={(e) => { e.stopPropagation(); handleAddRelation(); }}
            className="w-full px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
          >
            Add Relation
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setShowTagInput(!showTagInput); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          + Tag
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowRelationForm(!showRelationForm); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          + Relation
        </button>
      </div>
    </div>
  );
};

const MemoryDetailModal: React.FC<{
  memory: MemoryState;
  onClose: () => void;
}> = ({ memory, onClose }) => {
  const memoryService = getMemoryEventSourcingService();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const events = memoryService.getMemoryHistory(memory.id);
    setHistory(events);
  }, [memory.id]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-white">Memory Detail</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase">ID</label>
            <p className="text-zinc-300 font-mono text-xs">{memory.id}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Type</label>
            <p className="text-zinc-300">{memory.type}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Title</label>
            <p className="text-zinc-300">{memory.title}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Content</label>
            <p className="text-zinc-300 whitespace-pre-wrap">{memory.content}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Domain</label>
            <p className="text-zinc-300">{memory.domain}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Tags</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {memory.tags.map(tag => (
                <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Relations</label>
            {memory.relations.length > 0 ? (
              <div className="space-y-1 mt-1">
                {memory.relations.map((rel, i) => (
                  <div key={i} className="text-xs bg-zinc-800 p-2 rounded">
                    <span className="text-zinc-400">{rel.relationship}</span>
                    <span className="text-zinc-500 ml-2 font-mono">{rel.relatedMemoryId}</span>
                    <span className="text-zinc-600 ml-2">weight: {rel.weight}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-xs">No relations</p>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Created</label>
            <p className="text-zinc-300">{new Date(memory.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Updated</label>
            <p className="text-zinc-300">{new Date(memory.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Version</label>
            <p className="text-zinc-300 font-mono">{memory.version}</p>
          </div>
          
          {/* Event History */}
          <div className="border-t border-zinc-800 pt-4">
            <label className="text-xs text-zinc-500 uppercase block mb-2">Event History</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((event, i) => (
                <div key={i} className="bg-zinc-950 p-2 rounded text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{event.eventType}</span>
                    <span className="text-zinc-600 font-mono">{event.sequence}</span>
                  </div>
                  <div className="text-zinc-500 mt-1">{new Date(event.timestamp).toLocaleString()}</div>
                  <pre className="text-[10px] text-zinc-600 mt-1 overflow-x-auto">
                    {JSON.stringify(event.eventData, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
