
import React, { useEffect, useState } from 'react';
import { testRunner, TestResult } from '../../services/TestRunner';

export const TestPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = testRunner.subscribe(setResults);
    return () => { unsub(); };
  }, []);

  const runAll = () => {
    testRunner.runAll();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 text-zinc-300 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
           <h2 className="text-xl font-bold text-zinc-100">Diagnostics Suite</h2>
           <p className="text-xs text-zinc-500">Automated Integration Tests (CP10/11)</p>
        </div>
        <button 
          onClick={runAll}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          Run All Tests
        </button>
      </div>

      <div className="space-y-4">
        {results.map(r => (
          <div key={r.id} className="flex flex-col bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
             <div 
               className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
               onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
             >
                 <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                       r.status === 'pending' ? 'bg-zinc-600' :
                       r.status === 'running' ? 'bg-yellow-500 animate-pulse' :
                       r.status === 'passed' ? 'bg-green-500' :
                       'bg-red-500'
                    }`} />
                    <div>
                       <div className="font-medium text-zinc-200">{r.name}</div>
                       <div className="text-[10px] text-zinc-500">
                           {r.status.toUpperCase()} {r.log.length > 0 ? `• ${r.log.length} errors` : '• 0 errors'}
                       </div>
                    </div>
                 </div>
                 <div className="text-zinc-500 text-xs">
                    {expandedId === r.id ? '▲' : '▼'}
                 </div>
             </div>
             
             {expandedId === r.id && (
               <div className="bg-zinc-950 p-4 border-t border-zinc-800 text-xs font-mono">
                  {r.log.length === 0 ? (
                    <span className="text-zinc-600 italic">No errors logged.</span>
                  ) : (
                    <ul className="space-y-1">
                      {r.log.map((l, i) => (
                        <li key={i} className="text-red-400">{l}</li>
                      ))}
                    </ul>
                  )}
               </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
};
