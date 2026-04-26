# Dual-Channel Architecture - State Model Separation (LOOP 5)

**Domain:** controlapp  
**Created:** 2026-04-26  
**Related Ticket:** TICKET-011

## Summary

Integrated ConnectionManager into ChatService to separate connection state from chat state. ConnectionManager is now the single source of truth for connection state, while ChatService manages chat state independently.

## Files Modified

### knez-control-app/src/services/ChatService.ts
- Added import for getConnectionManager
- Added connectionManager instance (private field)
- Added getConnectionState() public getter method
- ConnectionManager now manages WebSocket and SSE connection state
- ChatService continues to manage chat state (messages, phase, etc.)

## State Separation

### Connection State (ConnectionManager)
- ws: connected/reconnecting/disconnected/dead
- backend: healthy/degraded/unreachable
- model: loaded/unloaded/unknown
- lastConnectedAt
- reconnectAttempts

### Chat State (ChatService)
- messages
- assistantMessages
- currentStreamId
- activeTools
- searchProvider
- pendingToolApproval
- sequenceCounter
- phase (via PhaseManager)

## Integration

- ChatService.getConnectionState() delegates to ConnectionManager.getConnectionState()
- ConnectionManager manages WebSocket lifecycle (connect, disconnect, heartbeat)
- ConnectionManager manages SSE request tracking (start, abort)
- ChatService continues to manage chat flow and message state

## Design Decision

Clear separation of concerns:
- ConnectionManager: System-level connectivity (WebSocket + SSE)
- ChatService: Application-level chat flow (messages, phase, tools)

This follows the Claude/Codex pattern with clean separation between system and application state.

## Next Steps

LOOP 6: Background Agents (backend pushes updates via WebSocket)
- Implement background agent system on backend
- Agents push updates via WebSocket (not SSE)
- Define agent event schema
- Test background agent updates

## Linked Memory

- .taqwin/present/tickets/TICKET-011.md (parent ticket)
- .taqwin/memory/development/dual-channel-architecture-research.md (LOOP 1 research)
- .taqwin/memory/development/dual-channel-architecture-sse-separation.md (LOOP 2 SSE)
- .taqwin/memory/development/dual-channel-architecture-websocket-system-events.md (LOOP 3 WebSocket)
- .taqwin/memory/controlapp/dual-channel-architecture-connection-manager.md (LOOP 4 ConnectionManager)
