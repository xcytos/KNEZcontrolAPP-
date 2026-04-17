import React, { useEffect, useState } from 'react';

export const PerformancePanel: React.FC = () => {
  const [metrics, setMetrics] = useState<any[]>([]);

  // TODO: Integrate with real metrics stream from backend (streaming metrics event emitter)
  // Currently using mock metrics for visualization
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(prev => {
         const newMetric = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            latency: Math.floor(Math.random() * 200) + 50,
            ttft: Math.floor(Math.random() * 100) + 20,
            tps: (Math.random() * 50 + 10).toFixed(1)
         };
         return [newMetric, ...prev].slice(0, 20);
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded mb-4">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Real-time Performance</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
         <div className="bg-zinc-950 p-2 rounded text-center">
            <div className="text-[10px] text-zinc-500">Avg Latency</div>
            <div className="text-lg font-mono text-blue-400">
               {(metrics.reduce((acc, m) => acc + m.latency, 0) / (metrics.length || 1)).toFixed(0)}ms
            </div>
         </div>
         <div className="bg-zinc-950 p-2 rounded text-center">
            <div className="text-[10px] text-zinc-500">Avg TTFT</div>
            <div className="text-lg font-mono text-purple-400">
               {(metrics.reduce((acc, m) => acc + m.ttft, 0) / (metrics.length || 1)).toFixed(0)}ms
            </div>
         </div>
         <div className="bg-zinc-950 p-2 rounded text-center">
            <div className="text-[10px] text-zinc-500">Tokens/Sec</div>
            <div className="text-lg font-mono text-green-400">
               {metrics.length > 0 ? metrics[0].tps : "0.0"}
            </div>
         </div>
      </div>
      
      <div className="h-32 flex items-end gap-1 border-b border-zinc-800 pb-1">
         {metrics.slice().reverse().map(m => (
            <div 
              key={m.id} 
              className="flex-1 bg-blue-900/50 hover:bg-blue-500 transition-colors relative group"
              style={{ height: `${Math.min(100, (m.latency / 300) * 100)}%` }}
            >
               <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                 {m.latency}ms
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};
