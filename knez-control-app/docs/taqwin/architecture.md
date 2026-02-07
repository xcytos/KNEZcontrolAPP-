# TAQWIN Architecture (CP12 Scan)

## Scope
- This scan targets `TAQWIN_V1` in the monorepo workspace and the “v2” session tooling inside it (e.g. `tools/sessions_v2`, `data_v2`).
- Two MCP server entrypoints exist: a single-tool adapter (`analyze`) and a full tool-registry server.

## Top-Level Layout
- `TAQWIN_V1/core/` — MCP server core, tool registry, response handler.
- `TAQWIN_V1/taqwin/` — TAQWIN “app” layer, policies, MCP adapter server.
- `TAQWIN_V1/tools/` — tool implementations (sessions, sessions_v2, web_intelligence, database, consciousness, council, etc.).
- `TAQWIN_V1/data_v2/` — v2 session database storage.
- `TAQWIN_V1/tools/sessions_v2/` — v2 session tool handler + supporting modules.

## MCP Surface

### Full MCP Server (Tool Registry)
- Entry: `TAQWIN_V1/core/mcp_server.py`
- Model: registers multiple tools via `ToolRegistry.register_lazy_tool()` and returns their static definitions in `tools/list`.
- Execution: tool call routing flows through `ToolRegistry.execute_tool()` (lazy loads tool handlers).

### MCP Adapter (Single Tool)
- Entry: `TAQWIN_V1/taqwin/mcp_server.py`
- Exposes one tool: `analyze`
- Purpose: bounded analysis routed through TAQWIN server logic (`taqwin.server.analyze_request`) and emits structured events.

## Tool Registry Mechanics
- `TAQWIN_V1/core/tool_registry.py` provides:
  - lazy registration (module+class names)
  - cached tool definitions for `tools/list`
  - runtime tool loading + execution

## Sessions “v2” Notes
- TAQWIN “v2” is present as session tooling within TAQWIN_V1:
  - `tools/sessions_v2/*`
  - `data_v2/*`
- This is the most direct match to the “TAQWIN_v2” requirement in PROMPT-012.

## Contract + Trust Boundaries (TAQWIN ↔ KNEZ ↔ Control App)

### Current KNEZ Behavior
- KNEZ exposes a TAQWIN adapter endpoint that ingests TAQWIN outputs:
  - `POST /taqwin/events` validates payload and emits canonical KNEZ events.
- KNEZ MCP registry endpoints exist but are currently stubbed (404).

### CP12 Intended Integration (Control App First)
- Control App acts as the MCP client for TAQWIN:
  - starts/attaches to TAQWIN MCP server locally (Tauri-side process)
  - calls TAQWIN tools directly via MCP (`tools/list`, `tools/call`)
  - renders tool calls inline in the chat timeline
- Observability bridge (optional):
  - Control App may mirror “tool invoked / tool result” into KNEZ via `/taqwin/events` for event logging.

### Trust Levels
- Default: safe-mode allowlist (only bounded tools enabled).
- Anything that can touch filesystem/network (e.g. `web_intelligence`, `scan_database`) must remain disabled until explicitly enabled and clearly shown to the operator.
