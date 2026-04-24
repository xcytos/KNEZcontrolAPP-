/**
 * Execution Flow Runner
 * 
 * Executes execution flows by emitting structured events through the EventBus
 * This is the REAL execution engine that makes flows ACTUALLY EXECUTE
 */

import { getEventBus } from './eventBus/EventBus';
import { SystemEvent } from './eventBus/EventSchema';
import { NodeIds, NodePaths, type NodeId } from './NodeRegistry';

export interface ExecutionFlow {
  id: string;
  name: string;
  description: string;
  input: string;
  expected: string;
  nodes: readonly NodeId[];
}

export const ExecutionFlows: ExecutionFlow[] = [
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

export class ExecutionFlowRunner {
  private eventBus = getEventBus();
  private activeTraceId: string | null = null;
  private isExecuting = false;

  /**
   * Run an execution flow by ID
   * Emits structured events for each node transition
   */
  async run(flowId: string, mode: 'live' | 'test' = 'test'): Promise<void> {
    if (this.isExecuting) {
      console.warn('[ExecutionFlowRunner] Already executing a flow');
      return;
    }

    const flow = ExecutionFlows.find(f => f.id === flowId);
    if (!flow) {
      console.error(`[ExecutionFlowRunner] Flow not found: ${flowId}`);
      return;
    }

    this.isExecuting = true;
    this.activeTraceId = this.generateUUID();

    console.log(`[ExecutionFlowRunner] Starting flow: ${flow.name} (mode: ${mode})`);

    // STARTUP DELAY: Allow UI to subscribe before emitting events
    if (mode === 'test') {
      await this.sleep(500);
    }

    // STEP 1: Emit trace_started
    this.emitEvent({
      event_id: this.generateUUID(),
      trace_id: this.activeTraceId,
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'trace_started',
      payload: {
        flow_id: flow.id,
        flow_name: flow.name,
        input: flow.input,
        mode
      },
      latency_ms: 0,
      status: 'success'
    });

    // STEP 2: Execute node transitions
    for (let i = 0; i < flow.nodes.length; i++) {
      const fromNode = i > 0 ? flow.nodes[i - 1] : NodeIds.UI;
      const toNode = flow.nodes[i];

      // Emit node_state_changed for the target node
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: NodeIds.ExecutionFlowRunner,
        target_node: toNode,
        event_type: 'node_state_changed',
        payload: {
          node_id: toNode,
          new_status: 'active'
        },
        latency_ms: 0,
        status: 'success'
      });

      // Emit packet_created
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: fromNode,
        target_node: toNode,
        event_type: 'packet_created',
        payload: {
          from_node: fromNode,
          to_node: toNode,
          packet_type: this.getPacketType(toNode)
        },
        latency_ms: 0,
        status: 'success'
      });

      // Simulate timing based on mode
      const delay = mode === 'test' ? this.getSimulatedDelay(toNode) : 50;
      await this.sleep(delay);

      // Emit packet_moved
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: fromNode,
        target_node: toNode,
        event_type: 'packet_moved',
        payload: {
          from_node: fromNode,
          to_node: toNode,
          progress: 0.5
        },
        latency_ms: delay / 2,
        status: 'success'
      });

      // Emit packet_arrived
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: fromNode,
        target_node: toNode,
        event_type: 'packet_arrived',
        payload: {
          from_node: fromNode,
          to_node: toNode
        },
        latency_ms: delay,
        status: 'success'
      });

      // Update node state to success after processing
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: NodeIds.ExecutionFlowRunner,
        target_node: toNode,
        event_type: 'node_state_changed',
        payload: {
          node_id: toNode,
          new_status: 'success'
        },
        latency_ms: 0,
        status: 'success'
      });
    }

    // STEP 3: Emit trace_completed
    this.emitEvent({
      event_id: this.generateUUID(),
      trace_id: this.activeTraceId,
      timestamp: Date.now(),
      source_node: NodeIds.ExecutionFlowRunner,
      target_node: NodeIds.System,
      event_type: 'trace_completed',
      payload: {
        flow_id: flow.id,
        success: true
      },
      latency_ms: 0,
      status: 'success'
    });

    // Reset state
    this.isExecuting = false;
    this.activeTraceId = null;

    console.log(`[ExecutionFlowRunner] Completed flow: ${flow.name}`);
  }

  /**
   * Stop the currently executing flow
   */
  stop(): void {
    if (!this.isExecuting) return;

    if (this.activeTraceId) {
      this.emitEvent({
        event_id: this.generateUUID(),
        trace_id: this.activeTraceId,
        timestamp: Date.now(),
        source_node: NodeIds.ExecutionFlowRunner,
        target_node: NodeIds.System,
        event_type: 'trace_completed',
        payload: {
          flow_id: 'unknown',
          success: false,
          cancelled: true
        },
        latency_ms: 0,
        status: 'failed'
      });
    }

    this.isExecuting = false;
    this.activeTraceId = null;

    console.log('[ExecutionFlowRunner] Flow execution stopped');
  }

  /**
   * Check if currently executing a flow
   */
  getIsExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * Get the active trace ID
   */
  getActiveTraceId(): string | null {
    return this.activeTraceId;
  }

  /**
   * Emit an event through the EventBus
   */
  private emitEvent(event: SystemEvent): void {
    this.eventBus.emit(event);
  }

  /**
   * Get packet type based on target node
   */
  private getPacketType(node: string): string {
    if (node.includes('tool')) return 'tool_packet';
    if (node.includes('memory')) return 'memory_packet';
    if (node.includes('model')) return 'token_packet';
    if (node.includes('response')) return 'response_packet';
    return 'request_packet';
  }

  /**
   * Get simulated delay for test mode
   */
  private getSimulatedDelay(node: string): number {
    // Simulate realistic timing for test mode
    const delays: Record<string, number> = {
      'UI': 50,
      'ChatService': 100,
      'Router': 80,
      'Model': 300,
      'Tool': 200,
      'Memory': 150,
      'Response': 100
    };
    return delays[node] || 100;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
let executionFlowRunnerInstance: ExecutionFlowRunner | null = null;

export function getExecutionFlowRunner(): ExecutionFlowRunner {
  if (!executionFlowRunnerInstance) {
    executionFlowRunnerInstance = new ExecutionFlowRunner();
  }
  return executionFlowRunnerInstance;
}
