## Goals

* Make the MCP handshake deterministic and spec-correct: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`.

* Prevent “silent timeouts” caused by calling tools before discovery, or switching framing mid-session.

* Add a postmortem doc (`mistakes.md`) explaining what was failing and how we fixed it.

## Root Causes (mapped to your 3 issues)

* **Missing** **`notifications/initialized`**: we implement it but never send it, so some servers can stall after `initialize`.

* **Calling** **`tools/call`** **before tools exist**: `TaqwinMcpService` currently fires a canary `debug_test` right after `initialize`, before `tools/list` succeeds.

* **Framing changes mid-session**: the STDIO client can flip between `content-length` and `line` after the first request; some servers “lock” framing based on the first request.

## Implementation (in the exact order you requested)

### 1) Always send `notifications/initialized` after `initialize` succeeds

* **Change** [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts):

  * Add a single “handshake” entrypoint that:

    1. sends `initialize` and waits for response
    2. immediately sends `notifications/initialized` (no `id`)

  * Ensure this happens only once per spawned process.

### 2) Immediately call `tools/list` and require non-empty tools before any `tools/call`

* **Change** [McpInspectorService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts):

  * Add a `handshake(serverId)` routine (or extend existing `initialize(serverId)`), so the “official session ready” path becomes:

    * `initialize` → `notifications/initialized` → `tools/list`

  * Store the tools snapshot on the session object.

* **Change** [TaqwinMcpService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts):

  * Remove/relocate the current post-initialize canary call to happen **only after tools/list succeeds**.

  * Add a hard gate in `callTool()`:

    * if tools are not trusted / not cached, force `listTools({ waitForResult: true })` first

    * if the tools list is empty, throw a clear error (`mcp_no_tools_after_list`) instead of hanging.

### 3) Lock request framing for the lifetime of the process (no mid-session switching)

* **Change** [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts):

  * Introduce a “session framing lock” after the first request is written.

  * Stop auto-switching `requestFraming` inside `initialize()` and `tools/list` after the first request.

  * If the chosen framing fails during handshake:

    * stop the child process

    * restart with the alternate framing

    * re-run the handshake

  * Keep response parsing flexible (still accept both framings), but don’t change **request** framing after handshake.

<br />

implement this in the repo.

## 1) Patch handshake correctness (fast, low-risk)

* Send notifications/initialized immediately after a successful initialize response.
* Make initialize() respect configured framing preference first, then fallback.
* Add graceful shutdown: send shutdown request + exit notification on stop (best-effort).

## 2) Add protocol/version compatibility layer

* If initialize fails with version-related errors, retry with "1.0" (opt-in or automatic fallback).
* Record negotiated protocol + framing in debug state/inspector.

## 3) Introduce a Rust-native MCP host core (governance-first)

* Add a Tauri-side “MCP Host Runtime” module that:
  * spawns processes
  * owns stdin/stdout parsing and request routing
  * emits traffic events to frontend
  * exposes commands: start/stop/restart/listTools/callTool/getStatus
* Keep current TS client as a fallback while migrating server-by-server.

## 4) Validation (so we know handshakes are truly fixed)

* Extend existing Playwright Tauri E2E to assert:
  * initialize → notifications/initialized → tools/list works
  * stop triggers shutdown flow without leaving pending requests
* Add a “stdio framing torture” test using TAQWIN\_V1 (line + content-length modes).

## TAQWIN\_V1 Advanced Debug Instrumentation (your suggested method)

* **Change** [TAQWIN\_V1/core/mcp\_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py):

  * Add an explicit, flushed log/event at the start of `tools/call` handling (before executing tool) so we can distinguish:

    * “method not matched” (no log)

    * “response path broken” (log prints but no response)

    * “tool handler blocking” (log prints, then hangs)

  * Prefer existing structured emit/logger patterns over raw `print`, but ensure flush semantics.

## Documentation Side Quest: mistakes.md

* **Add** `docs/mistakes.md` (or `docs/mcp/mistakes.md` if you prefer grouping) containing:

  * What was failing (missing initialized notif, premature tools/call, framing flips)

  * Why timeouts happened instead of errors

  * The corrected handshake contract and lifecycle invariants

  * A quick operator checklist (what to inspect in logs/traffic)

## Verification (execute after code changes)

* Run unit tests (existing suite) and ensure MCP config parsing tests still pass.

* Run the existing Tauri Playwright test flow for TAQWIN MCP and extend assertions to validate:

  * handshake order observed in inspector traffic

  * tools/list returns >0 before any tools/call

  * stop triggers best-effort shutdown without leaving pending requests

## Deliverables

* Deterministic MCP handshake and gating in the host runtime.

* No mid-session framing changes; handshake retries restart the process instead.

* TAQWIN server-side entry logging for tools/call.

* `mistakes.md` postmortem documenting what broke and why.

