## What’s Broken (Confirmed)

* Chat completions only send `{role, content}` and stream only `delta.content`, so the model never receives tool schemas and the client never executes a tool-call loop. Current “tools” behavior is limited to appending a `[SYSTEM: …]` text block for web search/extraction in [ChatService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ChatService.ts#L794-L919).

* Registry UI gets MCP registry config from `GET /mcp/registry` but runtime/tooling UI is split: inspector has tools in [McpInspectorService.getTools](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts#L256-L259), registry view mostly renders lifecycle/pid/errors.

* TAQWIN MCP tooling keeps its own tool cache and calls inspector directly in [TaqwinMcpService.callTool](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts#L556-L679).

## Architectural Guardrails (To Prevent Regression)

* Single runtime authority on frontend: **McpOrchestrator** is the only module allowed to read/write MCP runtime state and to perform MCP `tools/list` and `tools/call`.

* Inspector and Registry become **views** over orchestrator state.

* Single tools list per server at runtime: only orchestrator owns `tools[]` and its version/hash.

* Global tool identity is namespaced to prevent collisions: `toolName = ` ${serverId}\_\_${originalName}\`\`.

* Tool execution has deterministic telemetry + error taxonomy.

## 1) Implement McpOrchestrator (Canonical Runtime Store)

Create [src/mcp/McpOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/McpOrchestrator.ts) with:

* **State**: `servers: Record<serverId, ServerRuntime>`.

  * `ServerRuntime` includes: `serverId, enabled, type, tags, authority, state, pid, running, generation, framing, lastError, tools, toolsHash, toolsCacheAt, toolsPending`.

  * Note: Rust host currently supports only one stdio process at a time (single `proc` in `McpHostRuntime`), so orchestrator enforces that when `authority === "rust"`.

* **Inputs**:

  * Primary: subscribe to [McpInspectorService.subscribe](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts#L78-L81) for config + session lifecycle + cached tools.

  * Optional fast-path: consume `mcp://state` events (currently logged only in [rustEventBridge.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/rustEventBridge.ts)) to update `pid/state/generation` quickly when Rust authority is enabled.

* **API**:

  * `subscribe(listener): unsubscribe`

  * `getSnapshot(): { servers: Record<string, ServerRuntime> }`

  * `getServer(serverId)` and `getServerTools(serverId)`

  * `refreshTools(serverId)` (forces `tools/list`, updates `toolsHash/toolsCacheAt`)

  * `callTool(serverId, originalName, args, timeoutMs?)` (routes to underlying client and updates lastOk/lastError)

* **Authority discipline (key refinement)**:

  * Only orchestrator calls `mcpInspectorService.start/handshake/listTools/callTool`.

  * UI surfaces stop calling `mcpInspectorService` directly for runtime/tool data.

## 2) Remove Duplicate Tool Caches and Direct Inspector Calls

* Refactor [TaqwinMcpService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts) so it:

  * Does not maintain `toolsCache/toolsCacheAt` as an authority.

  * Delegates `listTools/callTool` to orchestrator for server `"taqwin"`.

  * Keeps only TAQWIN-specific governance/trust checks and KNEZ audit emission.

* Inspector UI becomes a view over orchestrator snapshot/tools/traffic (inspector can still exist, but it cannot be the canonical tool list).

## 3) Implement ToolExposureService (Reactive Aggregator + Policy)

Create [src/services/ToolExposureService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ToolExposureService.ts) with:

* Subscribes to orchestrator; rebuilds catalog on any runtime/tool change.

* Aggregates tools from READY servers.

* Produces **two outputs**:

  1. `getExposedToolsForModel(): Array<{ name, description, parameters }>` (OpenAI-compatible)
  2. `getCatalog(): Array<ExposedToolMeta>` including:

     * `name` (namespaced), `serverId`, `originalName`, `authority`, `riskLevel`, `permissions`, `category`, `schemaHash`.

* Policy enforcement (deterministic):

  * Reuse the existing trust gate from TAQWIN (e.g. blocking `web_intelligence/delete_file/...` when `knezClient.getProfile().trustLevel !== "verified"`).

  * Extend to a generic allowlist/denylist per `serverId` and `toolName`.

## 4) Extend KnezClient to Support Tools (Feature-Detected)

Update [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts) request/response typing and plumbing:

* Request optionally accepts `tools` and `tool_choice`.

* Response typing includes tool calls when backend supports it.

* Capability detection cached per backend profile:

  * Attempt a minimal non-stream request with `tools: []`.

  * If server rejects unknown fields or tool schema, mark `toolsUnsupported` and fall back.

## 5) Implement a Deterministic Tool-Call Loop in ChatService

Refactor [ChatService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ChatService.ts) delivery path into a small state machine:

* Build `toolsForModel` from `ToolExposureService`.

* If backend supports tools:

  * Send `{messages, tools}` using **non-stream** for the loop steps (simplifies partial tool\_calls parsing).

  * While model returns `tool_calls`:

    * Validate tool name exists and is allowed (via `ToolExposureService` metadata).

    * Decode `serverId/originalName` from namespaced tool name.

    * Execute via `McpOrchestrator.callTool`.

    * Append tool result as tool message (OpenAI-style tool role) and re-call.

  * Final assistant message can still be streamed (optional follow-up optimization).

* If backend does not support tools:

  * Use strict prompt-protocol fallback:

    * Model emits a JSON block specifying `{ tool: "server__name", arguments: {...} }`.

    * Client parses, validates, executes, appends result, continues until no request block.

## 6) UI Updates (Registry + Chat)

* Registry view [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx):

  * Source runtime state from orchestrator snapshot.

  * Render `toolsCached` count + small preview list of tool names per server.

  * Surface `generation/pid/lastError/state` consistently.

* Inspector panel [McpInspectorPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/inspector/McpInspectorPanel.tsx):

  * Replace direct reads of `mcpInspectorService.getTools/getTraffic/getStatusById` with orchestrator-backed data.

* Chat UI:

  * “Available tools” panel driven by `ToolExposureService.getCatalog()`.

  * Tool-call trace bubbles reuse `ChatMessage.toolCall` (already rendered in [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx#L144-L177)).

## 7) Telemetry + Error Taxonomy (Production Guardrails)

* Add a consistent tool execution trace in ChatService:

  * `tool_call_started / tool_call_completed / tool_call_failed` with `duration_ms`, `serverId`, `tool`, `allow/deny reason`.

* Normalize tool-call failures into explicit codes:

  * `mcp_server_not_ready`, `mcp_permission_denied`, `mcp_tool_not_found`, `mcp_tool_execution_error`, `mcp_transport_error`.

## 8) Tests (Unit + E2E)

* Unit:

  * MCP → OpenAI schema normalization (`inputSchema` to `parameters`).

  * Namespacing + routing (`serverId__tool` roundtrip).

  * Permission filtering.

* E2E (existing Tauri harness):

  * Start TAQWIN MCP, verify registry shows tools, run `debug_test` via tool loop (or prompt-fallback), verify trace + final assistant message.

<br />

## Acceptance Criteria

* Registry shows tool count + tool list per server (reactive, no refresh).

* Chat can execute at least one MCP tool end-to-end from model request.

* Only orchestrator owns runtime tool lists; no duplicate caches.

* Namespaced tools prevent collisions and route correctly.

* Works when MCP authority is Rust on desktop (and degrades safely when tools aren’t supported by backend).

