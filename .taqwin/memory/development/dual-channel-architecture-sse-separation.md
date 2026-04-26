# Dual-Channel Architecture - SSE Separation (LOOP 2)

**Domain:** development  
**Created:** 2026-04-26  
**Related Ticket:** TICKET-011

## Summary

Cleaned SSE endpoint to ONLY stream tokens and tool execution. Removed all system events from SSE stream. System events will now be emitted separately via WebSocket system channel.

## Files Modified

### KNEZ/knez/knez_core/api/completions.py
- Added comment: "SSE Stream: ONLY tokens and tool execution (no system events)"
- Removed realtime_stream_start event emission
- Removed realtime_agent_state event emission
- Removed realtime_token event emission
- Removed realtime_stream_end event emission
- Removed realtime_error event emission
- Added comments: "NOTE: WebSocket events removed from SSE, now emitted separately via WebSocket system channel"
- Kept legacy events for backward compatibility (will be deprecated)

## SSE Stream Responsibility (After Cleanup)

### SSE NOW ONLY Streams:
- Token chunks (chat.completion.chunk)
- Final completion object (chat.completion)
- Keep-alive events
- Error objects

### SSE NO LONGER Streams:
- realtime_stream_start (now WebSocket only)
- realtime_agent_state (now WebSocket only)
- realtime_token (now WebSocket only)
- realtime_stream_end (now WebSocket only)
- realtime_error (now WebSocket only)

## Backward Compatibility

Legacy events kept for now (will be deprecated after WebSocket system channel is fully implemented):
- token_stream_start
- token_stream
- token_stream_end
- backend_stream_interrupted

## Design Decision

SSE is now clean and focused on chat streaming only. No overlap between SSE and WebSocket by design. This follows the Claude/Codex pattern:
- SSE for work (tokens, tool execution)
- WebSocket for system (events, agents, notifications)

## Next Steps

LOOP 3: WebSocket System Events
- Define WebSocket event schema (system only)
- Implement heartbeat mechanism (ping/pong)
- Implement model supervisor (Ollama status tracking)

## Linked Memory

- .taqwin/present/tickets/TICKET-011.md (parent ticket)
- .taqwin/memory/development/dual-channel-architecture-research.md (LOOP 1 research)
