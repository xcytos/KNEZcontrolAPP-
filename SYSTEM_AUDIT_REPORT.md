# KNEZ CONTROL APP — FULL SYSTEM AUDIT & REAL STATE ANALYSIS

**Generated:** 2026-04-12  
**Auditor:** Production Audit  
**Scope:** Full codebase examination of knez-control-app

---

# 1. 📊 REAL PROJECT STAGE CLASSIFICATION

## Classification: **Alpha (unstable)**

**Justification:**
- **Core systems working:** ~70% of core systems are implemented and functional
- **Major blockers:** 
  - Silent error handling throughout codebase
  - No auto-reconnect on runtime connection loss
  - Weak retry logic with no exponential backoff
  - Memory system is misleading (system prompts only, not actual memory)
- **Reliability level:** Unstable - will fail in production under load or network instability

**Evidence:**
- ChatService.ts line 63, 1130, 1373, 1395: Silent catch blocks
- ChatService.ts line 47-48: Fixed retry limits (maxOutgoingAttempts=3, maxOutgoingAgeMs=300000)
- MemoryInjectionService.ts: Only injects system prompts, no actual memory retrieval
- useSystemOrchestrator.ts: Auto-reconnect only on app launch, not runtime failures

---

# 2. ⚙️ CORE SYSTEM VALIDATION

## 2.1 ChatService (CRITICAL)

**Status:** ✅ Working

**Evidence:**
- **File:** `src/services/ChatService.ts`
- **Execution ownership:** ChatService IS the ONLY execution owner
  - Line 117-176: `sendMessage()` is the single entry point
  - Line 178-245: `sendMessageForSession()` for programmatic access
  - Line 1052-1176: `deliverQueueItem()` processes all queued messages
- **No bypasses found:** All UI components go through ChatService
  - `src/features/chat/ChatPane.tsx` line 540-645: Uses `chatService.subscribe`, `chatService.sendMessage`
  - `src/services/TestRunner.ts` line 126-323: Uses `chatService.sendMessageForSession`
  - `src/App.tsx` line 143: Only subscribes to ChatService state
- **Tool loop correctness:**
  - Line 733-863: `runNativeToolLoop()` - model → tool → result → model loop
  - Line 906-1050: `runPromptToolLoop()` - prompt mode tool loop
  - Line 746: `maxSteps = 8` enforced
  - Line 942: `maxSteps = 8` enforced in prompt mode
- **Simulation detection:**
  - Line 674-684: `isPermissionSeekingResponse()` detects permission-seeking patterns
  - Line 891-904: `isSimulationResponse()` detects simulation patterns
  - Line 768-778: Blocks non-compliant output in native mode
  - Line 965-973: Blocks non-compliant output in prompt mode

**Issues:**
- ⚠️ Two different tool loop implementations (native vs prompt mode) - architecture violation
- ⚠️ Simulation detection patterns are basic (line 896-901)

---

## 2.2 TOOL EXECUTION PIPELINE

**Status:** ✅ Working

**Evidence:**
- **Pipeline:** ChatService → ToolExecutionService → GovernanceService → McpOrchestrator → MCP Client
- **File:** `src/services/ChatService.ts`
  - Line 559: Calls `toolExecutionService.executeNamespacedTool()`
- **File:** `src/services/ToolExecutionService.ts`
  - Line 51-143: `executeNamespacedTool()` is the single entry point
  - Line 86: Calls `governanceService.decideTool()` BEFORE execution
  - Line 126: Calls `mcpOrchestrator.callTool()` for actual execution
- **Error handling:**
  - Line 134-142: Catches and classifies errors via `classifyMcpError()`
  - Line 59-63: Validates tool name format before execution
- **Tool result appending:**
  - ChatService.ts line 859: Appends tool result to conversation
  - Line 1047: Appends tool result in prompt mode

**Issues:**
- ⚠️ No parallel tool execution support (sequential only)
- ⚠️ Tool result truncated to 20000 chars (line 853, 1041)

---

## 2.3 MCP RUNTIME

**Status:** ⚠️ Partial

**Evidence:**
- **Server lifecycle:**
  - File: `src/mcp/inspector/McpInspectorService.ts`
  - Line 311-335: `start()` - starts MCP server
  - Line 337-354: `stop()` - stops MCP server
  - Line 356-381: `restart()` - restarts MCP server
  - Line 383-423: `initialize()` - initializes MCP connection
  - Line 425-530: `handshake()` - full handshake with tools/list
