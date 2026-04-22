/**
 * Execution Trace Engine
 * 
 * Every user request MUST produce a full trace graph
 * Builds directed graph: Nodes = components, Edges = execution transitions
 * 
 * Algorithm:
 * 1. On request start: create TRACE_ID
 * 2. Build directed graph
 * 3. For each step: emit event from → to with latency and status
 */

import { SystemEvent, TraceMetadata, ExecutionFlow, NodeState, EdgeState } from '../eventBus/EventSchema';
import { getEventBus } from '../eventBus/EventBus';

type Phase = 'IDLE' | 'SENDING' | 'THINKING' | 'STREAMING' | 'FINALIZING' | 'DONE';

interface TraceConfig {
  enableCompression: boolean;
  enableIndexing: boolean;
  maxTraceRetention: number; // milliseconds
}

export class ExecutionTraceEngine {
  private traces: Map<string, TraceMetadata> = new Map();
  private executions: Map<string, ExecutionFlow> = new Map();
  private nodes: Map<string, NodeState> = new Map();
  private edges: Map<string, EdgeState> = new Map();
  private activeRequests: Map<string, string> = new Map(); // sessionId → traceId
  private phases: Map<string, Phase> = new Map(); // traceId → phase
  private config: TraceConfig;
  private eventBus = getEventBus();

  // Phase transition rules (strict FSM)
  private readonly phaseTransitions: Record<Phase, Phase[]> = {
    'IDLE': ['SENDING'],
    'SENDING': ['THINKING', 'DONE'],
    'THINKING': ['STREAMING', 'FINALIZING'],
    'STREAMING': ['FINALIZING'],
    'FINALIZING': ['DONE'],
    'DONE': []
  };

  constructor(config: TraceConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  /**
   * Start a new execution trace
   * Generates TRACE_ID and initializes graph
   */
  startTrace(sessionId: string, userId?: string): string {
    // Single-flight request control
    if (this.activeRequests.has(sessionId)) {
      const existingTraceId = this.activeRequests.get(sessionId)!;
      console.warn(`[TraceEngine] Duplicate request rejected for session ${sessionId}, existing trace ${existingTraceId}`);
      return existingTraceId;
    }

    const traceId = this.generateUUID();
    const startTime = Date.now();

    // Create trace metadata
    const metadata: TraceMetadata = {
      trace_id: traceId,
      user_id: userId,
      session_id: sessionId,
      start_time: startTime,
      status: 'running',
      node_count: 0,
      edge_count: 0
    };

    this.traces.set(traceId, metadata);
    this.activeRequests.set(sessionId, traceId);
    this.phases.set(traceId, 'IDLE');

    // Create execution flow
    const execution: ExecutionFlow = {
      trace_id: traceId,
      nodes: [],
      edges: [],
      events: [],
      start_time: startTime,
      status: 'running'
    };
    this.executions.set(traceId, execution);

    console.log(`[TraceEngine] trace_id generated: ${traceId}`);
    
    // Emit trace start event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: traceId,
      timestamp: startTime,
      source_node: 'user',
      target_node: 'system',
      event_type: 'trace_start',
      payload: { session_id: sessionId, user_id: userId },
      latency_ms: 0,
      status: 'success'
    });

