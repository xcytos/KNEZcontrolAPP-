import React from 'react';
import { Layer, LayerNode } from './knezArchitecture';
import { NodeBox } from './NodeBox';

interface LayerRowProps {
  layer: Layer;
  index: number;
  onNodeClick: (node: LayerNode) => void;
}

export const LayerRow: React.FC<LayerRowProps> = ({ layer, index, onNodeClick }) => {
  const layerColors = [
    'from-blue-900/20 to-blue-800/10',
    'from-purple-900/20 to-purple-800/10',
    'from-pink-900/20 to-pink-800/10',
    'from-red-900/20 to-red-800/10',
    'from-orange-900/20 to-orange-800/10',
    'from-amber-900/20 to-amber-800/10',
    'from-yellow-900/20 to-yellow-800/10',
    'from-green-900/20 to-green-800/10',
    'from-teal-900/20 to-teal-800/10',
    'from-cyan-900/20 to-cyan-800/10',
  ];

  const bgGradient = layerColors[index % layerColors.length];

  return (
    <div
      className={`bg-gradient-to-r ${bgGradient} border border-zinc-800 rounded-lg overflow-hidden`}
    >
      {/* Layer Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/50 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
            {index + 1}
          </div>
          <div>
            <h3 className="font-bold text-zinc-200 text-sm">{layer.name}</h3>
            <p className="text-xs text-zinc-500">{layer.description}</p>
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {layer.nodes.length} components
        </div>
      </div>

      {/* Layer Nodes */}
      <div className="p-4">
        <div className="flex flex-wrap gap-3">
          {layer.nodes.map((node) => (
            <NodeBox
              key={node.id}
              node={node}
              onClick={() => onNodeClick(node)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
