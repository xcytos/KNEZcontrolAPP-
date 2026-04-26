/**
 * Graph State Engine
 * 
 * Maintains:
 * - Node registry
 * - Edge registry
 * - State map
 * 
 * Data structure:
 * Graph = {
 *   nodes: Map<NodeId, NodeState>,
 *   edges: Map<EdgeId, EdgeState>,
 *   traces: Map<TraceId, ExecutionFlow>
 * }
 * 
 * CRITICAL: This is the authoritative source of truth for graph state
 * UI must subscribe to events and derive state from here
 */

import { NodeState, EdgeState, ExecutionFlow, SystemEvent } from '../eventBus/EventSchema';
import { getEventBus } from '../eventBus/EventBus';
import { NodeIds } from '../NodeRegistry';

export class GraphStateEngine {
  private nodes: Map<string, NodeState> = new Map();
  private edges: Map<string, EdgeState> = new Map();
  private traces: Map<string, ExecutionFlow> = new Map();
  private eventBus = getEventBus();

  constructor() {
    this.setupEventListeners();
    this.initializeCoreNodes();
  }

  /**
   * Initialize core nodes that should always be registered
   */
  private initializeCoreNodes(): void {
    const coreNodes = [
      NodeIds.UI,
      NodeIds.ChatService,
      NodeIds.Router,
      NodeIds.Model,
      NodeIds.Tool,
      NodeIds.Memory,
      NodeIds.Response,
      NodeIds.System,
      NodeIds.EventBus,
      NodeIds.ExecutionFlowRunner
    ];

    coreNodes.forEach(nodeId => {
      if (!this.nodes.has(nodeId)) {
        this.registerNode({
          node_id: nodeId,
          node_type: 'backend',
          status: 'idle',
          last_activity: Date.now(),
          active_trace_ids: new Set(),
          metrics: {
            request_count: 0,
            success_count: 0,
            failure_count: 0,
            avg_latency_ms: 0,
            last_latency_ms: 0
          }
        });
      }
    });
  }

