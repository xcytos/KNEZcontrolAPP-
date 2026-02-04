import React, { useEffect, useState } from "react";
import { HealthBackend } from "../../domain/DataContracts";
import { logger, LogEntry } from "../../services/LogService";

type Props = {
  backends: HealthBackend[];
  lastCheck: number | null;
  onRefresh: () => void;
};

export const InfrastructurePanel: React.FC<Props> = ({
  backends,
  lastCheck,
  onRefresh,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    setLogs(logger.getLogs());
    const unsub = logger.subscribe((log) => {
      setLogs((prev) => [log, ...prev].slice(0, 500));
    });
    return unsub;
  }, []);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-100">
          Runtime Observatory
        </h2>
        <div className="flex items-center gap-4">
          {lastCheck && (
            <span className="text-xs text-zinc-500 font-mono">
              Last check: {new Date(lastCheck).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Refresh Health"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {backends.length === 0 ? (
          <div className="col-span-2 p-8 text-center border border-zinc-800 rounded-lg bg-zinc-900/30 text-zinc-500">
            No backends detected.
          </div>
        ) : (
          backends.map((backend) => (
            <div
              key={backend.model_id}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-zinc-200">
                  {backend.model_id}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                    backend.status === "healthy"
                      ? "bg-green-900/20 text-green-400 border border-green-800"
                      : "bg-red-900/20 text-red-400 border border-red-800"
                  }`}
                >
                  {backend.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 font-mono mt-2">
                <div>
                  Lat:{" "}
                  {backend.latency_ms
                    ? `${backend.latency_ms.toFixed(1)}ms`
                    : "--"}
                </div>
                <div>
                  TPS:{" "}
                  {backend.tokens_per_sec
                    ? `${backend.tokens_per_sec.toFixed(1)}`
                    : "--"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-bold text-zinc-400 mb-2">System Logs</h3>
        <div className="flex-1 overflow-y-auto bg-black/40 rounded border border-zinc-800 p-2 font-mono text-[10px]">
          {logs.map((log) => (
            <div key={log.id} className="mb-1 border-b border-white/5 pb-1 last:border-0">
              <span className="text-zinc-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`mr-2 font-bold ${
                  log.level === "ERROR"
                    ? "text-red-500"
                    : log.level === "WARN"
                    ? "text-yellow-500"
                    : "text-blue-500"
                }`}
              >
                [{log.level}]
              </span>
              <span className="text-zinc-400 mr-2">[{log.category}]</span>
              <span className="text-zinc-300">{log.message}</span>
              {log.details && (
                <pre className="mt-1 text-zinc-600 overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
