import React, { useEffect, useRef } from "react";
import { HealthProbeStatus, SystemStatus } from "./useSystemOrchestrator";

export const SystemPanel: React.FC<{ 
  status: SystemStatus;
  output: string;
  healthProbe?: HealthProbeStatus;
  onStop?: () => void;
}> = ({ status, output, healthProbe, onStop }) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const fallback =
    status === "idle"
      ? "Idle. Use Start or Force Start to launch KNEZ."
      : status === "starting"
        ? "Starting KNEZ..."
        : status === "failed"
          ? "Startup failed. Check logs in Settings / Observatory."
          : "No output yet.";

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-zinc-500">System Orchestration</div>
        <div className="flex gap-2 items-center">
           {status === "running" && onStop && (
             <button 
               onClick={onStop}
               className="px-2 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors border border-red-900/50"
             >
               INJECT FAILURE (STOP)
             </button>
           )}
           <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
             status === "running" ? "bg-green-900/30 text-green-400" :
             status === "failed" || status === "degraded" ? "bg-red-900/30 text-red-400" :
             status === "starting" ? "bg-blue-900/30 text-blue-400" :
             "bg-zinc-800 text-zinc-500"
           }`}>
             {status}
           </div>
        </div>
      </div>

      {healthProbe && (status === "starting" || healthProbe.active || healthProbe.lastCheckedAt) && (
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500 font-mono">
          <span>
            health_probe {healthProbe.attempts}/{healthProbe.maxAttempts || "-"}
          </span>
          <span className="truncate">
            {healthProbe.active
              ? healthProbe.lastError
                ? `last_error=${healthProbe.lastError}`
                : "checking..."
              : healthProbe.lastError
                ? `stopped last_error=${healthProbe.lastError}`
                : "idle"}
          </span>
        </div>
      )}

      <div 
        ref={outputRef}
        className="bg-black/50 border border-zinc-800 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] text-zinc-400 whitespace-pre-wrap"
      >
        {output || fallback}
      </div>
    </div>
  );
};