- **Tools/list reliability:**
  - Line 494: Timeout 60000ms default, configurable
  - Line 532-587: `listTools()` with timeout
  - Line 495-505: Validates tools array is not empty
- **Tools/call execution:**
  - Line 589-709: `callTool()` with timeout 180000ms default
  - Line 661: Executes tool call
  - Line 683-706: Error classification and logging
- **Timeout handling:**
  - McpStdioClient.ts line 527-604: Request timeout with `stopOnTimeout` option
  - Line 569-604: Timeout classification and logging
- **Stdio framing:**
  - McpStdioClient.ts line 346-456: Dual framing support (content-length + line)
  - Line 347-404: Content-Length framing parser
  - Line 407-455: Line-based framing fallback
  - Line 514-525: Payload builder respects framing mode

**Issues:**
- ❌ Silent failures in framing detection (line 361-364: silently returns on invalid header)
- ❌ Process crash detection relies on poll (McpInspectorService.ts line 104-123)
- ❌ No retry on tools/list timeout (single attempt only)
- ❌ Framing auto-detection can fail silently (McpStdioClient.ts line 361-364)
- ⚠️ Runtime poll at 250ms (McpInspectorService.ts line 97-101) - could miss rapid state changes
- ⚠️ Auto-start backoff only for stdio servers (McpOrchestrator.ts line 256-295)

---

## 2.4 GOVERNANCE SYSTEM

**Status:** ⚠️ Partial

**Evidence:**
- **File:** `src/services/GovernanceService.ts`
- **Enforcement before tool calls:**
  - Line 92: `decideTool()` called in ToolExecutionService.ts line 86
  - Line 95-104: Runtime allowlist/blocklist enforcement
  - Line 106-110: Trust level check (verified vs untrusted)
  - Line 112-118: Snapshot availability check
  - Line 120-137: Blocked tools enforcement
  - Line 139-147: High-risk tools enforcement
- **Risk classification:**
  - ToolExecutionService.ts line 86: Passes tool metadata to governance
  - ToolExposureService.ts line 48-53: `riskForTool()` classifies risk
- **Approval flows:**
  - ❌ NO UI approval flows - purely server-side enforcement
  - Line 92: Returns `{ allowed: boolean; reason?: string }` - no user interaction

**Issues:**
- ❌ Governance snapshot fetch can fail silently (line 33-34: returns null on error)
- ❌ No UI approval flows for high-risk tools
- ❌ Snapshot cache timeout (2500ms) too short (line 24)
- ⚠️ Multiple field name variations checked (blocked_tools, blockedTools, etc.) - suggests schema instability

---

## 2.5 MEMORY SYSTEM

**Status:** ⚠️ Partial (Misleading name)

**Evidence:**
- **File:** `src/services/MemoryInjectionService.ts`
- **Memory injection:**
  - Line 149-182: `inject()` adds system messages to conversation
  - Line 176-180: System message content built from static snippets + runtime state
- **Token limits:**
  - Line 180: System message capped at 8000 chars
- **Actual influence:**
  - Line 163-166: MCP control rules injected
  - Line 128-129: Tool list injected (first 80 tools)
  - Line 112-140: Runtime MCP state injection
- **Memory retrieval:**
  - ❌ NO actual memory retrieval from KNEZ backend
  - ❌ Only static snippets + runtime MCP state

**Issues:**
- ❌ Name is misleading - it's "System Prompt Injection Service", not "Memory System"
- ❌ No actual long-term memory storage or retrieval
- ❌ No memory search or relevance matching
- ❌ Static snippets hardcoded (line 59-102)
- ⚠️ Token limit (8000 chars) may truncate important context

---

## 2.6 PERSISTENCE

**Status:** ⚠️ Partial

**Evidence:**
- **File:** `src/services/SessionDatabase.ts`
- **IndexedDB reliability:**
  - Line 42-75: Dexie database with versioned schema
  - Line 47-48: Database name 'KnezDatabase'
  - Line 106-126: `saveMessages()` uses bulkPut
  - Line 128-145: `loadMessages()` with index lookup
- **Session restore:**
  - Line 100-108: `load()` in ChatService.ts
  - Line 86-92: `getSession()` retrieves session metadata
- **Queue retry correctness:**
  - ChatService.ts line 47-48: `maxOutgoingAttempts = 3`, `maxOutgoingAgeMs = 300000`
  - Line 425-460: `flushOutgoingQueue()` processes pending items
  - Line 1057-1082: Retry limit enforcement
  - Line 1280-1281: Exponential backoff (base 2, max 60s)

