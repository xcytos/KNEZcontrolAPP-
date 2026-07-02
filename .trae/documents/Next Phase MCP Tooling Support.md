## Current State (Already Implemented)

* **Canonical runtime snapshot:** [McpOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/McpOrchestrator.ts) aggregates server status + cached tools from Inspector and listens to Rust `mcp://state` for generation.

* **Catalog + namespacing:** [ToolExposureService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ToolExposureService.ts) exposes `serverId__toolName` and filters risky tools for unverified profiles.

* **Chat tool-call loop (native + fallback):** [ChatService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ChatService.ts) runs a bounded loop with tool traces, permission checks, and orchestrator calls.

* **Model feature detection:** [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts) detects tool support via `getToolCallingSupport()` and can send OpenAI-style `tools/tool_choice`.

<br />

prompt:{You are a senior full-stack architect/engineer.

&#x20;

Your job is to implement the next phase of MCP integration in **knez-control-app** based on the existing architecture:

* Rust MCP host emits lifecycle & traffic events
* McpOrchestrator holds canonical runtime state
* ToolExposureService produces namespaced tool catalog
* ChatService already has a basic tool-call loop
* KnezClient supports feature detection for tools

Your goals:

***

## **1. CONFIG & AUTO-START**

### Requirements

✔ Extend MCP config schema with:

```
start_on_boot: boolean

```

This field must be backward-compatible and ignored in non-Tauri builds.

### Implement

* Parser & normalization in `McpHostConfig.ts`
* Default `false` unless explicitly enabled
* Save/restore logic in `McpInspectorService.saveConfig`
* UI toggle in registry

### Edge Cases

* Web mode → start\_on\_boot = false
* Invalid config → ignore & error badge
* Config migration must preserve legacy fields

***

## **2. MCP ORCHESTRATOR EXTENSIONS**

### API

Add methods:

```
getServers()
getTools(serverId)
startServer(serverId)
stopServer(serverId)
ensureStarted(serverId)
handshake(serverId)
refreshTools(serverId)
callTool(serverId, name, args)

```

### Internals

* Maintain `toolsHash`, `toolsCacheAt`, and generation invalidation
* On Rust generation change:
  * Clear cached tools
  * Set server state = “needs refresh”
* On ensureStarted:
  * Call start + handshake
  * Update lastOkAt, durations
  * Record actionable error on failure

***

## **3. REGISTRY UI IMPROVEMENTS**

### Visual Requirements

* Expand arrow per server
* Tool count badge next to server name
* Expanded view shows:
  * tool name
  * description
  * permission/risk badges
* Per server actions:
  * Start
  * Stop
  * Restart
  * Refresh Tools
  * Start on boot toggle
* Status indicators:
  * spawning, initializing, discovering, ready, error
* Last handshake timestamp + duration

### Modal Screens

* Tool detail modal:
  * Show full schema
  * Show sample payloads
  * Show risk & permission context
  * JSON validation UI for params

### UX

* Grey tools if not ready
* Click on tool opens detail modal

***

## **4. TOOL EXPOSURE SERVICE**

### Goals

* Namespaced tool names
* Policy filtering
* Grouping by server
* Ready vs present but disabled

### Schema

Expose:

```
{
 name,
 serverId,
 originalName,
 description,
 parameters,
 riskLevel,
 permissions,
 enabled: boolean,
 groupBy: serverId/category
}

```

### Policy Extensions

In config:

```
allowed_tools?: string[]
blocked_tools?: string[]

```

Prevent misuse per config.

***

## **5. CHAT UI & TOOL PANEL**

### Requirements

* Show tool panel in Chat header
* Group tools by server
* Display:
  * tools available
  * server state
  * permission status
  * risk badges
  * tool description
* Actions:
  * Manual tool invoke
  * Quick start server
  * Refresh tools

### Manual Invocation Flow

* Open tool parameters UI
* Validate input JSON
* Invoke via orchestrator.callTool()
* Emit trace messages in chat history
* Show result or error

***

## **6. CHAT TOOL LOOP IMPLEMENTATION**

### Loop Structure

```
messages = initial user messages
tools = ToolExposureService.getToolsForModel()
response = model(messages, tools)
while response.requestsToolCall:
    toolCall = response.toolCall
    if !ToolExposureService.isAllowed(toolCall):
        show tool_call_denied
        break
    result = orchestrator.callTool(...)
    append tool result as intermediate message
    response = model(messages, tools)
return final response

```

### Conditions

* Must handle both native and fallback JSON protocol
* Must report tool execution telemetry
* Must handle timeouts and server errors

***

## **7. TELEMETRY & ERROR TAXONOMY**

Emit consistent events:

```
mcp_handshake_started
mcp_handshake_completed
mcp_handshake_failed
mcp_tools_updated
tool_call_started
tool_call_completed
tool_call_failed

```

Classification:

```
mcp_timeout
mcp_not_ready
mcp_tool_not_found
mcp_permission_denied
mcp_tool_execution_error

```

***

## **8. EDGE CASES EVERY UI/CHAT MUST HANDLE**

✔ Models without tool support\
✔ Tool name collisions\
✔ Server crash mid-tool call\
✔ Restart server during chat session\
✔ Config change while running\
✔ Tool schema changes on restart\
✔ Permission feedback loops

***

## **9. TESTING & VERIFICATION**

### Unit Tests

* orchestrator
* toolExposureService
* KnezClient tool support detection
* chat service loop (native + fallback)
* permission enforcement

### E2E Tests

* TAQWIN MCP: registry expand → tool list → chat tool call
* Chrome DevTools MCP
* Multi-server flows
* Permission block flows

***

## **10. DELIVERABLES**

After implementation:

✔ Registry shows tools + metadata\
✔ Tools usable in chat automatically\
✔ Manual invocation works\
✔ Permissions enforced\
✔ Streaming models supported\
✔ Errors surfaced meaningfully

***

**Implement in the order above** and ensure all tests pass and UI is responsive/reactive.}

