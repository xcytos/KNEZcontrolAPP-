import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomControls } from './ZoomControls';
import { Activity, X, Layers, Play, Square, Radio, Network } from 'lucide-react';
import { DiagnosticPanel, LayerDiagnostic, DiagnosticConfig } from './DiagnosticPanel';
import { DiagnosticSimulation } from './DiagnosticSimulation';
import { knezArchitecture, Layer, NodeStatus } from './knezArchitecture';
import { testExecutionStateMachine } from './TestExecutionStateMachine';
import { getTestNodePath } from './testNodePaths';
import { usePacketAnimation } from './PacketAnimation';
import { getEventBus } from '../../observability/eventBus/EventBus';
import { getPacketSimulationEngine } from '../../observability/packetSimulation/PacketSimulationEngine';
import { NodePaths } from '../../observability/NodeRegistry';

type EdgeType = 'data' | 'control' | 'feedback';
type GuardrailStatus = 'active' | 'tripped' | 'disabled';

// PHASE 4: Execution Flow Registry - using NodeRegistry for consistency
interface ExecutionFlow {
  id: string;
  name: string;
  description: string;
  input: string;
  expected: string;
  nodes: readonly string[];
}

const ExecutionFlows: ExecutionFlow[] = [
  {
    id: "chat_basic",
    name: "Chat → Simple Response (HI)",
    description: "Basic chat flow with simple response",
    input: "Hi",
    expected: "model_response",
    nodes: NodePaths.chat_basic
  },
  {
    id: "chat_tool",
    name: "Chat → Tool Call Flow",
    description: "Chat flow with tool execution",
    input: "What time is it?",
    expected: "tool_result",
    nodes: NodePaths.chat_tool
  },
  {
    id: "chat_memory",
    name: "Chat → Memory Write + Recall",
    description: "Memory persistence and retrieval",
    input: "Remember: X. What did I say?",
    expected: "memory_result",
    nodes: NodePaths.chat_memory
  },
  {
    id: "full_agent",
    name: "Full Agent Flow (end-to-end)",
    description: "Complete agent execution flow",
    input: "Complex multi-step request",
    expected: "agent_response",
    nodes: NodePaths.full_agent
  }
];

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
  // Event-driven state from observability system
  eventState?: 'idle' | 'active' | 'success' | 'degraded' | 'failed';
}

