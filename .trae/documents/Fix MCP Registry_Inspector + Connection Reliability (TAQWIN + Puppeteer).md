## Root Causes From Your Logs

* **`Enabled ... but failed to start: mcp_config_missing_command`** **for every server** happens when the UI saves an invalid shape (e.g. pasting `{ "mcpServers": {...} }` into “Add Server”). The current “Add Server” merges the pasted JSON as *server entries*, so `mcpServers` becomes a server id and its value has no `command`, so start fails. Relevant: [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx), [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts).

* **`Method not found: shutdown`** is emitted by servers that don’t implement MCP `shutdown` (TAQWIN and Puppeteer in your log). Stop already succeeds because shutdown errors are caught, but the traffic/log line is confusing. Relevant: [McpStdioClient.stop](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts#L225-L267).

* **Puppeteer initialize timeouts**: `npx -y @modelcontextprotocol/server-puppeteer` often takes a long time on first run (download/install). Your log shows `initialize` timed out twice with content-length, then finally succeeded with **line framing**, but took \~34s overall. Relevant: [McpStdioClient.initialize](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts).

* **Inspector “does everything by itself”** is mostly from the Registry “Test” action, which runs a TAQWIN self-test that internally performs start→initialize→tools/list. Relevant: [runTaqwinMcpSelfTest.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/registry/runTaqwinMcpSelfTest.ts).

## Goals (What Will Be Fixed)

* Show a **correct MCP registry** (local config + knez snapshot), without spamming start failures.

* Add a **real “Add Server”** flow that accepts:

  * full config JSON `{ schema_version, servers }` or legacy `{ mcpServers }`

  * server map `{ "taqwin": {command,...}, "Puppeteer": {...} }`

  * single server object `{ command,... }` (will require an id)

* Add **Edit** + **Save** workflow for MCP config (easy access from registry).

* Add **Restart** buttons (registry cards + inspector) with a predictable handshake option.

* Remove the **Test** UI (or move behind a debug toggle), per your request.

* Improve MCP connection reliability (especially Puppeteer): framing selection + timeouts + clearer errors.

## Implementation Plan

### 1) Fix Config Import/Save and Validation (Stops `mcp_config_missing_command` spam)

* Update “Add Server” to detect and unwrap:

  * `{ mcpServers: {...} }` → treat as server map

  * `{ servers: {...} }` → treat as server map

  * `{ schema_version, inputs, servers }` → treat as full config

* Validate each added/edited server before saving:

  * For stdio: require `command` and `args` array

  * For http: require `url`

  * If validation fails: show per-server errors and **do not auto-start**.

* Ensure save writes canonical `{ schema_version, inputs, servers }` and doesn’t allow “save-able but unstartable” configs.
  Files to change:

* [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx)

* [McpInspectorService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts)

* (Possibly) [McpHostConfig.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfig.ts)

### 2) Registry UI: Correct MCP Registry + Edit + Restart + Remove Test

* Add **Edit** button on each local\_config server card:

  * to opens the config added and can edit and save it 

  * selects that server

  * opens config editor section

* Add **Restart** button on each local\_config server card:

  * runs `stop → start` (existing `restart`)

  * add optional “Restart + Handshake” that does `restart → initialize → tools/list`.

* Remove the Registry “Test” button and TAQWIN self-test trigger.
  Files to change:

* [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx)

* [McpInspectorPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/inspector/McpInspectorPanel.tsx)

### 3) Inspector UX: Make Start/Initialize Behavior Explicit

* Ensure “Start” only spawns and never auto-initializes.

* Add a single “Handshake” button (one-click): `start (if needed) → initialize → tools/list`.

* Improve error display:

  * show missing command/url errors inline

  * show last stderr tail + framing + protocol in a compact status row.
    Files to change:

* [McpInspectorPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/inspector/McpInspectorPanel.tsx)

* [McpInspectorService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts)

### 4) Connection Reliability Fixes (Puppeteer + Shutdown Noise)

* **Puppeteer / npx servers**:

  * Prefer **line framing first** when command is `npx` (or when args contain `@modelcontextprotocol/`).

  * Increase initialize timeout for `npx` servers (e.g. 60s) to handle first-time installs.

  * Make initialize duration logging per-attempt (so it doesn’t show 34s as a single “attempt”).

* **Shutdown**:

  * Keep best-effort `shutdown`, but downgrade “method not found” on shutdown to non-error traffic (still visible, but not scary).
    Files to change:

* [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts)

* (If needed) [McpTraffic.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpTraffic.ts)

### 5) Verification (So We Don’t Regress)

* Add/extend unit tests for:

  * Add Server accepts `{mcpServers}`, `{servers}`, full config, map, single server

  * Validation blocks auto-start when `command` missing

  * `npx` servers prefer line framing and use longer initialize timeout

* Run `npm test` and `npm run build`.

* (Optional) Extend Playwright/Tauri test to confirm handshake ordering and restart behavior.

## Deliverables After Execution

* Registry page that correctly shows local MCP servers + status, with Edit/Restart, no Test.

* Add Server that accepts your provided JSON formats and saves correct config.

* Inspector with a single, predictable handshake flow.

* Fewer false “errors” (shutdown method-not-found) and Puppeteer connects reliably on first run.

* inspector should run overall steps of a mcp host+ client when clicked on start after adding a config , successfully , it should show the error on why it is stopped , if fails with detailed error.

