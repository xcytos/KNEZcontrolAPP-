## Why `paramsKeys: Array(0)` isn’t wrong

* `tools/list` in MCP is a JSON-RPC request whose `params` are optional; pagination uses an optional `cursor`. Sending `{}` (or omitting `params`) is valid, so `paramsKeys: Array(0)` is expected when you don’t pass a cursor.

* If a server *requires* params for `tools/list`, that server is non-compliant; the reference host should still send spec-faithful requests (no invented params).

* In the reference app we’ll support `cursor` (and only `cursor`) for tools/list pagination; otherwise params are omitted.

## App Scope

* New standalone desktop app (Tauri + TypeScript) dedicated to MCP hosting + inspection.

* No Control App integration.

## Repo Layout

* Create a new folder at repo root (sibling to `knez-control-app`), e.g. `mcp-host-inspector/`.

* Tauri + Vite + React UI.

## Implementation Plan

### 1) Project bootstrap

* Scaffold a new Tauri app (frontend: React + TS).

* Add required Tauri plugins/permissions for `shell` spawn + stdin/stdout piping.

### 2) Config system (schema A + schema B)

* Implement `config/McpConfigNormalizer.ts`:

  * Accept both schemas.

  * Prefer `servers` when both exist.

  * Preserve `enabled`, `tags`, `env`.

  * Infer `cwd` from `main.py` path when missing.

  * Ignore unknown fields safely.

  * Output a canonical internal type: `NormalizedMcpConfig`.

* Implement `config/McpConfigLoader.ts`:

  * Load JSON from a user-selected path (file picker) OR a default path.

  * Display validation issues without blocking.

### 3) MCP core (stdio only)

* `mcp/McpTypes.ts`: JSON-RPC + MCP request/response shapes.

* `mcp/McpFraming.ts`: Content-Length encoder/decoder + line-delimited encoder/decoder.

* `mcp/McpStdioTransport.ts`:

  * Spawn via Tauri shell.

  * Capture raw stdout/stderr (byte + decoded text tails).

  * Parse messages using the chosen framing.

  * Track PID, exit code, close tail.

  * Implement request correlation by `id`.

* `mcp/McpLifecycle.ts`:

  * FSM: `IDLE → STARTING → INITIALIZED → LISTING_TOOLS → READY | ERROR`.

  * All transitions logged + visible.

* `mcp/McpClient.ts`:

  * One client instance per server.

  * `initialize` with 5s timeout.

  * Framing detection during initialize only:

    * Attempt Content-Length first.

    * If no valid response, retry initialize once using line framing (still within 5s total budget).

    * After initialize success, framing is locked.

  * `tools/list` with 60s timeout but **non-blocking UI**:

    * Start request; mark state as LISTING\_TOOLS.

    * UI remains usable; tools may populate when response arrives.

    * Timeout must NOT stop process / restart / flip framing.

  * `tools/call` with per-call timeout from UI.

  * Full traffic capture: request JSON, response JSON, timings, errors.

### 4) UI (Inspector)

* Left: `ServerList.tsx`

  * Shows servers (enabled/disabled), tags, start/stop/restart.

* Center: `ServerInspector.tsx`

  * Lifecycle state, running/stopped, PID, framing, durations, last error, stdout/stderr tail.

* Right: `ToolsPanel.tsx`

  * Tool list exactly as returned.

  * Tool selection, JSON args editor, per-call timeout control.

  * Execute tools/call; show request/response JSON + timing.

* Bottom/side: `LogsPanel.tsx`

  * Raw stdout (decoded), raw stderr.

  * Parsed MCP messages (requests/responses/notifications).

  * JSON-RPC errors.

### 5) Example config + README (as requested)

* Add `example-mcp-config.json` containing both schema examples.

* Add README explaining:

  * How to add servers.

  * How to start a server, list tools, call tools.

  * Known limitations.

  * Architecture notes: no retries, no auto-restart, no silent healing.

### 6) Verification (stop condition)

* Run the new desktop app.

* Load a config and start one MCP server.

* Confirm:

  * initialize succeeds (or fails visibly with raw logs).

  * tools/list is visible and does not block UI.

  * tools/call works with manual JSON input.

  * Logs show true raw + parsed MCP traffic.

