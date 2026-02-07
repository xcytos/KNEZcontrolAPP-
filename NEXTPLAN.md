# NEXTPLAN (Post-CP12) — “No Mock, Guaranteed Real”

This roadmap targets the exact issues observed in desktop Tauri dev:
- MCP tools must be real (no simulated tool calls).
- Connection failures must be explained and recoverable (no silent fallbacks).
- Session resume/fork must be correct and testable end-to-end.
- TAQWIN MCP contract must be honored (tool list, fields, content framing).
- Agent Loop must be able to call MCP tools between chat turns and inject results.

## Guiding Requirements
1. Desktop-only execution for MCP: if not in Tauri runtime, show “unavailable”, do not fake.
2. Health and timeouts: no raw AbortError surfaced; show actionable failure reasons.
3. Session integrity: never switch session IDs on failed resume/fork.
4. Tool integrity: every tool call is persisted (args, status, result/error, timings).
5. Contract correctness: TAQWIN MCP framing must be byte-accurate for Unicode.

## Tickets (15)

### T01 — Desktop MCP Capability Verification Gate
- Goal: Detect Tauri correctly and block MCP UI in web mode.
- Work: unify runtime detection; add a single shared helper used everywhere.
- Acceptance: “Tools” shows real tool list in Tauri; shows explicit “desktop required” outside Tauri.
- Risk: low

### T02 — TAQWIN MCP Process Lifecycle Manager
- Goal: Ensure MCP child process starts once, can be restarted, and failures are visible.
- Work: add start/stop/restart commands; attach stderr to UI logs; add heartbeat via `connection_info`.
- Acceptance: if MCP crashes, UI shows “process closed” and offers Restart; no “mcp_not_started” leaks.
- Risk: medium

### T03 — TAQWIN MCP Contract Hardening (Client)
- Goal: Make MCP client robust to line-delimited fallback and partial frames.
- Work: tolerate non-Content-Length responses; add defensive parsing and timeouts per request.
- Acceptance: tools/list and tools/call succeed even if server falls back to newline JSON.
- Risk: medium

### T04 — TAQWIN MCP Contract Hardening (Server)
- Goal: Byte-accurate Content-Length for Unicode request/response bodies.
- Work: read/write bodies using stdin/stdout buffers with UTF-8 encoding.
- Acceptance: tool results containing Unicode (emoji/Urdu/Arabic) do not hang or corrupt frames.
- Risk: medium

### T05 — TAQWIN Tool Catalog + Schemas (Truth Source)
- Goal: Generate an authoritative tool catalog from TAQWIN tool definitions.
- Work: create a small script that dumps tools/list output + inputSchema into `.taqwin/memory`.
- Acceptance: `.taqwin/memory` contains up-to-date tool names, actions, and required fields.
- Risk: low

### T06 — Session Tool (Not V2) First-Class Workflow
- Goal: Make `session` (bounded) the primary session tool in UI/Agent Loop.
- Work: add UI presets for each allowed action; validate required fields before calling.
- Acceptance: `session_start/session_attach/session_context_query/...` run reliably with correct args.
- Risk: medium

### T07 — Session Resume Snapshot Reliability
- Goal: Fix `/resume_snapshot` failures and make errors explainable.
- Work: longer timeouts, explicit timeout errors, and retry-on-startup window.
- Acceptance: no net::ERR_ABORTED spam; failures report “timeout / unreachable / HTTP status”.
- Risk: medium

### T08 — Remove False Positives From Diagnostics Suite
- Goal: Tests must fail when prerequisites are missing.
- Work: add preflight health checks; navigate to correct view before UI checks; remove silent fallbacks.
- Acceptance: UI Navigation Smoke and Replay Timeline tests fail only for real issues with clear logs.
- Risk: low

### T09 — Replay Timeline “Seed” Path Contract
- Goal: Define the real seeding mechanism (KNEZ endpoint vs TAQWIN tool).
- Work: decide one source of truth and implement it; delete any dead endpoints.
- Acceptance: Replay test seeds an event through a real supported path and timeline includes it.
- Risk: high

### T10 — Agent Loop: Tool-Calling Between Chat Turns
- Goal: Agents can call TAQWIN MCP tools mid-loop and inject results into chat context.
- Work: add an AgentLoop step type `tool_call`; persist it; render it in timeline; pipe output to next step.
- Acceptance: A single AgentLoop run can (plan → call `get_server_status` → use output → final response).
- Risk: high

### T11 — Tool Permission + Trust Model (Operator Controls)
- Goal: Enforce safe tools in untrusted mode; allow full set when verified/admin.
- Work: add explicit policy table (safe tools vs restricted tools); show why blocked; require confirm for high-risk.
- Acceptance: blocked tools cannot run; UI explains policy; verified/admin can enable and run.
- Risk: medium

### T12 — End-to-End “Real Desktop” Automation Harness
- Goal: Add automation that runs inside the real Tauri window.
- Work: driver/bridge to control UI + read logs; run MCP tool calls and validate results.
- Acceptance: CI/local can run a Tauri E2E suite that verifies real MCP, not browser simulation.
- Risk: high

### T13 — KNEZ Local Stack Startup Robustness
- Goal: Eliminate flakiness around starting 8000 services.
- Work: “wait for /health ok” gate, port checks, clearer logging, restart on bind failure.
- Acceptance: one-click Start results in stable /health and /state/overview without aborts.
- Risk: medium

### T14 — Persistence + Consistency Audits (Sessions/Messages/Tools)
- Goal: Detect and repair inconsistent session/message/tool-call state.
- Work: add “repair” actions to audit panel; add invariants (message pairings, queue constraints).
- Acceptance: audit reports violations and can auto-fix safe ones; no silent corruption.
- Risk: medium

### T15 — Packaging TAQWIN Runtime (No Local Repo Assumptions)
- Goal: Desktop builds should ship with TAQWIN MCP runtime (no external python requirement).
- Work: bundle python/runtime or repackage TAQWIN as a sidecar binary; update spawn config.
- Acceptance: Tauri build runs TAQWIN MCP out-of-the-box on a clean machine.
- Risk: high
