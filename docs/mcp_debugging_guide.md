# MCP Debugging Guide (knez-control-app)

## Where To Look First

- Inspector traffic panel: requests/responses/raw stdout/stderr/parse errors.
- Server status row: `state`, `pid`, `framing`, `toolsCached`, `lastError`.
- TAQWIN runtime modal status line (TAQWIN-specific).

## Deterministic Ordering Checks

When debugging any server, confirm these appear in order:

1. `MCP request initialize`
2. `MCP notify initialized`
3. `MCP request tools/list`
4. `MCP request tools/call`

If `tools/call` appears before `tools/list`, the host is violating READY gating.

## Error Classifications You Should See

- `mcp_timeout_initialize`
- `mcp_timeout_tools_list`
- `mcp_timeout_tools_call`
- `mcp_server_no_tools`
- `mcp_duplicate_initialize`
- `mcp_tool_not_found:<name>`
- `mcp_not_ready`

## STDIO Framing Diagnosis

Symptoms:

- `initialize` times out but the process stays alive
- stdout shows logs but no JSON-RPC responses

What it means:

- The server and host likely disagree on request framing (Content-Length vs line).

What the host does:

- Request framing is locked per process.
- Initialize retries by restarting the server with the alternate framing.

## “Did tools/call reach the server?” (TAP mode)

Use the stdio tap wrapper to prove the exact `tools/call` request is crossing STDIN:

- Wrapper: [taqwin_stdio_tap.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/mcp/taqwin_stdio_tap.py)

Expected stderr line:

- `Received tools/call tool=<name> id=<id>`

Interpretation:

- Not printed: host never sent the request, or request framing was not parseable by the tap.
- Printed but no response: server handler blocked, crashed, or response was not flushed.

## HTTP/SSE Diagnosis

- If the server returns SSE, verify `Mcp-Session-Id` is being stored and sent back.
- If SSE events arrive without `id`, they are treated as notifications and must not resolve pending tool calls.

## Authority (TS vs Rust)

- `VITE_MCP_AUTHORITY=ts`: stdio uses TS spawn/stdio router.
- `VITE_MCP_AUTHORITY=rust`: stdio uses Rust commands; TS stdio spawning is disabled.

If you see two PIDs for the same server id, authority selection is misconfigured.

