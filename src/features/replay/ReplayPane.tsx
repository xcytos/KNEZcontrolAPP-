import React, { useEffect, useMemo, useState } from 'react';
import { knezClient } from '../../services/KnezClient';

export const ReplayPane: React.FC<{ sessionId: string | null }> = ({ sessionId }) => {
  const [replay, setReplay] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    knezClient.getReplayTimeline(sessionId)
      .then((r) => {
        setReplay(r);
        setPhaseIndex(0);
        setEventIndex(0);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = String((e as CustomEvent).detail?.eventId ?? "");
      if (!id) return;
      setFocusEventId(id);
    };
    window.addEventListener("replay-focus-event", onFocus);
    return () => window.removeEventListener("replay-focus-event", onFocus);
  }, []);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading replay data...</div>;
  if (!replay) return <div className="p-8 text-center text-zinc-500">No replay data available.</div>;

  const phases: any[] = Array.isArray(replay.timeline) ? replay.timeline : [];
  const totalEvents = phases.reduce((acc, p) => acc + (Array.isArray(p.events) ? p.events.length : 0), 0);
  const durationSeconds = (() => {
    if (phases.length === 0) return 0;
    const start = new Date(phases[0].start_time).getTime();
    const end = new Date(phases[phases.length - 1].end_time).getTime();
    return Math.max(0, (end - start) / 1000);
  })();

  const currentPhase = phases[Math.min(Math.max(phaseIndex, 0), Math.max(phases.length - 1, 0))];
  const phaseEvents: any[] = currentPhase?.events || [];
  const currentEvent = phaseEvents[Math.min(Math.max(eventIndex, 0), Math.max(phaseEvents.length - 1, 0))];

  const focusIndex = useMemo(() => {
    if (!focusEventId) return null;
    for (let pi = 0; pi < phases.length; pi++) {
      const evs: any[] = Array.isArray(phases[pi]?.events) ? phases[pi].events : [];
      for (let ei = 0; ei < evs.length; ei++) {
        if (String(evs[ei]?.event_id ?? "") === focusEventId) {
          return { phaseIndex: pi, eventIndex: ei };
        }
      }
    }
    return null;
  }, [focusEventId, phases]);

  useEffect(() => {
    if (!focusIndex) return;
    setPlaying(false);
    setPhaseIndex(focusIndex.phaseIndex);
    setEventIndex(focusIndex.eventIndex);
  }, [focusIndex]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setEventIndex((idx) => {
        const next = idx + 1;
        if (next >= phaseEvents.length) {
          setPlaying(false);
          return idx;
        }
        return next;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [playing, phaseEvents.length]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Session Replay</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Chat
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "memory" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Memory
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "reflection" } }))}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Analyze
          </button>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg mb-6">
        <div className="flex gap-8 text-sm text-zinc-400">
           <div>Duration: <span className="text-white font-mono">{durationSeconds.toFixed(1)}s</span></div>
           <div>Events: <span className="text-white font-mono">{totalEvents}</span></div>
           <div>Phases: <span className="text-white font-mono">{phases.length}</span></div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        <div className="col-span-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
          <div className="text-xs font-bold text-zinc-400 mb-2">Phases</div>
          <div className="space-y-2">
            {phases.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPhaseIndex(idx);
                  setEventIndex(0);
                  setPlaying(false);
                }}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  idx === phaseIndex ? "bg-blue-900/10 border-blue-900/50 text-zinc-100" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <div className="text-sm font-semibold">{p.phase_name}</div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {new Date(p.start_time).toLocaleTimeString()} - {new Date(p.end_time).toLocaleTimeString()}
                </div>
                <div className="text-[10px] text-zinc-500">{(p.events || []).length} events</div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-zinc-400">Playback</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEventIndex((i) => Math.max(0, i - 1))}
                className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-600 text-zinc-200"
              >
                Prev
              </button>
              <button
                onClick={() => setEventIndex((i) => Math.min(Math.max(phaseEvents.length - 1, 0), i + 1))}
                className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-600 text-zinc-200"
              >
                Next
              </button>
              <button
                onClick={() => setPlaying(!playing)}
                className="text-xs px-2 py-1 bg-blue-600/20 border border-blue-900/50 rounded hover:border-blue-600 text-blue-200"
              >
                {playing ? "Pause" : "Play"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 max-h-[40vh] overflow-y-auto">
              <div className="text-[10px] text-zinc-500 mb-2">Events in phase</div>
              <div className="space-y-1">
                {phaseEvents.map((e: any, idx: number) => {
                  const isCheckpoint = String(e?.event_name || "").includes("checkpoint");
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setEventIndex(idx);
                        setPlaying(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded border ${
                        idx === eventIndex ? "border-blue-900/50 bg-blue-900/10" : "border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      <div className="text-xs text-zinc-200 font-mono">
                        {e.event_type}:{e.event_name}{isCheckpoint ? " [CHECKPOINT]" : ""}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{e.timestamp}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 max-h-[40vh] overflow-y-auto">
              <div className="text-[10px] text-zinc-500 mb-2">Selected event</div>
              {currentEvent ? (
                <div className="space-y-3">
                  {String(currentEvent?.payload?.message_id ?? "") && (
                    <button
                      onClick={() => {
                        const msgId = String(currentEvent.payload.message_id);
                        window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }));
                        window.dispatchEvent(new CustomEvent("chat-focus-message", { detail: { messageId: msgId } }));
                      }}
                      className="w-full text-xs px-3 py-2 rounded bg-blue-900/20 border border-blue-900/40 text-blue-200 hover:border-blue-700"
                    >
                      Jump to Chat Message
                    </button>
                  )}
                  <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap">{JSON.stringify(currentEvent, null, 2)}</pre>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">No event selected.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
