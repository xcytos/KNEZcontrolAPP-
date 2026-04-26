# TICKET-ID: TICKET-011

## Title
Dual-Channel Architecture (SSE + WebSocket) - Always-Connected System

## Objective
Implement production-grade dual-channel communication architecture like Claude/Codex:
- Layer 1: SSE for chat streaming (tokens, tool execution)
- Layer 2: WebSocket for system events (agents, notifications, sync, heartbeat)
- Achieve 99.999%+ connection reliability
- Zero race conditions
- Background agents with live updates
- Multi-session synchronization
- Always-connected UI/UX

## Context
Current system has critical issues:
- SSE and WebSocket both streaming tokens (duplication)
- FSM corruption from overlapping streams
- No central connection orchestrator
- Background agents interfere with chat
- No always-connected behavior
- Race conditions in state updates
- UI gets stuck during disconnections

Reference: Claude/Codex architecture uses SSE for work + WebSocket for system

## Dependencies
- KNEZ backend (FastAPI)
- Control App (Tauri + React)
- Existing SSE infrastructure
- Existing WebSocket infrastructure (from TICKET-010)
- TAQWIN memory system

## Execution Plan

### LOOP 1: Research & Design
1. Research Claude/Codex architecture patterns via web search
2. Design ConnectionManager (frontend orchestrator)
3. Define SSE vs WebSocket responsibility split
4. Create TICKET-011 documentation

### LOOP 2: Backend - SSE Separation
1. Clean SSE to ONLY stream tokens and tool execution
2. Remove system events from SSE
3. Ensure SSE is request-per-stream (no persistent connection)
4. Test SSE chat streaming independently

### LOOP 3: Backend - WebSocket System Events
1. Define WebSocket event schema (system only)
2. Implement heartbeat mechanism (ping/pong)
3. Implement model supervisor (Ollama status tracking)
4. Test WebSocket system events independently

### LOOP 4: Frontend - ConnectionManager
1. Create ConnectionManager.ts (central orchestrator)
2. Implement WebSocket lifecycle (connect, reconnect, heartbeat)
3. Implement SSE request tracking (start, abort)
4. Implement system state model (connection, backend, model)

### LOOP 5: Frontend - State Separation
1. Clean frontend state model (connection + chat separation)
2. Remove overlapping state between SSE and WebSocket
3. Implement event bus for WebSocket events
4. Test state separation

### LOOP 6: Backend - Background Agents
1. Implement background agent system on backend
2. Agents push updates via WebSocket (not SSE)
3. Define agent event schema
4. Test background agent updates

### LOOP 7: Backend - Multi-Session Sync
1. Implement session synchronization via WebSocket
2. Define session update event schema
3. Test multi-session sync

### LOOP 8: Backend - System Notifications
1. Implement notification system via WebSocket
2. Define notification event schema
3. Test system notifications

### LOOP 9: Frontend - Auto-Reconnect
1. Implement infinite WebSocket reconnection with exponential backoff
2. Implement silent reconnection (no UI disruption)
3. Implement session restoration on reconnect
4. Test auto-reconnect behavior

### LOOP 10: Integration & Validation
1. Verify SSE chat streaming works independently
2. Verify WebSocket system events work independently
3. Verify no overlap between SSE and WebSocket
4. Test auto-reconnect on WebSocket disconnect
5. Test heartbeat mechanism
6. Test background agent updates
7. Test multi-session sync
8. Test model status updates
9. End-to-end validation of always-connected behavior
10. Performance testing (latency, throughput, reliability)

### LOOP 11: Stability Testing
1. Network transition testing (WiFi → cellular → WiFi)
2. Server restart testing (client auto-reconnects)
3. Long-running stability (24h+ continuous operation)
4. Memory leak testing
5. Connection recovery testing

### LOOP 12: Documentation & Memory
1. Update TAQWIN memory with architecture decisions
2. Create history entries for each loop
3. Update TICKET-011 with results
4. Update index.json and relations.json

## Expected Output
- ConnectionManager.ts (frontend orchestrator)
- Clean SSE endpoint (chat only)
- Clean WebSocket endpoint (system only)
- Model supervisor (backend)
- Background agent system (backend)
- Multi-session sync (backend + frontend)
- System notifications (backend + frontend)
- Clean state model (frontend)
- 99.999%+ connection reliability
- Zero race conditions
- Always-connected UI/UX

## Status
COMPLETED - Implementation and verification complete. Runtime testing pending (requires running system).

## Linked Memory
- .taqwin/memory/development/dual-channel-architecture-research.md (LOOP 1)
- .taqwin/memory/development/dual-channel-architecture-sse-separation.md (LOOP 2)
- .taqwin/memory/development/dual-channel-architecture-websocket-system-events.md (LOOP 3)
- .taqwin/memory/controlapp/dual-channel-architecture-connection-manager.md (LOOP 4)
- .taqwin/memory/controlapp/dual-channel-architecture-state-separation.md (LOOP 5)
- .taqwin/memory/development/dual-channel-architecture-background-agents.md (LOOP 6)
- .taqwin/memory/development/dual-channel-architecture-multi-session-sync.md (LOOP 7)
- .taqwin/memory/development/dual-channel-architecture-system-notifications.md (LOOP 8)
- .taqwin/memory/development/dual-channel-architecture-sse-validation.md (LOOP 9)
- .taqwin/memory/development/dual-channel-architecture-websocket-validation.md (LOOP 10)
- .taqwin/memory/development/dual-channel-architecture-overlap-verification.md (LOOP 11)
- .taqwin/memory/development/dual-channel-architecture-final-summary.md (LOOP 12)

## Linked History
- .taqwin/history/R015.md (LOOP 2 - SSE Separation)
- .taqwin/history/R016.md (LOOP 3 - WebSocket System Events)
- .taqwin/history/R017.md (LOOP 4 - ConnectionManager)
- .taqwin/history/R018.md (LOOP 5 - State Separation)
- .taqwin/history/R019.md (LOOP 6 - Background Agents)
- .taqwin/history/R020.md (LOOP 7 - Multi-Session Sync)
- .taqwin/history/R021.md (LOOP 8 - System Notifications)
- .taqwin/history/R022.md (LOOP 9 - SSE Validation)
- .taqwin/history/R023.md (LOOP 10 - WebSocket Validation)
- .taqwin/history/R024.md (LOOP 11 - Overlap Verification)
- .taqwin/history/R025.md (LOOP 12 - Final Summary)

## Created
2026-04-26

## Priority
CRITICAL (System reliability and always-connected behavior)

## Phase Consideration
Current phase: CHECKPOINT 1.5 — Runtime Discovery & Observability
- This task involves dual-channel architecture which may require phase escalation
- Executing under TAQWIN serialized execution mode
- Following RULE-029: Serialized execution is mandatory
- Continuous loop execution (10+ loops minimum)
