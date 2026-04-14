# TICKET-ID: TICKET-006

## Title
Fix Tool Call Blocking - native_raw_tool_json_blocked Warnings

## Objective
Fix the repeated `native_raw_tool_json_blocked` warnings in the MCP loop. The qwen2.5:7b-instruct-q4_K_M model is outputting tool_call JSON as plain text instead of using the native tool_calls format, causing tool calls to be blocked.

## Context
From log analysis at 12:42-12:44, the MCP loop is generating repeated warnings:
- `native_raw_tool_json_blocked` at steps 0-4
- `native_non_compliant_output_blocked` at step 0
- `toolCallCount:0` - Model not making tool calls despite having assistant content
- Model output exists (`hasAssistantContent:true`) but not in tool call format

The ChatService guard at lines 787-792 in ChatService.ts is blocking tool calls when the model outputs tool_call JSON as plain text.

## Dependencies
- ChatService.ts (MCP loop tool call blocking logic)
- qwen2.5:7b-instruct-q4_K_M model (current model)
- MCP Inspector (TICKET-003, TICKET-004, TICKET-005)

## Execution Plan
1. Analyze ChatService.ts tool call blocking logic
2. Determine if model prompt needs adjustment for native tool_calls format
3. Consider switching to a model with better tool calling support
4. Test tool call format with current model
5. Implement fix (prompt adjustment, model switch, or ChatService modification)
6. Verify tool calls work after fix

## Expected Output
- No more `native_raw_tool_json_blocked` warnings
- Model outputs tool calls in native tool_calls format
- Tool calls execute successfully
- MCP tools work correctly with AI model

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

## Created
2026-04-13

## Priority
HIGH (Critical for MCP tool functionality)

## Phase Consideration
Current phase: CHECKPOINT 1.5 — Runtime Discovery & Observability
- Allowed: Read-only MCP tools, endpoint/status visibility
- This task involves fixing tool call format which is critical for MCP functionality
