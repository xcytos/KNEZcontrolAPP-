# CP-MCP-TOOLS-LIST — Stabilization Record

Stamped: 2026-02-10

## What was broken

- tools/list could execute blocking work because `ToolRegistry.get_tool_definitions()` was allowed to:
  - import tool modules synchronously during listing when static defs were missing
  - instantiate tool classes and call `get_definition()` during listing
- This violated the hard rule that tools/list must be static and non-blocking.

Primary risk lines:

- Lazy-load import path: [ToolRegistry._load_lazy_tool](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L68-L96)
- Listing-time instantiation + get_definition: [ToolRegistry.get_tool_definitions](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L124-L140)

## Why it was broken

- The registry conflated two responsibilities:
  - registry introspection (safe, static)
  - tool instantiation/loading (potentially heavy, dynamic)
- Because tools/list is on the request loop event path, any synchronous import or constructor work can stall the MCP handshake and trigger client retries/restarts.

## How it was fixed

- tools/list now returns a pure in-memory snapshot built from static tool definitions:
  - Implemented `ToolRegistry.get_tools_list_snapshot()` which:
    - does not import modules
    - does not instantiate handlers
    - sorts deterministically
    - attaches metadata: `enabled`, `disabled_reason`, `tags`
  - Server now uses that snapshot from [handle_tools_list](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L181-L224)

- Enforcement:
  - Added `TAQWIN_DISABLED_TOOLS` env support:
    - tools/list marks tools disabled without blocking listing
    - tools/call rejects disabled tools before attempting lazy import

- Observability:
  - Added tools/list entry/exit events and a 50ms budget guard:
    - `mcp_tools_list_entry`, `mcp_tools_list_exit`, `mcp_tools_list_budget_exceeded`
  - Added `tools_list_profile` structured timing payload in `get_tool_definitions()` to catch regressions when legacy path is used for debugging.

## Evidence

- Audit report: [.taqwin/reports/mcp_tools_list_audit.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/reports/mcp_tools_list_audit.md)
- Verification (runtime):
  - `npm test` PASS (knez-control-app)
  - `npm run e2e:tauri` PASS (knez-control-app)
  - e2e log scan: no framing fallback, no MCP restarts, no initialize/tools/list timeouts

