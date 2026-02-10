# Robust Connection Runbook (Control App ⇄ KNEZ ⇄ TAQWIN)

Stamped: 2026-02-10

## Purpose
- Guarantee "no simulation": UI mirrors reality, KNEZ is the event truth, TAQWIN is the tool executor.
- Provide audit-grade observability: every tool call must be attributable and replayable.

## System Truth Sources
- KNEZ `/events`: session truth and replay source of record.
- KNEZ `/taqwin/events`: schema-strict ingest for TAQWIN observations/proposals.
- TAQWIN MCP: tool execution runtime; writes tool-traffic logs and respects governance enforcement.

## Trust & Identity
- KNEZ exposes `GET /identity` with:
  - `knez_instance_id` (stable per installation)
  - `fingerprint` (sha256 of instance id)
- Control App trust is VERIFIED only when:
  - fingerprint is fetched from `/identity`
  - fingerprint is pinned locally
  - pinned fingerprint matches on subsequent checks
- Any mismatch revokes trust immediately.

## Session Bootstrap Rule
- A session must exist in KNEZ before `/taqwin/events` will accept payloads.
- On first local session creation, Control App emits `ui_session_started` to KNEZ `/events`.

## Tool Call Audit Bridge
- Control App mirrors each MCP `tools/call` into KNEZ via `/taqwin/events` as:
  - `intent: "mcp_tool_call"`
  - observation type `mcp_tool_call`
  - required fields: `tool`, `tool_call_id`, `trace_id`, `ok`, `duration_ms`
  - redacted `args_preview`/`result_preview`
- KNEZ validates these observations and:
  - emits `mcp_tool_call_observed` (event log)
  - persists to `sessions.db` table `mcp_tool_calls`
  - exposes `GET /sessions/{session_id}/tools`
- KNEZ replay merges persisted tool calls into the replay timeline.

## MCP Registry Runtime Truth
- KNEZ `/mcp/registry` reflects:
  - config (enabled/disabled)
  - runtime truth (`running`, `pid`, `last_ok`, `last_error`)
- Control App reports runtime truth via localhost-only:
  - `POST /mcp/registry/report`

## Governance Snapshot & Drift
- KNEZ exposes `GET /governance/snapshot` returning:
  - `combined_sha256`
  - per-file sha256 for selected `.taqwin` artifacts
- Control App Governance panel shows:
  - remote hash
  - local hash (when local `.taqwin` is readable)
  - drift status

## Risky Tools Policy (Hard Gate)
- Risky tools include:
  - database scanning
  - web intelligence
- Must be blocked unless both conditions hold:
  1) KNEZ trustLevel is VERIFIED (fingerprint pinned + matches)
  2) governance snapshot is available (KNEZ `/governance/snapshot`)
- TAQWIN MCP server enforces this when:
  - `TAQWIN_GOVERNANCE_ENFORCE=1`
  - `TAQWIN_GOVERNANCE_SNAPSHOT_URL` is provided

## Operational Checklist
- Verify `/identity` reachable and fingerprint stable.
- Verify a new session emits `ui_session_started` into `/events`.
- Verify a tool call results in:
  - KNEZ event `mcp_tool_call_observed`
  - row in `sessions.db.mcp_tool_calls`
  - entry visible in `/sessions/{session_id}/tools`
- Verify replay includes tool-call events.
- Verify governance snapshot hashes compute and drift is visible.

