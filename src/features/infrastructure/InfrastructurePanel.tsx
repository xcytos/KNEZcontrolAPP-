import React, { useEffect, useState } from "react";
import { HealthBackend, AuditResult } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";

type Props = {
  backends: HealthBackend[];
  lastCheck: number | null;
  onRefresh: () => void;
};

import { PerformancePanel } from "../performance/PerformancePanel";

// ... existing imports

export const InfrastructurePanel: React.FC<Props> = ({
  backends,
  lastCheck,
  onRefresh,
}) => {
  const [audits, setAudits] = useState<AuditResult[]>([]);

  useEffect(() => {
    knezClient.getAuditConsistency().then(setAudits).catch(() => {});
  }, [lastCheck]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Infrastructure</h2>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">
            Last check: {lastCheck ? new Date(lastCheck).toLocaleTimeString() : "Never"}
          </span>
          <button
            onClick={onRefresh}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Refresh Health
          </button>
        </div>
      </div>

      <PerformancePanel />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ... existing grids ... */}

        {/* Backend Health */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Backend Services</h3>
          {backends.length === 0 ? (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 text-sm italic">
              No backends reported.
            </div>
          ) : (
            backends.map((be) => (
              <div
                key={be.model_id}
                className="bg-zinc-900 border border-zinc-800 rounded p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-zinc-200">{be.model_id}</div>
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      be.status === "ok"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {be.status}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <div>Latency: {be.latency_ms ?? "-"}ms</div>
                  <div>Tokens/sec: {be.tokens_per_sec ?? "-"}</div>
                  <div>Fail Rate: {((be.failure_rate ?? 0) * 100).toFixed(1)}%</div>
                  <div>Score: {be.rolling_score ?? "-"}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* System Integrity Audit */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">System Integrity Audit</h3>
          {audits.length === 0 ? (
             <div className="p-4 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 text-sm italic">
               No audit data available.
             </div>
          ) : (
             <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
               {audits.map((audit, i) => (
                 <div key={i} className="p-3 border-b border-zinc-800 last:border-0 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-zinc-300">{audit.check_name}</div>
                      <div className="text-xs text-zinc-500">{audit.message}</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      audit.status === 'pass' ? 'text-green-400 bg-green-900/20' :
                      audit.status === 'fail' ? 'text-red-400 bg-red-900/20' :
                      'text-yellow-400 bg-yellow-900/20'
                    }`}>
                      {audit.status}
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
