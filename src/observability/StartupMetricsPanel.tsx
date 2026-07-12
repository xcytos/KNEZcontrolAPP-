import React, { useEffect, useState } from "react";
import {
  StartupSample,
  getStartupHistory,
  getLatestSample,
  getLastSessionSample,
} from "./StartupMetrics";

function ms(v: number): string {
  return `${v.toFixed(1)}ms`;
}

function fmtBoot(s: StartupSample): number {
  return s.loadEventEnd || s.domContentLoaded || s.fcp || s.reactInitEnd;
}

export const StartupMetricsPanel: React.FC = () => {
  const [latest, setLatest] = useState<StartupSample | null>(getLatestSample);
  const [previous, setPrevious] = useState<StartupSample | null>(getLastSessionSample);
  const [history, setHistory] = useState<StartupSample[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLatest(getLatestSample());
    setPrevious(getLastSessionSample());
    const all = getStartupHistory();
    setHistory(all.slice().reverse());
  }, []);

  if (!latest) {
    return (
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded mb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Startup Metrics</h3>
        <div className="text-zinc-500 text-sm italic">Awaiting first boot sample...</div>
      </div>
    );
  }

  const latestBoot = fmtBoot(latest);
  const prevBoot = previous ? fmtBoot(previous) : null;
  const bootDelta = prevBoot !== null ? latestBoot - prevBoot : null;

  const cards = [
    { label: "Total Boot", value: ms(fmtBoot(latest)), color: "text-blue-400" },
    { label: "FCP", value: ms(latest.fcp), color: "text-emerald-400" },
    { label: "DOM Content", value: ms(latest.domContentLoaded), color: "text-purple-400" },
    { label: "React Init", value: ms(latest.reactInitEnd - latest.reactInitStart), color: "text-amber-400" },
    { label: "Tauri IPC", value: latest.tauriInvokeMs !== null ? ms(latest.tauriInvokeMs) : "N/A", color: "text-cyan-400" },
    { label: "PTY Spawns", value: String(latest.ptySpawnCountAtCapture), color: "text-rose-400" },
  ];

  const maxBoot = Math.max(...history.map(fmtBoot), 1);

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Startup Metrics</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? "Collapse" : `History (${history.length})`}
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-zinc-950 p-2 rounded text-center">
            <div className="text-[10px] text-zinc-500 truncate">{c.label}</div>
            <div className={`text-sm font-mono ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Delta vs previous boot */}
      {bootDelta !== null && (
        <div className="flex items-center gap-2 mb-3 text-[11px]">
          <span className="text-zinc-500">vs previous boot:</span>
          <span className={`font-mono ${bootDelta <= 0 ? "text-green-400" : "text-red-400"}`}>
            {bootDelta > 0 ? "+" : ""}{bootDelta.toFixed(1)}ms
            <span className="text-zinc-600 ml-1">
              ({previous ? new Date(previous.timestamp).toLocaleDateString() : "?"})
            </span>
          </span>
        </div>
      )}

      {/* Mini history bar chart */}
      {history.length > 1 && (
        <div className={`${expanded ? "" : "max-h-0 overflow-hidden"} transition-all`}>
          <div className="h-24 flex items-end gap-[2px] border-b border-zinc-800 pb-1 mt-2">
            {history.map((s, i) => {
              const h = (fmtBoot(s) / maxBoot) * 100;
              const isLatest = i === 0;
              return (
                <div
                  key={s.id}
                  className={`flex-1 rounded-t transition-colors relative group ${
                    isLatest ? "bg-blue-500" : "bg-zinc-700 hover:bg-zinc-500"
                  }`}
                  style={{ height: `${Math.max(3, h)}%` }}
                >
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 text-zinc-300">
                    {ms(fmtBoot(s))}
                    <span className="text-zinc-600 ml-1">{new Date(s.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
            <span>{history.length} startups recorded</span>
            <span>oldest → newest</span>
          </div>
        </div>
      )}
    </div>
  );
};
