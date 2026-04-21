// ─── ExecutionGraphTracker.ts ─────────────────────────────────────────────
// T13: Execution Graph Tracker — tracks tool execution dependencies as a DAG.
//     Node types: tool_call, decision, retry, fallback.
//     Edge types: data_flow, control_flow, retry_flow.
//     Visualization: Mermaid.js or custom graph renderer.
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType = 'tool_call' | 'decision' | 'retry' | 'fallback' | 'start' | 'end';
export type EdgeType = 'data_flow' | 'control_flow' | 'retry_flow' | 'fallback_flow';

export interface GraphNode {
  id: string;
  type: NodeType;
  toolName?: string;
  args?: any;
  result?: any;
  timestamp: number;
  durationMs?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ExecutionGraph {
  sessionId: string;
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  startNodeId?: string;
  endNodeId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GraphExport {
  sessionId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mermaidGraph: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Execution graph tracker with DAG support for tool execution dependencies.
 */
export class ExecutionGraphTracker {
  private graphs: Map<string, ExecutionGraph> = new Map();
  private nodeIdCounter = 0;

  /**
   * Generate unique node ID.
   */
  private generateNodeId(): string {
    return `node_${++this.nodeIdCounter}`;
  }

  /**
   * Generate unique edge ID.
   */
  private generateEdgeId(): string {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new execution graph for a session.
   */
  startGraph(sessionId: string): void {
    if (this.graphs.has(sessionId)) {
      return; // Graph already exists
    }

    const startNodeId = this.generateNodeId();
    const startNode: GraphNode = {
      id: startNodeId,
      type: 'start',
      timestamp: Date.now(),
      status: 'completed',
      metadata: { sessionId }
    };

    const graph: ExecutionGraph = {
      sessionId,
      nodes: new Map([[startNodeId, startNode]]),
      edges: new Map(),
      startNodeId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.graphs.set(sessionId, graph);
  }

  /**
   * Get or create graph for a session.
   */
  private getOrCreateGraph(sessionId: string): ExecutionGraph {
    if (!this.graphs.has(sessionId)) {
      this.startGraph(sessionId);
    }
    return this.graphs.get(sessionId)!;
  }

  /**
   * Add a node to the graph.
   */
  addNode(
    sessionId: string,
    type: NodeType,
    toolName?: string,
    args?: any,
    metadata?: Record<string, any>
  ): string {
    const graph = this.getOrCreateGraph(sessionId);
    const nodeId = this.generateNodeId();

    const node: GraphNode = {
      id: nodeId,
      type,
      toolName,
      args,
      timestamp: Date.now(),
      status: 'pending',
      metadata
    };

    graph.nodes.set(nodeId, node);
    graph.updatedAt = Date.now();

    return nodeId;
  }

  /**
   * Update a node's status and result.
   */
  updateNode(
    sessionId: string,
    nodeId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    result?: any,
    durationMs?: number
  ): void {
    const graph = this.graphs.get(sessionId);
    if (!graph) return;

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    node.status = status;
    node.result = result;
    node.durationMs = durationMs;
    graph.updatedAt = Date.now();
  }

  /**
   * Add an edge between nodes.
   */
  addEdge(
    sessionId: string,
    from: string,
    to: string,
    type: EdgeType,
    metadata?: Record<string, any>
  ): void {
    const graph = this.graphs.get(sessionId);
    if (!graph) return;

    const edgeId = this.generateEdgeId();
    const edge: GraphEdge = {
      id: edgeId,
      from,
      to,
      type,
      timestamp: Date.now(),
      metadata
    };

    graph.edges.set(edgeId, edge);
    graph.updatedAt = Date.now();
  }

  /**
   * Add a tool execution node with automatic edge from previous node.
   */
  addToolExecution(
    sessionId: string,
    toolName: string,
    args: any,
    previousNodeId?: string
  ): string {
    const nodeId = this.addNode(sessionId, 'tool_call', toolName, args);

    if (previousNodeId) {
      this.addEdge(sessionId, previousNodeId, nodeId, 'control_flow');
    }

    return nodeId;
  }

  /**
   * Add a decision node.
   */
  addDecision(
    sessionId: string,
    decision: string,
    previousNodeId?: string
  ): string {
    const nodeId = this.addNode(sessionId, 'decision', undefined, { decision });

    if (previousNodeId) {
      this.addEdge(sessionId, previousNodeId, nodeId, 'control_flow');
    }

    return nodeId;
  }

  /**
   * Add a retry node.
   */
  addRetry(
    sessionId: string,
    originalNodeId: string,
    retryAttempt: number,
    metadata?: Record<string, any>
  ): string {
    const nodeId = this.addNode(
      sessionId,
      'retry',
      undefined,
      { retryAttempt },
      metadata
    );

    this.addEdge(sessionId, originalNodeId, nodeId, 'retry_flow', { retryAttempt });

    return nodeId;
  }

  /**
   * Add a fallback node.
   */
  addFallback(
    sessionId: string,
    originalNodeId: string,
    fallbackTool: string,
    metadata?: Record<string, any>
  ): string {
    const nodeId = this.addNode(
      sessionId,
      'fallback',
      fallbackTool,
      undefined,
      metadata
    );

    this.addEdge(sessionId, originalNodeId, nodeId, 'fallback_flow', { fallbackTool });

    return nodeId;
  }

  /**
   * End the graph with an end node.
   */
  endGraph(sessionId: string, success: boolean): void {
    const graph = this.graphs.get(sessionId);
    if (!graph) return;

    const endNodeId = this.generateNodeId();
    const endNode: GraphNode = {
      id: endNodeId,
      type: 'end',
      timestamp: Date.now(),
      status: success ? 'completed' : 'failed',
      metadata: { success }
    };

    graph.nodes.set(endNodeId, endNode);
    graph.endNodeId = endNodeId;
    graph.updatedAt = Date.now();

    // Connect end node to the last node in the graph
    const nodes = Array.from(graph.nodes.values());
    const lastNode = nodes[nodes.length - 2]; // -1 is the end node we just added
    if (lastNode && lastNode.type !== 'end') {
      this.addEdge(sessionId, lastNode.id, endNodeId, 'control_flow');
    }
  }

  /**
   * Get the graph for a session.
   */
  getGraph(sessionId: string): ExecutionGraph | null {
    return this.graphs.get(sessionId) || null;
  }

  /**
   * Get all nodes for a session.
   */
  getNodes(sessionId: string): GraphNode[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) return [];
    return Array.from(graph.nodes.values());
  }

  /**
   * Get all edges for a session.
   */
  getEdges(sessionId: string): GraphEdge[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) return [];
    return Array.from(graph.edges.values());
  }

  /**
   * Get tool execution nodes for a session.
   */
  getToolExecutions(sessionId: string): GraphNode[] {
    const nodes = this.getNodes(sessionId);
    return nodes.filter(node => node.type === 'tool_call');
  }

  /**
   * Get failed nodes for a session.
   */
  getFailedNodes(sessionId: string): GraphNode[] {
    const nodes = this.getNodes(sessionId);
    return nodes.filter(node => node.status === 'failed');
  }

  /**
   * Export graph to Mermaid format.
   */
  exportGraph(sessionId: string, format: 'mermaid' = 'mermaid'): GraphExport | null {
    const graph = this.graphs.get(sessionId);
    if (!graph) return null;

    if (format === 'mermaid') {
      return this.exportToMermaid(graph);
    }

    return null;
  }

  /**
   * Export graph to Mermaid format.
   */
  private exportToMermaid(graph: ExecutionGraph): GraphExport {
    const nodes = Array.from(graph.nodes.values());
    const edges = Array.from(graph.edges.values());

    let mermaid = 'graph TD\n';

    // Add nodes
    for (const node of nodes) {
      const label = this.getNodeLabel(node);
      const shape = this.getNodeShape(node);
      const style = this.getNodeStyle(node);
      mermaid += `  ${node.id}["${label}"]${shape}${style}\n`;
    }

    // Add edges
    for (const edge of edges) {
      const lineStyle = this.getEdgeStyle(edge);
      mermaid += `  ${edge.from} ${lineStyle} ${edge.to}\n`;
    }

    return {
      sessionId: graph.sessionId,
      nodes,
      edges,
      mermaidGraph: mermaid,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt
    };
  }

  /**
   * Get label for a node.
   */
  private getNodeLabel(node: GraphNode): string {
    if (node.type === 'start') return 'Start';
    if (node.type === 'end') return 'End';
    if (node.type === 'decision') return 'Decision';
    if (node.type === 'retry') return 'Retry';
    if (node.type === 'fallback') return 'Fallback';
    if (node.type === 'tool_call') {
      return node.toolName || 'Tool';
    }
    return node.type;
  }

  /**
   * Get shape for a node.
   */
  private getNodeShape(node: GraphNode): string {
    if (node.type === 'start' || node.type === 'end') return '([ ])';
    if (node.type === 'decision') return '{ }';
    if (node.type === 'tool_call') return '[ ]';
    return '( )';
  }

  /**
   * Get style for a node.
   */
  private getNodeStyle(node: GraphNode): string {
    if (node.status === 'failed') return ':::fail';
    if (node.status === 'completed') return ':::success';
    if (node.status === 'running') return ':::running';
    if (node.status === 'pending') return ':::pending';
    return '';
  }

  /**
   * Get style for an edge.
   */
  private getEdgeStyle(edge: GraphEdge): string {
    if (edge.type === 'retry_flow') return '-.->';
    if (edge.type === 'fallback_flow') return '-.->';
    return '-->';
  }

  /**
   * Clear graph for a session.
   */
  clearGraph(sessionId: string): void {
    this.graphs.delete(sessionId);
  }

  /**
   * Clear all graphs.
   */
  clearAllGraphs(): void {
    this.graphs.clear();
  }

  /**
   * Get all session IDs with graphs.
   */
  getSessionIds(): string[] {
    return Array.from(this.graphs.keys());
  }

  /**
   * Get graph statistics.
   */
  getGraphStats(sessionId: string): {
    totalNodes: number;
    totalEdges: number;
    toolExecutions: number;
    decisions: number;
    retries: number;
    fallbacks: number;
    failedNodes: number;
    completedNodes: number;
  } | null {
    const graph = this.graphs.get(sessionId);
    if (!graph) return null;

    const nodes = Array.from(graph.nodes.values());
    const edges = Array.from(graph.edges.values());

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      toolExecutions: nodes.filter(n => n.type === 'tool_call').length,
      decisions: nodes.filter(n => n.type === 'decision').length,
      retries: nodes.filter(n => n.type === 'retry').length,
      fallbacks: nodes.filter(n => n.type === 'fallback').length,
      failedNodes: nodes.filter(n => n.status === 'failed').length,
      completedNodes: nodes.filter(n => n.status === 'completed').length
    };
  }

  /**
   * Get execution path (sequence of nodes) for a session.
   */
  getExecutionPath(sessionId: string): GraphNode[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) return [];

    const edges = Array.from(graph.edges.values());

    // Build adjacency map
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const targets = adjacency.get(edge.from) || [];
      targets.push(edge.to);
      adjacency.set(edge.from, targets);
    }

    // Find path from start to end
    const path: GraphNode[] = [];
    let current = graph.startNodeId;

    while (current) {
      const node = graph.nodes.get(current);
      if (!node) break;
      path.push(node);

      if (node.type === 'end') break;

      const targets = adjacency.get(current);
      if (!targets || targets.length === 0) break;

      current = targets[0]; // Follow first edge
    }

    return path;
  }
}

// Global instance
export const executionGraphTracker = new ExecutionGraphTracker();