**Issues:**
- ❌ Fixed retry limits (3 attempts, 5 minutes max age) - not configurable
- ❌ No exponential backoff for initial retry (line 1280)
- ❌ Silent catch blocks in PersistenceService.ts (line 16-18, 25-28)
- ⚠️ No queue priority mechanism
- ⚠️ No dead letter queue for permanently failed items

---

## 2.7 INFRASTRUCTURE

**Status:** ⚠️ Partial

**Evidence:**
- **File:** `src/features/system/useSystemOrchestrator.ts`
- **KNEZ start/stop reliability:**
  - Line 31-123: `launchAndConnect()` with idempotency check
  - Line 181-207: `stopKnez()` with process kill
  - Line 49-61: Fast-path verification (checks if already running)
- **Health checks:**
  - Line 125-179: `verifyHealthLoop()` with 180 attempts (90s timeout)
  - Line 134-152: Health check with 900ms timeout
  - Line 156-169: Exponential backoff on failure
- **Auto-reconnect:**
  - App.tsx line 111-130: Auto-launch on app start if local + Tauri
  - ❌ NO auto-reconnect on runtime connection loss

**Issues:**
- ❌ No auto-reconnect on connection loss during runtime
- ❌ Health check timeout (900ms) too short for slow backends
- ❌ Process kill uses hardcoded ports (8000, 11434) - line 184-189
- ⚠️ No health check interval after initial connection
- ⚠️ No degraded mode handling

---

# 3. 🧨 CRITICAL FAILURES (TOP 10)

## 1. Silent Error Handling Throughout Codebase
- **Impact:** Errors swallowed, no visibility into failures
- **Root cause:** Empty catch blocks with no logging
- **Where:** 
  - ChatService.ts line 63, 1130, 1373, 1395
  - KnezClient.ts line 425, 689, 864, 996, 1045
  - ToolExposureService.ts line 125
  - LogService.ts line 93, 123
- **Severity:** HIGH

## 2. No Auto-Reconnect on Runtime Connection Loss
- **Impact:** System becomes unusable after network hiccup
- **Root cause:** Auto-reconnect only on app launch, not runtime
- **Where:** App.tsx line 111-130 (only checks on mount)
- **Severity:** HIGH

## 3. Governance Snapshot Can Fail Silently
- **Impact:** Governance enforcement bypassed without detection
- **Root cause:** getSnapshot() returns null on error, no error propagation
- **Where:** GovernanceService.ts line 33-34
- **Severity:** HIGH

## 4. Memory System is Misleading (Not Actual Memory)
- **Impact:** Users expect memory system, it's just system prompts
- **Root cause:** MemoryInjectionService only injects static prompts
- **Where:** MemoryInjectionService.ts entire file
- **Severity:** HIGH

## 5. Weak Retry Logic (No Configurable Limits)
- **Impact:** Messages permanently fail after 3 attempts
- **Root cause:** Hardcoded retry limits
- **Where:** ChatService.ts line 47-48
- **Severity:** MEDIUM

## 6. MCP Framing Detection Can Fail Silently
- **Impact:** MCP communication breaks without detection
- **Root cause:** Silently returns on invalid header
- **Where:** McpStdioClient.ts line 361-364
- **Severity:** MEDIUM

## 7. No Parallel Tool Execution Support
- **Impact:** Slow multi-tool workflows
- **Root cause:** Sequential tool loop implementation
- **Where:** ChatService.ts line 797-860 (sequential for loop)
- **Severity:** MEDIUM

## 8. Tool Result Truncation (20000 chars)
- **Impact:** Large tool results corrupted
- **Root cause:** Hardcoded limit in stringifyToolPayload
- **Where:** ChatService.ts line 853, 1041
- **Severity:** MEDIUM

## 9. Race Conditions in Queue Flushing
- **Impact:** Duplicate message delivery
- **Root cause:** queueFlushInFlight flag not atomic
- **Where:** ChatService.ts line 426-427, 458
- **Severity:** MEDIUM

## 10. No UI Approval Flows for Governance
- **Impact:** High-risk tools execute without user consent
- **Root cause:** Governance is purely server-side
- **Where:** GovernanceService.ts line 92 (returns boolean, no UI)
- **Severity:** LOW

---

# 4. ⚠️ ARCHITECTURE VIOLATIONS

## 1. Two Different Tool Loop Implementations
- **Violation:** Single execution path principle
- **Where:** ChatService.ts line 733 (runNativeToolLoop) vs line 906 (runPromptToolLoop)
- **Impact:** Code duplication, maintenance burden, inconsistent behavior

