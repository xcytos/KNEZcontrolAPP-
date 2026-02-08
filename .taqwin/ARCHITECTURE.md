# Architecture

## Runtime Topology
- KNEZ Control App (Tauri + React) is the operator console.
- KNEZ backend (FastAPI) provides HTTP APIs for sessions, events, memory, and registry.
- TAQWIN MCP server (stdio JSON-RPC) provides tool surfaces to the desktop app.

## Key Flows
### Health
- Control App polls KNEZ `/health` and `/state/overview` for UI state.
- Logs are throttled; polling uses backoff and visibility-aware delays.

### Chat
- Control App stores chat messages locally and streams completions from KNEZ `/v1/chat/completions`.
- Stop/Retry/Edit actions map to queue control in ChatService.

### MCP Tools
- Desktop app spawns TAQWIN MCP via allowlisted script and config-driven command.
- Protocol is stdio JSON-RPC framed with Content-Length headers.
- Tools are surfaced in UI (TAQWIN Tools modal and MCP Registry view).

### Lineage / Resume
- KNEZ creates new sessions via resume/fork routes and records lineage in persistence.
- Control App renders lineage chain and can resume from the current head.

## ID Graph (serialization)
- session_id → messages → events → checkpoints(token_index, sha) → resume snapshots(snapshot_id)
- session_id → lineage(parent_session_id) → chain for UI breadcrumbs

