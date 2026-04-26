# Dual-Channel Architecture - Research (LOOP 1)

**Domain:** development  
**Created:** 2026-04-26  
**Related Ticket:** TICKET-011

## Research Summary

### Claude Code Architecture (from arxiv paper)
- Reactive loop following ReAct pattern
- StreamingToolExecutor for concurrent tool execution
- Tool results buffered and emitted in order
- Orchestrator-workers pattern for subagent delegation
- Context assembly and memory management

### SSE vs WebSocket Comparison (from DEV.to article)

#### SSE Advantages (95% of use cases)
1. **It's Just HTTP** - Works everywhere HTTP works, no special firewall rules
2. **Auto-Reconnect Built-In** - EventSource API handles reconnection automatically
3. **HTTP/2 Multiplexing** - One TCP connection, unlimited streams
4. **Works with curl** - Easy debugging with standard tools
5. **CDN Friendly** - CDNs understand HTTP, transparent caching

#### WebSocket Use Cases (5% of use cases)
- Multiplayer games (constant two-way traffic)
- Collaborative editing (high-frequency bidirectional)
- Video calls / WebRTC signaling
- Trading platforms (simultaneous bidirectional)

#### SSE Use Cases (95% of use cases)
- Dashboards (server → client metrics)
- Notifications (server → client alerts)
- Live feeds (server → client updates)
- AI Chat (ChatGPT-style token streaming)
- Stock tickers (server → client prices)
- Log streaming (server → client logs)
- Build status (server → client progress)

### Key Findings

1. **SSE is ideal for chat streaming** - Unidirectional, auto-reconnect, HTTP/2 multiplexing
2. **WebSocket is needed for system events** - Bidirectional, always-connected, background agents
3. **Claude uses SSE for API streaming** - Tokens, tool execution via SSE
4. **Dual-channel is the correct pattern** - SSE for work, WebSocket for system

### Architecture Decision

**Layer 1 - SSE (Request Stream)**
- LLM token streaming
- Tool execution steps
- Final response
- Request-per-stream (no persistent connection)

**Layer 2 - WebSocket (Realtime Bus)**
- Background agent updates
- System notifications
- Model status (loaded/unloaded)
- Multi-session sync
- Connection heartbeat
- Always-connected with auto-reconnect

### Why This Works

- No overlapping streams
- No duplicate events
- No FSM corruption
- Background tasks don't interfere with chat
- UI always has real system state
- SSE auto-reconnect (built-in)
- WebSocket heartbeat + custom reconnection

## Next Steps

LOOP 2: SSE Separation
- Clean SSE to ONLY stream tokens and tool execution
- Remove system events from SSE
- Ensure SSE is request-per-stream

## Linked Memory

- .taqwin/present/tickets/TICKET-011.md (parent ticket)
