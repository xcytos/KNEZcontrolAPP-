import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { InfluenceContract } from '../../domain/DataContracts';

export const GovernancePanel: React.FC = () => {
  const { showToast } = useToast();
  const [controls, setControls] = useState<any>(null);
  const [contracts, setContracts] = useState<InfluenceContract[]>([]);

  useEffect(() => {
    knezClient.getOperatorControls()
      .then(setControls)
      .catch(() => showToast("Failed to load governance controls", "error"));
      
    knezClient.getActiveContracts()
      .then(setContracts)
      .catch(() => {});
  }, []);

  if (!controls) return <div className="p-6 text-zinc-500">Loading governance...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">Operator Governance</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Global Control */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-4">Global Influence</h3>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Enable Global Influence System</span>
            <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${controls.enabled ? 'bg-green-600' : 'bg-zinc-700'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${controls.enabled ? 'translate-x-6' : ''}`} />
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Master kill-switch. When disabled, all contracts are bypassed.
          </p>
        </div>

        {/* Active Policies */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
           <h3 className="text-lg font-medium text-white mb-4">Active Policies</h3>
           {(!controls.policies || controls.policies.length === 0) && (
             <div className="text-sm text-zinc-500 italic">No active policies defined.</div>
           )}
           <div className="space-y-2">
             {controls.policies?.map((policy: any, idx: number) => (
               <div key={idx} className="flex justify-between items-center p-3 bg-zinc-800 rounded">
                 <span className="text-sm text-zinc-200">{policy.name}</span>
                 <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded">Active</span>
               </div>
             ))}
           </div>
        </div>
      </div>
      
      {/* Contracts List */}
      <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/30">
          <h3 className="text-lg font-medium text-white">Active Contracts</h3>
        </div>
        
        {contracts.length === 0 ? (
           <div className="p-6 text-center text-zinc-500 italic">No active contracts found.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {contracts.map(contract => (
              <div key={contract.influence_id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start">
                   <div>
                     <div className="text-sm font-bold text-zinc-200">{contract.domain}</div>
                     <div className="text-xs text-zinc-500 font-mono mt-1">ID: {contract.influence_id}</div>
                   </div>
                   <div className="flex gap-2">
                      <span className={`text-[10px] px-2 py-1 rounded border ${contract.scope === 'per_decision' ? 'bg-blue-900/20 border-blue-900 text-blue-300' : 'bg-purple-900/20 border-purple-900 text-purple-300'}`}>
                        {contract.scope}
                      </span>
                      <span className={`text-[10px] px-2 py-1 rounded border ${contract.approved_by === 'human' ? 'bg-green-900/20 border-green-900 text-green-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        Auth: {contract.approved_by}
                      </span>
                   </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-zinc-400">
                   <div>Weight: <span className="text-white">{contract.max_weight.toFixed(1)}</span></div>
                   <div>Reversible: <span className={contract.reversible ? 'text-green-400' : 'text-red-400'}>{contract.reversible ? 'Yes' : 'No'}</span></div>
                   <div>Override: <span className={contract.no_override ? 'text-red-400' : 'text-green-400'}>{contract.no_override ? 'Blocked' : 'Allowed'}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
