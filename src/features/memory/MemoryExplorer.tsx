import React, { useEffect, useState } from "react";
import { KnowledgeBaseView } from "./KnowledgeBaseView";
import { useStatus } from "../../contexts/useStatus";
import { EventSourcedMemoryView } from "./EventSourcedMemoryView";
import { getSimpleMemoryStorage, SimpleMemoryState } from "../../services/memory/storage/SimpleMemoryStorage";
import { SessionMemoryPanel } from "./SessionMemoryPanel";
import { ChatMemorySyncService } from "../../services/chat/sync/ChatMemorySyncService";

export const MemoryExplorer: React.FC<{ sessionId: string | null; readOnly: boolean }> = ({ sessionId, readOnly: _readOnly }) => {
  const { online } = useStatus();
  const [memories, setMemories] = useState<SimpleMemoryState[]>([]);
  const [activeTab, setActiveTab] = useState<"memories" | "knowledge" | "eventsourced">("memories");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleMemoryState[]>([]);
  const [, setEventSourcedMemories] = useState<SimpleMemoryState[]>([]);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [since, setSince] = useState<string | null>(null);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [rawStateExpanded, setRawStateExpanded] = useState(false);
  const memoryService = getSimpleMemoryStorage();
  const syncService = new ChatMemorySyncService();

  // State persistence to localStorage
  useEffect(() => {
    // Load saved states from localStorage
    const savedStates = localStorage.getItem('memoryExplorerStates');
    if (savedStates) {
      try {
        const states = JSON.parse(savedStates);
        setDashboardCollapsed(states.dashboardCollapsed ?? true);
        setSidebarCollapsed(states.sidebarCollapsed ?? true);
        setRawStateExpanded(states.rawStateExpanded ?? false);
      } catch (e) {
        console.warn('Failed to load memory explorer states:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save states to localStorage whenever they change
    const states = {
      dashboardCollapsed,
      sidebarCollapsed,
      rawStateExpanded
    };
    localStorage.setItem('memoryExplorerStates', JSON.stringify(states));
  }, [dashboardCollapsed, sidebarCollapsed, rawStateExpanded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search memories..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      
      // Number keys for tab switching
      if (e.key === '1' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setActiveTab('memories');
      } else if (e.key === '2' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setActiveTab('eventsourced');
      } else if (e.key === '3' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setActiveTab('knowledge');
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
      
      // Ctrl/Cmd + D to toggle dashboard
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setDashboardCollapsed(prev => !prev);
      }
      
      // Ctrl/Cmd + S to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      
      // Ctrl/Cmd + / for keyboard help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  const toggleMemoryExpansion = (memoryId: string) => {
    setExpandedMemories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memoryId)) {
        newSet.delete(memoryId);
      } else {
        newSet.add(memoryId);
      }
      return newSet;
    });
  };

  // Compressed Memory Card Component with expand-on-click
  const MemoryCard: React.FC<{
    memory: SimpleMemoryState;
    isExpanded: boolean;
    onToggleExpand: () => void;
  }> = ({ memory, isExpanded, onToggleExpand }) => {
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'learning': return 'bg-emerald-900/30 border-emerald-700 text-emerald-400';
        case 'mistake': return 'bg-red-900/30 border-red-700 text-red-400';
        case 'decision': return 'bg-blue-900/30 border-blue-700 text-blue-400';
        case 'pattern': return 'bg-purple-900/30 border-purple-700 text-purple-400';
        default: return 'bg-zinc-900/30 border-zinc-700 text-zinc-400';
      }
    };

    return (
      <div 
        className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg overflow-hidden hover:border-zinc-600/50 hover:bg-zinc-800/70 transition-all duration-200 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Compressed State - Title, Type, Date Only */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-medium text-zinc-100 truncate hover:text-zinc-50 transition-colors">
                  {memory.title}
                </h3>
                <span className={`px-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap flex-shrink-0 ${getTypeColor(memory.type)}`}>
                  {memory.type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{memory.domain}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {memory.tags && memory.tags.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {memory.tags.length} tag{memory.tags.length !== 1 ? 's' : ''}
                </span>
              )}
              <svg 
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Expanded State - Full Content and Tags */}
          <div 
            className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
          >
            <div className="border-t border-zinc-700/30 pt-4">
              <div className="text-sm text-zinc-300 leading-relaxed mb-4">
                <div className="whitespace-pre-wrap">
                  {memory.content}
                </div>
              </div>

              {/* Tags */}
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {memory.tags.map((tag, index) => (
                    <span 
                      key={index} 
                      className="text-xs px-2 py-1 bg-zinc-700/50 rounded-full text-zinc-300 border border-zinc-600/50 hover:bg-zinc-700 transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    let interval: any;
    
    if (!sessionId) {
      setMemories([]);
      setError("No session selected.");
      setSince(null);
      return;
    }
    if (!online) {
      setMemories([]);
      setError("Offline. Start KNEZ to load memories.");
      setSince(null);
      return;
    }
    setError(null);

    const fetchMemories = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        // Use SimpleMemoryStorage instead of event-sourced memories
        const allMemories = await memoryService.getAllMemories();
        const sessionMemories = sessionId 
          ? allMemories.filter(memory => memory.sourceSessionId === sessionId)
          : allMemories;
        
        const incoming = sessionMemories.slice().reverse();
        
        // Update since timestamp based on newest memory
        const newSince = incoming.length > 0 ? incoming[0].createdAt : null;
        if (newSince && newSince !== since) setSince(newSince);
        
        if (since) {
          setMemories(prev => [...incoming, ...prev]);
        } else {
          setMemories(incoming);
        }
      } catch (e) {
        setError("Failed to load memories.");
        console.error(e);
      }
    };

    fetchMemories();
    interval = setInterval(fetchMemories, 3000);
    return () => clearInterval(interval);
  }, [sessionId, online, since]);

      
    useEffect(() => {
      if (searchQuery) {
        const filtered = memories.filter(m => 
          m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.content?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
    }, [searchQuery, memories]);

    const handleSessionSync = async (sessionIdToSync: string) => {
      try {
        const analysisResult = await syncService.analyzeAllChats();
        const sessionCandidates = analysisResult.candidates.filter(
          candidate => candidate.sourceSessionId === sessionIdToSync
        );
        
        if (sessionCandidates.length > 0) {
          for (const candidate of sessionCandidates) {
            await memoryService.createMemory(
              candidate.type,
              candidate.title,
              candidate.content,
              candidate.domain,
              candidate.tags,
              candidate.metadata,
              candidate.sourceSessionId,
              candidate.sourceSessionName,
              candidate.sourceMessageIds
            );
          }
          
          if (sessionIdToSync === sessionId) {
            const updatedMemories = (await memoryService.getAllMemories()).filter(
              memory => memory.metadata?.sourceSessionId === sessionIdToSync
            );
            setEventSourcedMemories(updatedMemories);
          }
        }
      } catch (error) {
        console.error('Failed to sync session:', error);
        setError('Failed to sync session memories');
      }
    };

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-900">
      {/* Collapsible Sessions Rail - Icon-only by default */}
      <div 
        className={`${sidebarCollapsed ? 'w-16' : 'w-80'} border-r border-zinc-800 bg-zinc-900/50 flex flex-col transition-all duration-300`}
        onMouseEnter={() => !sidebarCollapsed && setSidebarCollapsed(false)}
      >
        {/* Sidebar Toggle Button */}
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            title={sidebarCollapsed ? "Expand Sessions" : "Collapse Sessions"}
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Session Content */}
        {!sidebarCollapsed ? (
          <div className="flex-1 overflow-y-auto">
            <SessionMemoryPanel
              selectedSessionId={sessionId}
              onSessionSelect={async (selectedSessionId) => {
                const sessionMemories = (await memoryService.getAllMemories()).filter(
                  memory => memory.sourceSessionId === selectedSessionId
                );
                setMemories(sessionMemories.slice().reverse());
                setEventSourcedMemories(sessionMemories);
              }}
              onSessionSync={handleSessionSync}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center py-4 space-y-4">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              title="Show Sessions"
            >
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
            <div className="text-xs text-zinc-500 text-center px-2">
              Sessions
            </div>
          </div>
        )}
      </div>
      
      {/* Main Memory Explorer Content - Flex-grow workspace */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Merged Single Header Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Title + Tabs */}
              <div className="flex items-center gap-6">
                <h1 className="text-lg font-bold text-zinc-100">Memory Explorer</h1>
                
                {/* Tab Navigation */}
                <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab("memories")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'memories' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                    }`}
                  >
                    Memories
                  </button>
                  <button 
                    onClick={() => setActiveTab("eventsourced")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'eventsourced' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                    }`}
                  >
                    Event Sourced
                  </button>
                  <button 
                    onClick={() => setActiveTab("knowledge")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'knowledge' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                    }`}
                  >
                    Knowledge Base
                  </button>
                </div>
              </div>
              
              {/* Right: Search + Dashboard Toggle */}
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search memories... (⌘K)" 
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 w-56 focus:w-64 transition-all duration-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder-zinc-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute right-2 top-1.5 flex items-center gap-1">
                    {searchQuery && (
                      <div className="text-xs text-zinc-500 font-medium">
                        {searchResults.length}
                      </div>
                    )}
                    <div className="text-xs text-zinc-600 font-mono bg-zinc-700 px-1 py-0.5 rounded">
                      ⌘K
                    </div>
                  </div>
                </div>

                {/* Dashboard Toggle Button */}
                <button
                  onClick={() => setDashboardCollapsed(!dashboardCollapsed)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  title={dashboardCollapsed ? "Show Dashboard" : "Hide Dashboard"}
                >
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Full width scroll container */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="text-red-400 text-sm font-medium">{error}</div>
            </div>
          )}

          {activeTab === "memories" && (
            <div className="p-6">
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((memory: SimpleMemoryState) => (
                    <MemoryCard 
                      key={memory.id} 
                      memory={memory} 
                      isExpanded={expandedMemories.has(memory.id)}
                      onToggleExpand={() => toggleMemoryExpansion(memory.id)}
                    />
                  ))}
                </div>
              ) : memories.length > 0 ? (
                <div className="space-y-3">
                  {memories.map((memory: SimpleMemoryState) => (
                    <MemoryCard 
                      key={memory.id} 
                      memory={memory} 
                      isExpanded={expandedMemories.has(memory.id)}
                      onToggleExpand={() => toggleMemoryExpansion(memory.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    {memories.length === 0 
                      ? 'No memories yet' 
                      : searchQuery 
                        ? `No memories found matching "${searchQuery}"`
                        : 'No memories match the current filter'}
                  </h3>
                  <p className="text-sm text-zinc-500 max-w-md">
                    {memories.length === 0 
                      ? 'Create your first memory by syncing a chat session or using the event sourcing feature.'
                      : 'Try adjusting your search terms or filters to find what you\'re looking for.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "eventsourced" && (
            <div className="p-6">
              <EventSourcedMemoryView />
            </div>
          )}

          {activeTab === "knowledge" && (
            <div className="p-6">
              <KnowledgeBaseView />
            </div>
          )}
        </div>
      </div>

      {/* Sliding Cognitive State Dashboard */}
      <div className={`fixed right-0 top-0 h-full bg-zinc-900/95 border-l border-zinc-800 transition-transform duration-300 z-40 ${
        dashboardCollapsed ? 'translate-x-full' : 'translate-x-0'
      }`}>
        <div className="w-96 h-full flex flex-col">
          {/* Dashboard Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-medium text-zinc-200">Cognitive State</h3>
            <button
              onClick={() => setDashboardCollapsed(true)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Overview Metrics */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Overview</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-zinc-100">{memories.length}</div>
                  <div className="text-xs text-zinc-400">Total Memories</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-zinc-100">{online ? 'Online' : 'Offline'}</div>
                  <div className="text-xs text-zinc-400">System Status</div>
                </div>
              </div>
            </div>

            {/* Collapsible Raw State Dump */}
            <div>
              <button
                onClick={() => setRawStateExpanded(!rawStateExpanded)}
                className="w-full flex items-center justify-between p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-300">Raw State Dump</span>
                <svg 
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${rawStateExpanded ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${rawStateExpanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800">
                  <pre className="text-xs text-zinc-400 font-mono leading-relaxed">
                    {JSON.stringify({ memories: memories.length, sessionId, activeTab, online }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Search memories</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Switch to Memories tab</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">1</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Switch to Event Sourced tab</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">2</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Switch to Knowledge Base tab</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">3</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Clear search</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">ESC</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Toggle dashboard</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌘D</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Toggle sidebar</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌘S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Show this help</span>
                <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌘/</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
