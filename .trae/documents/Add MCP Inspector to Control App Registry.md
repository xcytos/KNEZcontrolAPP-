## Goal
- Add the full `mcp-host-inspector` “host + inspector” experience inside `knez-control-app`, under the existing **MCP Registry** screen, and wire it to the app’s MCP host (stdio) so any configured server can be inspected.

## What “Inspector Features” Means (port 1:1)
- Server list + selection (from local MCP host config)
- Lifecycle controls: Start / Stop / Restart / Initialize / tools/list
- Status panel: lifecycle state, pid, framing mode, timings, last error
- Output tails: stdout tail + stderr tail
- Tools explorer: searchable tool list, JSON args editor, per-call timeout, show request/response
- Logs: parsed traffic (request/response/parse_error) + raw stdout + raw stderr
- Config panel: raw JSON editor + normalize/validate issues surfaced inline

## Architecture Changes (Control App)
### 1) Add a reusable “inspector session” layer
- Create a new service (e.g. `src/mcp/inspector/McpInspectorService.ts`) that:
  - Loads local MCP host config via `mcpHostConfigService.load()`
  - Normalizes servers using existing `normalizeMcpConfig/parseMcpHostConfigJson` in `src/mcp/config/McpHostConfig.ts`
  - Keeps a `Map<serverId, McpStdioClient>` with per-server lifecycle + metrics
  - Exposes actions: `start/stop/restart/initialize/listTools/callTool`
  - Exposes derived state: `statusById`, selected server tools cache, timings
  - Supports `subscribe()` so UI rerenders like the inspector app

### 2) Port traffic model into `knez-control-app`
- Add `McpTrafficEvent` types (request/response/raw_stdout/raw_stderr/parse_error/process_closed) mirroring `mcp-host-inspector/src/mcp/McpTypes.ts`.
- Extend `src/mcp/client/McpStdioClient.ts` to store a capped in-memory traffic buffer (e.g. 800 events) and expose `getTraffic()`.
  - Emit events on: stdout chunk, stderr chunk, request send, parsed response, parse errors, close/error.
  - Keep existing `LogService` logging (so FloatingConsole MCP tab continues to work), but inspector UI reads from structured traffic.

### 3) Unify with the existing TAQWIN MCP host
- Refactor `src/mcp/taqwin/TaqwinMcpService.ts` to use the same underlying session manager used by the new inspector service (so there’s exactly one MCP process per serverId).
  - Result: TAQWIN Tools modal and MCP Registry Inspector show the same runtime/process and the same logs.

## UI Changes (Under MCP Registry)
### 1) Upgrade `McpRegistryView` into a tabbed page
- Keep current registry cards as the “Registry” tab (existing behavior unchanged).
- Add a new “Inspector” tab that mirrors the `mcp-host-inspector` 3-panel layout:
  - **Left:** Config editor + issues + server list
  - **Middle:** Status + action buttons + stdout/stderr tails
  - **Right:** Tools panel + Logs panel

### 2) Wire registry items to inspector selection
- When a user clicks a registry item id that exists in local config, offer an “Inspect” button that jumps to Inspector tab with that server selected.
- If a registry item has no local config entry, show “Not configured locally” + quick link to the config editor.

### 3) Reuse styling conventions
- Implement UI using the existing Tailwind patterns used by `McpRegistryView.tsx` / `TaqwinToolsModal.tsx` (no inline styles), keeping the app’s design consistent.

## Handling the `/mcp/registry/report` 405
- Keep the runtime report call as “best-effort”: if backend returns 404/405, cache “unsupported” and stop retrying.
- Do not treat it as an MCP failure in the inspector UI.

## Verification
- Add unit tests for:
  - Traffic buffer capture (request/response + raw stderr/stdout)
  - `tools/list` request shape (no params when no cursor)
- Run `npm test` and `npm run e2e:tauri` to confirm end-to-end TAQWIN MCP + inspector UI doesn’t break existing flows.

## Deliverables (Files You’ll See Added/Changed)
- New: `src/mcp/inspector/*` (service + types)
- Update: `src/mcp/client/McpStdioClient.ts` (traffic capture + getters)
- Update: `src/mcp/taqwin/TaqwinMcpService.ts` (use shared session manager)
- Update: `src/features/mcp/McpRegistryView.tsx` (tabs + Inspector UI)
- New UI components: `src/features/mcp/inspector/*` (ServerList/Inspector/Tools/Logs panels)
- Tests under `tests/unit/*` for the new inspector plumbing