## 2. Memory System Name is Misleading
- **Violation:** Naming should reflect actual functionality
- **Where:** MemoryInjectionService.ts (should be SystemPromptInjectionService)
- **Impact:** User expectations not met, confusion

## 3. Governance Has No UI Approval Flows
- **Violation:** Governance should include human-in-the-loop for high-risk operations
- **Where:** GovernanceService.ts line 92
- **Impact:** High-risk tools execute without user consent

## 4. State Inconsistency Between In-Memory and Persisted
- **Violation:** Single source of truth principle
- **Where:** ChatService.ts line 147 (state.messages) vs SessionDatabase (persisted)
- **Impact:** Potential desync between UI and database

## 5. Dual MCP Client Implementations
- **Violation:** Single abstraction principle
- **Where:** McpStdioClient.ts vs McpRustClient.ts vs McpHttpClient.ts
- **Impact:** Inconsistent behavior across client types

---

# 5. 🧪 WHAT ACTUALLY DOES NOT WORK

## 1. Real Memory Retrieval from KNEZ Backend
- **Claimed:** Memory system with retrieval
- **Actual:** Only system prompt injection
- **Evidence:** MemoryInjectionService.ts has no calls to knezClient.listMemory() or similar

## 2. UI Approval Flows for Governance
- **Claimed:** Governance system with approvals
- **Actual:** Purely server-side boolean decision
- **Evidence:** GovernanceService.ts line 92 returns only `{ allowed: boolean }`

## 3. Auto-Reconnect on Runtime Connection Loss
- **Claimed:** Auto-reconnect functionality
- **Actual:** Only on app launch
- **Evidence:** App.tsx line 111-130 (only in useEffect with online dependency)

## 4. Parallel Tool Execution
- **Claimed:** Tool execution pipeline
- **Actual:** Sequential only
- **Evidence:** ChatService.ts line 797-860 (sequential for loop)

## 5. Proper Exponential Backoff for Retries
- **Claimed:** Queue retry with backoff
- **Actual:** Only for failed delivery, not initial attempt
- **Evidence:** ChatService.ts line 1280 (backoff only after failure)

---

# 6. 🐢 PERFORMANCE & SCALABILITY ISSUES

## 1. Streaming Efficiency
- **Issue:** No streaming support for chat completions
- **Where:** KnezClient.ts line 807-867 (chatCompletionsNonStreamRaw)
- **Impact:** Poor UX for long responses

## 2. IndexedDB Growth Issues
- **Issue:** No cleanup mechanism for old messages
- **Where:** SessionDatabase.ts (no delete/compact operations)
- **Impact:** Database grows unbounded

## 3. Memory Leaks
- **Issue:** Potential memory leaks in traffic logging
- **Where:** McpStdioClient.ts line 58-59 (traffic array with 800 limit)
- **Impact:** Memory grows with usage

## 4. Log Overflow
- **Issue:** No log rotation or size limits
- **Where:** LogService.ts (no size limits)
- **Impact:** Logs grow unbounded

## 5. Tool Latency Handling
- **Issue:** No timeout per tool in multi-tool workflows
- **Where:** ChatService.ts line 746 (maxSteps=8 but no per-tool timeout)
- **Impact:** One slow tool blocks entire workflow

---

# 7. 🔐 SECURITY & SAFETY GAPS

## 1. Tool Misuse Risks
- **Issue:** No rate limiting on tool calls
- **Where:** ToolExecutionService.ts (no rate limiting)
- **Impact:** Tools can be abused in loops

## 2. Missing Validation
- **Issue:** Tool arguments not validated against schema
- **Where:** ToolExecutionService.ts line 126 (passes args directly)
- **Impact:** Invalid arguments can reach MCP servers

## 3. Unsafe Execution Paths
- **Issue:** Command injection risk in stdio client
- **Where:** McpStdioClient.ts line 182-188 (command concatenation)
- **Impact:** Malicious MCP configs could execute arbitrary commands

## 4. Governance Bypass Possibilities
- **Issue:** Governance snapshot null allows high-risk tools
- **Where:** GovernanceService.ts line 113-117 (returns allowed: true if no snapshot)
- **Impact:** Governance can be bypassed by failing snapshot fetch

---

# 8. 📉 TECH DEBT & DESIGN PROBLEMS

