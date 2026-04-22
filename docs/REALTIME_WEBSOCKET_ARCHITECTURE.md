# Real-Time WebSocket Architecture Implementation

## Overview

Converted the system from request-response to **event-driven real-time architecture** using WebSocket while maintaining backward compatibility with SSE streaming.

## Implementation Summary

### Backend Changes

#### 1. Event Protocol Definition
**File:** `KNEZ/knez/knez_core/events/realtime_protocol.py`

**New Event Types:**
- `TOKEN` - Single token from model
- `AGENT_STATE` - Agent state change
- `TOOL_CALL` - Tool execution request
- `TOOL_RESULT` - Tool execution result
- `ERROR` - Error event
- `STREAM_START` - Token stream started
- `STREAM_END` - Token stream ended

**Event Data Schemas:**
- `TokenEventData` - token, index, backend_id, is_first, is_last
- `AgentStateEventData` - state, message, metadata
- `ToolCallEventData` - tool_id, tool_name, arguments, call_id
- `ToolResultEventData` - tool_id, result, error, execution_time_ms
- `ErrorEventData` - error_type, message, details
- `StreamStartEventData` - backend_id, model
- `StreamEndEventData` - total_tokens, total_time_ms, ttft_ms, tokens_per_sec, finish_reason

#### 2. Backend Event Emission
**File:** `KNEZ/knez/knez_core/api/completions.py`

**Changes:**
- Import realtime protocol types
- Emit `STREAM_START` event via WebSocket when streaming starts
- Emit `AGENT_STATE` event with state="streaming"
- Emit `TOKEN` events for each token during streaming
- Emit `STREAM_END` event when streaming completes
- Emit `ERROR` events when backend fails
- All events maintain backward compatibility with existing event system

#### 3. Tool Results API
**File:** `KNEZ/knez/knez_core/api/tool_results.py` (NEW)

**Endpoint:** `POST /v1/tool/result`

**Purpose:** Receive tool execution results from frontend after MCP execution

**Request:**
```json
{
  "session_id": string,
  "tool_id": string,
  "result": any,
  "error": string | null,
  "execution_time_ms": number | null,
  "call_id": string | null
}
```

**Response:** Broadcasts `TOOL_RESULT` event via WebSocket

#### 4. Router Registration
**File:** `KNEZ/knez/knez_core/app.py`

**Changes:**
- Import `tool_results` router
- Register `tool_results.router` in FastAPI app

### Frontend Changes

#### 1. Event Protocol Types
**File:** `knez-control-app/src/domain/RealtimeProtocol.ts` (NEW)

**Contents:**
- `RealtimeEventType` enum
- `RealtimeEvent` interface
- Event data interfaces
- Type guards for event data validation

#### 2. Real-time Event Handler
**File:** `knez-control-app/src/services/realtime/RealtimeEventHandler.ts` (NEW)

**Features:**
- Connects to WebSocket using existing `WebSocketClient`
- Listens for WebSocket events
- Routes events to registered handlers:
  - `onToken(handler)` - Token events
  - `onAgentState(handler)` - Agent state changes
  - `onToolCall(handler)` - Tool call requests
  - `onToolResult(handler)` - Tool execution results
  - `onError(handler)` - Error events
  - `onStreamStart(handler)` - Stream start events
  - `onStreamEnd(handler)` - Stream end events
- Singleton instance: `realtimeEventHandler`

#### 3. Real-time Tool Executor
**File:** `knez-control-app/src/services/realtime/RealtimeToolExecutor.ts` (NEW)

**Features:**
- Listens for `TOOL_CALL` events via WebSocket
- Executes tools via existing `ToolExecutionService.executeNamespacedTool()`
- Sends results to backend via `POST /v1/tool/result`
- Maintains session-based execution control
- Singleton instance: `realtimeToolExecutor`

## Validation Steps

### 1. Backend Validation

**Test WebSocket Connection:**
```bash
# Connect to WebSocket
wscat -c ws://localhost:8000/ws/{session_id}

# Expected: Welcome message
{"type":"connected","data":{"session_id":"...","message":"WebSocket connection established"}}
```

**Test Token Streaming:**
1. Send chat completion request with `stream=true`
2. Observe WebSocket events:
   - `realtime_stream_start` - When streaming starts
   - `realtime_agent_state` - With state="streaming"
   - `realtime_token` - For each token
   - `realtime_stream_end` - When streaming completes

**Test Error Events:**
1. Trigger backend failure (e.g., disconnect backend)
2. Observe `realtime_error` event via WebSocket

### 2. Frontend Validation

