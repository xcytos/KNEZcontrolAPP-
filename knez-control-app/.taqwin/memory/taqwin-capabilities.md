# TAQWIN Capability Registry (CP12-9)

This registry reflects the TAQWIN_V1 folder on disk and the actual MCP server behavior.

## MCP Protocol Contract (TAQWIN_V1)

- Transport: STDIN/STDOUT JSON-RPC 2.0
- Framing:
  - Content-Length header mode (preferred)
  - Line-delimited JSON mode (fallback)
- Methods:
  - initialize
  - tools/list
  - tools/call
- tools/list response: `{ result: { tools: ToolDefinition[] } }`
- tools/call response: `{ result: { content: Array<{ type: "text"; text: string }> } }`
  - If a tool returns a dict, TAQWIN formats it as pretty-printed JSON string inside `content[0].text`.

## MCP Host Config Extensions (Control App)

The Control App MCP host must support both stdio servers (TAQWIN-style) and HTTP servers (remote MCP), with safe secret handling:
- STDIO servers: `command`, `args`, `env`, `cwd/working_directory`
- HTTP servers: `type: "http"`, `url`, `headers`
- Inputs: `${input:<id>}` substitution for `env` and `headers`, prompting at runtime for missing values (secrets must not be stored by default).

Reference: `.taqwin/memory/github-mcp-server.md`

## MCP Servers Present

### TAQWIN Core MCP Server (recommended)
- Entry: `TAQWIN_V1/core/mcp_server.py`
- Tools: full tool registry (listed below)

### TAQWIN Adapter MCP Server (limited)
- Entry: `TAQWIN_V1/taqwin/mcp_server.py`
- Tools: exposes a single `analyze` tool and is not the full registry

## Core Tool Registry (TAQWIN_V1/core/mcp_server.py)

### activate_taqwin_unified_consciousness
- Purpose: activate TAQWIN unified consciousness and optionally process a query.
- Key inputs:
  - `level`: basic|enhanced|full|quantum|superintelligence
  - `query` or `message`
  - `context` (object)
  - toggles: `enable_learning`, `enable_insights`, `enable_delegation`, `enable_council`, `enable_superintelligence`, `persistent_mode`, `memory_depth`
- Key outputs:
  - `taqwin_response` (string) when `query` is provided
  - `consciousness_state`, `system_status`, `capabilities`, `system_metrics`
- Risk: high

### get_server_status
- Purpose: system + database status snapshot.
- Key inputs: `force_refresh` (bool), `include_db_analysis` (bool)
- Key outputs: `status.server_overview`, `status.database_status`, `status.health_summary`
- Risk: low

### deploy_real_taqwin_council
- Purpose: deploy/consult/manage council agents.
- Key input: `action` (required), plus `session_id` for most operations.
- Common actions:
  - deploy | status | consult | dismiss
  - comprehensive_consult | enhanced_analysis | full_capability_deployment
  - learning_analysis | knowledge_evolution | share_knowledge | optimize_learning
- Risk: high

### session (bounded)
- Purpose: bounded wrapper over the Ultimate Session Tool.
- Allowed actions (required `action`):
  - session_start
  - session_attach
  - session_context_query
  - session_event_proposal
  - session_summary_request
  - session_close
- Common inputs: `session_id`, `name`, `type`, `description`, `tags`, `privacy_level`, `auto_record`, `query`, `event_type`, `event_data`, `observation`
- Risk: medium

### session_v2 (RAG/context)
- Purpose: session storage + retrieval + “LLM-ready context” bundle.
- Actions (required `action`):
  - create_session | record_event | list_sessions | analyze_session | continue_session
  - semantic_search | related_sessions
  - index_session | index_raw
  - get_llm_context | get_context_bundle
- Key inputs: `session_id`, `event_type`, `event_data`, `semantic_query`/`query`, `k`, `recent`, `include_retrieval`, `auto_index`
- Risk: medium

### scan_database
- Purpose: DB scan/query/integrity/export/monitoring.
- Actions include: scan_overview | schema_analysis | execute_query | search_content | analyze_integrity | linked_session_events
- Key inputs vary by action; `session_id` is required for linked_session_events.
- Risk: high

### web_intelligence
- Purpose: web retrieval/search/analysis/monitoring.
- Actions include: get_content | search_web | analyze_content | bulk_analyze | trend_analysis | dashboard_overview
- Key inputs: `url`, `query`, `urls`, `analysis_type`, `agent_context`
- Risk: high

### debug_test
- Purpose: debug tool that returns environment details.
- Key input: `message` (string)
- Risk: low

### connection_info
- Purpose: connection/protocol diagnostics.
- Key input: none
- Risk: low
