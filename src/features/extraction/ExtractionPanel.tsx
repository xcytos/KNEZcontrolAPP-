import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { extractionService } from '../../services/ExtractionService';

export const ExtractionPanel: React.FC = () => {
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'news' | 'github' | 'raw'>('news');
  const [schedule, setSchedule] = useState<number | null>(null); // Interval in minutes
  const [schedulerId, setSchedulerId] = useState<any | null>(null);

  useEffect(() => {
    return () => {
      if (schedulerId) clearInterval(schedulerId);
    };
  }, [schedulerId]);

  const toggleScheduler = () => {
     if (schedulerId) {
        clearInterval(schedulerId);
        setSchedulerId(null);
        showToast("Auto-extraction disabled", "info");
     } else {
        if (!url) {
           showToast("Enter a URL first", "error");
           return;
        }
        const id = setInterval(() => {
           handleExtract();
        }, (schedule || 15) * 60 * 1000);
        setSchedulerId(id);
        showToast(`Auto-extraction enabled (${schedule || 15}m)`, "success");
     }
  };

  const handleExtract = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);

    try {
      const data = await extractionService.extract(url, mode);
      if (data.error) throw new Error(data.error);
      setResult(JSON.stringify(data, null, 2));
      showToast("Extraction complete", "success");
    } catch (e: any) {
      showToast(`Extraction failed: ${e.message}`, "error");
      setResult(JSON.stringify({ error: e.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">Web Extractor (CP8)</h2>
      
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg mb-6">
        <div className="flex gap-4 mb-4">
           <button 
             onClick={() => setMode('news')}
             className={`px-4 py-2 rounded text-sm ${mode === 'news' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
           >
             AI News
           </button>
           <button 
             onClick={() => setMode('github')}
             className={`px-4 py-2 rounded text-sm ${mode === 'github' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
           >
             GitHub Repo
           </button>
           <button 
             onClick={() => setMode('raw')}
             className={`px-4 py-2 rounded text-sm ${mode === 'raw' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
           >
             Raw Page
           </button>
        </div>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={mode === 'github' ? "https://github.com/username/repo" : "https://example.com/news"}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-4 py-2 text-zinc-200 outline-none focus:border-blue-500"
          />
          <button 
            onClick={handleExtract}
            disabled={loading || !url}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded font-medium transition-colors"
          >
            {loading ? "Extracting..." : "Extract"}
          </button>
          
          <div className="flex items-center gap-2 border-l border-zinc-700 pl-4 ml-2">
             <select 
               className="bg-zinc-950 border border-zinc-700 text-zinc-300 rounded px-2 py-2 text-sm outline-none"
               value={schedule || 15}
               onChange={(e) => setSchedule(Number(e.target.value))}
               disabled={!!schedulerId}
             >
                <option value={5}>Every 5m</option>
                <option value={15}>Every 15m</option>
                <option value={60}>Every 1h</option>
                <option value={360}>Every 6h</option>
             </select>
             <button
               onClick={toggleScheduler}
               disabled={!url}
               className={`px-3 py-2 rounded text-sm font-medium transition-colors ${schedulerId ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-900' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'}`}
             >
                {schedulerId ? "Stop Auto" : "Start Auto"}
             </button>
          </div>
        </div>
      </div>
      
      {result && (
        <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-4 overflow-hidden flex flex-col">
           <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-2">
             <span className="text-xs text-zinc-500 uppercase font-bold">Extraction Analysis</span>
             <div className="flex gap-2">
               <button 
                 className="text-xs px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-300"
                 onClick={() => {
                    const blob = new Blob([result], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `extraction-${new Date().getTime()}.json`;
                    a.click();
                 }}
               >
                 Download JSON
               </button>
             </div>
           </div>
           
           <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Analysis View */}
              <div className="space-y-4">
                 <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">Summary</div>
                    <div className="text-sm font-medium text-zinc-200">{JSON.parse(result).summary}</div>
                 </div>
                 
                 <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-2">Key Data Points</div>
                    <div className="grid grid-cols-2 gap-2">
                       {Object.entries(JSON.parse(result).data).map(([k, v]) => {
                          if (typeof v === 'string' || typeof v === 'number') {
                             return (
                               <div key={k} className="flex flex-col">
                                  <span className="text-[10px] text-zinc-500 uppercase">{k.replace(/_/g, ' ')}</span>
                                  <span className="text-xs text-zinc-300 truncate" title={String(v)}>{String(v)}</span>
                               </div>
                             );
                          }
                          return null;
                       })}
                    </div>
                 </div>

                 {JSON.parse(result).data.keywords && (
                    <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-2">Keywords / Topics</div>
                      <div className="flex flex-wrap gap-2">
                        {(JSON.parse(result).data.keywords as string[]).map((kw, i) => (
                           <span key={i} className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded-full text-xs border border-blue-900/50">
                             {kw}
                           </span>
                        ))}
                      </div>
                    </div>
                 )}
              </div>

              {/* Raw JSON View */}
              <div className="bg-zinc-950 p-2 rounded border border-zinc-900 overflow-auto">
                 <div className="text-xs text-zinc-600 mb-1 font-mono">Raw Data Payload</div>
                 <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-all">
                   {result}
                 </pre>
              </div>
           </div>
        </div>
      )}
      
      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 italic">
          Enter a URL to begin extraction analysis.
        </div>
      )}
    </div>
  );
};
