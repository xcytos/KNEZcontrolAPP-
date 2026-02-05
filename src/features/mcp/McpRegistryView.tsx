import React, { useState } from 'react';
import { McpRegistrySnapshot } from '../../domain/DataContracts';
import { knezClient } from '../../services/KnezClient';
import { useToast } from '../../components/ui/Toast';

export const McpRegistryView: React.FC<{ 
  snapshot: McpRegistrySnapshot | null;
  onRefresh: () => void; 
}> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();
  const [toggling, setToggling] = useState<string | null>(null);

  if (!snapshot) return <div className="p-8 text-center text-zinc-500">Loading MCP Registry...</div>;
  if (!snapshot.supported) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-2">MCP Not Available</div>
        <div className="text-zinc-500 text-sm">{snapshot.reason}</div>
      </div>
    );
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    setToggling(id);
    try {
      const isEnabled = currentStatus === 'active';
      await knezClient.toggleMcpItem(id, !isEnabled);
      showToast(`MCP Server ${isEnabled ? 'disabled' : 'enabled'}`, 'success');
      onRefresh();
    } catch (e) {
      showToast("Failed to toggle MCP server", 'error');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-zinc-100">MCP Registry</h2>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.items?.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative overflow-hidden">
            {/* Health Indicator Stripe */}
            <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'active' ? 'bg-green-500' : 'bg-zinc-700'}`} />
            
            <div className="pl-3">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-mono text-sm text-zinc-200">{item.id}</div>
                  <div className="text-xs text-zinc-500">{item.provider}</div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  item.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {item.status}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Capabilities</div>
                <div className="flex flex-wrap gap-1">
                  {item.capabilities?.map(cap => (
                    <span key={cap} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
                <div className="text-[10px] text-zinc-600">
                   Health: {item.status === 'active' ? 'Operational' : 'Offline'}
                </div>
                <button
                  onClick={() => handleToggle(item.id, item.status || 'inactive')}
                  disabled={toggling === item.id}
                  className={`text-xs px-3 py-1.5 rounded transition-colors ${
                     item.status === 'active' 
                     ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700' 
                     : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {toggling === item.id ? '...' : item.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
