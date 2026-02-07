# TAQWIN Tools (CP12 Scan)

## MCP Servers

### TAQWIN Adapter MCP (`analyze`)
- Server: `TAQWIN_V1/taqwin/mcp_server.py`
- Tool: `analyze`
- Intent: bounded cognitive analysis routed through TAQWIN.
- Inputs (schema): `text`, `session_id`, optional `intent`, optional `correlation_id`.

### Full TAQWIN MCP Server (Tool Registry)
- Server: `TAQWIN_V1/core/mcp_server.py`
- Tools declared via lazy registry:
  - `activate_taqwin_unified_consciousness`
  - `get_server_status`
  - `deploy_real_taqwin_council`
  - `session`
  - `session_v2`
  - `scan_database`
  - `web_intelligence`
  - `debug_test`
  - `connection_info`

## Risk Classification (Control App Enforcement)
- Safe (default enabled):
  - `analyze`
  - `session`, `session_v2` (bounded to session context, still audited)
- Restricted (default disabled; requires explicit trust enable):
  - `web_intelligence` (network / external content)
  - `scan_database` (filesystem / internal data access)
  - `deploy_real_taqwin_council` (multi-agent execution)
  - `activate_taqwin_unified_consciousness` (broad behavior surface)
  - `debug_test`, `connection_info` (diagnostic surface)

## Tool Output Expectations
- All tool calls must be represented in UI as:
  - tool name
  - arguments (sanitized)
  - result or error
  - correlation id tied to a chat message