interface SystemEdge {
  from: string;
  to: string;
  type: EdgeType;
  active: boolean;
  guardrail?: GuardrailStatus;
  // Event-driven state from observability system
  eventState?: 'idle' | 'active' | 'blocked' | 'failed';
  latencyMs?: number;
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
  const [validationLogsOpen, setValidationLogsOpen] = useState(false);
  const [validationLogs, setValidationLogs] = useState<{ timestamp: number; event: string; details: string }[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
  
  // PHASE 1: Execution Entry Points
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState('chat_basic');
  const [isExecuting, setIsExecuting] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { isAnimating, startAnimation, stopAnimation } = usePacketAnimation();

  // PHASE 1: Handler Functions
  const handleModeSwitch = (newMode: 'live' | 'test') => {
    // Cancel active trace
    // Clear packets
    // Reset graph state
    // Reconnect WS if LIVE
    if (mode === newMode) return;
    
    setMode(newMode);
    
    if (newMode === 'live') {
      // Connect to WebSocket
      const eventBus = getEventBus();
      eventBus.connect();
      setWsConnected(true);
    } else {
      // Disconnect from WebSocket
      const eventBus = getEventBus();
      eventBus.disconnect();
      setWsConnected(false);
    }
    
    // Reset execution state
    setIsExecuting(false);
    stopAnimation();
    
    // Reset node states
    setNodes(prev => prev.map(node => ({
      ...node,
      eventState: 'idle',
      active: false
    })));
    
    // Clear validation logs
    setValidationLogs([]);
    
    addValidationLog('mode_switch', `Switched to ${newMode.toUpperCase()} mode`);
  };

  const handleRunFlow = async () => {
    if (isExecuting) return;
    
    const flow = ExecutionFlows.find(f => f.id === selectedFlow);
    if (!flow) return;
    
    setIsExecuting(true);
    addValidationLog('flow_started', `Running: ${flow.name} (${mode.toUpperCase()} mode)`);
    
    // Highlight expected path
    setHighlightedPath(flow.nodes as string[]);
    
    // Start packet animation
    startAnimation(flow.nodes as string[]);
    
    // STEP 2: Use ExecutionFlowRunner to execute the flow
    const { getExecutionFlowRunner } = await import('../../observability/ExecutionFlowRunner');
    const runner = getExecutionFlowRunner();
    
    try {
      await runner.run(selectedFlow, mode);
      addValidationLog('flow_completed', `Completed: ${flow.name}`);
    } catch (error) {
      addValidationLog('error', `Flow execution failed: ${error}`);
    }
    
    setIsExecuting(false);
    setHighlightedPath([]);
    stopAnimation();
  };

  const handleStop = () => {
    // STEP 2: Use ExecutionFlowRunner to stop execution
    import('../../observability/ExecutionFlowRunner').then(({ getExecutionFlowRunner }) => {
      const runner = getExecutionFlowRunner();
      runner.stop();
    });
    
    setIsExecuting(false);
    stopAnimation();
    setHighlightedPath([]);
    
    // Reset node states
    setNodes(prev => prev.map(node => ({
      ...node,
      eventState: 'idle',
      active: false
    })));
    
    addValidationLog('execution_stopped', 'Execution stopped by user');
  };

  const addValidationLog = (event: string, details: string) => {
    setValidationLogs(prev => [...prev, {
      timestamp: Date.now(),
      event,
      details
    }]);
  };

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
  const [edges] = useState<SystemEdge[]>(useMemo(() => {
    return knezArchitecture.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
      type: conn.type === 'dependency' ? 'control' : conn.type === 'data_flow' ? 'data' : 'feedback',
      active: false
    }));
  }, []));

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

  const getStatusColor = (node: SystemNode): string => {
    // Use eventState if available (from observability system), otherwise fall back to status
    if (node.eventState) {
      switch (node.eventState) {
        case 'idle': return '#6b7280'; // IDLE (gray)
        case 'active': return '#3b82f6'; // ACTIVE (blue)
        case 'success': return '#10b981'; // SUCCESS (green)
        case 'degraded': return '#f59e0b'; // DEGRADED (yellow)
        case 'failed': return '#ef4444'; // FAILED (red)
        default: return '#6b7280';
      }
    }
    
    // Fall back to legacy status mapping
    switch (node.status) {
      case 'working': return '#10b981';
      case 'partial': return '#f59e0b';
      case 'not_working': return '#ef4444';
      case 'planned': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getEdgeColor = (edge: SystemEdge): string => {
    // Use eventState if available for flow visualization
    if (edge.eventState) {
      switch (edge.eventState) {
        case 'active': return '#3b82f6'; // Flow active (blue)
        case 'blocked': return '#ef4444'; // Failure break (red)
        case 'failed': return '#dc2626'; // Failed (dark red)
        case 'idle': return '#6b7280'; // Idle (gray)
        default: return '#6b7280';
      }
    }
    
    // Fall back to type-based coloring
    switch (edge.type) {
      case 'data': return '#3b82f6';
      case 'control': return '#8b5cf6';
      case 'feedback': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getEdgeHeatColor = (latencyMs?: number): string => {
    if (!latencyMs) return '#3b82f6';
    if (latencyMs < 50) return '#10b981'; // Fast (green)
    if (latencyMs < 100) return '#f59e0b'; // Medium (yellow)
    return '#ef4444'; // Slow (red)
  };

  const getLogColor = (eventType: string): string => {
    switch (eventType) {
      case 'packet_created':
      case 'packet_arrived':
        return 'text-emerald-400';
      case 'trace_started':
      case 'trace_completed':
        return 'text-indigo-400';
      case 'node_state_changed':
        return 'text-amber-400';
      case 'error':
        return 'text-red-400';
      case 'websocket_connected':
        return 'text-cyan-400';
      default:
        return 'text-zinc-400';
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

  // PHASE 2: Event-driven state propagation from EventBus (UI = event subscriber ONLY)
  useEffect(() => {
    const eventBus = getEventBus();

    // Subscribe to ALL events (wildcard subscription)
    const unsubscribe = eventBus.subscribe('*', (event) => {
      handleSystemEvent(event);
    });

    return () => unsubscribe();
  }, []);

  // PHASE 2: Comprehensive event handler
  const handleSystemEvent = (event: any) => {
    switch (event.event_type) {
      case 'packet_created':
        handlePacketCreated(event);
        break;
      case 'packet_moved':
        handlePacketMoved(event);
        break;
      case 'packet_arrived':
        handlePacketArrived(event);
        break;
      case 'node_state_changed':
        handleNodeStateChanged(event);
        break;
      case 'trace_started':
        handleTraceStarted(event);
        break;
      case 'trace_completed':
        handleTraceCompleted(event);
        break;
      case 'error':
        handleError(event);
        break;
      case 'websocket_connected':
        handleWebSocketConnected(event);
        break;
    }
  };

  const handlePacketCreated = (event: any) => {
    console.log("EVENT RECEIVED: packet_created", event);
    const { from_node, to_node, packet_type } = event.payload as { 
      from_node: string; 
      to_node: string; 
      packet_type?: string 
    };
    
    // Trigger packet animation
    const packetEngine = getPacketSimulationEngine();
    packetEngine.createPacket(event);
    packetEngine.startAnimation();
    
    // Log to validation panel
    addValidationLog('packet_created', `${from_node} → ${to_node} (${packet_type || 'request_packet'})`);
    
    // Update source node state to active
    setNodes(prev => prev.map(node => {
      if (node.id === from_node) {
        return { ...node, eventState: 'active', active: true };
      }
      return node;
    }));
  };

  const handlePacketMoved = (event: any) => {
    console.log("EVENT RECEIVED: packet_moved", event);
    // Update packet position (handled by PacketSimulationEngine)
    // This event is for visual interpolation
    // Packet position updates are handled by the animation loop in PacketSimulationEngine
  };

  const handlePacketArrived = (event: any) => {
    console.log("EVENT RECEIVED: packet_arrived", event);
    const { to_node } = event.payload as { to_node: string };
    
    // Remove packet (handled by PacketSimulationEngine)
    
    // Update target node state to active/success
    setNodes(prev => prev.map(node => {
      if (node.id === to_node) {
        return { ...node, eventState: 'success', active: true };
      }
      return node;
    }));
    
    // Log to validation panel
    addValidationLog('packet_arrived', `at ${to_node}`);
  };

  const handleNodeStateChanged = (event: any) => {
    const { node_id, new_status } = event.payload as { 
      node_id: string; 
      new_status: string 
    };
    
    setNodes(prev => prev.map(node => {
      if (node.id === node_id) {
        return {
          ...node,
          eventState: new_status as 'idle' | 'active' | 'success' | 'degraded' | 'failed',
          active: new_status === 'active' || new_status === 'success'
        };
      }
      return node;
    }));
    
    addValidationLog('node_state_changed', `${node_id} → ${new_status}`);
  };

  const handleTraceStarted = (event: any) => {
    console.log("EVENT RECEIVED: trace_started", event);
    const { trace_id, flow_id, flow_name } = event.payload as { 
      trace_id: string; 
      flow_id?: string; 
      flow_name?: string 
    };
    
    addValidationLog('trace_started', `TRACE_ID: ${trace_id} (${flow_name || 'system'})`);
    
    // Highlight nodes in the trace path if available
    if (flow_id) {
      const flow = ExecutionFlows.find(f => f.id === flow_id);
      if (flow) {
        setHighlightedPath(flow.nodes as string[]);
      }
    }
  };

  const handleTraceCompleted = (event: any) => {
    console.log("EVENT RECEIVED: trace_completed", event);
    const { trace_id, success } = event.payload as { 
      trace_id: string; 
      success?: boolean 
    };
    
    addValidationLog('trace_completed', `TRACE_ID: ${trace_id} (${success ? 'SUCCESS' : 'FAILED'})`);
    
    // Clear highlighted path
    setHighlightedPath([]);
    
    // Reset node states to idle after short delay
    setTimeout(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        eventState: 'idle',
        active: false
      })));
    }, 2000);
  };

  const handleError = (event: any) => {
    const { error, node_id } = event.payload as { 
      error: string; 
      node_id?: string 
    };
    
    addValidationLog('error', error);
    
    // Update node to failed state if specified
    if (node_id) {
      setNodes(prev => prev.map(node => {
        if (node.id === node_id) {
          return { ...node, eventState: 'failed', active: false };
        }
        return node;
      }));
      
      // Set error path
      setErrorPath([node_id]);
    }
  };

  const handleWebSocketConnected = (event: any) => {
    const { state } = event.payload as { state: string };
    setWsConnected(state === 'connected');
    addValidationLog('websocket_connected', state);
  };

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
            <Network className="w-4 h-4" />
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
            onClick={() => setValidationLogsOpen(!validationLogsOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
              validationLogsOpen 
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white' 
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            <Activity className="w-4 h-4" />
            Validation Logs
          </button>
          <button
            onClick={() => setDiagnosticOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
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

      {/* PHASE 1: Execution Entry Points - Control Bar */}
      <div className={`flex items-center gap-4 px-6 py-3 border-b ${mode === 'live' ? 'bg-blue-950/50 border-blue-800' : 'bg-emerald-950/50 border-emerald-800'}`}>
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeSwitch('live')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
              mode === 'live' 
                ? 'bg-blue-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Radio className="w-3 h-3" />
            LIVE MODE
          </button>
          <button
            onClick={() => handleModeSwitch('test')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
              mode === 'test' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Network className="w-3 h-3" />
            TEST MODE
          </button>
        </div>

        {/* WebSocket Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-zinc-400">
            WS: {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Flow Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedFlow}
            onChange={(e) => setSelectedFlow(e.target.value)}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded border border-zinc-700 focus:outline-none focus:border-zinc-600"
            disabled={isExecuting}
          >
            {ExecutionFlows.map(flow => (
              <option key={flow.id} value={flow.id}>{flow.name}</option>
            ))}
          </select>
        </div>

        {/* Run Flow / Stop Buttons */}
        <div className="flex items-center gap-2">
          {!isExecuting ? (
            <button
              onClick={handleRunFlow}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
            >
              <Play className="w-3 h-3" />
              RUN FLOW
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              <Square className="w-3 h-3" />
              STOP
            </button>
          )}
        </div>

        {/* Mode Badge */}
        <div className={`ml-auto px-2 py-1 text-xs font-bold rounded ${
          mode === 'live' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {mode.toUpperCase()}
        </div>

        {/* Validation Logs Toggle */}
        <button
          onClick={() => setValidationLogsOpen(!validationLogsOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
            validationLogsOpen 
              ? 'bg-cyan-600 text-white' 
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          <Activity className="w-3 h-3" />
          LOGS
        </button>
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
              const isFlowActive = edge.eventState === 'active';
              const edgeColor = edge.latencyMs ? getEdgeHeatColor(edge.latencyMs) : getEdgeColor(edge);

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={generateEdgePath(fromNode, toNode)}
                    stroke={isGuardrailTripped ? '#ef4444' : isErrorPath ? '#dc2626' : edgeColor}
                    strokeWidth={isHighlighted ? 3 : isErrorPath ? 3 : edge.active ? 2 : 1}
                    fill="none"
                    opacity={isHighlighted ? 1 : isErrorPath ? 1 : edge.active ? 0.8 : 0.3}
                    strokeDasharray={isErrorPath ? '8,4' : getEdgeDash(edge.type)}
                  >
                    {isFlowActive && (
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="20"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                  {/* Arrow head */}
                  <polygon
                    points={`${toNode.x - 6},${toNode.y - 6} ${toNode.x + 6},${toNode.y - 6} ${toNode.x},${toNode.y}`}
                    fill={isGuardrailTripped ? '#ef4444' : edgeColor}
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
                    fill={getStatusColor(node)}
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

      {/* Validation Logs Panel */}
      {validationLogsOpen && (
        <div className="fixed top-20 right-4 w-96 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              <h3 className="text-sm font-bold text-zinc-100">Validation Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
              >
                <option value="all">All Events</option>
                <option value="packet_created">Packets</option>
                <option value="trace_started">Traces</option>
                <option value="node_state_changed">Nodes</option>
                <option value="error">Errors</option>
                <option value="websocket_connected">WebSocket</option>
              </select>
              <button
                onClick={() => setValidationLogsOpen(false)}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-auto">
            {validationLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No validation events logged yet</p>
            ) : (
              validationLogs
                .slice()
                .reverse()
                .filter(log => logFilter === 'all' || log.event === logFilter)
                .map((log, idx) => (
                  <div key={idx} className="bg-zinc-800 rounded p-2 text-[10px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${getLogColor(log.event)}`}>{log.event}</span>
                      <span className="text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-zinc-300">{log.details}</p>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const InfrastructureVisualizerSimulation: React.FC = () => {
  return <DiagnosticSimulation />;
};
