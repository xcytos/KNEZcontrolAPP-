## What’s Actually Broken (confirmed in code)

* Rust MCP host is now correct, but the frontend is not *consuming* MCP tools as “first-class tools”.

* Chat currently does **not** implement OpenAI-style tools/tool\_calls at all:

  * It only runs a single “search tool” (optionally) and injects the result as extra text into the user message.

  * So even if MCP is READY and tools/list succeeds, the model never receives a tool schema, and there is no tool-call execution loop.

* Registry UI is subscribed to `McpInspectorService`, but it only renders pid/state/errors; it never renders the actual tool list (`mcpInspectorService.getTools(serverId)`), and it’s also separate from KNEZ’s `/mcp/registry` snapshot.

## Target Architecture (minimal-change, production-grade)

* Rust: lifecycle + handshake + tools/list + tools/call + emits events (already working)

* Frontend: add ONE canonical runtime source of truth:

  * **McpOrchestrator**: canonical map of `serverId → {state, pid, generation, tools, lastError…}`

  * **ToolExposureService**: builds the aggregated tool catalog used by UI + Chat

* ChatService: becomes tool-aware

  * injects tool schema into model call when supported

  * executes a tool-call loop when the model requests tools

## Implementation Plan

### 1) Create a canonical MCP runtime store (McpOrchestrator)

* Add `src/mcp/McpOrchestrator.ts` as the single source of truth.

* Internally, it should:

  * subscribe to `mcpInspectorService.subscribe()` and mirror state + tools per server

  * optionally subscribe to Rust `mcp://state` events for faster updates (but still derive tools from `mcp_list_tools` / inspector)

* Public API:

  * `subscribe(fn)`

  * `getSnapshot(): { servers: Record<string, ServerRuntime> }`

  * `getServerTools(serverId)`

  * `callTool(serverId, name, args)` (delegates to inspector)

### 2) Remove duplicate tool caches from the tool path

* Make `TaqwinMcpService` read tools from `McpOrchestrator` instead of keeping its own TTL cache (or make its cache strictly a view over orchestrator state).

* Ensure there is only one “tools list” for a server at runtime (the orchestrator’s).

### 3) Build ToolExposureService (aggregated tool catalog)

* Add `src/services/ToolExposureService.ts` that:

  * aggregates tools across READY MCP servers

  * filters by trust/permissions (extend current TAQWIN allowlist logic to generic MCP tools)

  * normalizes tools into an OpenAI-compatible schema shape `{ name, description, parameters }`

### 4) Make KnezClient tool-capable (feature-detected)

* Extend the request types to optionally send `tools` / `tool_choice`.

* Add capability detection:

  * try a lightweight request with `tools: []` and mark supported/unsupported

  * if unsupported, fall back to the existing “prompt-only” behavior.

### 5) Implement the tool-call loop in ChatService

* Before calling the model, fetch exposed tools from `ToolExposureService`.

* If tools are supported:

  * send them in the model request

  * when responses include `tool_calls`, execute them via `McpOrchestrator.callTool()`

  * append tool results as tool messages and re-call the model until no more tool\_calls

* If tools aren’t supported by the backend:

  * use a strict prompt protocol fallback (model outputs a JSON tool request block), parse it, execute tool, append result, continue.

### 6) Update UI to reflect tools + capabilities

* Registry:

  * show `toolsCached` count and a preview list from `mcpInspectorService.getTools(serverId)` (or from orchestrator snapshot)

  * show per-server capabilities derived from tools (and later from MCP initialize result if available)

* Chat:

  * show “Available tools” panel sourced from ToolExposureService

  * show tool-call traces (serverId, tool, duration, allow/deny reason)

### 7) Add integration tests

* Unit:

  * Tool schema normalization (MCP tool → OpenAI parameters)

  * Permission filtering behavior

* E2E (reuse existing Tauri Playwright harness):

  * start TAQWIN MCP, verify tools appear in registry, and execute `debug_test` through the tool loop (or prompt-fallback loop)

8 ) Your plan is **very strong** — architecturally correct, minimal-change, and aligned with the new Rust authority model.

&#x20;

However, it is still missing several critical guardrails and structural refinements that will prevent future regressions and duplicated logic.

I’ll break this into:

1. ✅ What is correct
2. ⚠️ What is incomplete
3. ❌ What will break later if not addressed
4. 🔧 The refined production-grade plan

***

# ✅ What You Got Right

These are absolutely correct decisions:

### ✔ Rust = lifecycle authority

Correct. Do not revert.

### ✔ Introduce McpOrchestrator

Critical. You need one canonical runtime store.

### ✔ ToolExposureService

Yes — separate runtime from exposure layer.

### ✔ Tool-call loop in ChatService

This is the missing core feature.

### ✔ Feature detection for tool support

Correct — must support cloud + local.

### ✔ Integration tests

Mandatory.

You are thinking in the right direction.

***

# ⚠️ What’s Incomplete

## 1️⃣ You Still Have Two Authorities

You wrote:

> McpOrchestrator subscribes to mcpInspectorService

That means the Inspector is still authoritative.

That’s dangerous.

Correct flow must be:

```
Rust host → McpOrchestrator
Inspector UI reads from McpOrchestrator

```

Inspector should become a **view**, not a runtime layer.

