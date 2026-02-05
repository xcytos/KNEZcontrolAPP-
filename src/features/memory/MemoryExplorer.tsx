import React, { useEffect, useState } from "react";
import { knezClient } from "../../services/KnezClient";
import { KnowledgeBaseView } from "./KnowledgeBaseView";

const MemoryDetailModal: React.FC<{ 
  memoryId: string | null;
  onClose: () => void;
}> = ({ memoryId, onClose }) => {
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (memoryId) {
      knezClient.getMemoryDetail(memoryId).then(setDetail).catch(() => setDetail(null));
    } else {
      setDetail(null);
    }
  }, [memoryId]);

  if (!memoryId) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Memory Detail</h3>
        {detail ? (
           <div className="space-y-4">
             <div>
               <label className="text-xs text-zinc-500 uppercase">Summary</label>
               <p className="text-zinc-300">{detail.summary}</p>
             </div>
             <div>
               <label className="text-xs text-zinc-500 uppercase">Confidence</label>
               <p className="text-zinc-300">{(detail.confidence * 100).toFixed(1)}%</p>
             </div>
             <div>
               <label className="text-xs text-zinc-500 uppercase">Evidence</label>
               <div className="bg-zinc-950 p-2 rounded text-xs font-mono text-zinc-400">
                 {detail.evidence_event_ids?.join(", ") || "None"}
               </div>
             </div>
             <div>
               <label className="text-xs text-zinc-500 uppercase">JSON</label>
               <pre className="text-[10px] bg-zinc-950 p-2 rounded overflow-x-auto text-green-400">
                 {JSON.stringify(detail, null, 2)}
               </pre>
             </div>
           </div>
        ) : (
          <div className="text-zinc-500">Loading...</div>
        )}
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded">Close</button>
        </div>
      </div>
    </div>
  );
};

export const MemoryExplorer: React.FC<{ sessionId: string | null; readOnly: boolean }> = ({ sessionId }) => {
  const [memories, setMemories] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"memories" | "knowledge">("memories");

  useEffect(() => {
    knezClient.listMemory(sessionId || undefined).then(recs => {
       setMemories(knezClient.mapMemoryToUi(recs));
    });
  }, [sessionId]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <h2 className="font-bold text-zinc-100">Memory Graph</h2>
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
        </div>
      </div>
      
      {activeTab === 'memories' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {memories.map((m) => (
            <div 
              key={m.id} 
              onClick={() => setSelectedId(m.id)}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 cursor-pointer transition-colors group"
            >
              <div className="text-sm text-zinc-300 group-hover:text-white">{m.summary}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">{new Date(m.createdAt).toLocaleTimeString()}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 font-mono">{(m.importance * 100).toFixed(0)}% Conf</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <KnowledgeBaseView />
      )}
      
      <MemoryDetailModal 
        memoryId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
};
