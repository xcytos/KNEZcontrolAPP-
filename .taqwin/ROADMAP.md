# Roadmap

## CP00_STABILIZE (Now)
Goal: stabilize observability, MCP reliability, and correctness of lineage + analysis surfaces.

Outputs:
- Health logs throttled and polling intervals sane.
- TAQWIN MCP started from JSON config; stdio handshake validated.
- MCP registry is available (no 404) and toggling works.
- Floating console exposes MCP logs and is accessible from Chat.
- Lineage panel reflects real parent chain.
- Memory/analysis surfaces no longer aggressive polling.

## CP01_MCP_REGISTRY (Next)
Goal: professional MCP connection model, registry truth-source, and tool-call auditing.

Outputs:
- Unified config schema, validation, and structured status/errors.
- Registry reflects real runtime state (enabled/disabled, last error, last success).
- Tool list/call latency and timeout budgets tracked.

## CP02_SESSION_MEMORY_ANALYSIS (After)
Goal: sessions, checkpoints, memory, and analysis unified via stable IDs and reachable from Chat.

Outputs:
- Every session has durable storage and can be analyzed on demand.
- Memory mesh links sessions ↔ events ↔ insights ↔ knowledge docs.
- UI provides a clean “flow”: Chat → Analyze → Memory → Replay → MCP Tools.

