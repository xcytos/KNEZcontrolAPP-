import React, { useState, useRef, useMemo } from 'react';
import { ZoomControls } from './ZoomControls';
import { Play, Database, Cpu, ArrowRight, RefreshCw } from 'lucide-react';

type FunctionalRole = 'input' | 'decision' | 'execution' | 'memory' | 'governance' | 'infra';
type EdgeType = 'data' | 'control' | 'feedback';
type GuardrailStatus = 'active' | 'tripped' | 'disabled';

interface SystemNode {
  id: string;
  role: FunctionalRole;
  label: string;
  x: number;
  y: number;
  active: boolean;
  guardrails?: GuardrailStatus[];
}

interface SystemEdge {
  from: string;
  to: string;
  type: EdgeType;
  active: boolean;
  guardrail?: GuardrailStatus;
}

interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export const InfrastructureVisualizer: React.FC = () => {
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Define zones (not rows)
  const zones: Zone[] = useMemo(() => [
    { id: 'input-zone', label: 'INPUT ZONE', x: 50, y: 50, width: 300, height: 400, color: '#3b82f6' },
    { id: 'decision-zone', label: 'DECISION ZONE', x: 380, y: 50, width: 300, height: 200, color: '#8b5cf6' },
    { id: 'execution-zone', label: 'EXECUTION ZONE', x: 380, y: 280, width: 300, height: 170, color: '#10b981' },
    { id: 'infra-zone', label: 'INFRASTRUCTURE ZONE', x: 710, y: 50, width: 300, height: 400, color: '#f59e0b' },
  ], []);

  // Define functional role nodes
  const nodes: SystemNode[] = useMemo(() => [
    // Input zone
    { id: 'user-input', role: 'input', label: 'User Input', x: 150, y: 120, active: false },
    { id: 'context-injection', role: 'input', label: 'Context Injection', x: 150, y: 220, active: false },
    { id: 'api-gateway', role: 'input', label: 'API Gateway', x: 150, y: 320, active: false },
    
    // Decision zone
    { id: 'router', role: 'decision', label: 'Router', x: 480, y: 100, active: false },
    { id: 'policy-check', role: 'decision', label: 'Policy Check', x: 480, y: 180, active: false, guardrails: ['active'] },
    
    // Execution zone
    { id: 'agent-runtime', role: 'execution', label: 'Agent Runtime', x: 480, y: 320, active: false },
    { id: 'tool-executor', role: 'execution', label: 'Tool Executor', x: 480, y: 400, active: false, guardrails: ['active'] },
    
    // Infrastructure zone
    { id: 'knez-backend', role: 'infra', label: 'KNEZ Backend', x: 810, y: 100, active: false },
    { id: 'mcp-host', role: 'infra', label: 'MCP Host', x: 810, y: 200, active: false },
    { id: 'memory-store', role: 'infra', label: 'Memory Store', x: 810, y: 300, active: false },
    { id: 'event-stream', role: 'infra', label: 'Event Stream', x: 810, y: 400, active: false },
    
    // Memory (central)
    { id: 'memory-core', role: 'memory', label: 'Memory Core', x: 530, y: 480, active: false },
  ], []);

  // Define edges with flow types
  const edges: SystemEdge[] = useMemo(() => [
    // Data flows
    { from: 'user-input', to: 'router', type: 'data', active: false },
    { from: 'context-injection', to: 'router', type: 'data', active: false },
    { from: 'api-gateway', to: 'router', type: 'data', active: false },
    { from: 'router', to: 'policy-check', type: 'control', active: false },
    { from: 'policy-check', to: 'agent-runtime', type: 'control', active: false, guardrail: 'active' },
    { from: 'agent-runtime', to: 'tool-executor', type: 'control', active: false },
    { from: 'tool-executor', to: 'mcp-host', type: 'control', active: false },
    { from: 'mcp-host', to: 'knez-backend', type: 'data', active: false },
    
    // Memory connections (central hub)
    { from: 'router', to: 'memory-core', type: 'data', active: false },
    { from: 'policy-check', to: 'memory-core', type: 'data', active: false },
    { from: 'agent-runtime', to: 'memory-core', type: 'data', active: false },
    { from: 'tool-executor', to: 'memory-core', type: 'data', active: false },
    { from: 'memory-core', to: 'memory-store', type: 'data', active: false },
    { from: 'memory-core', to: 'event-stream', type: 'feedback', active: false },
    
    // Feedback loops
    { from: 'agent-runtime', to: 'router', type: 'feedback', active: false },
    { from: 'tool-executor', to: 'agent-runtime', type: 'feedback', active: false },
  ], []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleResetZoom = () => {
    setZoom(0.9);
    setPan({ x: 50, y: 50 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (nodeId: string) => {
    // Simulate highlighting execution path
    const path = nodes.find(n => n.id === nodeId)?.role === 'input' 
      ? ['user-input', 'router', 'policy-check', 'agent-runtime', 'tool-executor', 'mcp-host']
      : [];
    setHighlightedPath(path);
  };

  const getRoleColor = (role: FunctionalRole): string => {
    switch (role) {
      case 'input': return '#3b82f6';
      case 'decision': return '#8b5cf6';
      case 'execution': return '#10b981';
      case 'memory': return '#ec4899';
      case 'governance': return '#f43f5e';
      case 'infra': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getEdgeColor = (type: EdgeType): string => {
    switch (type) {
      case 'data': return '#3b82f6';
      case 'control': return '#8b5cf6';
      case 'feedback': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getEdgeDash = (type: EdgeType): string => {
    switch (type) {
      case 'data': return 'none';
      case 'control': return '4,4';
      case 'feedback': return '2,2';
      default: return 'none';
    }
  };

  const generateEdgePath = (from: SystemNode, to: SystemNode): string => {
    const startX = from.x;
    const startY = from.y;
    const endX = to.x;
    const endY = to.y;

    // Curved paths for better visualization
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
  };

  const canvasWidth = 1100;
  const canvasHeight = 600;

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">System Behavior Observatory</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Directed system graph with functional roles and flow visualization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHighlightedPath([])}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors"
          >
            Clear Highlight
          </button>
          <ZoomControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleResetZoom}
          />
        </div>
      </div>

      <div className="flex items-center gap-6 px-6 py-3 bg-zinc-950 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Input</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-zinc-400">Decision</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Execution</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500" />
          <span className="text-zinc-400">Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-zinc-400">Infrastructure</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative bg-zinc-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="relative"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: '0 0',
            width: canvasWidth,
            height: canvasHeight
          }}
        >
          <svg
            ref={svgRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute top-0 left-0"
          >
            {/* Draw zones */}
            {zones.map((zone) => (
              <g key={zone.id}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill={`${zone.color}10`}
                  stroke={zone.color}
                  strokeWidth="2"
                  strokeDasharray="8,4"
                  rx="8"
                />
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + 25}
                  textAnchor="middle"
                  className="text-xs font-bold fill-zinc-500"
                >
                  {zone.label}
                </text>
              </g>
            ))}

            {/* Governance overlay (not a zone) */}
            <g>
              <rect
                x={50}
                y={470}
                width={960}
                height={100}
                fill="#f43f5e10"
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="4,4"
                rx="8"
              />
              <text
                x={70}
                y={490}
                className="text-xs font-bold fill-rose-500"
              >
                GOVERNANCE OVERLAY
              </text>
              <text
                x={70}
                y={510}
                className="text-[10px] fill-rose-400"
              >
                Policy enforcement, guardrails, validation
              </text>
            </g>

            {/* Draw edges */}
            {edges.map((edge, idx) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const isHighlighted = highlightedPath.includes(edge.from) && highlightedPath.includes(edge.to);
              const isGuardrailTripped = edge.guardrail === 'tripped';

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={generateEdgePath(fromNode, toNode)}
                    stroke={isGuardrailTripped ? '#ef4444' : getEdgeColor(edge.type)}
                    strokeWidth={isHighlighted ? 3 : edge.active ? 2 : 1}
                    fill="none"
                    opacity={isHighlighted ? 1 : edge.active ? 0.8 : 0.3}
                    strokeDasharray={getEdgeDash(edge.type)}
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${toNode.x - 6},${toNode.y - 6} ${toNode.x + 6},${toNode.y - 6} ${toNode.x},${toNode.y}`}
                    fill={isGuardrailTripped ? '#ef4444' : getEdgeColor(edge.type)}
                    opacity={isHighlighted ? 1 : edge.active ? 0.8 : 0.3}
                  />
                  {/* Guardrail indicator */}
                  {edge.guardrail === 'active' && (
                    <circle
                      cx={(fromNode.x + toNode.x) / 2}
                      cy={(fromNode.y + toNode.y) / 2}
                      r={6}
                      fill="#f43f5e"
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}

            {/* Draw nodes */}
            {nodes.map((node) => {
              const isHighlighted = highlightedPath.includes(node.id);
              const isMemory = node.role === 'memory';

              return (
                <g key={node.id}>
                  {/* Node background */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isMemory ? 35 : 25}
                    fill={getRoleColor(node.role)}
                    opacity={isHighlighted ? 1 : node.active ? 0.9 : 0.6}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                    onClick={() => handleNodeClick(node.id)}
                  />
                  
                  {/* Guardrail indicator on node */}
                  {node.guardrails && node.guardrails.includes('tripped') && (
                    <circle
                      cx={node.x + 20}
                      cy={node.y - 20}
                      r={8}
                      fill="#ef4444"
                      stroke="#fef2f2"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Icon */}
                  <g transform={`translate(${node.x - 10}, ${node.y - 10})`}>
                    {isMemory && <Database size={20} className="text-white" />}
                    {node.role === 'input' && <ArrowRight size={20} className="text-white" />}
                    {node.role === 'decision' && <Cpu size={20} className="text-white" />}
                    {node.role === 'execution' && <Play size={20} className="text-white" />}
                    {node.role === 'infra' && <RefreshCw size={20} className="text-white" />}
                  </g>
                  
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + (isMemory ? 45 : 35)}
                    textAnchor="middle"
                    className={`text-[10px] font-medium ${isHighlighted ? 'fill-white' : 'fill-zinc-400'}`}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500" />
            <span className="text-zinc-500">Data Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500" style={{ background: 'repeating-linear-gradient(90deg, #8b5cf6, #8b5cf6 4px, transparent 4px, transparent 8px)' }} />
            <span className="text-zinc-500">Control Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-emerald-500" style={{ background: 'repeating-linear-gradient(90deg, #10b981, #10b981 2px, transparent 2px, transparent 4px)' }} />
            <span className="text-zinc-500">Feedback Loop</span>
          </div>
          <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-zinc-500">Guardrail Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-zinc-500">Guardrail Tripped</span>
          </div>
        </div>
      </div>
    </div>
  );
};
