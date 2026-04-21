# MCP Architecture Design Document

**Last Updated:** 2026-04-19
**Version:** 2.0 (Updated to reflect actual implementation state)

---

## Executive Summary

The control app implements a robust, multi-server MCP (Model Context Protocol) architecture with comprehensive tool execution, governance, and recovery capabilities. This document describes the actual implementation state, correcting previous misconceptions about missing components.

---

## Architecture Overview

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ChatService                              │
│  - Manages chat sessions and message persistence                 │
│  - Coordinates tool execution via AgentOrchestrator              │
│  - Handles streaming and output interpretation                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentOrchestrator                           │
│  - Central brain for agent execution                            │
│  - Manages agent loop with LoopController                        │
│  - Handles tool execution, retries, and final output            │
│  - Integrates security validation and retry strategies           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ToolExecutionService                           │
│  - Single entry point for tool execution                         │
│  - Validates tool names and metadata                            │
│  - Integrates governance checks before execution                │
│  - Calls McpOrchestrator for actual tool invocation              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GovernanceService                              │
│  - Runtime allowlist/blocklist enforcement                       │
│  - Trust level checks (verified vs untrusted)                     │
│  - High-risk tool enforcement                                    │
│  - Snapshot availability checks                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      McpOrchestrator                              │
│  - Manages MCP server lifecycle                                  │
│  - Supports multiple concurrent servers (stdio + HTTP)           │
│  - Auto-restart with exponential backoff                         │
│  - Crash detection and recovery                                  │
│  - Tool namespace isolation                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              McpInspectorService                                  │
│  - Higher-level interface for MCP server management             │
│  - Handles server configuration and client instantiation          │
│  - Manages server sessions and traffic logging                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              MCP Clients (Multi-Client)                          │
│  - McpStdioClient: TypeScript-based stdio client                │
│  - McpHttpClient: HTTP-based client                              │
│  - McpRustClient: Rust backend client (singleton for stdio)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. AgentOrchestrator

**File:** `src/services/agent/AgentOrchestrator.ts`

**Status:** ✅ Fully Implemented

**Capabilities:**
- Agent loop management with LoopController
- Tool execution via ToolExecutionService
- Strict JSON parsing for tool calls (no regex hacks)
- Retry strategy integration with RetryStrategyEngine
- Security validation via SecurityLayer
- Agent tracing and context management
- Final answer generation from tool results

**Configuration:**
```typescript
{
  maxAgentTime: 20000, // 20 seconds
  maxSteps: 10        // Increased from 5 to 10 for complex workflows
}
```

**Strengths:**
- Centralized agent logic with clear separation of concerns
- Non-blocking tool execution
- Proper model → tool → result → model flow
- No intent gating that bypasses model authority

### 2. ToolExecutionService

**File:** `src/services/ToolExecutionService.ts`

**Status:** ✅ Fully Implemented

**Capabilities:**
- Single entry point for all tool execution
- Tool name validation and namespace resolution
- Governance checks before execution
- Server runtime status verification
- Error classification and handling
- MCP latency tracking

**Flow:**
```
ToolExecutionService.executeNamespacedTool()
  → GovernanceService.decideTool()
  → McpOrchestrator.callTool()
  → MCP Client
  → Result normalization
```

**Strengths:**
- Comprehensive validation before execution
- Governance integration for security
- Clear error classification
- Namespaced tool support for multi-server isolation

### 3. McpOrchestrator

**File:** `src/mcp/McpOrchestrator.ts`

**Status:** ✅ Fully Implemented

**Capabilities:**
- Multi-server support (stdio + HTTP)
- Server lifecycle management (start, stop, restart)
- Auto-restart with exponential backoff (2s, 4s, 8s, 16s max)
- Max 3 restart attempts per server
- Crash detection and history tracking
- Tool namespace isolation
- Server snapshot management

**Multi-Server Support:**
- TypeScript orchestrator supports unlimited concurrent servers
- HTTP servers have no limitations
- Rust McpRustClient is limited to 1 stdio server at a time (singleton)
- Use McpStdioClient for multiple concurrent stdio servers

**Crash Recovery:**
```typescript
{
  crashHistory: Map<string, Array<{ timestamp: number; reason: string }>>,
  autoStartAttemptsByServerId: Map<string, number>,
  autoStartBackoffUntilByServerId: Map<string, number>
}
```

**Strengths:**
- Robust crash detection and auto-recovery
- Exponential backoff prevents restart storms
- Manual restart resets attempt counter
- Crash history visible in UI

### 4. RetryStrategyEngine

**File:** `src/services/agent/RetryStrategyEngine.ts`

**Status:** ✅ Fully Implemented

**Capabilities:**
- Tool call parsing with strict JSON (no regex)
- Failure classification via FailureClassifier
- Retry strategy selection (same, modified_args, alternative_tool, fallback)
- Fallback chain integration

