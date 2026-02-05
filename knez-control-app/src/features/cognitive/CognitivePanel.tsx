import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { CognitiveState } from '../../domain/DataContracts';

type Tab = "overview" | "governance" | "influence" | "taqwin";

export const CognitivePanel: React.FC = () => {
  const [state, setState] = useState<CognitiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [subState, setSubState] = useState<any>(null);

  useEffect(() => {
    knezClient.getCognitiveState()
      .then(setState)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (activeTab === "overview") {
      setSubState(null);
      return;
    }
    knezClient.getDetailedSubsystemState(activeTab)
      .then(setSubState)
      .catch(() => setSubState({ error: "Failed to load subsystem state" }));
  }, [activeTab]);

  if (error) return <div className="p-6 text-red-400">Error loading cognitive state: {error}</div>;
  if (!state) return <div className="p-6 text-zinc-500">Loading state...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">Cognitive State Dashboard</h2>
      
      {/* Overview Cards (Always Visible) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">System Stability</div>
          <div className="text-3xl font-bold text-blue-400">{state.stability_score ?? 'N/A'}%</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Active Contexts</div>
          <div className="text-3xl font-bold text-green-400">{state.active_contexts ?? 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Focus Level</div>
          <div className="text-3xl font-bold text-purple-400">{state.focus_level ?? 'Normal'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-4">
        {['overview', 'governance', 'influence', 'taqwin'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as Tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab 
              ? 'text-white border-b-2 border-blue-500' 
              : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-800 flex justify-between items-center">
           <h3 className="text-sm font-medium text-zinc-200">
             {activeTab === 'overview' ? 'Raw State Dump' : `Subsystem: ${activeTab}`}
           </h3>
           <span className="text-[10px] text-zinc-500 font-mono">LIVE</span>
        </div>
        <pre className="p-4 text-xs font-mono text-zinc-400 overflow-auto max-h-96">
          {activeTab === 'overview' 
            ? JSON.stringify(state, null, 2)
            : subState ? JSON.stringify(subState, null, 2) : "Loading..."
          }
        </pre>
      </div>
    </div>
  );
};
