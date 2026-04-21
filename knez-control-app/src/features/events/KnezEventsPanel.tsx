import React, { useEffect, useState } from "react";
import { knezClient } from '../../services/knez/KnezClient';
import { KnezEvent } from "../../domain/DataContracts";

type Severity = "DEBUG" | "INFO" | "WARN" | "ERROR";

export const KnezEventsPanel: React.FC<{ sessionId: string | null; readOnly: boolean }> = ({ sessionId, readOnly }) => {
  const [events, setEvents] = useState<KnezEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<Severity | "ALL">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEvents = async () => {
    if (!sessionId) return;
    try {
      const data = await knezClient.listEvents(sessionId, 50);
      setEvents(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (readOnly) return;
    fetchEvents();
    if (autoRefresh) {
      const interval = setInterval(fetchEvents, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId, readOnly, autoRefresh]);

  const filteredEvents = events.filter(e => {
    if (filterSeverity === "ALL") return true;
    return e.severity === filterSeverity;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">System Events</h3>
          <span className="text-[9px] text-zinc-600 font-mono">
            SID: {sessionId ? sessionId.slice(0, 8) + '...' : 'NONE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="bg-zinc-800 text-xs text-zinc-300 border border-zinc-700 rounded px-2 py-1 outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warn</option>
            <option value="ERROR">Error</option>
          </select>
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}
            title="Auto-refresh"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
        {filteredEvents.length === 0 && (
          <div className="text-center py-4 text-zinc-600 italic">No events found</div>
        )}
        {filteredEvents.map((e, i) => (
          <div key={i} className={`p-2 rounded border flex gap-2 ${
            e.severity === 'ERROR' ? 'bg-red-900/20 border-red-900/50 text-red-300' :
            e.severity === 'WARN' ? 'bg-yellow-900/20 border-yellow-900/50 text-yellow-300' :
            'bg-zinc-950 border-zinc-800 text-zinc-400'
          }`}>
            <div className="w-16 shrink-0 text-zinc-600">{new Date(e.timestamp).toLocaleTimeString()}</div>
            <div className="w-12 shrink-0 font-bold opacity-70">{e.severity}</div>
            <div className="w-20 shrink-0 text-zinc-500 truncate">{e.source}</div>
            <div className="flex-1 break-all">{e.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
