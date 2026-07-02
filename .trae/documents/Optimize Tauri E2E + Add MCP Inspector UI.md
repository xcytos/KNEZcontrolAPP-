## Findings (Why it behaves like this)
- Your Playwright harness connects to the app via CDP and calls `closeTauri()`, but that only closes the Playwright CDP connection; it does **not** close the actual Tauri main window. The test-window helpers only close windows whose label starts with `test-`/`e2e-`.
  - Playwright helper: [tauri.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/tauri.ts#L149-L219)
  - Tauri commands: [lib.rs](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/src/lib.rs#L45-L96)

- MCP “inspector UI not visible” is expected right now: `knez-control-app` has only the registry cards + a “Test” button ([McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx)), and the inspector panels haven’t been added under the registry yet.

## Implementation Plan
### 1) Make Playwright E2E always close the Tauri window
- Add a new Tauri invoke command like `close_main_window` (or `exit_app`) in [lib.rs](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/src/lib.rs) that closes the `main` webview window.
- Update Playwright helper `closeTauri()` to call that invoke when running under CDP mode (best-effort), then close the CDP browser.
- Update `spawn-and-run.js` so the “reuse existing desktop app” path also shuts down the running app after Playwright completes (either by invoking the new command or by killing `knez-control-app.exe` as a last-resort).

### 2) Optimize the Playwright run (less flake, faster feedback)
- Reduce unnecessary sleeps (e.g. `afterEach` fixed 600ms) and replace with explicit waits for UI selectors.
- Make page selection more deterministic in [tauri.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/tauri.ts) (prefer the main window when only one page exists; otherwise pick by `__TAURI__` and URL once).
- Disable unused tracing (currently `trace: on-first-retry` but retries=0) in [playwright.tauri.config.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/playwright.tauri.config.ts).

### 3) Add a Puppeteer “live test” runner (optional debugging tool)
- Add `tests/tauri-e2e/puppeteer-live.js` that:
  - Connects to `TAURI_CDP_URL` via `puppeteer-core`
  - Finds the Tauri page
  - Runs the same core clicks as Playwright (Chat → TAQWIN Tools → MCP Config → Auto-detect → Save → open MCP modal)
  - Captures console logs + screenshots to a folder for quick inspection
- Add an npm script `e2e:tauri:puppeteer` to run it.

### 4) Implement MCP Inspector UI under MCP Registry
- Extend [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx) into tabs: **Registry** (existing cards) + **Inspector**.
- Create inspector UI components (ported from `mcp-host-inspector`) under `src/features/mcp/inspector/`:
  - Server list + selection
  - Status/actions panel (start/stop/restart/initialize/tools-list)
  - Tools explorer (search + args editor + tools/call)
  - Logs panel showing structured traffic + stdout/stderr
- Wire UI to the shared session layer (`mcpInspectorService`) so it inspects the same processes used by TAQWIN MCP.

### 5) Fix “MCP not connected” from the Inspector tab
- Ensure the Inspector tab triggers `mcpInspectorService.loadConfig()` on mount.
- Ensure selecting a server and clicking Start/Initialize uses the same stdio client session used by TAQWIN.

### 6) Build, then Git commit and push
- Run `npm run build` (and `npm run tauri build` if you want desktop packaging verification).
- Run `npm test` and `npm run e2e:tauri`.
- Create a git commit with a clear message and push to the configured remote/branch.

## Deliverables
- E2E: main window closes after tests, even on reuse
- New: MCP Registry → Inspector tab with full inspector features (servers/tools/logs)
- New: optional Puppeteer live runner
- Verified builds + tests; committed and pushed