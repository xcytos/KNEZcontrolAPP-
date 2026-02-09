# CP03_MCP_CLIENT_CORE — Ticket Set (12)

## CP03 Goal
Build a production-grade MCP client core (desktop host) that is correct, observable, and reusable across UI + chat + tests, with first-class compatibility with TAQWIN_V1.

---

## CP03-T01 — Unify MCP config schema and migration
Acceptance Criteria:
- One internal schema with `schema_version` and `servers` map.
- Parser accepts legacy inputs:
  - `{ servers: { ... } }`
  - `{ mcpServers: { ... } }`
  - `working_directory`, `workingDirectory`, `cwd`
- Normalizer produces canonical `cwd`, `command`, `args`, `env`, `enabled`.
Tests:
- Unit: parse/normalize for each legacy shape.

## CP03-T02 — Make one MCP config source-of-truth
Acceptance Criteria:
- Desktop uses one config file for TAQWIN spawn and UI editing.
- TAURI script-based spawn and UI spawn read the same resolved config.
- Config edits persist and are reflected without restarting the whole app.
Tests:
- E2E: edit config, start MCP, list tools succeeds.

## CP03-T03 — Fix TAQWIN ACTIVATE tool compatibility
Acceptance Criteria:
- Activation checks tools inventory and calls:
  - `activate_taqwin_unified_consciousness` when present (TAQWIN_V1)
  - otherwise `taqwin_activate` when present
- Activation reports actionable error when neither exists.
Tests:
- Unit: tool name resolution function.

## CP03-T04 — Implement MCP process supervisor v1
Acceptance Criteria:
- Supervisor state machine supports: `down`, `starting`, `running`, `error`.
- Backoff on consecutive failures; stop restart loops.
- Produces structured debug snapshot (pid, last_exit, stderr_tail).
Tests:
- Unit: backoff function; state transitions on error.

## CP03-T05 — Harden spawn and env handling
Acceptance Criteria:
- Prefer direct program spawn where possible (avoid fragile command chains).
- Errors distinguish: missing command, missing cwd, permission denied, spawn failed.
- No secrets logged (env redacted by default in logs/debug view).
Tests:
- Unit: env redaction.

## CP03-T06 — Improve MCP status model fields
Acceptance Criteria:
- Status exposes: `processAlive`, `initialized`, `framing`, `lastStartAt`, `lastOkAt`, `lastError`.
- UI can show “process alive but init failed” as distinct state.
Tests:
- Unit: status derivation.

## CP03-T07 — Add tool catalog cache and invalidation
Acceptance Criteria:
- Cache `tools/list` with TTL.
- Invalidate on: restart, config change, explicit refresh, framing switch.
Tests:
- Unit: cache TTL and invalidation triggers.

## CP03-T08 — Persist tool call audit records locally
Acceptance Criteria:
- Records include: tool name, duration_ms, ok/error, args_bytes, result_bytes, timestamp.
- Records survive reload and are viewable in UI logs/health panel.
Tests:
- Unit: serialization round-trip.

## CP03-T09 — Add contract-level MCP self-test suite
Acceptance Criteria:
- Self-test runs: start → initialize → tools/list → call `get_server_status` → call `debug_test`.
- Self-test reports step timings and the first failure reason.
Tests:
- Unit: self-test result formatting; error propagation.

## CP03-T10 — Replace unsafe kill-all-python stop behavior
Acceptance Criteria:
- Stop only the spawned process (PID tracked by supervisor), not global python.
- Stop is idempotent and safe while starting.
Tests:
- Unit: stop while already stopped does not throw.

## CP03-T11 — Add Tauri E2E test for TAQWIN tools
Acceptance Criteria:
- E2E launches desktop app, opens Tools, starts TAQWIN MCP, verifies tools loaded.
- E2E performs one tool call and asserts success.

## CP03-T12 — Write app-side MCP operator documentation
Acceptance Criteria:
- Operator guide covers: configuration, framing, common errors, diagnostics workflow.
- Links to TAQWIN_V1 contract and runbook.
