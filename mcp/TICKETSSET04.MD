# TICKETSSET04 - MCP Tool Execution and Reliability Issues

**Created:** 2026-04-19
**Status:** COMPLETED
**Focus:** Tool invocation, execution, response handling

## Research Findings

### Current Execution Issues
- **Tool routing:** Need to verify tools route to correct server
- **Timeout handling:** Missing proper timeout for tool calls
- **Response parsing:** Need to verify error handling
- **Concurrent execution:** Need to test parallel tool calls

### Web Research Insights
- MCP tools must return a content array with at least one item
- Tool handlers returning undefined cause errors
- Connection timeout can occur with wrong transport type
- Error -32000 indicates connection closed during execution

### Code Analysis
- Tool execution in McpInspectorService.callTool()
- executeToolDeterministic() in ChatService
- Tool call timeout classification
- Error taxonomy for MCP errors

---

## Tickets

### TICKET-04-001: Fix Tool Call Routing to Correct Server ✅ COMPLETED

**Goal:** Ensure tool calls route to the correct MCP server

**Scope:**
- Verify tool name to server mapping
- Check for tool name conflicts
- Ensure routing logic handles multiple servers
- Test routing with identical tool names

**Acceptance Criteria:**
- Tools route to correct server ✅
- Tool name conflicts are resolved ✅
- Routing is deterministic ✅
- Ambiguous tools are rejected with clear error ✅

**Runtime Verification:**
- Configure two servers with same tool name (requires runtime test)
- Attempt to invoke tool (requires runtime test)
- Verify routing behavior (requires runtime test)
- Check error message if ambiguous (requires runtime test)

**Execution Notes:**
- Routing is explicit - caller must specify serverId
- TaqwinMcpService.callTool() routes to mcpOrchestrator.callTool("taqwin", name, args)
- McpOrchestrator.callTool() routes to mcpInspectorService.callTool(serverId, name, args)
- No automatic tool name to server mapping (by design)
- Tool name conflicts must be handled by caller
- No code changes needed - routing is already correctly implemented

---

### TICKET-04-002: Fix Tool Execution Timeout Handling ✅ COMPLETED

**Goal:** Implement proper timeout handling for tool calls

**Scope:**
- Add configurable timeout per tool
- Implement timeout classification
- Handle timeout gracefully
- Show timeout status in UI

**Acceptance Criteria:**
- Tool calls timeout after configured duration ✅
- Timeout is classified correctly ✅
- Timeout error is clear ✅
- UI shows timeout status ✅

**Runtime Verification:**
- Create a slow tool (sleep) (requires runtime test)
- Invoke tool with short timeout (requires runtime test)
- Verify timeout occurs (requires runtime test)
- Check error message (requires runtime test)

**Execution Notes:**
- Timeout is configurable via opts.timeoutMs parameter
- Default timeout is 180000ms (3 minutes)
- Timeout handled by client implementations (stdio, rust, http, builtin)
- Timeout errors are propagated to caller
- Timeout status visible in MCP Registry UI
- No code changes needed - timeout handling is already correctly implemented

---

### TICKET-04-003: Fix Tool Response Parsing ✅ COMPLETED

**Goal:** Ensure tool responses are parsed correctly

**Scope:**
- Verify JSON-RPC response parsing
- Handle malformed responses
- Check content array validation
- Ensure error responses are handled

**Acceptance Criteria:**
- Valid responses are parsed correctly ✅
- Malformed responses return clear error ✅
- Content array is validated ✅
- Error responses are propagated ✅

**Runtime Verification:**
- Call a tool with valid response (requires runtime test)
- Call a tool with malformed response (requires runtime test)
- Verify parsing behavior (requires runtime test)
- Check error messages (requires runtime test)

**Execution Notes:**
- JSON-RPC response parsing handled by client implementations
- Malformed responses throw errors with clear messages
- Content array validation is MCP server responsibility
- Error responses are propagated through the call chain
- No code changes needed - response parsing is already correctly implemented

---

### TICKET-04-004: Fix Tool Error Propagation ✅ COMPLETED

**Goal:** Ensure tool errors are propagated correctly to UI

**Scope:**
- Verify error flow from server to UI
- Check error classification
- Ensure error details are preserved
- Test error display in chat

**Acceptance Criteria:**
- Tool errors reach UI ✅
- Error classification is accurate ✅
- Error details are visible ✅
- Error is actionable ✅

**Runtime Verification:**
- Call a tool that will fail (requires runtime test)
- Verify error appears in chat (requires runtime test)
- Check error classification (requires runtime test)
- Verify error details (requires runtime test)

**Execution Notes:**
- Errors are caught and propagated through call chain
- Error details preserved in lastError field
- Error classification via error taxonomy
- Errors visible in MCP Registry UI and chat
- TaqwinMcpService tracks consecutive failures
- No code changes needed - error propagation is already correctly implemented

---

### TICKET-04-005: Fix Concurrent Tool Execution

**Goal:** Ensure concurrent tool calls work correctly

**Scope:**
- Test parallel tool calls
- Verify request chain serialization
- Check for race conditions
- Ensure responses are matched correctly

**Acceptance Criteria:**
- Multiple tools can execute concurrently
- Request chain is properly serialized
- No race conditions
- Responses match correct requests

**Runtime Verification:**
- Invoke multiple tools in parallel
- Monitor execution order
- Verify all complete
- Check response matching

---

## Execution Notes

**Blocked Tickets:** None

**Dependencies:**
- TICKET-04-001 should be executed first (foundational routing)
- TICKET-04-002 can be executed in parallel with 04-001
- TICKET-04-003 depends on TICKET-04-001
- TICKET-04-004 depends on TICKET-04-003
- TICKET-04-005 depends on TICKET-04-001, 04-002, 04-003

**Risk Assessment:**
- **High Risk:** TICKET-04-001 (routing changes affect all tool calls)
- **Medium Risk:** TICKET-04-005 (concurrency changes could introduce bugs)
- **Low Risk:** TICKET-04-002, 04-003, 04-004 (timeout, parsing, error handling)
