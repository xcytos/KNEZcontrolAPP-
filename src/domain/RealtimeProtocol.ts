/**
 * Real-time Event Protocol for WebSocket-based AI Runtime
 * 
 * Standardizes event structure for bidirectional communication between backend and frontend.
 */

export enum RealtimeEventType {
  // Backend → Frontend events
  TOKEN = "token",
  AGENT_STATE = "agent_state",
  TOOL_CALL = "tool_call",
  TOOL_RESULT = "tool_result",
  ERROR = "error",
  STREAM_START = "stream_start",
  STREAM_END = "stream_end",

  // Frontend → Backend events
  TOOL_RESULT_SUBMIT = "tool_result_submit",
  PING = "ping",
  PONG = "pong",
}

export interface RealtimeEvent {
  type: RealtimeEventType;
  session_id: string;
  data: any;
  timestamp?: string;
}

// Event data schemas

export interface TokenEventData {
  token: string;
  index: number;
  backend_id: string;
  is_first?: boolean;
  is_last?: boolean;
}

export interface AgentStateEventData {
  state: string; // "thinking", "tool_running", "streaming", "done", "error"
  message?: string;
  metadata?: Record<string, any>;
}

export interface ToolCallEventData {
  tool_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  call_id?: string;
}

export interface ToolResultEventData {
  tool_id: string;
  result: any;
  error?: string;
  execution_time_ms?: number;
}

export interface ErrorEventData {
  error_type: string;
  message: string;
  details?: Record<string, any>;
}

export interface StreamStartEventData {
  backend_id: string;
  model: string;
}

export interface StreamEndEventData {
  total_tokens: number;
  total_time_ms: number;
  ttft_ms?: number;
  tokens_per_sec?: number;
  finish_reason: string;
}

// Type guards for event data

export function isTokenEventData(data: any): data is TokenEventData {
  return data && typeof data.token === 'string' && typeof data.index === 'number';
}

export function isAgentStateEventData(data: any): data is AgentStateEventData {
  return data && typeof data.state === 'string';
}

export function isToolCallEventData(data: any): data is ToolCallEventData {
  return data && typeof data.tool_id === 'string' && typeof data.tool_name === 'string';
}

export function isToolResultEventData(data: any): data is ToolResultEventData {
  return data && typeof data.tool_id === 'string';
}

export function isErrorEventData(data: any): data is ErrorEventData {
  return data && typeof data.error_type === 'string' && typeof data.message === 'string';
}

export function isStreamStartEventData(data: any): data is StreamStartEventData {
  return data && typeof data.backend_id === 'string' && typeof data.model === 'string';
}

export function isStreamEndEventData(data: any): data is StreamEndEventData {
  return data && typeof data.total_tokens === 'number' && typeof data.total_time_ms === 'number';
}
