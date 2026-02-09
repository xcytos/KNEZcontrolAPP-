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

## CP03_MCP_CLIENT_CORE (Next)
Goal: production-grade MCP client core used by UI, chat, and tests.

Outputs:
- Unified MCP config schema with migration and one source-of-truth file.
- Robust TAQWIN V1 handshake: initialize → tools/list → tools/call.
- Compatibility shims for tool naming and framing mode.
- Safe process lifecycle (start/stop/restart) with backoff and diagnostics.
- Tool catalog cache with deterministic invalidation.
- Local tool-call audit records (duration, bytes, ok/error).

## CP04_MCP_UI_STATUS_AND_CONTROL (After)
Goal: all MCP controls reflect true runtime status (starting/running/error).

Outputs:
- Global MCP status store driving header, Tools modal, and chat controls.
- Stateful TAQWIN ACTIVATE surface with progress + failure visibility.
- Tools button shows MCP badge (running/down/error).
- MCP Health panel (pid, framing, last_ok, last_error, failures).
