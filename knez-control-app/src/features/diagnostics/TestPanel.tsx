import React, { useEffect, useState } from 'react';
import { testRunner, TestResult } from '../../services/TestRunner';
import { useStatus } from '../../contexts/useStatus';
import { useSystemOrchestrator } from '../system/useSystemOrchestrator';
import { clearTestSessions, getRecommendedFixes } from '../../services/Troubleshooter';
import { Button } from '../../components/ui/core/Button';
import { Badge } from '../../components/ui/core/Badge';
import { Card } from '../../components/ui/core/Card';

export const TestPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [busyFixId, setBusyFixId] = useState<string | null>(null);

  const { forceCheck, online } = useStatus();
  const { launchAndConnect } = useSystemOrchestrator(async () => {
    await forceCheck();
  });

  useEffect(() => {
    const unsub = testRunner.subscribe(setResults);
    return () => { unsub(); };
  }, []);

  const runAll = async () => {
    if (!online) {
      await launchAndConnect(true);
      await new Promise((r) => setTimeout(r, 250));
      await forceCheck();
    }
    await testRunner.runAll();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 text-zinc-300 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
           <h2 className="text-xl font-bold text-zinc-100">Diagnostics Suite</h2>
           <p className="text-xs text-zinc-500">Automated Integration Tests (CP10/11)</p>
        </div>
        <Button 
          onClick={() => { void runAll(); }}
          variant="primary"
        >
          Run All Tests
        </Button>
      </div>

      <div className="space-y-4">
        {results.map((r) => {
          const errorCount = r.log.filter((l) => !l.startsWith("[STEP]")).length;
          const statusBadge = r.status === 'pending' ? 'default' :
                             r.status === 'running' ? 'warning' :
                             r.status === 'passed' ? 'success' : 'error';
          return (
            <Card key={r.id} className="overflow-hidden">
             <div 
               className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
               onClick={() => setExpandedIds((prev) => {
                 const next = new Set(prev);
                 if (next.has(r.id)) next.delete(r.id);
                 else next.add(r.id);
                 return next;
               })}
             >
                 <div className="flex items-center gap-4">
                    <Badge variant={statusBadge} className="w-3 h-3 p-0"><span className="block w-3 h-3 rounded-full bg-current" /></Badge>
                    <div>
                       <div className="font-medium text-zinc-200">{r.name}</div>
                       <div className="text-[10px] text-zinc-500">
                           {r.status.toUpperCase()} {errorCount > 0 ? `• ${errorCount} errors` : '• 0 errors'}
                       </div>
                    </div>
                 </div>
                 <div className="text-zinc-500 text-xs">
                    {expandedIds.has(r.id) ? '▲' : '▼'}
                 </div>
             </div>
             
             {expandedIds.has(r.id) && (
               <div className="bg-zinc-950 p-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-mono text-zinc-500">Logs</div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => { void (async () => {
                          if (!online) {
                            await launchAndConnect(true);
                            await new Promise((x) => setTimeout(x, 250));
                            await forceCheck();
                          }
                          await testRunner.runOne(r.id);
                        })(); }}
                        variant="secondary"
                        size="xs"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs font-mono">
                    {r.log.length === 0 ? (
                      <span className="text-zinc-600 italic">No errors logged.</span>
                    ) : (
                      <ul className="space-y-1">
                        {r.log.map((l, i) => (
                          <li
                            key={i}
                            className={l.startsWith("[STEP]") ? "text-zinc-500" : "text-red-400"}
                          >
                            {l}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {r.status === "failed" && (
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <div className="text-xs font-mono text-zinc-500 mb-2">Recommended fixes</div>
                      <div className="flex flex-wrap gap-2">
                        {getRecommendedFixes(r.id, {
                          forceCheck,
                          launchAndConnect,
                          clearTestSessions
                        }).map((fix) => (
                          <Button
                            key={fix.id}
                            onClick={async () => {
                              setBusyFixId(fix.id);
                              try {
                                await fix.run();
                              } finally {
                                setBusyFixId(null);
                              }
                            }}
                            disabled={busyFixId !== null}
                            variant="secondary"
                            size="xs"
                          >
                            {busyFixId === fix.id ? "Applying..." : fix.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
             )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
