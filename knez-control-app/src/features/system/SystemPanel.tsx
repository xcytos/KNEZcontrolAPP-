import React, { useEffect, useRef } from "react";
import { HealthProbeStatus, SystemStatus } from "./useSystemOrchestrator";

export const SystemPanel: React.FC<{ 
  status: SystemStatus;
  output: string;
  healthProbe?: HealthProbeStatus;
  onStop?: () => void;
}> = ({ status, output, healthProbe, onStop }) => {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const formatOutput = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.includes('ERROR') || line.includes('FAILED') || line.includes('timed out')) {
        return <div key={i} className="text-red-400">{line}</div>;
      }
      if (line.includes('READY') || line.includes('SUCCESS') || line.includes('running')) {
        return <div key={i} className="text-green-400">{line}</div>;
      }
      if (line.includes('WARNING') || line.includes('waiting')) {
        return <div key={i} className="text-yellow-400">{line}</div>;
      }
      return <div key={i} className="text-zinc-400">{line}</div>;
    });
  };

  return (
    <div className="font-mono text-xs">
      <div className="flex items-center gap-4 mb-2">
        <span className="text-zinc-500">STATUS:</span>
        <span className={
          status === "running" ? "text-green-400" :
          status === "failed" ? "text-red-400" :
          status === "starting" ? "text-yellow-400" :
          "text-zinc-500"
        }>{status.toUpperCase()}</span>
        
        {healthProbe && (status === "starting" || healthProbe.active) && (
          <span className="text-zinc-500">
            HEALTH_CHECK: {healthProbe.attempts}/{healthProbe.maxAttempts}
          </span>
        )}
        
        {healthProbe?.lastError && (
          <span className="text-red-400 truncate">{healthProbe.lastError}</span>
        )}
      </div>

      {status === "running" && onStop && (
        <button 
          onClick={onStop}
          className="mb-2 text-red-400 hover:text-red-300"
        >
          [STOP]
        </button>
      )}

      <div 
        ref={outputRef}
        className="bg-black/50 border-l-2 border-zinc-700 pl-2 h-40 overflow-y-auto text-[10px] whitespace-pre-wrap"
      >
        {output ? formatOutput(output) : "No output"}
      </div>
    </div>
  );
};
