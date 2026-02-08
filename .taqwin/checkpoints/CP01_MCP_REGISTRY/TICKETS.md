# CP01_MCP_REGISTRY — Ticket Set (15)

## CP01 Goal
Unify MCP configuration, runtime registry truth, and tool-call auditing with clear error taxonomy and low-latency behavior.

---

## CP01-T01 — Define MCP registry schema (versioned)
Acceptance Criteria:
- JSON schema version field (e.g., `schema_version`).
- Supports `command`, `args`, `env`, `working_directory`, `enabled`, `tags`.

## CP01-T02 — Add config validation and human-readable errors
Acceptance Criteria:
- Invalid config reports a single actionable error message in UI logs.

## CP01-T03 — Add per-MCP runtime status fields (last_seen, last_ok, last_error)
Acceptance Criteria:
- UI shows timestamps and last error without guessing.

## CP01-T04 — Implement tool list caching with freshness and invalidation
Acceptance Criteria:
- `tools/list` cached for configurable TTL; invalidated on process restart/toggle.

## CP01-T05 — Implement MCP process supervisor (restart policy)
Acceptance Criteria:
- Controlled restart on `mcp_process_closed_*` and on timeouts.
- Backoff prevents restart loops.

## CP01-T06 — Enforce protocol framing invariants
Acceptance Criteria:
- Client accepts only Content-Length framed messages.
- Server side ensures Content-Length responses for MCP requests.

## CP01-T07 — Unify error taxonomy across UI + backend
Acceptance Criteria:
- Canonical error codes: `mcp_not_started`, `mcp_process_closed`, `mcp_request_timeout`, `mcp_config_invalid`, `mcp_permission_denied`.
- UI maps codes to operator-friendly strings.

## CP01-T08 — Add `tools/call` audit log with duration and result size
Acceptance Criteria:
- Every call records: tool name, duration_ms, ok/error, bytes.
- Visible in Logs and export bundle.

## CP01-T09 — Add MCP connectivity test button in MCP Registry view
Acceptance Criteria:
- One-click runs initialize + tools/list and displays outcome.

## CP01-T10 — Make MCP registry view resizable/expandable
Acceptance Criteria:
- Can expand to full width; details section scrolls independently.

## CP01-T11 — Persist MCP registry state in durable storage
Acceptance Criteria:
- Enable/disable persists across server restarts.

## CP01-T12 — Add server-side endpoint to expose resolved config for an item
Acceptance Criteria:
- `GET /mcp/registry/{id}` returns resolved fields (with secrets redacted).

## CP01-T13 — Add per-item “connect via config” path for desktop app
Acceptance Criteria:
- Desktop tool runner uses the same config item definition as registry.

## CP01-T14 — Add end-to-end tests for MCP registry + listTools + callTool
Acceptance Criteria:
- E2E asserts listTools returns tools and at least one call succeeds.

## CP01-T15 — Performance budget enforcement
Acceptance Criteria:
- `tools/list` p95 under 2s (local).
- Tool calls have timeouts per tool category.