## Phase 1 — Config + “Start On Boot” (App Launch Auto-Start)

* **Extend MCP config schema** to include per-server `start_on_boot: boolean` (default false) while remaining backward compatible.

  * Update parsing/normalization in [McpHostConfig.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfig.ts) so the field is preserved on load/save.

  * Ensure [McpInspectorService.saveConfig](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts) round-trips it (today it rewrites normalized JSON).

* **Add per-server “start on boot” toggle in Registry UI** that patches config and persists via existing save flow.

## Phase 2 — McpOrchestrator Becomes the Single Lifecycle API

* Expand orchestrator API (thin wrappers over Inspector) to match the internal spec:

  * `getServers()`, `getTools(serverId)`, `startServer(serverId)`, `stopServer(serverId)`, `ensureStarted(serverId)`, `handshake(serverId)`, `refreshTools(serverId)`, `callTool(serverId, tool, args)`.

* Expand runtime state to include:

  * `lastOkAt`, `initializedAt`, `initializeDurationMs`, `toolsListDurationMs`, `toolsCacheAt`, `toolsPending`, `lastError`, `startOnBoot`.

* Add **generation invalidation behavior**:

  * When Rust generation changes, clear cached tools and transition the runtime into a “needs refresh” state until tools/list completes.

* Implement **auto-start on app launch**:

  * After config load/reconcile, orchestrator runs `ensureStarted+handshake` for servers where `enabled && startOnBoot`.

  * Use a small concurrency limit and store per-server failures in runtime so UI/Chat can show actionable errors.

  * Trigger the same auto-start logic when config changes (so E2E can toggle without restarting app).

## Phase 3 — Registry UI: VS Code–Level Visibility

