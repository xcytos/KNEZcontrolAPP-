# Dual-Channel Architecture - WebSocket System Events (LOOP 3)

**Domain:** development  
**Created:** 2026-04-26  
**Related Ticket:** TICKET-011

## Summary

Implemented WebSocket system channel for system events (separate from SSE chat streaming). Created system event schema, model supervisor for Ollama status tracking, and integrated system event emission into completions endpoint.

## Files Created

### KNEZ/knez/knez_core/websocket/system_events.py (NEW)
- SystemEventType enum (connection, model, agent, session, notification, heartbeat, stream events)
- SystemEvent base class
- ConnectionEvent, ModelStatusEvent, AgentStateEvent, SessionUpdateEvent, NotificationEvent
- StreamStartEvent, StreamEndEvent (system-level, not token streaming)

### KNEZ/knez/knez_core/websocket/model_supervisor.py (NEW)
- ModelState enum (unknown, loading, loaded, unloaded, error)
- OllamaState enum (unknown, running, stopped, error)
- ModelStatus dataclass
- ModelSupervisor class (monitors Ollama and model status)
- Emits model_status events via WebSocket system channel
- 30-second check interval
- Global instance with get_model_supervisor()

## Files Modified

### KNEZ/knez/knez_core/api/completions.py
- Added import for system_events (SystemEventType, StreamStartEvent, StreamEndEvent, AgentStateEvent)
- Added system event emission via WebSocket:
  - system_stream_start (when stream begins)
  - system_agent_state (when agent starts streaming)
  - system_stream_end (when stream ends)
- System events use new SystemEvent schema

### KNEZ/knez/knez_core/app.py
- Added import for model_supervisor (get_model_supervisor, stop_model_supervisor)
- Added model supervisor startup in app.on_event("startup")
- Added model supervisor shutdown in app.on_event("shutdown")

## WebSocket System Channel Design

### System Event Types
- **Connection**: connected, disconnected, reconnecting, connection_error
- **Model**: model_status, ollama_status, model_loaded, model_unloaded
- **Agent**: agent_state, agent_update, agent_started, agent_stopped, agent_error
- **Session**: session_update, session_sync, session_created, session_deleted
- **Notification**: notification, alert, warning
- **Heartbeat**: ping, pong
- **Stream**: stream_start, stream_end, stream_error (system-level)

### Model Supervisor
- Monitors Ollama service availability (http://127.0.0.1:11434/api/tags)
- Tracks loaded models
- Emits model_status events on state changes
- 30-second check interval
- Started/stopped with FastAPI app lifecycle

## Design Decision

System events now use dedicated schema and are emitted separately from SSE. This follows the Claude/Codex pattern:
- SSE for work (tokens, tool execution)
- WebSocket for system (events, agents, notifications)

## Next Steps

LOOP 4: ConnectionManager (frontend orchestrator)
- Create ConnectionManager.ts (central orchestrator)
- Implement WebSocket lifecycle (connect, reconnect, heartbeat)
- Implement SSE request tracking (start, abort)
- Implement system state model (connection, backend, model)

## Linked Memory

- .taqwin/present/tickets/TICKET-011.md (parent ticket)
- .taqwin/memory/development/dual-channel-architecture-research.md (LOOP 1 research)
- .taqwin/memory/development/dual-channel-architecture-sse-separation.md (LOOP 2 SSE)
