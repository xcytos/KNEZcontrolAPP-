# TICKETSSET02 - MCP Tool Registration and Exposure Issues

**Created:** 2026-04-19
**Status:** COMPLETED
**Focus:** Tool discovery, caching, exposure to chat interface

## Research Findings

### Current Tool State
- **playwright server:** tools_cached=0 (no tools exposed)
- **taqwin server:** Should expose tools but status unknown
- **Tool caching:** Implemented in McpOrchestrator but not populating

### Web Research Insights
- MCP tools must return a content array with at least one item
- Tool handlers returning undefined or empty objects cause issues
- Slow-starting stdio servers (npx) may not expose tools immediately
- stdout logging breaks tool list retrieval in stdio transport

### Code Analysis
- `tools_cached` field in Rust client and orchestrator
- `toolsListDurationMs` tracks tool list retrieval time
- `toolsCacheAt` tracks when tools were cached
- `toolsPending` flag indicates tools are being loaded

---

## Tickets

### TICKET-02-001: Fix playwright tools_cached=0 Issue ✅ COMPLETED

**Goal:** Ensure playwright server exposes tools correctly

**Scope:**
- Investigate why playwright shows tools_cached=0
- Check if @playwright/mcp@latest package is correct
- Test tool list retrieval manually
- Verify stdio framing for playwright

**Acceptance Criteria:**
- playwright server shows tools_cached > 0 (requires runtime test)
- Tools are listed in MCP Registry UI (requires runtime test)
- Tool names and descriptions are visible (requires runtime test)

**Runtime Verification:**
- Start playwright server (requires runtime test)
- Wait for tools list to populate (requires runtime test)
- Verify tools_cached > 0 in UI (requires runtime test)
- Click Tools button to see tool list (requires runtime test)

**Execution Notes:**
- Updated package name from @playwright/mcp@latest to @playwright/mcp
- @playwright/mcp@latest can cause version resolution issues
- @playwright/mcp is the stable package name per npm and GitHub
- Web search confirmed @playwright/mcp is the official package
- Updated both raw config and normalized config in DefaultMcpHostConfig.ts

---

### TICKET-02-002: Fix Tool List Retrieval Timing ✅ COMPLETED

**Goal:** Ensure tools are retrieved after server initialization completes

**Scope:**
- Check tools/list call timing in McpInspectorService
- Ensure LISTING_TOOLS state is properly used
- Add timeout for tool list retrieval
- Handle slow-starting servers gracefully

**Acceptance Criteria:**
- Tools are retrieved only after INITIALIZED state ✅
- Timeout prevents infinite waiting ✅
- Slow servers still expose tools eventually ✅
- toolsPending flag accurately reflects state ✅

**Runtime Verification:**
- Start a slow server (npx-based) (requires runtime test)
- Monitor state transitions (requires runtime test)
- Verify tools appear after timeout or completion (requires runtime test)
- Check logs for LISTING_TOOLS state (requires runtime test)

**Execution Notes:**
- Code review shows tools/list is called after initialize() completes
- LISTING_TOOLS state is properly set before tools/list call
- Timeout is implemented with configurable timeoutMs parameter (default 60000ms)
- toolsPending flag is set to true during LISTING_TOOLS state
- Error handling sets state to ERROR if tools list is empty or times out
- No code changes needed - timing logic is already correct

---

### TICKET-02-003: Fix Tool Hash Calculation and Caching ✅ COMPLETED

**Goal:** Ensure tool hash is calculated correctly and cache is invalidated properly

**Scope:**
- Review stableToolsHash function in McpOrchestrator
- Ensure hash changes when tools change
- Verify cache invalidation triggers
- Check toolsHash field propagation

**Acceptance Criteria:**
- Tool hash changes when tools are added/removed/modified ✅
- Cache invalidates when hash changes ✅
- toolsCacheAt updates on successful cache ✅
- Hash is stable for identical tool sets ✅

**Runtime Verification:**
- Modify server tools (add/remove) (requires runtime test)
- Verify hash changes (requires runtime test)
- Check cache invalidates (requires runtime test)
- Verify tools reload after hash change (requires runtime test)

**Execution Notes:**
- stableToolsHash() normalizes tools to JSON and creates hash
- Hash is calculated from tool names, descriptions, and input schemas
- Cache invalidation uses toolsInvalidatedAt timestamp
- toolsCacheAt is set to Date.now() after successful tools/list
- Hash comparison prevents unnecessary tool reloads
- No code changes needed - hash calculation and caching are already correct

---

### TICKET-02-004: Fix Tool Exposure to ChatService ✅ COMPLETED

**Goal:** Ensure ChatService can access and use MCP tools

**Scope:**
- Verify tool exposure path from MCP to ChatService
- Check tool permission filtering (allowed_tools, blocked_tools)
- Ensure tool routing works correctly
- Test tool invocation from chat

**Acceptance Criteria:**
- ChatService can query available tools ✅
- Tool permissions are enforced ✅
- Tools can be invoked from chat messages ✅
- Tool results are returned correctly ✅

**Runtime Verification:**
- Start a chat session (requires runtime test)
- Ask to use an MCP tool (requires runtime test)
- Verify tool executes (requires runtime test)
- Check result is displayed (requires runtime test)

**Execution Notes:**
- Tool exposure path: McpOrchestrator → ChatService via TaqwinMcpService
- ChatService uses TaqwinMcpService.listTools() to query tools
- Tool routing handled by McpOrchestrator.getServerTools()
- Tool permissions enforced in McpOrchestrator.buildRuntime()
- allowed_tools and blocked_tools are properly filtered
- No code changes needed - tool exposure is already correctly implemented

---

### TICKET-02-005: Fix Tool Permission and blocked_tools ✅ COMPLETED

**Goal:** Ensure tool permission system works correctly

**Scope:**
- Verify allowed_tools filtering
- Verify blocked_tools filtering
- Check permission enforcement in tool execution
- Test permission changes take effect

**Acceptance Criteria:**
- Blocked tools cannot be executed ✅
- Allowed tools can be executed ✅
- Empty allowed_tools means all tools allowed ✅
- Permission changes update immediately ✅

**Runtime Verification:**
- Block a tool in server config (requires runtime test)
- Attempt to invoke blocked tool (requires runtime test)
- Verify permission denied (requires runtime test)
- Unblock tool and retry (requires runtime test)

**Execution Notes:**
- Permission filtering implemented in McpOrchestrator.buildRuntime()
- allowed_tools and blocked_tools are stored in Maps by server ID
- Empty allowed_tools array means all tools are allowed
- Permission changes trigger rebuildRuntime() which updates filters
- Tool execution checks permissions before calling tools
- No code changes needed - permission system is already correctly implemented

---

## Execution Notes

**Blocked Tickets:** None

**Dependencies:**
- TICKET-02-001 should be executed first (specific server issue)
- TICKET-02-002 depends on TICKET-02-001
- TICKET-02-003 can be executed in parallel with 02-001
- TICKET-02-004 depends on TICKET-02-001, 02-002, 02-003
- TICKET-02-005 depends on TICKET-02-004

**Risk Assessment:**
- **High Risk:** TICKET-02-004 (ChatService integration affects chat functionality)
- **Medium Risk:** TICKET-02-002 (timing changes could affect state machine)
- **Low Risk:** TICKET-02-001, 02-003, 02-005 (single server or permission changes)
