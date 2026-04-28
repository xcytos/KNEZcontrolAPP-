/**
 * Unified SSE Event Schema
 * Standardized streaming events across all providers (Ollama, OpenAI, Claude)
 * Enforces: 1 execution = 1 provider = 1 SSE stream
 */

export type SSEEventType = 
  | 'stream_start'
  | 'token_delta'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'stream_end'
  | 'error'
  | 'metadata';

export interface SSEEventBase {
  id: string;
  event: SSEEventType;
  timestamp: number;
  executionId: string;
  sessionId: string;
  provider: string;
  model: string;
}

export interface StreamStartEvent extends SSEEventBase {
  event: 'stream_start';
  metadata: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    estimatedLatency?: number;
  };
}

export interface TokenDeltaEvent extends SSEEventBase {
  event: 'token_delta';
  data: {
    content: string;
    index: number;
    finishReason?: string | null;
  };
}

export interface ToolCallStartEvent extends SSEEventBase {
  event: 'tool_call_start';
  data: {
    toolName: string;
    toolId: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolCallDeltaEvent extends SSEEventBase {
  event: 'tool_call_delta';
  data: {
    toolId: string;
    delta: string;
  };
}

export interface ToolCallEndEvent extends SSEEventBase {
  event: 'tool_call_end';
  data: {
    toolId: string;
    result?: unknown;
    error?: string;
    executionTimeMs?: number;
  };
}

export interface StreamEndEvent extends SSEEventBase {
  event: 'stream_end';
  data: {
    finishReason: string;
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
    totalExecutionTimeMs: number;
  };
}

export interface ErrorEvent extends SSEEventBase {
  event: 'error';
  data: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestedAction?: 'retry' | 'restart' | 'fallback';
  };
}

export interface MetadataEvent extends SSEEventBase {
  event: 'metadata';
  data: {
    key: string;
    value: unknown;
  };
}

export type SSEEvent =
  | StreamStartEvent
  | TokenDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | StreamEndEvent
  | ErrorEvent
  | MetadataEvent;

/**
 * Serialize SSE event to string format for HTTP streaming
 */
export function serializeSSEEvent(event: SSEEvent): string {
  const data = JSON.stringify(event);
  return `data: ${data}\n\n`;
}

/**
 * Parse SSE event from string format
 */
export function parseSSEEvent(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  
  try {
    const jsonStr = line.slice(6); // Remove 'data: ' prefix
    return JSON.parse(jsonStr) as SSEEvent;
  } catch {
    return null;
  }
}

/**
 * Create event with standard fields populated
 */
export function createSSEEvent<T extends SSEEvent>(
  type: T['event'],
  base: Omit<T, 'event' | 'timestamp'>,
  data: T extends { data: infer D } ? D : never
): T {
  return {
    ...base,
    event: type,
    timestamp: Date.now(),
    data,
  } as T;
}

/**
 * Event type guards
 */
export const isStreamStart = (e: SSEEvent): e is StreamStartEvent => e.event === 'stream_start';
export const isTokenDelta = (e: SSEEvent): e is TokenDeltaEvent => e.event === 'token_delta';
export const isToolCallStart = (e: SSEEvent): e is ToolCallStartEvent => e.event === 'tool_call_start';
export const isToolCallDelta = (e: SSEEvent): e is ToolCallDeltaEvent => e.event === 'tool_call_delta';
export const isToolCallEnd = (e: SSEEvent): e is ToolCallEndEvent => e.event === 'tool_call_end';
export const isStreamEnd = (e: SSEEvent): e is StreamEndEvent => e.event === 'stream_end';
export const isError = (e: SSEEvent): e is ErrorEvent => e.event === 'error';
export const isMetadata = (e: SSEEvent): e is MetadataEvent => e.event === 'metadata';
