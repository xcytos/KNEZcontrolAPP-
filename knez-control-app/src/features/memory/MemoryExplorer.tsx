import React, { useEffect, useState } from "react";
import { knezClient } from "../../services/knez/KnezClient";
import { KnowledgeBaseView } from "./KnowledgeBaseView";
import { useStatus } from "../../contexts/useStatus";
import { EventSourcedMemoryView } from "./EventSourcedMemoryView";
import { getMemoryEventSourcingService, MemoryState } from "../../services/memory/storage/MemoryEventSourcingService";

import { persistenceService } from '../../services/infrastructure/persistence/PersistenceService'
export const MemoryExplorer: React.FC<{ sessionId: string | null; readOnly: boolean }> = ({ sessionId, readOnly }) => {
  const { online } = useStatus();
  const [memories, setMemories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"memories" | "knowledge" | "graph" | "gate" | "eventsourced">("memories");
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessions, setSessions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [gateEvents, setGateEvents] = useState<any[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [eventSourcedMemories, setEventSourcedMemories] = useState<MemoryState[]>([]);
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const memoryService = getMemoryEventSourcingService();

  useEffect(() => {
    let interval: any;
    
    let lastCount = 0;
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
        const recs = await knezClient.listMemory(sessionId, since ? { since, order: "asc", limit: 200 } : { order: "desc", limit: 200 });
        const mapped = knezClient.mapMemoryToUi(recs);
        const incoming = since ? mapped.slice().reverse() : mapped;
        const newSince = recs.reduce((acc: string | null, r: any) => {
          const t = String(r?.created_at ?? "");
          if (!t) return acc;
          if (!acc) return t;
          return t > acc ? t : acc;
        }, since);
        if (incoming.length > 0 && lastCount > 0) {
          setIsRecording(true);
          setTimeout(() => setIsRecording(false), 2000);
        }
        setSince(newSince);
        setMemories((prev) => {
          const byId = new Map<string, any>();
          for (const m of prev) byId.set(String(m.id), m);
          for (const m of incoming) byId.set(String(m.id), m);
          const merged = Array.from(byId.values());
          merged.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
          lastCount = merged.length;
          return merged;
        });
      } catch (e: any) {
        setError(String(e?.message ?? e));
        setMemories([]);
        setSince(null);
      }
    };

    void fetchMemories();
    interval = setInterval(fetchMemories, 30000);
    return () => clearInterval(interval);
  }, [sessionId, online]);

  useEffect(() => {
    persistenceService.listSessions().then(setSessions)
  }, [])

  useEffect(() => {
    // Load event-sourced memories from MemoryEventSourcingService
    try {
      const allMemories = memoryService.getAllMemories();
      setEventSourcedMemories(allMemories);
    } catch (error) {
      console.error("Failed to load event-sourced memories:", error);
    }
  }, [])

  const loadGate = async () => {
    try {
      const evs = await knezClient.listEvents(sessionId || "", 200);
      const gate = evs.filter((e: any) => {
        const name = String(e?.event_name || e?.eventName || "");
        return (
          name === "reflection_memory_rejected" ||
          name === "reflection_memory_promoted" ||
          name === "reflection_memory_insight_rejected" ||
          name === "reflection_memory_insight_needs_review" ||
          name === "reflection_memory_insight_promotable"
        );
      });
      setGateEvents(gate);
    } catch {
      setGateEvents([]);
    }
  };

  useEffect(() => {
    loadGate();
  }, [sessionId]);
  useEffect(() => {
     if (searchQuery.length > 2) {
        // CP8-9: Client-side search for now (Simulated Cross-Session if we had all memories)
        // Since listMemory(undefined) returns recent memories from ALL sessions if backend supports it
        // (Our KnezClient implementation passes sessionId optional)
        const lower = searchQuery.toLowerCase();
        const results = memories.filter(m => 
           m.summary.toLowerCase().includes(lower) || 
           m.details.toLowerCase().includes(lower)
        );
        setSearchResults(results);
     } else {
        setSearchResults([]);
     }
  }, [searchQuery, memories]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <div className="flex items-center gap-2">
           <h2 className="font-bold text-zinc-100">Memory Graph</h2>
           {isRecording && (
              <span className="flex items-center gap-1 text-[10px] text-red-400 animate-pulse bg-red-900/20 px-2 py-0.5 rounded-full border border-red-900/50">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                RECORDING
              </span>
           )}
        </div>
        <button
          onClick={() => setShowMemoryForm(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
        >
          Add Memory
        </button>
        
        <div className="flex items-center gap-2">
           <button
             onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }))}
             className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
           >
             Chat
           </button>
           <button
             onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "replay" } }))}
             className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
           >
             Replay
           </button>
           <button
             onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "reflection" } }))}
             className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
           >
             Analyze
           </button>
           <div className="w-px h-6 bg-zinc-800 mx-1" />
           {/* CP8-9 Search Input */}
           <div className="relative">
             <input 
               type="text" 
               placeholder="Search memories..." 
               className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 w-40 focus:w-64 transition-all outline-none focus:border-blue-900"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
             {searchQuery && (
               <div className="absolute right-2 top-1.5 text-[10px] text-zinc-500">
                 {searchResults.length} results
               </div>
             )}
           </div>

           <div className="flex gap-2">
             <button 
               onClick={() => setActiveTab("memories")}
               className={`text-xs px-2 py-1 rounded ${activeTab === 'memories' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Memories
             </button>
             <button 
               onClick={() => setActiveTab("knowledge")}
               className={`text-xs px-2 py-1 rounded ${activeTab === 'knowledge' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Knowledge Base
             </button>
             <button 
               onClick={() => setActiveTab("graph")}
               className={`text-xs px-2 py-1 rounded ${activeTab === 'graph' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Nav Graph
             </button>
            <button 
              onClick={() => setActiveTab("gate")}
              className={`text-xs px-2 py-1 rounded ${activeTab === 'gate' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Gate
            </button>
            <button 
              onClick={() => setActiveTab("eventsourced")}
              className={`text-xs px-2 py-1 rounded ${activeTab === 'eventsourced' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Event Sourced
            </button>
            </div>
        </div>
      </div>

      <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-800 text-[10px] text-zinc-500">
        Sessions: {sessions.slice(0, 6).map(s => s.slice(0,8)).join(', ')}{sessions.length > 6 ? '…' : ''}
      </div>
      {error && (
        <div className="px-4 py-2 border-b border-zinc-800 bg-red-950/20 text-[10px] text-red-300">
          {error}
        </div>
      )}
      
      {activeTab === 'memories' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Event Sourced Memories */}
          {eventSourcedMemories.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-zinc-500 uppercase mb-2">Event Sourced Memories</div>
              {eventSourcedMemories.map((m) => (
                <div 
                  key={m.id} 
                  className="p-3 border rounded hover:bg-zinc-800 cursor-pointer transition-colors group bg-blue-900/10 border-blue-900/50 mb-2"
                >
                  <div className="text-sm text-zinc-300 group-hover:text-white flex justify-between">
                    <span>{m.title}</span>
                    <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1 rounded">
                      {m.type}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.content.slice(0, 100)}...</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{new Date(m.updatedAt).toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      {m.tags.map(tag => (
                        <span key={tag} className="text-[9px] text-zinc-400 bg-zinc-800 px-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* KNEZ Memories */}
          {(searchQuery ? searchResults : memories).map((m) => (
            <div 
              key={m.id} 
              className={`p-3 border rounded hover:bg-zinc-800 cursor-pointer transition-colors group ${
                 searchQuery && searchResults.includes(m) ? 'bg-blue-900/10 border-blue-900/50' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="text-sm text-zinc-300 group-hover:text-white flex justify-between">
                 <span>{m.summary}</span>
                 {m.sessionId !== sessionId && (
                    <span className="text-[9px] text-zinc-600 bg-zinc-950 px-1 rounded">
                       SID: {m.sessionId?.slice(0,6)}
                    </span>
                 )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">{new Date(m.createdAt).toLocaleTimeString()}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 font-mono">{(m.importance * 100).toFixed(0)}% Conf</span>
                </div>
              </div>
            </div>
          ))}
          {searchQuery && searchResults.length === 0 && eventSourcedMemories.length === 0 && (
             <div className="text-center text-zinc-500 text-xs py-8">
                No memories found matching "{searchQuery}"
             </div>
          )}
          {!searchQuery && memories.length === 0 && eventSourcedMemories.length === 0 && (
             <div className="text-center text-zinc-500 text-xs py-8">
                No memories yet. Memory promotion requires running the Gate check and backend support.
             </div>
          )}
        </div>
      ) : activeTab === 'knowledge' ? (
        <KnowledgeBaseView />
      ) : activeTab === 'gate' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex justify-end gap-2">
            <button
              disabled={!sessionId || readOnly}
              onClick={async () => {
                if (!sessionId) return;
                await knezClient.emitEvent({
                  session_id: sessionId,
                  event_type: "REFLECTION",
                  event_name: "reflection_flag_memory_candidate",
                  source: "tool",
                  severity: "INFO",
                  payload: { session_id: sessionId, source: "ui" },
                  tags: ["reflection", "memory_gate"]
                });
                await loadGate();
              }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 px-3 py-1 rounded"
            >
              Flag for Gate
            </button>
            <button
              disabled={!sessionId || readOnly}
              onClick={async () => {
                if (!sessionId) return;
                await knezClient.checkMemoryGate(sessionId);
                await loadGate();
              }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 px-3 py-1 rounded"
            >
              Run Gate Check
            </button>
          </div>
          {readOnly && (
            <div className="text-zinc-500 text-xs">
              Read-only mode: gate check disabled.
            </div>
          )}
          {gateEvents.length === 0 && (
            <div className="text-zinc-500 text-xs">No memory gate events found.</div>
          )}
          {gateEvents.map((e: any, idx: number) => {
            const ts = e.timestamp || e.created_at || e.createdAt;
            const name = e.event_name || e.eventName;
            const payload = e.payload || {};
            return (
              <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded p-3">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-zinc-200">{name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{ts ? new Date(ts).toLocaleString() : ""}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                  <div>policy: {payload.policy_name || "-"}</div>
                  <div>rule: {payload.rule_name || payload.reason || "-"}</div>
                  <div>memory_type: {payload.memory_type || "-"}</div>
                  <div className="col-span-2">
                    evidence:&nbsp;
                    {Array.isArray(payload.evidence_event_ids) && payload.evidence_event_ids.length > 0 ? (
                      payload.evidence_event_ids.map((ev: any) => (
                        <button
                          key={String(ev)}
                          onClick={() => {
                            const id = String(ev);
                            window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "replay" } }));
                            window.dispatchEvent(new CustomEvent("replay-focus-event", { detail: { eventId: id } }));
                          }}
                          className="text-[10px] font-mono text-blue-300 hover:text-blue-200 mr-2"
                        >
                          {String(ev).slice(0, 8)}…
                        </button>
                      ))
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'eventsourced' ? (
        <EventSourcedMemoryView />
      ) : (
        <div className="flex-1 p-4 flex flex-col items-center justify-center bg-zinc-950 text-zinc-600">
           {/* CP8-8: Simple Node Graph Visualization */}
           <div className="w-full h-full relative border border-zinc-800 rounded bg-zinc-900 overflow-hidden">
              <svg className="w-full h-full">
                 {/* Edges */}
                 {memories.map((_, i) => {
                    if (i === 0) return null;
                    return (
                       <line 
                         key={`edge-${i}`}
                         x1={50 + (i-1) * 100} y1={150 + ((i-1)%2)*50}
                         x2={50 + i * 100} y2={150 + (i%2)*50}
                         stroke="#3f3f46"
                         strokeWidth="2"
                       />
                    );
                 })}
                 {/* Nodes */}
                 {memories.map((m, i) => (
                    <circle
                      key={m.id}
                      cx={50 + i * 100}
                      cy={150 + (i%2)*50}
                      r="20"
                      fill="#3b82f6"
                      className="cursor-pointer hover:fill-blue-400"
                    />
                 ))}
              </svg>
           </div>
        </div>
      )}

      {/* Memory Form Modal */}
      {showMemoryForm && (
        <MemoryFormModal
          onClose={() => setShowMemoryForm(false)}
          onSubmit={async (memoryData) => {
            try {
              await memoryService.createMemory(
                memoryData.type,
                memoryData.title,
                memoryData.content,
                memoryData.domain,
                memoryData.tags
              );
              // Reload memories
              const allMemories = memoryService.getAllMemories();
              setEventSourcedMemories(allMemories);
              setShowMemoryForm(false);
            } catch (error) {
              console.error("Failed to create memory:", error);
            }
          }}
        />
      )}
    </div>
  );
};

const MemoryFormModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: {
    type: 'learning' | 'mistake' | 'decision' | 'pattern';
    title: string;
    content: string;
    domain: string;
    tags: string[];
  }) => void;
}> = ({ onClose, onSubmit }) => {
  const [type, setType] = useState<'learning' | 'mistake' | 'decision' | 'pattern'>('learning');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [domain, setDomain] = useState('controlapp');
  const [tags, setTags] = useState('');

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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Add Memory</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
            >
              <option value="learning">Learning</option>
              <option value="mistake">Mistake</option>
              <option value="decision">Decision</option>
              <option value="pattern">Pattern</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm h-32"
              required
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Save Memory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