**Test WebSocket Client:**
```typescript
// In browser console
import { realtimeEventHandler } from './services/realtime/RealtimeEventHandler';

realtimeEventHandler.connect('your-session-id');

// Register handlers
realtimeEventHandler.onToken((data) => {
  console.log('Token:', data.token);
});

realtimeEventHandler.onAgentState((data) => {
  console.log('Agent State:', data.state);
});
```

**Test Tool Execution Loop:**
1. Enable real-time tool executor:
```typescript
import { realtimeToolExecutor } from './services/realtime/RealtimeToolExecutor';
realtimeToolExecutor.enable('your-session-id');
```

2. Send a request that requires tool execution
3. Observe:
   - Backend emits `TOOL_CALL` event via WebSocket
   - Frontend receives event and executes tool via MCP
   - Frontend sends result via `POST /v1/tool/result`
   - Backend broadcasts `TOOL_RESULT` event via WebSocket

### 3. Integration Validation

**Test End-to-End Flow:**
1. User sends message via ChatService
2. Backend processes request
3. Backend emits `STREAM_START` event
4. Backend emits `TOKEN` events for each token
5. Frontend receives tokens and appends to chat
6. If tool required:
   - Backend emits `TOOL_CALL` event
   - Frontend executes tool via MCP
   - Frontend sends result via HTTP
   - Backend emits `TOOL_RESULT` event
7. Backend emits `STREAM_END` event
8. Frontend updates UI with completion

**Test Backward Compatibility:**
- SSE streaming should still work (not broken)
- Existing event system should still emit events
- ChatService should work without WebSocket connection

## Architecture Benefits

### Real-Time Updates
- Tokens stream via WebSocket instead of polling
- Agent state changes broadcast instantly
- Tool execution status visible in real-time

### Separation of Concerns
- Backend controls execution flow
- Frontend executes tools via MCP
- WebSocket provides bidirectional communication

### Backward Compatibility
- SSE streaming still works
- Existing event system preserved
- No breaking changes to ChatService
- No changes to MCP execution logic

### Scalability
- WebSocket reduces HTTP overhead
- Event-driven architecture reduces latency
- Frontend can handle multiple concurrent streams

## Polling Analysis

**Existing Polling Mechanisms (Preserved):**
- `ChatService.flushOutgoingQueue` - Queue management (500ms interval)
- `ConnectionHealthMonitor` - Health checks
- `ToolResultCache.cleanup` - Cache maintenance
- `McpInspectorService` - MCP inspector UI updates
- UI modal timers - Modal refresh logic

**Rationale for Preservation:**
- These serve different purposes (queue mgmt, health, UI updates)
- Not related to real-time streaming
- WebSocket events are additive, not replacements
- Removing them would break unrelated functionality

## Next Steps for Integration

### ChatService Integration (Optional)
To fully leverage WebSocket events in ChatService:

1. Connect to WebSocket when session starts:
```typescript
realtimeEventHandler.connect(this.sessionId);
```

2. Register token handler to append to messages:
```typescript
realtimeEventHandler.onToken((data) => {
  this.appendToMessage(data.token);
});
```

3. Register agent state handler to update phase:
```typescript
realtimeEventHandler.onAgentState((data) => {
  this.setPhase(data.state as ChatPhase);
});
```

4. Enable tool execution for session:
```typescript
realtimeToolExecutor.enable(this.sessionId);
```

### Migration Path
- Phase 1: WebSocket events alongside SSE (current state)
- Phase 2: Frontend consumes WebSocket events for real-time updates
- Phase 3: Gradual migration from SSE to WebSocket for streaming
- Phase 4: Deprecate SSE when WebSocket is fully adopted

## Constraints Compliance

✅ **DO NOT refactor ChatService architecture** - No changes to ChatService
✅ **DO NOT modify MCP execution logic** - Uses existing ToolExecutionService
✅ **DO NOT move responsibilities** - Backend still controls flow, frontend executes tools
✅ **ONLY implement real-time event system** - WebSocket events are additive

## Files Created/Modified

### Created Files:
- `KNEZ/knez/knez_core/events/realtime_protocol.py`
- `KNEZ/knez/knez_core/api/tool_results.py`
- `knez-control-app/src/domain/RealtimeProtocol.ts`
- `knez-control-app/src/services/realtime/RealtimeEventHandler.ts`
- `knez-control-app/src/services/realtime/RealtimeToolExecutor.ts`

### Modified Files:
- `KNEZ/knez/knez_core/api/completions.py` - Added real-time event emission
- `KNEZ/knez/knez_core/app.py` - Registered tool_results router

### No Breaking Changes:
- ChatService.ts - Unchanged
- MCP execution logic - Unchanged
- SSE streaming - Preserved
- Existing event system - Preserved
