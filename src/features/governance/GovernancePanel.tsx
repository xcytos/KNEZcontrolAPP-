import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';
import { InfluenceContract } from '../../domain/DataContracts';
import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export const GovernancePanel: React.FC = () => {
  const { showToast } = useToast();
  const [controls, setControls] = useState<any>(null);
  const [contracts, setContracts] = useState<InfluenceContract[]>([]);
  const [activeTab, setActiveTab] = useState<'controls' | 'prompts' | 'tickets'>('controls');
  
  // CP7-8 & CP7-9 Data
  const [promptsContent, setPromptsContent] = useState<string>("");
  const [ticketsContent, setTicketsContent] = useState<string>("");

  useEffect(() => {
    knezClient.getOperatorControls()
      .then(setControls)
      .catch(() => showToast("Failed to load governance controls", "error"));
      
    knezClient.getActiveContracts()
      .then(setContracts)
      .catch(() => {});
  }, []);

  const loadGovernanceFiles = async () => {
    try {
      // In a real app, path resolution might be trickier. 
      // Assuming .taqwin is relative to CWD or accessible via fs.
      // Since we don't have a backend endpoint, we rely on FS plugin if allowed.
      // If permission denied, we show a message.
      
      // We try to read relative to Resource or AppConfig, but .taqwin is in repo root.
      // For the "Control App" development mode, we might need absolute path or user pick.
      // BUT for CP7 requirements, we must show it.
      
      // Let's try to read from a known location if possible, or skip if we can't resolve.
      // Ideally, the backend KNEZ should serve these files. 
      // Since we are in "Real Installation", maybe we should fetch from backend if we add an endpoint?
      // CP7-8 says "In-app panel to view .taqwin...".
      
      // Let's try to fetch from KNEZ backend if we add a route? 
      // No, let's use FS but catch errors.
      // Actually, since we can't easily guess the path in production, 
      // let's display a placeholder if FS fails, or implementing a backend route is cleaner.
      // I'll stick to the existing plan: try FS, fallback to "Unavailable in this build".
      
      // However, for this environment, I'll mock the read for the sake of the ticket if FS fails?
      // NO. CP7 says "Assert zero simulation".
      // So if FS fails, we show "Governance files not accessible".
      
      // Wait, I can add a simple backend endpoint to KNEZ to serve these files? 
      // That would be robust. But modifying backend is extra scope.
      // Let's try to read via Tauri FS using a relative path from the app executable? 
      // Or just assume CWD is repo root for development.
      
      // For now, I will render the tabs and try to load.
      setPromptsContent("// Loading prompts.md...");
      setTicketsContent("// Loading tickets.md...");
      
      // Try to read from current working directory which should be repo root in dev
      // In production, this might fail, but for "Real Installation" verification we check if it works.
      try {
        const prompts = await readTextFile('.taqwin/serialization/prompts.md', { baseDir: BaseDirectory.AppLocalData });
        setPromptsContent(prompts);
      } catch (e1) {
         try {
            // Fallback to Resource or explicit path if we can guess it?
            // Actually, without scope, we can only read from allowed dirs.
            // .taqwin is in root.
            // Let's assume we can read relative to the binary if configured?
            // The default.json allows "fs:default" which usually means AppConfig, AppData, etc.
            // It does NOT allow arbitrary paths unless configured.
            // Let's try to fetch via a relative path just in case we are in a dev environment.
            // If all fails, we show the message.
            const prompts = await readTextFile('.taqwin/serialization/prompts.md');
            setPromptsContent(prompts);
         } catch (e2) {
            setPromptsContent("Governance files not accessible via client-side FS.\n(Requires KNEZ backend serving or strict FS scope configuration).");
         }
      }

      try {
        const tickets = await readTextFile('.taqwin/work/tickets.md');
        setTicketsContent(tickets);
      } catch (e) {
        setTicketsContent("Tickets file not accessible.");
      }
      
    } catch (e) {
      setPromptsContent("Error loading governance files.");
    }
  };

  useEffect(() => {
    if (activeTab !== 'controls') {
      loadGovernanceFiles();
    }
  }, [activeTab]);

  if (!controls) return <div className="p-6 text-zinc-500">Loading governance...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Governance & History</h2>
        <div className="flex space-x-2 bg-zinc-900 rounded p-1">
          <button 
            onClick={() => setActiveTab('controls')}
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'controls' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Controls
          </button>
          <button 
            onClick={() => setActiveTab('prompts')}
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'prompts' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Prompts (CP7-8)
          </button>
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'tickets' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Tickets (CP7-9)
          </button>
        </div>
      </div>
      
      {activeTab === 'controls' && (
        <div className="space-y-6 overflow-y-auto">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
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
      )}

      {activeTab === 'prompts' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded p-4 h-full overflow-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap">
          {promptsContent}
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded p-4 h-full overflow-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap">
          {ticketsContent}
        </div>
      )}
    </div>
  );
};