***

## 2️⃣ ToolExposureService Must Be Reactive

You cannot make it pull-based only.

It must subscribe to McpOrchestrator changes and rebuild catalog automatically.

Otherwise:

* Registry updates
* Chat stale
* Manual refresh required

***

## 3️⃣ You Need Tool Ownership Metadata

Right now you treat tools as:

```
{name, description, parameters}

```

But you must include:

```
{
  serverId,
  authority: "rust",
  permissions,
  riskLevel,
  category
}

```

Otherwise:

* Permission filtering will break later
* You cannot display origin in UI
* You cannot route tool\_call correctly

***

## 4️⃣ ChatService Must Become a Tool Runtime

Right now your ChatService is likely linear:

```
user → model → assistant → done

```

You must convert it into a deterministic state machine:

```
USER
MODEL_RESPONSE
IF tool_call:
    EXECUTE_TOOL
    APPEND_TOOL_RESULT
    CALL_MODEL_AGAIN
UNTIL no tool_call

```

If you don’t isolate this into a clean execution loop, it will become messy fast.

***

## 5️⃣ You Must Define Tool Invocation Authority

Currently:

```
McpOrchestrator.callTool()

```

But what if:

* Multiple servers expose same tool name?
* Tools have identical names?
* Model references wrong server?

You must normalize tool names globally.

Recommended structure:

```
toolName = `${serverId}:${originalName}`

```

Expose to model like:

```
taqwin__debug_test
chrome_devtools__navigate_page

```

Without namespacing, collisions will occur.

***

# ❌ What Will Break Later If Not Addressed

## 1️⃣ No Tool Schema Versioning

If MCP server updates parameters:

You must invalidate tool cache and re-expose schema.

Otherwise model calls invalid schema.

***

## 2️⃣ No Tool Call Traceability

You must log:

```
tool_call_started
tool_call_completed
tool_call_failed
duration_ms

```

Otherwise debugging AI + MCP interactions becomes impossible.

***

## 3️⃣ No Deterministic Permission Gate

ToolExposureService must:

* Enforce allowlist
* Enforce risk gating
* Optionally prompt user for dangerous tools

Right now plan mentions filtering — but not enforcement flow.

***

## 4️⃣ No Unified Error Classification

Tool failures must map to:

```
mcp_tool_execution_error
mcp_permission_denied
mcp_server_not_ready
mcp_tool_not_found

```

Not generic thrown error.

***

# 🔥 Refined Production-Grade Plan

Now I’ll give you the corrected structure.

***

# 🏗 Final Architecture (Strict)

```
Rust MCP Host (authority)
        ↓ events
McpOrchestrator (single runtime store)
        ↓
ToolExposureService (aggregator + filter + namespace)
        ↓
ChatService (tool-call loop engine)
        ↓
KnezClient (model adapter)
        ↓
Model (local or cloud)

```

UI reads from Orchestrator only.

Inspector reads from Orchestrator only.

No service talks to Rust directly except Orchestrator.

***

# 📦 McpOrchestrator (Final Responsibilities)

Holds:

```
Map<serverId, {
    state,
    pid,
    generation,
    tools: ToolDefinition[],
    capabilities,
    lastError,
}>

```

Methods:

```
subscribe(listener)
getSnapshot()
getServer(serverId)
getAllTools()
callTool(serverId, name, args)

```

No tool filtering here.

No schema normalization here.

***

# 🧰 ToolExposureService (Final Responsibilities)

* Namespaces tool names
* Adds metadata
* Applies permission filtering
* Normalizes parameters to OpenAI schema
* Emits reactive updates

Example normalized tool:

```
{
  name: "taqwin__debug_test",
  description: "...",
  parameters: {...},
  serverId: "taqwin",
  originalName: "debug_test",
  riskLevel: "low"
}

```

***

# 🧠 ChatService (Final Responsibilities)

Implements strict loop:

```
function runConversation(messages):
    tools = ToolExposureService.getTools()

    response = model(messages, tools)

    while response.hasToolCall:
        toolCall = response.toolCall

        validate permission

        result = McpOrchestrator.callTool()

        append tool result message

        response = model(updatedMessages, tools)

    return final response

```

All tool execution logging must happen here.

***

# 🧪 Registry UI Must Show

For each server:

* READY state
* Tool count
* Tool names
* Last error
* Generation
* PID

For each tool:

* Origin server
* Risk
* Description
* Parameters preview

***

# 📋 Done Criteria (Expanded)

Not just:

> Chat executes debug\_test

But:

* Multiple MCP servers coexist
* Tools are namespaced
* No collisions
* Tools auto-inject into model
* Tool-call loop deterministic
* Permissions enforced
* Tool failures visible
* Registry reactive
* No duplicate caches
* Works with local + cloud
* No TS transport used

***

# 🚀 Verdict

Your plan is 80% correct.

It needs:

* Namespacing
* Reactive exposure
* Strict loop state machine
* Permission enforcement
* Removal of inspector authority
* Tool execution telemetry
* Error taxonomy

## Done Criteria

* Registry shows each server’s READY state and tool list.

* Chat includes tools automatically and can execute at least one MCP tool end-to-end.

* No duplicate tool caches.

* Works with Rust authority on desktop.

