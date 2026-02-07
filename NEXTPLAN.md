# NEXTPLAN (Post-CP12)

## 1) Multi-agent TAQWIN
- Add a multi-agent orchestrator layer on top of TAQWIN tools (planner / executor / verifier roles).
- Persist per-agent “capability + trust” profiles so agents cannot exceed policy.
- Implement agent-loop timeline visualization (plan → tool calls → verification → finalization) as first-class chat items.

## 2) Cloud Sync
- Add optional cloud sync for:
  - local sessions (Dexie export/import)
  - tool audit logs
  - operator preferences (tool permissions, trust)
- Use a reversible, conflict-safe model:
  - append-only event log + compaction
  - deterministic merge rules for message ledger and tool-call records

## 3) Operator Roles + Governance
- Introduce operator roles:
  - Viewer (read-only)
  - Operator (execute safe tools)
  - Admin (enable restricted tools)
- Gate high-risk tools behind explicit role + per-tool approval prompts.

## 4) Production Hardening
- Package TAQWIN runtime for desktop builds (avoid relying on local repo layout + python).
- Add structured error reporting and safe fallback states for:
  - MCP process crash
  - tool call timeout
  - partial writes / corrupted local db
- Add performance guardrails:
  - backpressure on chat streaming + queue flush
  - bounded persistence writes (throttled)

## 5) Test Expansion
- Add “real Tauri window” automation via a supported driver/bridge.
- Add deterministic MCP mock server for CI.
- Add chaos tests:
  - kill MCP server mid-call
  - kill backend mid-stream
  - rapid session switches with queued sends