**Strengths:**
- Structured retry logic
- No regex-based parsing hacks
- Proper error classification
- Fallback strategy tracking with reasoning

### 5. FallbackStrategy

**File:** `src/services/FallbackStrategy.ts`

**Status:** ✅ Fully Implemented with Web Automation Adaptive Strategies (TICKET-003)

**Capabilities:**
- Fallback chains for common tools
- Web automation adaptive strategies:
  - Selector variants (by text, by role, by test-id)
  - Dynamic content handling (scroll, wait, paginate)
  - Alternative path attempts (/blog, /docs, /wiki)
- Content extraction fallbacks
- Navigation URL alternatives
- Fallback usage tracking with reasoning

**Strengths:**
- Adaptive behavior for web automation failures
- Strategies logged with reasoning
- Max 3 adaptive attempts per tool call
- Comprehensive fallback coverage

---

## Multi-Server Architecture

### Server Types Supported

1. **STDIO Servers (TypeScript Client)**
   - Unlimited concurrent servers via McpStdioClient
   - Full feature parity with HTTP servers
   - Recommended for multiple stdio servers

2. **STDIO Servers (Rust Client)**
   - Singleton limitation (only 1 server at a time)
   - Used for McpHostRuntime integration
   - Not suitable for multi-server stdio deployment

3. **HTTP Servers**
   - Unlimited concurrent servers via McpHttpClient
   - No limitations
   - Recommended for remote MCP servers

### Tool Namespace Isolation

Each server's tools are namespaced to prevent conflicts:
```
{serverId}__{toolName}
```

Example:
- `playwright__browser_navigate`
- `github__list_repositories`
- `taqwin__scan_database`

### Tool Exposure

**File:** `src/services/ToolExposureService.ts`

- Aggregates tools from all active servers
- Only exposes tools from READY servers or servers with cached tools
- Normalizes tool parameters
- Maintains tool registry

---

## Error Handling & Recovery

### Crash Detection

**Implementation:**
- Process exit detection in McpStdioClient
- Distinguishes between normal shutdown (code 0) and crashes (non-zero code)
- Logs crash with timestamp and reason
- Records crash history in McpOrchestrator

### Auto-Restart Logic

**Backoff Strategy:**
```
Attempt 1: 2s
Attempt 2: 4s
Attempt 3: 8s
Max: 16s
Max attempts: 3
```

**Manual Restart:**
- Resets attempt counter
- Clears backoff timer
- Immediately attempts restart

### Error Classification

**File:** `src/services/agent/FailureClassifier.ts`

Categories:
- Network errors
- Timeout errors
- Validation errors
- Permission errors
- Data mismatch errors

Each category has specific remediation strategies.

---

## UI State Visibility

### MCP Inspector Panel

**File:** `src/features/mcp/inspector/McpInspectorPanel.tsx`

**Features:**
- Server list with state badges (color-coded)
- Error-only tab with error count badge
- Crash history display per server
- Traffic logging (request/response)
- Lifecycle logs
- Server configuration editing
- Tool listing with search

**State Badge Colors:**
- IDLE: gray
- STARTING: yellow
- INITIALIZED: blue
- LISTING_TOOLS: purple
- READY: green
- ERROR: red

**Enhancements (TICKET-001, TICKET-002):**
- Real-time state updates
- Error panel with filtering
- Crash history visibility
- Tool execution metrics

---

## Architecture Strengths

### 1. Robust Tool Execution Pipeline
- Single entry point (ToolExecutionService)
- Governance integration
- Comprehensive validation
- Error classification
- Non-blocking execution

### 2. Multi-Server Support
- Unlimited HTTP servers
- Unlimited stdio servers via TypeScript client
- Tool namespace isolation
- Server snapshot management

### 3. Crash Recovery
- Automatic detection
- Exponential backoff restart
- Crash history tracking
- Manual restart reset

### 4. Adaptive Strategies
- Web automation fallbacks
- Selector variants
- Dynamic content handling
- Alternative paths
- Strategy logging with reasoning

### 5. Agent Loop Stabilization
- LoopController with deterministic rules
- Max steps increased to 10
- Retry strategy integration
- Security validation
- Agent tracing

---

## Remaining Gaps

### 1. Live Status Updates (PARTIALLY ADDRESSED)
**Status:** State badges and error panel added (TICKET-001, TICKET-002)
**Remaining:** Tool execution status transitions (pending → running → completed)

### 2. Execution Time Tracking (PARTIALLY ADDRESSED)
**Status:** Tracked in events
**Remaining:** Propagation to toolCall.executionTimeMs and UI display

### 3. MCP Latency Tracking (PARTIALLY ADDRESSED)
**Status:** Infrastructure in place
**Remaining:** Actual latency measurement and UI display