  /**
   * Register a node in the graph
   */
  registerNode(node: NodeState): void {
    if (this.nodes.has(node.node_id)) {
      console.warn(`[GraphState] Node ${node.node_id} already registered, updating`);
    }
    this.nodes.set(node.node_id, node);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'node_registered',
      payload: { node_id: node.node_id, node_type: node.node_type },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Register an edge in the graph
   */
  registerEdge(edge: EdgeState): void {
    const edgeId = this.generateEdgeId(edge.from_node, edge.to_node);
    if (this.edges.has(edgeId)) {
      console.warn(`[GraphState] Edge ${edgeId} already registered, updating`);
    }
    edge.edge_id = edgeId;
    this.edges.set(edgeId, edge);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'edge_registered',
      payload: { edge_id: edgeId, from_node: edge.from_node, to_node: edge.to_node },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Register a trace in the graph
   */
  registerTrace(trace: ExecutionFlow): void {
    if (this.traces.has(trace.trace_id)) {
      console.warn(`[GraphState] Trace ${trace.trace_id} already registered, updating`);
    }
    this.traces.set(trace.trace_id, trace);
    
    // Register all nodes in the trace
    trace.nodes.forEach(nodeId => {
      if (!this.nodes.has(nodeId)) {
        this.registerNode({
          node_id: nodeId,
          node_type: 'backend', // Default type, should be updated by registration
          status: 'idle',
          last_activity: Date.now(),
          active_trace_ids: new Set([trace.trace_id]),
          metrics: {
            request_count: 0,
            success_count: 0,
            failure_count: 0,
            avg_latency_ms: 0,
            last_latency_ms: 0
          }
        });
      } else {
        const node = this.nodes.get(nodeId)!;
        node.active_trace_ids.add(trace.trace_id);
      }
    });

    // Register all edges in the trace
    trace.edges.forEach(edgeId => {
      if (!this.edges.has(edgeId)) {
        const [from, to] = edgeId.split('→');
        this.registerEdge({
          edge_id: edgeId,
          from_node: from,
          to_node: to,
          edge_type: 'data', // Default type
          status: 'idle',
          last_activity: Date.now(),
          metrics: {
            packet_count: 0,
            avg_latency_ms: 0,
            failure_count: 0
          }
        });
      }
    });
  }

  /**
   * Update node state
   * This is the ONLY way to update node state
   */
  updateNodeState(nodeId: string, status: NodeState['status'], latencyMs?: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.warn(`[GraphState] Node ${nodeId} not found`);
      return;
    }

    node.status = status;
    node.last_activity = Date.now();

    if (latencyMs !== undefined) {
      node.metrics.last_latency_ms = latencyMs;
      node.metrics.request_count++;
      
      if (status === 'success') {
        node.metrics.success_count++;
      } else if (status === 'failed') {
        node.metrics.failure_count++;
      }

      // Update average latency
      const totalRequests = node.metrics.request_count;
      node.metrics.avg_latency_ms = 
        (node.metrics.avg_latency_ms * (totalRequests - 1) + latencyMs) / totalRequests;
    }

    // Emit state change event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: nodeId,
      target_node: NodeIds.ExecutionFlowRunner,
      event_type: 'node_state_changed',
      payload: {
        node_id: nodeId,
        new_status: status
      },
      latency_ms: latencyMs || 0,
      status: 'success'
    });
  }

  /**
   * Update edge state
   * This is the ONLY way to update edge state
   */
  updateEdgeState(fromNode: string, toNode: string, status: EdgeState['status'], latencyMs?: number): void {
    const edgeId = this.generateEdgeId(fromNode, toNode);
    const edge = this.edges.get(edgeId);
    if (!edge) {
      console.warn(`[GraphState] Edge ${edgeId} not found`);
      return;
    }

    const oldStatus = edge.status;
    edge.status = status;
    edge.last_activity = Date.now();

    if (latencyMs !== undefined) {
      edge.metrics.packet_count++;
      
      if (status === 'blocked') {
        edge.metrics.failure_count++;
      }

      // Update average latency
      const totalPackets = edge.metrics.packet_count;
      edge.metrics.avg_latency_ms = 
        (edge.metrics.avg_latency_ms * (totalPackets - 1) + latencyMs) / totalPackets;
    }

    // Emit state change event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: fromNode,
      target_node: toNode,
      event_type: 'edge_status_change',
      payload: {
        edge_id: edgeId,
        old_status: oldStatus,
        new_status: status,
        latency_ms: latencyMs
      },
      latency_ms: latencyMs || 0,
      status: 'success'
    });
  }

  /**
   * Get node state
   */
  getNode(nodeId: string): NodeState | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get edge state
   */
  getEdge(fromNode: string, toNode: string): EdgeState | undefined {
    return this.edges.get(this.generateEdgeId(fromNode, toNode));
  }

  /**
   * Get all nodes
   */
  getAllNodes(): Map<string, NodeState> {
    return this.nodes;
  }

  /**
   * Get all edges
   */
  getAllEdges(): Map<string, EdgeState> {
    return this.edges;
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): ExecutionFlow | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Map<string, ExecutionFlow> {
    return this.traces;
  }

  /**
   * Get nodes by status
   */
  getNodesByStatus(status: NodeState['status']): NodeState[] {
    return Array.from(this.nodes.values()).filter(n => n.status === status);
  }

  /**
   * Get edges by status
   */
  getEdgesByStatus(status: EdgeState['status']): EdgeState[] {
    return Array.from(this.edges.values()).filter(e => e.status === status);
  }

  /**
   * Get active traces
   */
  getActiveTraces(): ExecutionFlow[] {
    return Array.from(this.traces.values()).filter(t => t.status === 'running');
  }

  /**
   * Remove node
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'node_removed',
      payload: { node_id: nodeId },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Remove edge
   */
  removeEdge(fromNode: string, toNode: string): void {
    const edgeId = this.generateEdgeId(fromNode, toNode);
    this.edges.delete(edgeId);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'edge_removed',
      payload: { edge_id: edgeId },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Remove trace
   */
  removeTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    // Remove trace from active_trace_ids of all nodes
    trace.nodes.forEach(nodeId => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.active_trace_ids.delete(traceId);
      }
    });

    this.traces.delete(traceId);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'trace_removed',
      payload: { trace_id: traceId },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.traces.clear();
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: 'system',
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'graph_cleared',
      payload: {},
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Get graph statistics
   */
  getStatistics(): {
    total_nodes: number;
    total_edges: number;
    total_traces: number;
    active_traces: number;
    nodes_by_status: Record<NodeState['status'], number>;
    edges_by_status: Record<EdgeState['status'], number>;
  } {
    const nodesByStatus: Record<NodeState['status'], number> = {
      idle: 0,
      active: 0,
      success: 0,
      degraded: 0,
      failed: 0
    };

    this.nodes.forEach(node => {
      nodesByStatus[node.status]++;
    });

    const edgesByStatus: Record<EdgeState['status'], number> = {
      idle: 0,
      active: 0,
      blocked: 0
    };

    this.edges.forEach(edge => {
      edgesByStatus[edge.status]++;
    });

    return {
      total_nodes: this.nodes.size,
      total_edges: this.edges.size,
      total_traces: this.traces.size,
      active_traces: this.getActiveTraces().length,
      nodes_by_status: nodesByStatus,
      edges_by_status: edgesByStatus
    };
  }

  /**
   * Setup event listeners
   * This implements event-driven state propagation (NO POLLING)
   */
  private setupEventListeners(): void {
    // Listen to node state changes from other components
    this.eventBus.subscribe('node_state_changed', (event: SystemEvent) => {
      const { node_id, new_status } = event.payload as {
        node_id: string;
        new_status: NodeState['status'];
      };
      // Extract latency_ms from event if available
      const latencyMs = event.latency_ms;
      this.updateNodeState(node_id, new_status, latencyMs);
    });

    // Listen to edge status changes from other components
    this.eventBus.subscribe('edge_status_change', (event: SystemEvent) => {
      const { edge_id, new_status } = event.payload as {
        edge_id: string;
        new_status: EdgeState['status'];
      };
      // Extract latency_ms from event if available
      const latencyMs = event.latency_ms;
      const [from, to] = edge_id.split('→');
      this.updateEdgeState(from, to, new_status, latencyMs);
    });

    // Listen to trace events
    this.eventBus.subscribe('trace_started', () => {
      // Trace will be registered by ExecutionTraceEngine
    });

    this.eventBus.subscribe('trace_completed', (event: SystemEvent) => {
      const traceId = event.trace_id;
      const trace = this.traces.get(traceId);
      if (trace) {
        trace.status = event.status === 'success' ? 'completed' : 'failed';
        trace.end_time = event.timestamp;
      }
    });
  }

  /**
   * Generate edge ID
   */
  private generateEdgeId(fromNode: string, toNode: string): string {
    return `${fromNode}→${toNode}`;
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Singleton instance
let graphStateEngineInstance: GraphStateEngine | null = null;

export function getGraphStateEngine(): GraphStateEngine {
  if (!graphStateEngineInstance) {
    graphStateEngineInstance = new GraphStateEngine();
  }
  return graphStateEngineInstance;
}