* In [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx):

  * Add **expand arrow** per server; on expand show **tool count badge** and **tool list (name + description)**.

  * Show **capabilities block** (type/protocol/framing, pid, generation, last handshake/ok time, last error).

  * Add **per-server actions**: Start/Stop/Restart, Refresh Tools, Retry on error.

  * Grey tool rows when server not READY.

  * Add **Tool Details modal** (schema + derived risk/permission) on tool click.

  * Add **Start on boot toggle** per server.

* Ensure tool list refresh is reactive:

  * UI subscribes to orchestrator snapshot; expand panel re-renders on `toolsHash/toolsCacheAt/generation/state`.

## Phase 4 — ToolExposureService: Policy-Driven, Not Hardcoded

* Keep namespacing format `serverId__toolName`, but enhance policy inputs:

  * Add optional per-server allow/deny lists in MCP config (minimal surface area):

    * `allowed_tools?: string[]` (original tool names)

    * `blocked_tools?: string[]`

  * Preserve existing trust gating, but add **explicit reasons** for any block (e.g. `unverified_knez_profile`, `blocked_by_config`, `server_not_ready`).

* Update exposure logic:

  * Catalog includes tools even when server not READY as “present but disabled” for UI; model-facing `toolsForModel` remains READY + allowed only.

  * Provide grouping helpers for Chat UI (by serverId/category/risk).

## Phase 5 — Chat UI: Tools Panel + Manual Invocation

* Extend Chat header tooling (currently “Available Tools” modal in [ChatPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/ChatPane.tsx)) into a VS Code–style panel:

  * Group tools by server; show server state + error; show permission status and risk.

  * Add “Refresh tools” and “Start server” quick actions from this panel.

* Add **Manual Tool Invocation** modal:

  * Select tool → show schema (and a JSON editor to start) → validate JSON → invoke via orchestrator.

  * Emit tool trace messages into chat history (same rendering path as AI tool calls).

  * For risky tools, require an explicit confirmation step.

* Improve tool-call UX in chat stream:

  * Ensure tool traces show `calling/succeeded/failed`, duration, and structured error code.

## Phase 6 — Telemetry + Error Taxonomy Completion

* Standardize error codes end-to-end:

  * `mcp_server_not_found`, `mcp_server_not_ready`, `mcp_not_started`, `mcp_not_initialized`, `mcp_timeout`, `mcp_tool_not_found`, `mcp_permission_denied`, `mcp_tool_execution_error`, `mcp_process_crashed`.

* Emit consistent events/logs:

  * `mcp_handshake_started/completed/failed`, `mcp_tools_updated`, `tool_call_started/completed/failed`.

* Ensure no silent failures:

  * Any tool denial or runtime failure produces a visible chat trace + registry error badge.

## Phase 7 — Testing & E2E Coverage

* **Unit tests**

  * Orchestrator: runtime projection, generation invalidation, auto-start decisioning, lifecycle wrappers.

  * ToolExposureService: namespace/normalize/filter + allow/deny lists.

  * KnezClient: tool support detection behavior.

  * ChatService: native tool\_calls + fallback JSON protocol + denial path.

* **Playwright E2E**

  * Registry: expand server → tools list visible; toggle start\_on\_boot and observe auto-start + tools populated.

  * Chat: run an end-to-end tool call loop by using a mock Knez `/v1/chat/completions` server that returns `tool_calls`, plus the existing mock HTTP MCP server; assert tool trace + final assistant response.

  * Permission: configure blocked tool and assert denial is surfaced.

## Deliverables (What You’ll See After This Phase)

* Registry shows each server with expandable tools, counts, status, errors, refresh, and start-on-boot.

* Chat has a real tools panel, manual invocation, and reliable AI tool-call loops for both native-support and fallback models.

* One canonical runtime store (orchestrator), no duplicate caches, and comprehensive telemetry.

If you confirm, I’ll start implementing Phase 1→7 in order, keeping changes small and continuously verified (unit tests + `npm run tauri build`).