### 4. Design Document Corrections
**Status:** This document addresses all incorrect claims
**Completed:**
- ✅ ToolExecutionService exists and is fully implemented
- ✅ AgentOrchestrator is robust (not minimal)
- ✅ Multi-server support exists (unlimited HTTP + stdio via TypeScript)
- ✅ Auto-recovery exists (crash detection + exponential backoff)

---

## Data Flow Diagrams

### Tool Execution Flow

```
User Request
    ↓
ChatService.runAgentViaOrchestrator()
    ↓
AgentOrchestrator.runAgent()
    ↓
AgentContextManager (initialize context)
    ↓
LoopController (step execution)
    ↓
Model Call (get tool request)
    ↓
RetryStrategyEngine.parseToolCall() (strict JSON)
    ↓
ToolExecutionService.executeNamespacedTool()
    ↓
GovernanceService.decideTool() (security check)
    ↓
McpOrchestrator.callTool()
    ↓
McpInspectorService.callTool()
    ↓
MCP Client (Stdio/HTTP/Rust)
    ↓
Tool Result
    ↓
ToolResultNormalizer
    ↓
RetryStrategyEngine (if retry needed)
    ↓
AgentOrchestrator.generateFinalAnswer()
    ↓
User Response
```

### Crash Recovery Flow

```
Server Process Exit
    ↓
McpStdioClient.onClose()
    ↓
Determine: Normal shutdown vs Crash
    ↓
If Crash:
    ↓
McpOrchestrator.recordCrash()
    ↓
McpOrchestrator.maybeAutoStartServers()
    ↓
Check: attempts < 3?
    ↓
Yes: Calculate backoff (2s, 4s, 8s, 16s)
    ↓
Wait for backoff
    ↓
McpOrchestrator.ensureStarted()
    ↓
Success: Reset attempts
    ↓
Failure: Increment attempts
    ↓
If attempts >= 3: Give up
```

---

## Configuration

### Server Configuration Schema

```typescript
interface McpServerConfig {
  id: string;
  type: "stdio" | "http";
  enabled: boolean;
  start_on_boot: boolean;
  tags: string[];
  allowed_tools: string[];
  blocked_tools: string[];
  // stdio-specific
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // http-specific
  url?: string;
  headers?: Record<string, string>;
}
```

### Agent Configuration

```typescript
interface AgentOrchestratorConfig {
  maxAgentTime: number;  // 20000ms
  maxSteps: number;      // 10
}

interface LoopConfig {
  maxSteps: number;              // 10
  maxConsecutiveFailures: number; // 3
  maxSameToolRepeats: number;    // 2
  forceAnswerTimeoutMs: number;  // 5000
}
```

---

## Testing & Verification

### Unit Tests
- ToolExecutionService tests (`tests/unit/chat/toolExecutionService.test.ts`)
- Memory drift guard tests
- Agent E2E tests (`tests/tauri-playwright/agent-e2e.spec.ts`)

### Integration Tests
- MCP server start/stop/restart
- Tool execution with governance
- Crash detection and recovery
- Multi-server isolation

### Runtime Verification
- Manual server kill → auto-restart verification
- Tool call with selector variants
- Navigation with alternative paths
- Error panel visibility

---

## Performance Considerations

### Timeout Management
- Adaptive timeout configuration per tool
- Timeout escalation for retries
- Configurable max agent time (20s default)

### Backoff Strategy
- Prevents restart storms
- Exponential backoff (2s, 4s, 8s, 16s)
- Max 3 attempts before giving up

### Resource Limits
- Max steps: 10 (prevents infinite loops)
- Max consecutive failures: 3
- Max same tool repeats: 2

---

## Security

### Governance Enforcement
- Runtime allowlist/blocklist
- Trust level checks
- High-risk tool enforcement
- Snapshot availability checks

### Security Layer
- Tool result validation
- Input sanitization
- Output classification

---

## Conclusion

The control app's MCP architecture is robust, well-implemented, and includes comprehensive features for:
- Multi-server management
- Crash detection and recovery
- Adaptive fallback strategies
- Agent loop stabilization
- Governance and security

Previous claims about missing components (ToolExecutionService, AgentOrchestrator minimal, single stdio server limitation, no auto-recovery) have been corrected. The actual implementation exceeds initial design expectations with additional features like web automation adaptive strategies and comprehensive error handling.

---

## References

- **AgentOrchestrator:** `src/services/agent/AgentOrchestrator.ts`
- **ToolExecutionService:** `src/services/ToolExecutionService.ts`
- **McpOrchestrator:** `src/mcp/McpOrchestrator.ts`
- **FallbackStrategy:** `src/services/FallbackStrategy.ts`
- **RetryStrategyEngine:** `src/services/agent/RetryStrategyEngine.ts`
- **McpInspectorPanel:** `src/features/mcp/inspector/McpInspectorPanel.tsx`
