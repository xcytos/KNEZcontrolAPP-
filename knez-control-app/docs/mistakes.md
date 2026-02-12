# MCP Mistakes Postmortem (knez-control-app)

## What Broke

- `initialize` looked “successful”, but subsequent calls timed out or behaved nondeterministically.
- `tools/call` was sometimes sent before the host had confirmed any tools existed.
- STDIO framing could change after the first request, which can desynchronize servers that lock framing.

## Why It Timed Out Instead Of Error

- JSON-RPC over STDIO has no “connection error” channel once the process is alive; if the server stops responding or is blocked, the host just waits until timeout.
- If the server never reads the request correctly (framing mismatch) or blocks inside tool logic, the host sees a timeout rather than a structured JSON-RPC error.

## Root Causes (Real Issues)

### 1) Missing `notifications/initialized`

- The host was sending `initialize` but did not send `notifications/initialized` after a successful initialize response.
- Some MCP servers proceed only after receiving this notification, so the session can stall before tool discovery.

### 2) `tools/call` before `tools/list` verified tools

- The host could call `tools/call` (including “canary” calls) without proving tool discovery succeeded.
- When `tools/list` returned empty or never completed, `tools/call` could hang or time out with no actionable error.

### 3) Framing changes mid-session

- Request framing could flip between Content-Length and line-delimited JSON after the first request.
- Servers may “lock” framing based on the first request; switching later can cause silent parse failures and timeouts.

## Correct Handshake Contract (Invariant)

- `initialize` must complete successfully.
- Immediately send `notifications/initialized` (no id).
- Immediately call `tools/list` and confirm tools are non-empty.
- Only then allow any `tools/call`.

## What We Changed In This Repo

- Enforced `initialize` → `notifications/initialized` order in the inspector initialization flow.
- Prevented `tools/call` unless `tools/list` has succeeded and the tool name exists in the cached list.
- Locked STDIO request framing for the lifetime of a spawned process.
- If handshake fails with the preferred framing, restarted the process and retried with alternate framing.
- Added `protocolVersion` fallback for initialize (`"2024-11-05"` then `"1.0"`).
- Added explicit MCP runtime authority selection (`ts` vs `rust`) to avoid dual-runtime conflicts.

## Advanced Debugging: “Did tools/call even reach the server?”

When you need proof of the exact request flowing over STDIN:

- Use the stdio tap wrapper: [taqwin_stdio_tap.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/mcp/taqwin_stdio_tap.py)
- Configure the MCP server as a stdio server that runs the wrapper and points at the real TAQWIN entrypoint.

Example (conceptual shape):

- command: python.exe
- args:
  - -u
  - <path-to-knez-control-app>/src-tauri/mcp/taqwin_stdio_tap.py
  - --target
  - <path-to-TAQWIN_V1>/main.py
  - --cwd
  - <path-to-TAQWIN_V1>

What you should see:

- On every `tools/call`, stderr prints: `Received tools/call tool=<name> id=<id>`
- If that never appears, the host is not sending the request.
- If it appears but no response arrives, the server is blocked, crashed, or not flushing responses.

## Operational Checklist

- If `initialize` succeeds but `tools/list` times out:
  - check KNEZ health if the server depends on it
  - check MCP stderr tail for tracebacks
  - increase tools/list timeout for large registries
- If `tools/list` returns empty:
  - treat it as “server has no tools” and surface `mcp_server_no_tools`
  - verify the server is actually registering tools
- If `tools/call` times out:
  - confirm the request exists in the Inspector traffic
  - use the tap wrapper to prove the exact request is flowing
  - isolate whether the server is blocked in tool execution vs not parsing the request