    return traceId;
  }

  /**
   * Transition phase (strict FSM)
   * Throws error on invalid transition
   */
  transitionPhase(traceId: string, newPhase: Phase): void {
    const currentPhase = this.phases.get(traceId);
    if (!currentPhase) {
      throw new Error(`[TraceEngine] No current phase for trace ${traceId}`);
    }

    const validTransitions = this.phaseTransitions[currentPhase];
    if (!validTransitions.includes(newPhase)) {
      throw new Error(
        `[TraceEngine] Invalid phase transition: ${currentPhase} → ${newPhase}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }

    this.phases.set(traceId, newPhase);
    
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: traceId,
      timestamp: Date.now(),
      source_node: 'phase_machine',
      target_node: 'system',
      event_type: 'phase_transition',
      payload: { from: currentPhase, to: newPhase },
      latency_ms: 0,
      status: 'success'
    });
  }

  /**
   * Add node to graph
   */
  addNode(nodeId: string, nodeType: NodeState['node_type'], traceId: string): void {
    if (!this.nodes.has(nodeId)) {
      const node: NodeState = {
        node_id: nodeId,
        node_type: nodeType,
        status: 'idle',
        last_activity: Date.now(),
        active_trace_ids: new Set([traceId]),
        metrics: {
          request_count: 0,
          success_count: 0,
          failure_count: 0,
          avg_latency_ms: 0,
          last_latency_ms: 0
        }
      };
      this.nodes.set(nodeId, node);
      
      // Update trace metadata
      const metadata = this.traces.get(traceId);
      if (metadata) {
        metadata.node_count = this.nodes.size;
      }
    } else {
      const node = this.nodes.get(nodeId)!;
      node.active_trace_ids.add(traceId);
    }

    // Add to execution flow
    const execution = this.executions.get(traceId);
    if (execution && !execution.nodes.includes(nodeId)) {
      execution.nodes.push(nodeId);
    }
  }

  /**
   * Add edge to graph
   */
  addEdge(fromNode: string, toNode: string, edgeType: EdgeState['edge_type'], traceId: string): void {
    const edgeId = `${fromNode}→${toNode}`;
    
    if (!this.edges.has(edgeId)) {
      const edge: EdgeState = {
        edge_id: edgeId,
        from_node: fromNode,
        to_node: toNode,
        edge_type: edgeType,
        status: 'idle',
        last_activity: Date.now(),
        metrics: {
          packet_count: 0,
          avg_latency_ms: 0,
          failure_count: 0
        }
      };
      this.edges.set(edgeId, edge);
      
      // Update trace metadata
      const metadata = this.traces.get(traceId);
      if (metadata) {
        metadata.edge_count = this.edges.size;
      }
    }

    // Add to execution flow
    const execution = this.executions.get(traceId);
    if (execution && !execution.edges.includes(edgeId)) {
      execution.edges.push(edgeId);
    }
  }

  /**
   * Emit event for execution transition
   * Emits from → to event with latency and status
   */
  emitTransition(
    traceId: string,
    fromNode: string,
    toNode: string,
    eventType: string,
    payload: Record<string, unknown>,
    latencyMs: number,
    status: 'success' | 'failed'
  ): void {
    const event: SystemEvent = {
      event_id: this.generateUUID(),
      trace_id: traceId,
      timestamp: Date.now(),
      source_node: fromNode,
      target_node: toNode,
      event_type: eventType,
      payload,
      latency_ms: latencyMs,
      status
    };

    // Add to execution flow
    const execution = this.executions.get(traceId);
    if (execution) {
      execution.events.push(event);
    }

    // Update node states
    this.updateNodeState(fromNode, status === 'success' ? 'active' : 'failed', latencyMs);
    this.updateNodeState(toNode, status === 'success' ? 'active' : 'failed', latencyMs);

    // Update edge state
    this.updateEdgeState(fromNode, toNode, status === 'success' ? 'active' : 'blocked', latencyMs);

    // Emit to event bus
    this.eventBus.emit(event);
  }

  /**
   * Update node state
   */
  private updateNodeState(nodeId: string, status: NodeState['status'], latencyMs: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = status;
    node.last_activity = Date.now();
    node.metrics.request_count++;
    node.metrics.last_latency_ms = latencyMs;
    
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

  /**
   * Update edge state
   */
  private updateEdgeState(fromNode: string, toNode: string, status: EdgeState['status'], latencyMs: number): void {
    const edgeId = `${fromNode}→${toNode}`;
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    edge.status = status;
    edge.last_activity = Date.now();
    edge.metrics.packet_count++;
    
    if (status === 'blocked') {
      edge.metrics.failure_count++;
    }

    // Update average latency
    const totalPackets = edge.metrics.packet_count;
    edge.metrics.avg_latency_ms = 
      (edge.metrics.avg_latency_ms * (totalPackets - 1) + latencyMs) / totalPackets;
  }

  /**
   * Complete trace
   */
  completeTrace(traceId: string, success: boolean, failurePoint?: string): void {
    const metadata = this.traces.get(traceId);
    const execution = this.executions.get(traceId);
    
    if (!metadata || !execution) {
      console.warn(`[TraceEngine] Trace ${traceId} not found`);
      return;
    }

    const endTime = Date.now();
    metadata.end_time = endTime;
    metadata.total_latency_ms = endTime - metadata.start_time;
    metadata.status = success ? 'completed' : 'failed';

    execution.end_time = endTime;
    execution.status = success ? 'completed' : 'failed';
    if (failurePoint) {
      execution.failure_point = failurePoint;
    }

    // Remove from active requests
    this.activeRequests.delete(metadata.session_id);
    this.phases.delete(traceId);

    // Compress trace if enabled
    if (this.config.enableCompression) {
      this.compressTrace(traceId);
    }

    // Index trace if enabled
    if (this.config.enableIndexing) {
      this.indexTrace(traceId);
    }

    // Emit trace complete event
    this.eventBus.emit({
      event_id: this.generateUUID(),
      trace_id: traceId,
      timestamp: endTime,
      source_node: 'trace_engine',
      target_node: 'system',
      event_type: 'trace_complete',
      payload: {
        success,
        total_latency_ms: metadata.total_latency_ms,
        failurePoint
      },
      latency_ms: metadata.total_latency_ms || 0,
      status: success ? 'success' : 'failed'
    });

    console.log(`[TraceEngine] Trace ${traceId} completed: ${metadata.status} (${metadata.total_latency_ms}ms)`);
  }

  /**
   * Compress trace (store summary, latency distribution, failure points)
   */
  private compressTrace(traceId: string): void {
    const execution = this.executions.get(traceId);
    if (!execution) return;

    // Calculate latency distribution
    const latencies = execution.events.map(e => e.latency_ms);
    const latencySummary = {
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99)
    };

    // Store compressed data in execution
    execution.events = []; // Clear full event log
    (execution as any).compressed = {
      latency_summary: latencySummary,
      node_count: execution.nodes.length,
      edge_count: execution.edges.length,
      failure_point: execution.failure_point
    };

    console.log(`[TraceEngine] Trace ${traceId} compressed`);
  }

  /**
   * Index trace for fast lookup
   */
  private indexTrace(traceId: string): void {
    const metadata = this.traces.get(traceId);
    if (!metadata) return;

    // Hash-based trace ID for indexing
    const hash = this.simpleHash(traceId);
    (metadata as any).index_hash = hash;

    console.log(`[TraceEngine] Trace ${traceId} indexed with hash ${hash}`);
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceMetadata | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get execution flow by ID
   */
  getExecution(traceId: string): ExecutionFlow | undefined {
    return this.executions.get(traceId);
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
  getEdge(edgeId: string): EdgeState | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): TraceMetadata[] {
    return Array.from(this.traces.values()).filter(t => t.status === 'running');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventBus.subscribe('node_status_change', (event) => {
      const { node_id, status } = event.payload as { node_id: string; status: NodeState['status'] };
      const node = this.nodes.get(node_id);
      if (node) {
        node.status = status;
      }
    });

    this.eventBus.subscribe('edge_status_change', (event) => {
      const { edge_id, status } = event.payload as { edge_id: string; status: EdgeState['status'] };
      const edge = this.edges.get(edge_id);
      if (edge) {
        edge.status = status;
      }
    });
  }

  /**
   * Clean up old traces
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [traceId, metadata] of this.traces) {
      if (metadata.end_time && now - metadata.end_time > this.config.maxTraceRetention) {
        toDelete.push(traceId);
      }
    }

    toDelete.forEach(traceId => {
      this.traces.delete(traceId);
      this.executions.delete(traceId);
      console.log(`[TraceEngine] Cleaned up trace ${traceId}`);
    });
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

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Singleton instance
let traceEngineInstance: ExecutionTraceEngine | null = null;

export function getTraceEngine(config?: TraceConfig): ExecutionTraceEngine {
  if (!traceEngineInstance) {
    traceEngineInstance = new ExecutionTraceEngine(config || {
      enableCompression: true,
      enableIndexing: true,
      maxTraceRetention: 3600000 // 1 hour
    });
  }
  return traceEngineInstance;
}
