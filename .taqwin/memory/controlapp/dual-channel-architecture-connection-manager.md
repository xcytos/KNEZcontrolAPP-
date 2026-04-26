# Dual-Channel Architecture - ConnectionManager (LOOP 4)

**Domain:** controlapp  
**Created:** 2026-04-26  
**Related Ticket:** TICKET-011

## Summary

Created ConnectionManager as the central frontend orchestrator for dual-channel communication. Manages WebSocket lifecycle, SSE request tracking, and system state model. Following Claude/Codex pattern: SSE for chat streaming, WebSocket for system events.

## Files Created

### knez-control-app/src/services/connection/ConnectionManager.ts (NEW)
- ConnectionState interface (ws, backend, model, lastConnectedAt, reconnectAttempts)
- SSERequest interface (id, sessionId, controller, startTime, status)
- SystemState interface (connection, activeSSERequests, modelStatus, notifications)
- ModelStatus interface (modelId, state, ollamaState, loadedAt, lastCheck, error)
- Notification interface (id, level, title, message, timestamp, action)
- ConnectionManager class (central orchestrator)
- Global instance with getConnectionManager()

## ConnectionManager Features

### WebSocket Lifecycle
- connect(sessionId): Connect WebSocket for system events
- disconnect(): Disconnect WebSocket
- Auto-reconnect handled by existing WebSocketClient (from TICKET-010)
- Heartbeat: 30-second interval (ping/pong)

### SSE Request Tracking
- startSSERequest(sessionId, url, options): Start SSE stream for chat
- abortSSERequest(requestId): Abort active SSE request
- readSSEStream(): Parse SSE data lines and emit events
- Active request tracking with status (active, aborted, completed, error)

### System State Model
- getConnectionState(): Get current connection state
- getActiveSSERequests(): Get all active SSE requests
- getModelStatus(modelId): Get model status
- getAllModelStatuses(): Get all model statuses
- getNotifications(): Get notifications
- clearNotifications(): Clear notifications

### Event System
- on(event, callback): Register event listener
- off(event, callback): Unregister event listener
- emit(event, data): Emit event to listeners
- Events: connection_change, sse_data, sse_error, sse_aborted, sse_completed, stream_start, stream_end, agent_state, model_status, notification, websocket_error

### System Event Handling
- handleSystemEvent(): Route system events from WebSocket
- handleModelStatus(): Update model status in state
- handleNotification(): Add notification to state

## Design Decision

ConnectionManager is the single source of truth for:
- Connection state (WebSocket + SSE)
- Active SSE requests
- Model status
- Notifications

This follows the Claude/Codex pattern with clear separation:
- SSE for chat streaming (tokens, tool execution)
- WebSocket for system events (agents, notifications, sync, heartbeat)

## Next Steps

LOOP 5: Clean frontend state model (connection + chat separation)
- Integrate ConnectionManager into ChatService
- Separate connection state from chat state
- Use ConnectionManager for SSE requests instead of direct fetch
- Use ConnectionManager for WebSocket events instead of direct WebSocketClient

## Linked Memory

- .taqwin/present/tickets/TICKET-011.md (parent ticket)
- .taqwin/memory/development/dual-channel-architecture-research.md (LOOP 1 research)
- .taqwin/memory/development/dual-channel-architecture-sse-separation.md (LOOP 2 SSE)
- .taqwin/memory/development/dual-channel-architecture-websocket-system-events.md (LOOP 3 WebSocket)
