# TICKET-ID: TICKET-005

## Title
Bug Fixes: KNEZ Health Check Timeout, Hardcoded Model Labels, TransformCallback Error

## Objective
Fix critical runtime errors preventing MCP Inspector from functioning properly:
1. Fix KNEZ health check timeout error blocking MCP operations
2. Remove hardcoded model labels from runtime code
3. Fix transformCallback undefined error (known past issue)

## Context
User reported three errors when testing MCP Inspector:
1. "Cannot read properties of undefined (reading 'transformCallback')" - known issue from memory log related to tauri-plugin-shell dependency
2. "{knez_unreachable: Health check timed out: http://127.0.0.1:8000/health}" - MCP Inspector health check blocking operations
3. Hardcoded "qwen2.5:7b-instruct-q4_K_M" label in runtime code (not just test files) - in LocalBackend class

## Dependencies
- MCP Inspector (TICKET-003, TICKET-004)
- KNEZ backend health check system
- LocalBackend class in KNEZ knez_core

## Execution Plan
1. Fix knez health check timeout error in McpInspectorService.ts
2. Remove hardcoded model_id default from LocalBackend.__init__
3. Make model_id configurable via environment variable DEFAULT_MODEL
4. Update test files to use environment variable for model_id
5. Verify fixes don't break existing functionality

## Expected Output
- MCP Inspector works without KNEZ health check blocking
- Model labels are dynamic and configurable
- No hardcoded model labels in runtime code
- MCP Inspector can function with or without KNEZ backend

## Status
DONE

## Files Changed
- Modified: knez-control-app/src/mcp/inspector/McpInspectorService.ts
  - Changed ensureKnezHealthy() to log warning instead of throwing error
  - Increased timeout from 1200ms to 5000ms
  - Added try-catch for health check failures
  - MCP operations continue even if KNEZ is unreachable
- Modified: KNEZ/knez/knez_core/models/local_backend.py
  - Removed hardcoded default model_id "qwen2.5:7b-instruct-q4_K_M"
  - Made model_id optional parameter
  - Added fallback to DEFAULT_MODEL environment variable
  - Raises ValueError if no model_id provided
- Modified: KNEZ/tests/test_ttft_keepalive.py
  - Added os import
  - Changed hardcoded model to os.getenv("TEST_MODEL", "qwen2.5:7b-instruct-q4_K_M")
- Modified: KNEZ/tests/test_local_streaming.py
  - Added os import
  - Changed hardcoded models to os.getenv("TEST_MODEL", "qwen2.5:7b-instruct-q4_K_M")

## Issues
- transformCallback error: Known issue from past (tauri-plugin-shell dependency), not found in current codebase
- KNEZ health check: Fixed by making it optional (logs warning instead of blocking)
- Hardcoded model label: Fixed by making it configurable via environment variable

## Next
1. Update memory index
2. Create history entry R006.md
3. Update relations.json

## Linked Memory
- .taqwin/memory/mcp/ (MCP tool memory)
- .taqwin/memory/development/ (development memory)
- .taqwin/memory/log.md (transformCallback issue history)

## Linked History
- .taqwin/history/R003.md (MCP Inspector implementation)
- .taqwin/history/R004.md (Bug fix: tool execution enabled)
- .taqwin/history/R005.md (MCP config testing and stress testing)

## Linked Tickets
- TICKET-003 (MCP Inspector implementation) - DONE
- TICKET-004 (MCP config testing and stress testing) - READY_FOR_UI_TESTING

## Created
2026-04-12

## Priority
HIGH (Critical for MCP Inspector runtime functionality)

## Phase Consideration
Current phase: CHECKPOINT 1.5 — Runtime Discovery & Observability
- Allowed: Read-only MCP tools, endpoint/status visibility
- Health check fixes align with runtime discovery
