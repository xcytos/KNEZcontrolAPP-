import React, { useEffect, useRef } from "react";
import { SystemStatus } from "./useSystemOrchestrator";

export const SystemPanel: React.FC<{ 
  status: SystemStatus;
  output: string;
  onLaunch: () => void;
}> = ({ status, output, onLaunch }) => {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-zinc-500">System Orchestration</div>
        <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
          status === "running" ? "bg-green-900/30 text-green-400" :
          status === "failed" || status === "degraded" ? "bg-red-900/30 text-red-400" :
          status === "starting" ? "bg-blue-900/30 text-blue-400" :
          "bg-zinc-800 text-zinc-500"
        }`}>
          {status}
        </div>
      </div>

      <div className="mb-3">
        <button
          onClick={onLaunch}
          disabled={status === "starting" || status === "running"}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-700 transition-colors"
        >
          {status === "running" ? "Stack Running (Connected)" : "Launch & Connect KNEZ"}
        </button>
      </div>

      <div 
        ref={outputRef}
        className="bg-black/50 border border-zinc-800 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] text-zinc-400 whitespace-pre-wrap"
      >
        {output || "// Output will appear here..."}
      </div>
    </div>
  );
};

