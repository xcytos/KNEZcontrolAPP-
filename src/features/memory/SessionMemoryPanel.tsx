import React, { useEffect, useState } from 'react';
import { sessionDatabase } from '../../services/session/SessionDatabase';
import { getSimpleMemoryStorage, SimpleMemoryState } from '../../services/memory/storage/SimpleMemoryStorage';
import { SessionSyncButton } from './SessionSyncButton';

interface SessionInfo {
  id: string;
  name: string;
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  memoryCount: number;
  lastSynced?: string;
  hasUnprocessedContent: boolean;
}

interface SessionMemoryPanelProps {
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionSync: (sessionId: string) => void;
}

export const SessionMemoryPanel: React.FC<SessionMemoryPanelProps> = ({
  selectedSessionId,
  onSessionSelect,
  onSessionSync
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
  
  const memoryService = getSimpleMemoryStorage();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const allSessions = await sessionDatabase.getSessions();
      const allMemories = await memoryService.getAllMemories();
      
      // Group memories by session
      const memoriesBySession = new Map<string, SimpleMemoryState[]>();
      allMemories.forEach(memory => {
        const sessionId = memory.sourceSessionId;
        if (sessionId) {
          if (!memoriesBySession.has(sessionId)) {
            memoriesBySession.set(sessionId, []);
          }
          memoriesBySession.get(sessionId)!.push(memory);
        }
      });
      
      // Build session info
      const sessionInfos: SessionInfo[] = await Promise.all(
        allSessions.map(async (session) => {
          const messages = await sessionDatabase.loadMessages(session.id);
          const sessionMemories = memoriesBySession.get(session.id) || [];
          
          return {
            id: session.id,
            name: session.name,
            createdAt: session.createdAt || new Date().toISOString(),
            lastActivity: messages.length > 0 
              ? messages[messages.length - 1].createdAt 
              : session.createdAt || new Date().toISOString(),
            messageCount: messages.length,
            memoryCount: sessionMemories.length,
            lastSynced: sessionMemories.length > 0 
              ? sessionMemories[sessionMemories.length - 1].createdAt 
              : undefined,
            hasUnprocessedContent: messages.length > 0 && sessionMemories.length === 0
          };
        })
      );
      
      // Sort by last activity (most recent first)
      sessionInfos.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      setSessions(sessionInfos);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  
  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-zinc-400">Loading sessions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="font-semibold text-zinc-100 mb-3">Sessions</h3>
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-zinc-500">
            {searchQuery ? 'No sessions found' : 'No sessions available'}
          </div>
        ) : (
          <div className="p-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`mb-2 p-3 rounded border cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'bg-blue-900/30 border-blue-600'
                    : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                }`}
                onClick={() => onSessionSelect(session.id)}
              >
                {/* Session Name and ID */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100 truncate">
                      {session.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {session.id}
                    </div>
                  </div>
                  {session.hasUnprocessedContent && (
                    <div className="ml-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-400">
                      New
                    </div>
                  )}
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div className="flex items-center text-zinc-400">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                    {session.messageCount} messages
                  </div>
                  <div className="flex items-center text-zinc-400">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    {session.memoryCount} memories
                  </div>
                </div>

                {/* Last Activity */}
                <div className="text-xs text-zinc-500 mb-2">
                  Last active: {formatDate(session.lastActivity)}
                </div>

                {/* Sync Status and Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    {session.lastSynced ? (
                      <span>Synced: {formatDate(session.lastSynced)}</span>
                    ) : (
                      <span className="text-yellow-400">Not synced</span>
                    )}
                  </div>
                  {session.hasUnprocessedContent && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <SessionSyncButton 
                        sessionId={session.id}
                        onSyncComplete={(result) => {
                          if (result.success) {
                            loadSessions(); // Refresh the session list
                            if (selectedSessionId === session.id) {
                              onSessionSync(session.id);
                            }
                          }
                        }}
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span>Total Sessions:</span>
            <span className="text-zinc-400">{sessions.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Memories:</span>
            <span className="text-zinc-400">
              {sessions.reduce((sum, s) => sum + s.memoryCount, 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Unprocessed:</span>
            <span className="text-yellow-400">
              {sessions.filter(s => s.hasUnprocessedContent).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
