/**
 * Event Schema for KNEZ Observatory System
 * All events follow this strict structure for real-time observability
 */

export type EventStatus = 'pending' | 'success' | 'failed';

export interface SystemEvent {
  event_id: string;
  trace_id: string;
  timestamp: number;
  source_node: string;
  target_node: string;
  event_type: string;
  payload: Record<string, unknown>;
  latency_ms: number;
  status: EventStatus;
}

export interface TraceMetadata {
  trace_id: string;
  user_id?: string;
  session_id: string;
  start_time: number;
  end_time?: number;
  total_latency_ms?: number;
  status: 'running' | 'completed' | 'failed';
  node_count: number;
  edge_count: number;
}

export interface NodeState {
  node_id: string;
  node_type: 'router' | 'backend' | 'tool' | 'memory' | 'guardrail' | 'diagnostic';
  status: 'idle' | 'active' | 'success' | 'degraded' | 'failed';
  last_activity: number;
  active_trace_ids: Set<string>;
  metrics: {
    request_count: number;
    success_count: number;
    failure_count: number;
    avg_latency_ms: number;
    last_latency_ms: number;
  };
}

export interface EdgeState {
  edge_id: string;
  from_node: string;
  to_node: string;
  edge_type: 'data' | 'control' | 'feedback';
  status: 'idle' | 'active' | 'blocked';
  last_activity: number;
  metrics: {
    packet_count: number;
    avg_latency_ms: number;
    failure_count: number;
  };
}

export interface ExecutionFlow {
  trace_id: string;
  nodes: string[];
  edges: string[];
  events: SystemEvent[];
  start_time: number;
  end_time?: number;
  status: 'running' | 'completed' | 'failed';
  failure_point?: string;
}

export interface Packet {
  packet_id: string;
  event_id: string;
  trace_id: string;
  from_node: string;
  to_node: string;
  path: string[];
  progress: number;
  status: 'traveling' | 'arrived' | 'failed';
  start_time: number;
  estimated_arrival: number;
}
