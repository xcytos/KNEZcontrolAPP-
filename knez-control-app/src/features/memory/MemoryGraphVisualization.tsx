/**
 * Memory Graph Visualization Component
 * 
 * Interactive visualization for memory relationships and clusters
 * 
 * Applied Learnings:
 * - Learning 47-48: Graph Database Fundamentals
 * - Learning 51-53: Knowledge Graph Benefits
 * - Learning 99-102: Taxonomy vs Ontology for visualization
 */

import React, { useEffect, useState, useRef } from 'react';
import { getMemoryKnowledgeGraphService, GraphNode, GraphEdge, GraphCluster } from '../../services/memory/tracking/MemoryKnowledgeGraphService';
import { getMemoryEventSourcingService } from '../../services/memory/storage/MemoryEventSourcingService';

interface MemoryGraphVisualizationProps {
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string;
}

export const MemoryGraphVisualization: React.FC<MemoryGraphVisualizationProps> = ({
  onNodeClick,
  selectedNodeId
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const graphService = getMemoryKnowledgeGraphService();
  const memoryService = getMemoryEventSourcingService();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    graphService.buildGraph();
    const allClusters = graphService.findClusters();
    setClusters(allClusters);

    // Load all nodes for visualization
    const memories = memoryService.getAllMemories();
    const graphNodes: GraphNode[] = memories.map(memory => ({
      id: memory.id,
      type: memory.type,
      properties: {
        title: memory.title,
        domain: memory.domain,
        timestamp: memory.createdAt,
        tags: memory.tags
      }
    }));
    setNodes(graphNodes);

    // Load edges from memory relations
    const graphEdges: GraphEdge[] = [];
    memories.forEach(memory => {
      memory.relations.forEach(relation => {
        graphEdges.push({
          id: `${memory.id}-${relation.relatedMemoryId}`,
          source: memory.id,
          target: relation.relatedMemoryId,
          relationship: relation.relationship,
          weight: relation.weight,
          timestamp: relation.addedAt
        });
      });
    });
    setEdges(graphEdges);
  };

  // Simple force-directed layout
  const layoutNodes = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const positions = new Map<string, { x: number; y: number }>();
    const width = 800;
    const height = 600;

    // Initialize positions randomly
    nodes.forEach(node => {
      positions.set(node.id, {
        x: Math.random() * width,
        y: Math.random() * height
      });
    });

    // Simple simulation
    for (let i = 0; i < 50; i++) {
      // Repulsion between nodes
      for (const a of nodes) {
        for (const b of nodes) {
          if (a.id === b.id) continue;
          const posA = positions.get(a.id)!;
          const posB = positions.get(b.id)!;
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          posA.x += fx;
          posA.y += fy;
          posB.x -= fx;
          posB.y -= fy;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const posA = positions.get(edge.source);
        const posB = positions.get(edge.target);
        if (!posA || !posB) return;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.05;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        posA.x += fx;
        posA.y += fy;
        posB.x -= fx;
        posB.y -= fy;
      });

      // Center gravity
      nodes.forEach(node => {
        const pos = positions.get(node.id)!;
        pos.x += (width / 2 - pos.x) * 0.01;
        pos.y += (height / 2 - pos.y) * 0.01;
      });
    }

    return positions;
  };

  const positions = layoutNodes(nodes, edges);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'learning': return '#22c55e';
      case 'mistake': return '#ef4444';
      case 'decision': return '#3b82f6';
      case 'pattern': return '#a855f7';
      default: return '#6b7280';
    }
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case 'relates_to': return '#9ca3af';
      case 'caused': return '#f59e0b';
      case 'resolved': return '#10b981';
      case 'similar_to': return '#8b5cf6';
      case 'depends_on': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const filteredNodes = selectedCluster
    ? nodes.filter(n => clusters.find(c => c.id === selectedCluster)?.nodes.includes(n.id))
    : nodes;

  const filteredEdges = selectedCluster
    ? edges.filter(e => 
        filteredNodes.find(n => n.id === e.source) && 
        filteredNodes.find(n => n.id === e.target)
      )
    : edges;

  return (
    <div className="w-full h-full bg-zinc-950 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <h3 className="font-bold text-zinc-100">Memory Graph</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`text-xs px-2 py-1 rounded ${
              !selectedCluster ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            All
          </button>
          {clusters.slice(0, 5).map(cluster => (
            <button
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster.id)}
              className={`text-xs px-2 py-1 rounded ${
                selectedCluster === cluster.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {cluster.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {filteredEdges.map(edge => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={getRelationshipColor(edge.relationship)}
              strokeWidth={Math.max(1, edge.weight * 2)}
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {filteredNodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isSelected = node.id === selectedNodeId;
          const isHovered = node.id === hoveredNode;
          const radius = isSelected || isHovered ? 20 : 15;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onNodeClick?.(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle
                r={radius}
                fill={getNodeColor(node.type)}
                stroke={isSelected ? '#fff' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
                opacity={isHovered ? 0.8 : 1}
              />
              {isHovered && (
                <foreignObject x={25} y={-10} width={200} height={80}>
                  <div className="bg-zinc-900 border border-zinc-700 rounded p-2 text-xs">
                    <div className="font-bold text-zinc-100">{node.properties.title}</div>
                    <div className="text-zinc-400">{node.properties.domain}</div>
                    <div className="text-zinc-500">{node.type}</div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-4 right-4 bg-zinc-900/90 border border-zinc-800 rounded p-3">
        <div className="text-xs font-bold text-zinc-300 mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[10px] text-zinc-400">Learning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-[10px] text-zinc-400">Mistake</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[10px] text-zinc-400">Decision</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-[10px] text-zinc-400">Pattern</span>
          </div>
        </div>
      </div>
    </div>
  );
};
