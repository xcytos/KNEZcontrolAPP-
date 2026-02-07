# TAQWIN Capability Registry (CP12-9)

## MCP Adapter

### analyze
- Description: bounded TAQWIN cognitive analysis routed through TAQWIN.
- Input: `{ text: string, session_id: string, intent?: string, correlation_id?: string }`
- Output: TAQWIN response envelope (observations, proposals, errors).
- Risk: low/medium (content processing, no direct filesystem/network required by contract).

## Full TAQWIN MCP Server (Tool Registry)

### activate_taqwin_unified_consciousness
- Description: activate/query TAQWIN consciousness.
- Input: object (varies by handler).
- Output: TAQWIN response fields (implementation-defined).
- Risk: high (broad behavioral surface).

### get_server_status
- Description: comprehensive TAQWIN server status.
- Input: object.
- Output: status payload.
- Risk: low.

### deploy_real_taqwin_council
- Description: deploy/manage TAQWIN council agents.
- Input: object (actions/agents/session config).
- Output: deployment result payload.
- Risk: high (multi-agent execution).

### session
- Description: session operations (create/list/analyze/continue).
- Input: object (handler-defined).
- Output: session result payload.
- Risk: medium.

### session_v2
- Description: v2 session management (RAG/LLM-context oriented).
- Input: object (handler-defined).
- Output: v2 session payload.
- Risk: medium.

### scan_database
- Description: database scanning and analysis.
- Input: object (handler-defined).
- Output: scan results.
- Risk: high (filesystem/internal data access).

### web_intelligence
- Description: web intelligence access and analysis.
- Input: object (handler-defined).
- Output: extracted intelligence payload.
- Risk: high (network/external content).

### debug_test
- Description: debug test tool.
- Input: object.
- Output: debug payload.
- Risk: medium.

### connection_info
- Description: debug connection information.
- Input: object.
- Output: connection details.
- Risk: medium.
