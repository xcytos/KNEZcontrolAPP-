# Ticket Set: MCP Reliability + Chat Terminal UX (Control App)

## Context / Problem Statement
Observed runtime logs show:
- `[mcp] MCP process started` then `[mcp] MCP request ... method=initialize` with no response, followed by timeouts/restarts.
- `shell.execute not allowed` indicates Tauri capabilities did not allow executing commands needed by MCP tooling/UI flows.

This ticket set hardens the MCP client handshake, fixes Tauri permissions, and improves the Chat page UX with an embedded terminal that supports directory selection and command execution.

## How MCP Works (Runtime)
- The Control App starts an MCP server process (TAQWIN) using the Tauri shell plugin.
- The client must perform JSON-RPC handshake:
  1. `initialize` request (client → server)
  2. server returns `initialize` result
  3. client sends `notifications/initialized`
  4. client can call `tools/list`, `tools/call`, etc.
- MCP framing matters:
  - Some servers expect Content-Length framed JSON-RPC payloads.
  - If the client sends newline-delimited JSON but the server expects Content-Length, the server will not parse the request → no stdout response → request timeout.

## Ticket Breakdown

### TICKET 01 — Tauri Shell Permissions (Execute/Spawn)
**Goal**
- Ensure all required shell operations for MCP + tooling work in the desktop app.

**Reasoning**
- MCP tooling and some UX flows use `Command.execute()` and `Command.spawn()`; Tauri requires explicit capability permissions for both.

**Implementation**
- Add `shell:allow-execute` allowlist in `src-tauri/capabilities/default.json` mirroring the existing `shell:allow-spawn` allowlist.

**Acceptance**
- No `shell.execute not allowed` errors during MCP config auto-detect, MCP start, or terminal actions.

**Verification**
- Build Tauri dev and run MCP tools; validate no permission denial in logs.

---

### TICKET 02 — MCP Initialize Reliability (Framing + Retry)
**Goal**
- Make MCP `initialize` robust against framing mismatches and dead-start stalls.

**Reasoning**
- Timeouts at `initialize` commonly indicate a framing mismatch or server not flushing stdout.

**Implementation**
- Default request framing to `content-length` unless explicitly overridden.
- If `initialize` times out with `stdoutBytes==0`, automatically flip framing and retry once.
- Enrich timeout error messages with method/framing/pid context.

**Acceptance**
- `initialize` succeeds reliably and is followed by `notifications/initialized`.
- Logs contain actionable details on failures (method, pid, framing, last stdout/stderr tail).

**Verification**
- Run `Self-Test` in UI and confirm `tools/list` + `get_server_status` succeed.

---

### TICKET 03 — Chat Page: Chat/Terminal Mode Switch
**Goal**
- Add an in-chat switch to toggle between chat messages and an embedded terminal inside the Chat page.

**Reasoning**
- Developers/operators need to run local commands while staying in the same workflow context as chat.

**Implementation**
- Add a segmented toggle (`Chat` / `Terminal`) in the Chat header.
- When `Terminal` is active, render the terminal pane and hide the message list + composer (without breaking chat state).

**Acceptance**
- Toggle switches views instantly without losing chat state.
- Chat continues to work normally when switched back.

**Verification**
- Unit test renders terminal controls; manual UI check in desktop app.

---

### TICKET 04 — Embedded Terminal: Directory Selection + Command Execution
**Goal**
- Allow selecting a working directory and running commands from the embedded terminal.

**Reasoning**
- Many workflows require switching cwd for correct execution.

**Implementation**
- Provide directory selection using a Windows FolderBrowserDialog invoked via PowerShell (`-STA`) through Tauri shell.
- Execute PowerShell commands with optional `cwd`, stream stdout/stderr, support Stop/Clear.

**Acceptance**
- Directory picker sets cwd and is reflected in the terminal output.
- Commands run and stream output; Stop terminates long running commands.

**Verification**
- Manual run: select folder, run `Get-Location` and confirm it matches.

---

### TICKET 05 — E2E: Playwright + Tauri Execution + Better Logs
**Goal**
- Reduce flakiness and improve failure observability in Tauri Playwright runs.

**Reasoning**
- CDP port open does not guarantee the CDP JSON endpoints are ready.
- Console logs should include MCP/KNEZ signals and permission/timeouts to debug failures quickly.

**Implementation**
- Wait for CDP JSON readiness (`/json/version` or `/json/list`).
- Capture relevant console lines (MCP/KNEZ/permission/timeouts) in Playwright diagnostics.

**Acceptance**
- E2E runner is stable and produces actionable logs on failure.

**Verification**
- Run `npm run e2e:tauri` and confirm PASS.

## Execution Checklist (Dev → Verify → Git)
- Run `npm test` (unit tests)
- Run `npm run build` (typecheck + prod build)
- Run `npm run e2e:tauri` (desktop E2E)
- Stage changes (exclude unrelated submodules/dirty work)
- Commit with message: `mcp: fix permissions + stabilize initialize; chat: add embedded terminal`
- Push to `origin/master`

