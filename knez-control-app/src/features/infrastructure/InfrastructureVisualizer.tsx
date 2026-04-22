import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomControls } from './ZoomControls';
import { Activity, GitBranch, X, Layers } from 'lucide-react';
import { DiagnosticPanel, LayerDiagnostic, DiagnosticConfig } from './DiagnosticPanel';
import { DiagnosticSimulation } from './DiagnosticSimulation';
import { knezArchitecture, Layer, NodeStatus } from './knezArchitecture';
import { knezClient } from '../../services/knez/KnezClient';
import { testExecutionStateMachine } from './TestExecutionStateMachine';
import { getTestNodePath } from './testNodePaths';
import { usePacketAnimation } from './PacketAnimation';

type EdgeType = 'data' | 'control' | 'feedback';
type GuardrailStatus = 'active' | 'tripped' | 'disabled';

interface SystemNode {
  id: string;
  layerId: string;
  label: string;
  x: number;
  y: number;
  active: boolean;
  status: NodeStatus;
  description: string;
  fileRef: string;
  dependencies: string[];
  guardrails?: GuardrailStatus[];
  metrics?: {
    lastActive?: string;
    errorCount?: number;
    performance?: number;
  };
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
  layer: Layer;
}

export const InfrastructureVisualizer: React.FC = () => {
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [view, setView] = useState<'graph' | 'simulation'>('graph');
  const [selectedNode, setSelectedNode] = useState<SystemNode | null>(null);
  const [layerSummaryOpen, setLayerSummaryOpen] = useState(false);
  const [activeTestNodeId, setActiveTestNodeId] = useState<string | null>(null);
  const [blinkingNodes, setBlinkingNodes] = useState<Set<string>>(new Set());
  const [errorPath, setErrorPath] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { isAnimating, startAnimation, stopAnimation } = usePacketAnimation();

  // Define zones from actual knezArchitecture layers
  const zones: Zone[] = useMemo(() => {
    const layerColors = [
      '#3b82f6', // Observability - blue
      '#8b5cf6', // Governance - purple
      '#ec4899', // Cognitive - pink
      '#f59e0b', // Infrastructure - amber
      '#10b981', // MCP - emerald
      '#06b6d4', // Tool Execution - cyan
      '#f43f5e', // Agent Runtime - rose
      '#6366f1', // Chat - indigo
      '#84cc16', // Memory - lime
      '#a855f7', // Data - violet
    ];
    
    return knezArchitecture.layers.map((layer, index) => ({
      id: layer.id,
      label: layer.name,
      x: 50 + (index % 2) * 500,
      y: 50 + Math.floor(index / 2) * 450,
      width: 450,
      height: 400,
      color: layerColors[index % layerColors.length],
      layer
    }));
  }, []);

  // Define nodes from actual knezArchitecture layers with improved layout
  const initialNodes = useMemo(() => {
    const allNodes: SystemNode[] = [];
    
    knezArchitecture.layers.forEach((layer) => {
      const zone = zones.find(z => z.id === layer.id);
      if (!zone) return;
      
      const nodesInLayer = layer.nodes.length;
      const padding = 40;
      const availableWidth = zone.width - padding * 2;
      const availableHeight = zone.height - padding * 2;
      
      // Calculate optimal grid dimensions
      const aspectRatio = availableWidth / availableHeight;
      const cols = Math.ceil(Math.sqrt(nodesInLayer * aspectRatio));
      const rows = Math.ceil(nodesInLayer / cols);
      
      const nodeSpacingX = availableWidth / cols;
      const nodeSpacingY = availableHeight / rows;
      
      layer.nodes.forEach((node, nodeIndex) => {
        const row = Math.floor(nodeIndex / cols);
        const col = nodeIndex % cols;
        
        allNodes.push({
          id: node.id,
          layerId: layer.id,
          label: node.name,
          x: zone.x + padding + nodeSpacingX * col + nodeSpacingX / 2,
          y: zone.y + padding + nodeSpacingY * row + nodeSpacingY / 2,
          active: node.status === 'working',
          status: node.status,
          description: node.description,
          fileRef: node.fileRef,
          dependencies: node.dependencies,
          metrics: node.metrics
        });
      });
    });
    
    return allNodes;
  }, [zones]);

  const [nodes, setNodes] = useState<SystemNode[]>(initialNodes);

  // Define edges from actual knezArchitecture connections
  const edges: SystemEdge[] = useMemo(() => {
    return knezArchitecture.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
      type: conn.type === 'dependency' ? 'control' : conn.type === 'data_flow' ? 'data' : 'feedback',
      active: false
    }));
  }, []);

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
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setSelectedNode(node);
    
    // Highlight execution path from this node through its dependencies
    const path = [nodeId];
    const visited = new Set<string>([nodeId]);
    
    const traverseDependencies = (currentId: string) => {
      const currentNode = nodes.find(n => n.id === currentId);
      if (!currentNode) return;
      
      currentNode.dependencies.forEach(depId => {
        if (!visited.has(depId)) {
          visited.add(depId);
          path.push(depId);
          traverseDependencies(depId);
        }
      });
    };
    
    traverseDependencies(nodeId);
    setHighlightedPath(path);
  };

  const getStatusColor = (status: NodeStatus): string => {
    switch (status) {
      case 'working': return '#10b981';
      case 'partial': return '#f59e0b';
      case 'not_working': return '#ef4444';
      case 'planned': return '#6b7280';
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

  // Poll health status from KnezClient
  useEffect(() => {
    let mounted = true;
    const pollInterval = 30000; // 30 seconds

    const pollHealth = async () => {
      try {
        const health = await knezClient.health({ timeoutMs: 5000 });
        if (!mounted) return;
        
        // Update node statuses based on health response
        // For now, we'll mark all nodes as working if backend is healthy
        // In a full implementation, we'd map specific backend components to nodes
        if (health.status === 'healthy') {
          setNodes(prev => prev.map(node => ({
            ...node,
            active: node.status === 'working'
          })));
        } else {
          setNodes(prev => prev.map(node => ({
            ...node,
            active: false
          })));
        }
      } catch (error) {
        // If health check fails, mark nodes as inactive
        if (mounted) {
          setNodes(prev => prev.map(node => ({
            ...node,
            active: false
          })));
        }
      }
    };

    pollHealth();
    const interval = setInterval(pollHealth, pollInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setNodes]);

  // Subscribe to TestRunner state updates and drive visualization
  // Note: Integration logic in place, but subscription deferred due to type mismatch
  // TODO: Resolve TestRunner.subscribe return type to enable real-time integration
  // useEffect(() => {
  //   const handleTestUpdate = (results: any[]) => {
  //     results.forEach((result: any) => {
  //       if (result.status === 'running') {
  //         testExecutionStateMachine.transition({ type: 'START', testId: result.id });
  //       } else if (result.status === 'passed') {
  //         testExecutionStateMachine.transition({ type: 'COMPLETE', testId: result.id, success: true });
  //       } else if (result.status === 'failed') {
  //         testExecutionStateMachine.transition({ type: 'FAIL', testId: result.id, error: result.log[result.log.length - 1] || 'Unknown error' });
  //       }
  //     });
  //   };
  //   const unsubscribe = testRunner.subscribe(handleTestUpdate);
  //   return unsubscribe;
  // }, []);

  // Subscribe to test execution state machine for real-time visualization
  useEffect(() => {
    const unsubscribe = testExecutionStateMachine.subscribe((context) => {
      const activeTest = context.activeTest;
      if (!activeTest) {
        setActiveTestNodeId(null);
        setBlinkingNodes(new Set());
        setErrorPath([]);
        stopAnimation();
        return;
      }

      const testState = context.tests.get(activeTest);
      if (!testState) return;

      // If test failed, set error path
      if (testState.state === 'failed') {
        const testPath = getTestNodePath(activeTest);
        if (testPath) {
          setErrorPath(testPath.nodePath.slice(0, testState.currentNodeIndex + 1));
        }
        return;
      }

      if (testState.state !== 'running') return;

      const testPath = getTestNodePath(activeTest);
      if (!testPath) return;

      // Clear error path when test is running
      setErrorPath([]);

      // Highlight current node in the test path
      const currentNodeId = testPath.nodePath[testState.currentNodeIndex];
      if (currentNodeId) {
        setActiveTestNodeId(currentNodeId);
        
        // Blink the node briefly
        setBlinkingNodes(prev => new Set([...prev, currentNodeId]));
        setTimeout(() => {
          setBlinkingNodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentNodeId);
            return newSet;
          });
        }, 500);
      }

      // Start packet animation if not already animating
      if (!isAnimating) {
        startAnimation(testPath.nodePath, '#3b82f6');
      }
    });

    return unsubscribe;
  }, [isAnimating, startAnimation, stopAnimation]);

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

  const canvasWidth = 1050;
  const canvasHeight = 2400;

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
            onClick={() => setView(view === 'graph' ? 'simulation' : 'graph')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
              view === 'graph' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            {view === 'graph' ? 'Simulation View' : 'Graph View'}
          </button>
          <button
            onClick={() => setLayerSummaryOpen(!layerSummaryOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
              layerSummaryOpen 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            <Layers className="w-4 h-4" />
            Layer Summary
          </button>
          <button
            onClick={() => setDiagnosticOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            <Activity className="w-4 h-4" />
            Diagnostics
          </button>
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
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Working</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-zinc-400">Partial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-zinc-400">Not Working</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-zinc-400">Planned</span>
        </div>
        <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
          <span className="text-zinc-500">{nodes.length} nodes across {zones.length} layers</span>
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
              const isErrorPath = errorPath.includes(edge.from) && errorPath.includes(edge.to);
              const isGuardrailTripped = edge.guardrail === 'tripped';

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={generateEdgePath(fromNode, toNode)}
                    stroke={isGuardrailTripped ? '#ef4444' : isErrorPath ? '#dc2626' : getEdgeColor(edge.type)}
                    strokeWidth={isHighlighted ? 3 : isErrorPath ? 3 : edge.active ? 2 : 1}
                    fill="none"
                    opacity={isHighlighted ? 1 : isErrorPath ? 1 : edge.active ? 0.8 : 0.3}
                    strokeDasharray={isErrorPath ? '8,4' : getEdgeDash(edge.type)}
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
              const isActiveTestNode = activeTestNodeId === node.id;
              const isBlinking = blinkingNodes.has(node.id);

              return (
                <g key={node.id}>
                  {/* Node background */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={20}
                    fill={getStatusColor(node.status)}
                    opacity={isHighlighted ? 1 : node.active ? 0.9 : 0.6}
                    stroke={isActiveTestNode ? '#fbbf24' : isBlinking ? '#fff' : 'transparent'}
                    strokeWidth={isActiveTestNode ? 3 : isBlinking ? 2 : 0}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                    onClick={() => handleNodeClick(node.id)}
                  >
                    {isActiveTestNode && (
                      <animate
                        attributeName="r"
                        values="20;23;20"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    )}
                    {isBlinking && (
                      <>
                        <animate
                          attributeName="opacity"
                          values="1;0.3;1"
                          dur="0.3s"
                          repeatCount="3"
                        />
                        <animate
                          attributeName="stroke-opacity"
                          values="1;0.5;1"
                          dur="0.3s"
                          repeatCount="3"
                        />
                      </>
                    )}
                  </circle>
                  
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
                  
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 35}
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

      <DiagnosticPanel
        isOpen={diagnosticOpen}
        onClose={() => setDiagnosticOpen(false)}
        onRunDiagnostic={async (_config: DiagnosticConfig) => {
          const layerDiagnostics: LayerDiagnostic[] = knezArchitecture.layers.map(layer => {
            const partialCount = layer.nodes.filter(n => n.status === 'partial').length;
            const notWorkingCount = layer.nodes.filter(n => n.status === 'not_working').length;
            
            let status: 'healthy' | 'degraded' | 'failed';
            if (notWorkingCount > 0) {
              status = 'failed';
            } else if (partialCount > 0) {
              status = 'degraded';
            } else {
              status = 'healthy';
            }
            
            return {
              id: layer.id,
              name: layer.name,
              status,
              lastCheck: Date.now(),
              metrics: [],
              nodes: layer.nodes.map(n => ({
                id: n.id,
                name: n.name,
                type: 'infra' as const,
                status: n.status === 'not_working' ? 'error' : n.status === 'partial' ? 'inactive' : 'active',
                responseTime: Math.floor(Math.random() * 100) + 20,
                throughput: Math.floor(Math.random() * 100) + 10,
                errorRate: n.status === 'not_working' ? 1.0 : n.status === 'partial' ? 0.1 : 0.0,
                metrics: []
              }))
            };
          });
          
          return layerDiagnostics;
        }}
      />

      {/* Node Detail Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-[500px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">{selectedNode.label}</h3>
                <p className="text-xs text-zinc-500">{selectedNode.id}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-zinc-400 mb-2">Description</h4>
                <p className="text-sm text-zinc-300">{selectedNode.description}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-400 mb-2">Status</h4>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium ${
                  selectedNode.status === 'working' ? 'bg-green-500/20 text-green-400' :
                  selectedNode.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedNode.status === 'not_working' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    selectedNode.status === 'working' ? 'bg-green-500' :
                    selectedNode.status === 'partial' ? 'bg-yellow-500' :
                    selectedNode.status === 'not_working' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  {selectedNode.status.toUpperCase()}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-400 mb-2">File Reference</h4>
                <code className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded">{selectedNode.fileRef}</code>
              </div>
              {selectedNode.dependencies.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 mb-2">Dependencies ({selectedNode.dependencies.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.dependencies.map(dep => (
                      <span key={dep} className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{dep}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedNode.metrics && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 mb-2">Metrics</h4>
                  <div className="space-y-2">
                    {selectedNode.metrics.lastActive && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Last Active</span>
                        <span className="text-zinc-300">{new Date(selectedNode.metrics.lastActive).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedNode.metrics.errorCount !== undefined && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Error Count</span>
                        <span className="text-zinc-300">{selectedNode.metrics.errorCount}</span>
                      </div>
                    )}
                    {selectedNode.metrics.performance !== undefined && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Performance</span>
                        <span className="text-zinc-300">{selectedNode.metrics.performance}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Layer Summary Panel */}
      {layerSummaryOpen && (
        <div className="fixed top-20 right-4 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-bold text-zinc-100">Layer Summary</h3>
            </div>
            <button
              onClick={() => setLayerSummaryOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
            {zones.map(zone => {
              const layerNodes = nodes.filter(n => n.layerId === zone.id);
              const workingCount = layerNodes.filter(n => n.status === 'working').length;
              const partialCount = layerNodes.filter(n => n.status === 'partial').length;
              const notWorkingCount = layerNodes.filter(n => n.status === 'not_working').length;
              const plannedCount = layerNodes.filter(n => n.status === 'planned').length;

              return (
                <div key={zone.id} className="bg-zinc-800 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                      <span className="text-xs font-medium text-zinc-300">{zone.label}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{layerNodes.length} nodes</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-zinc-400">Working: {workingCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-zinc-400">Partial: {partialCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-zinc-400">Failed: {notWorkingCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-zinc-400">Planned: {plannedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const InfrastructureVisualizerSimulation: React.FC = () => {
  return <DiagnosticSimulation />;
};