## 1. Over-Engineering
- **Issue:** Complex dual-mode tool loops (native vs prompt)
- **Where:** ChatService.ts line 733-1050
- **Impact:** Maintenance burden, inconsistent behavior

## 2. Fragile Modules
- **Issue:** Many silent catch blocks make debugging impossible
- **Where:** Throughout codebase (see section 3.1)
- **Impact:** Errors invisible in production

## 3. Hardcoded Logic
- **Issue:** Magic numbers throughout (timeouts, limits)
- **Where:** ChatService.ts line 47-48, McpStdioClient.ts line 59
- **Impact:** Not configurable, hard to tune

## 4. Missing Abstractions
- **Issue:** No unified error handling strategy
- **Where:** Each service has different error handling
- **Impact:** Inconsistent error reporting

## 5. Schema Instability
- **Issue:** Multiple field name variations in governance
- **Where:** GovernanceService.ts line 52-68 (blocked_tools, blockedTools, etc.)
- **Impact:** Suggests unstable API contracts

---

# 9. 🚧 PRODUCTION BLOCKERS

## 1. Silent Error Handling
- **Issue:** Errors swallowed without logging
- **Blocker:** Cannot debug production issues
- **Fix:** Add logging to all catch blocks

## 2. No Auto-Reconnect on Runtime Connection Loss
- **Issue:** System unusable after network hiccup
- **Blocker:** Poor reliability
- **Fix:** Add connection monitoring and auto-reconnect

## 3. Weak Retry Logic
- **Issue:** Messages permanently fail after 3 attempts
- **Blocker:** Poor reliability
- **Fix:** Implement configurable retry with exponential backoff

## 4. Memory System Misleading
- **Issue:** Users expect memory, it's just prompts
- **Blocker:** User confusion
- **Fix:** Either implement real memory or rename service

## 5. No Streaming Support
- **Issue:** Poor UX for long responses
- **Blocker:** Poor UX
- **Fix:** Implement streaming chat completions

---

# 10. 🧭 REALISTIC PROJECT SCORE

- **Architecture:** 6/10
  - Good: Centralized execution, clear pipeline
  - Bad: Dual tool loops, misleading names, no UI governance

- **Reliability:** 4/10
  - Good: Health checks, queue system
  - Bad: Silent errors, no auto-reconnect, weak retries

- **Execution Correctness:** 7/10
  - Good: Tool loop correct, governance enforced
  - Bad: No parallel execution, result truncation

- **Production Readiness:** 3/10
  - Good: Core systems implemented
  - Bad: Silent errors, no auto-reconnect, weak retries, misleading names

---

# 11. 🛠️ WHAT SHOULD BE FIXED FIRST (PRIORITY ORDER)

## 1. Add Logging to All Silent Catch Blocks
- **Why:** Cannot debug production without error visibility
- **Files:** ChatService.ts, KnezClient.ts, ToolExposureService.ts, LogService.ts
- **Effort:** Medium

## 2. Implement Auto-Reconnect on Runtime Connection Loss
- **Why:** System becomes unusable after network hiccup
- **Files:** App.tsx, useSystemOrchestrator.ts
- **Effort:** Medium

## 3. Fix Governance Snapshot Silent Failure
- **Why:** Governance can be bypassed without detection
- **Files:** GovernanceService.ts
- **Effort:** Low

## 4. Implement Configurable Retry Logic with Exponential Backoff
- **Why:** Messages permanently fail after 3 attempts
- **Files:** ChatService.ts
- **Effort:** Medium

## 5. Rename MemoryInjectionService to SystemPromptInjectionService
- **Why:** Misleading name causes user confusion
- **Files:** MemoryInjectionService.ts, all imports
- **Effort:** Low

---

## 📝 SUMMARY

The KNEZ Control App is in **Alpha (unstable)** stage. Core systems are implemented and functional, but critical issues prevent production readiness:

**Strengths:**
- Centralized execution through ChatService
- Clear tool execution pipeline
- Governance enforcement before tool calls
- MCP runtime with multiple client types
- IndexedDB persistence

**Critical Weaknesses:**
- Silent error handling throughout
- No auto-reconnect on runtime connection loss
- Weak retry logic
- Memory system is misleading (system prompts only)
- No UI approval flows for governance

**Production Blockers:**
- Silent error handling (cannot debug)
- No auto-reconnect (poor reliability)
- Weak retries (poor reliability)
- Misleading memory system (user confusion)
- No streaming (poor UX)

**Recommendation:** Address silent error handling and auto-reconnect before any production deployment. These are reliability-critical and relatively easy to fix.
