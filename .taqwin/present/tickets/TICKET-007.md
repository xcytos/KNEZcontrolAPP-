# TICKET-ID: TICKET-007

## Title
Fix TAQWIN Server Restart Loop

## Objective
Fix the TAQWIN MCP server restart loop where the server repeatedly exits and restarts with different PIDs (29684 → 10676 → 24640). This causes unstable MCP connection and lost state.

## Context
From log analysis at 12:38-12:44, the TAQWIN MCP server is restarting repeatedly:
- Server starts successfully with handshake complete and 9 tools listed
- Server exits and restarts with different PIDs
- Server exits without proper shutdown (shutdown method not found)
- This causes unstable MCP connection and state loss

The restart loop is likely caused by:
- Tool call blocking causing server idle time
- Missing shutdown support causing unclean exits
- MCP client retry logic triggering restarts
- Internal errors causing server crashes

## Dependencies
- TAQWIN MCP server (TAQWIN_V1/main.py)
- MCP client retry logic
- ChatService.ts (MCP loop logic)
- MCP Inspector (TICKET-003, TICKET-004, TICKET-005)

## Execution Plan
1. Analyze TAQWIN MCP server code for crash causes
2. Add error handling to prevent crashes
3. Implement graceful shutdown support
4. Add health checks before handshake attempts
5. Add detailed logging for restart diagnostics
6. Test server stability after fixes
7. Monitor server lifecycle to prevent restart loops

## Expected Output
- TAQWIN server runs stably without restarts
- Server handles errors gracefully without crashing
- Proper shutdown support implemented
- Server lifecycle is stable and predictable
- MCP connection remains stable

## Status
PENDING

## Linked Memory
- .taqwin/memory/mcp/ (MCP tool memory)
- .taqwin/memory/development/ (development memory)
- .taqwin/memory/log.md (log analysis)

## Linked History
- .taqwin/history/R006.md (bug fixes)

## Linked Tickets
- TICKET-003 (MCP Inspector implementation) - DONE
- TICKET-004 (MCP config testing and stress testing) - READY_FOR_UI_TESTING
- TICKET-005 (Bug fixes) - DONE
- TICKET-006 (Tool call blocking) - PENDING

## Created
2026-04-13

## Priority
HIGH (Critical for MCP connection stability)

## Phase Consideration
Current phase: CHECKPOINT 1.5 — Runtime Discovery & Observability
- Allowed: Read-only MCP tools, endpoint/status visibility
- This task involves server stability which is critical for runtime observability
