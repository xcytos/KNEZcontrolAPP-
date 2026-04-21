import React, { useState } from 'react';
import { knezClient } from '../../services/knez/KnezClient';
import { PerceptionSnapshot, ActiveWindowInfo } from '../../domain/DataContracts';
import { useToast } from '../../components/ui/Toast';

export const PerceptionPanel: React.FC = () => {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<PerceptionSnapshot | null>(null);
  const [windowInfo, setWindowInfo] = useState<ActiveWindowInfo | null>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const [snap, win] = await Promise.all([
        knezClient.takeSnapshot(),
        knezClient.getActiveWindow()
      ]);
      setSnapshot(snap);
      setWindowInfo(win);
      showToast("Perception event captured", "success");
    } catch (e) {
      showToast("Capture failed", "error");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-zinc-100">Visual Perception</h2>
        <button
          onClick={handleCapture}
          disabled={capturing}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-bold disabled:opacity-50"
        >
          {capturing ? "Looking..." : "Capture View"}
        </button>
      </div>

      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center overflow-hidden relative">
        {!snapshot ? (
          <div className="text-zinc-600 text-sm">No visual input</div>
        ) : (
          <img 
            src={`data:image/png;base64,${snapshot.image_base64}`} 
            alt="Perception" 
            className="max-w-full max-h-full object-contain"
          />
        )}
        
        {windowInfo && (
          <div className="absolute bottom-4 left-4 bg-black/80 p-2 rounded border border-zinc-700 max-w-sm">
             <div className="text-[10px] text-zinc-400 uppercase">Active Context</div>
             <div className="text-sm font-bold text-white truncate">{windowInfo.title}</div>
             <div className="text-xs text-zinc-500 font-mono">
               Process: {windowInfo.process_name || 'unknown'} | {windowInfo.bounds.right - windowInfo.bounds.left}x{windowInfo.bounds.bottom - windowInfo.bounds.top}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
