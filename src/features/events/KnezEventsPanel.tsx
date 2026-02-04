import React, { useEffect, useState } from "react";
import { knezClient } from "../../services/KnezClient";
import { KnezEvent } from "../../domain/DataContracts";

type Props = {
  sessionId: string | null;
  readOnly: boolean;
};

function safeStringify(value: unknown, limit = 800): string {
  let raw = "";
  try {
    raw = JSON.stringify(value);
  } catch {
    raw = String(value);
  }
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}…`;
}

export const KnezEventsPanel: React.FC<Props> = ({ sessionId, readOnly }) => {
  const [events, setEvents] = useState<KnezEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!sessionId) return;
    if (readOnly) return;
    setLoading(true);
    setError(null);
    try {
      const data = await knezClient.listEvents(sessionId, 50);
      setEvents(data);
    } catch {
      setError("Failed to load KNEZ events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [sessionId, readOnly]);

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          KNEZ Events
        </h3>
        <button
          onClick={refresh}
          disabled={readOnly || !sessionId || loading}
          className="text-[10px] px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {readOnly ? (
        <div className="text-xs text-zinc-600">Read-only mode.</div>
      ) : loading ? (
        <div className="text-xs text-zinc-600">Loading…</div>
      ) : error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-xs text-zinc-600">No events found for this session.</div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {events.map((e: any, idx) => {
            const name = String(e.event_name ?? e.name ?? "event");
            const type = String(e.event_type ?? "");
            const severity = String(e.severity ?? "");
            const at = String(e.created_at ?? e.timestamp ?? "");
            const tags = Array.isArray(e.tags) ? (e.tags as string[]) : [];
            const payload = e.payload ?? {};
            const highlight =
              tags.includes("influence_execution") ||
              tags.includes("agent_governance") ||
              tags.includes("influence_kill_switch") ||
              tags.includes("reflection");
            return (
              <div
                key={`${name}-${idx}`}
                className={`p-2 rounded border ${
                  highlight ? "border-orange-900/40 bg-orange-950/10" : "border-zinc-800 bg-zinc-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-zinc-300 font-medium">{name}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">
                    {type} {severity}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-zinc-600 font-mono">{at}</div>
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-zinc-500 font-mono break-words">
                  {safeStringify(payload)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

