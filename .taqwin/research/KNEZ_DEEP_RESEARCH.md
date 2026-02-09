# KNEZ Deep Research (Canonical)

Stamped: 2026-02-10T01:00+05:30

This file is the canonical location for the 30 KNEZ orchestration/routing questions required by PROMPT-1.

Evidence anchor:
- Ingestion run: `e9212f692fbc420f846d7db14af0a278`
- Ingestion index: `../ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md`

Source mirror (legacy location):
- `../memory_mesh/knez_layer/KNEZ_DEEP_RESEARCH.md`

---
## 30 Orchestration & Routing Questions (KNEZ)

### Q01 — What is KNEZ’s canonical definition of a “backend” and how is it registered?
Why it matters: Routing logic depends on a stable backend schema (capabilities, health, cost, trust).
What breaks if ignored: UI shows phantom backends; router makes invalid decisions; sessions fail silently.
Where it applies:
- API wiring: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py)
- Router logic: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)

### Q02 — How does KNEZ detect and represent “health” across local and cloud backends?
Why it matters: Operator truth requires health signals to be first-class.
What breaks if ignored: Failover never triggers; retries loop; UI shows “connected” when not.
Where it applies:
- Server entrypoint: [run.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/run.py)
- Core app lifecycle: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py)

### Q03 — What is the router’s decision record format and how is it persisted as evidence?
Why it matters: Decisions must be auditable; routing is governance-adjacent.
What breaks if ignored: Cannot explain “why this model”; cannot debug trust/regression.
Where it applies:
- Router decision emission: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)
- Session/event stores (via KNEZ DB, referenced by TAQWIN MCP status output)

### Q04 — How does KNEZ represent trust levels and policy constraints for backends?
Why it matters: Prevents sensitive tasks from being routed to untrusted endpoints.
What breaks if ignored: Data leakage and policy violations.
Where it applies:
- Governance layer: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)
- Router: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)

### Q05 — What is the contract between TAQWIN “memory candidates” and KNEZ memory persistence?
Why it matters: Ensures TAQWIN cannot unilaterally mutate KNEZ memory truth.
What breaks if ignored: Memory becomes a write-anything surface; governance collapses.
Where it applies:
- TAQWIN bridge endpoint: [adapter.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/integrations/taqwin/adapter.py)
- KNEZ memory API: [api.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/memory/api.py)

### Q06 — What is the canonical shape of “session continuity” in KNEZ?
Why it matters: Control App expects stable session_id, replay, and snapshot mapping.
What breaks if ignored: UI cannot reconcile chat ↔ tool calls ↔ checkpoints.
Where it applies:
- ID invariants: [ID_CONTRACTS.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/ID_CONTRACTS.md)
- KNEZ server event/session tables (TAQWIN MCP status: sessions.db)

### Q07 — How does KNEZ handle partial failures (one backend down, others healthy)?
Why it matters: Real-world operation demands graceful degradation and deterministic failover.
What breaks if ignored: Whole system is “down” when only one backend is failing.
Where it applies:
- Router behavior: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)
- Control orchestrator polling: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

### Q08 — What endpoints must be considered “operator-critical” and always visible in the UI?
Why it matters: Operators need a minimal set of truth endpoints to debug.
What breaks if ignored: UI becomes decorative; runtime truth is hidden.
Where it applies:
- FastAPI app routers: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py)
- UI panels: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)

### Q09 — What is the schema drift strategy for KNEZ DB tables?
Why it matters: Sessions and events DB is large; migration discipline is required.
What breaks if ignored: Old UIs break, and evidence becomes unreplayable.
Where it applies:
- KNEZ persistence layer (DB path in TAQWIN MCP status output)
- Any migrations folder in KNEZ (to be referenced by ingestion evidence)

### Q10 — How is “tool call” auditing handled inside KNEZ?
Why it matters: Tool calls are the bridge between cognition and execution; must be visible.
What breaks if ignored: No proof of what was executed; cannot reproduce bugs.
Where it applies:
- KNEZ event store tables (TAQWIN MCP status: tool_calls table exists)
- Control App execution surfaces: [ApprovalPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/ApprovalPanel.tsx)

### Q11 — What is the formal contract for TAQWIN ↔ KNEZ event ingestion?
Why it matters: Events are the only safe channel for cross-system memory proposals.
What breaks if ignored: Ad-hoc writes and hidden side effects.
Where it applies:
- TAQWIN integration: [adapter.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/integrations/taqwin/adapter.py)
- TAQWIN tool contracts: [tools_v1.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/contracts/tools_v1.py)

### Q12 — How does KNEZ expose “capability discovery” for UI and routing?
Why it matters: UI must not guess which features exist; router needs capability vectors.
What breaks if ignored: Feature buttons trigger 404s; routing chooses incompatible models.
Where it applies:
- App/router: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py), [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)

### Q13 — What is the correct throttling/backpressure strategy for SSE/event streams?
Why it matters: Large event volumes can kill UI responsiveness.
What breaks if ignored: Control App freezes or drops events silently.
Where it applies:
- Control App streaming consumption (search by SSE usage in UI codebase)
- KNEZ event endpoints (FastAPI router modules)

### Q14 — How does KNEZ guarantee “backend-truth UI state” (no simulated data)?
Why it matters: Governance requires UI state derivable from backend truth only.
What breaks if ignored: Operators act on fake state; incidents occur.
Where it applies:
- `.taqwin/rules.md` rule #14: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- Control UI: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)

### Q15 — What is KNEZ’s definition of “memory gating” and what can bypass it?
Why it matters: Memory gating is governance enforcement.
What breaks if ignored: Any subsystem can persist “truth” without review.
Where it applies:
- Governance: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)
- Memory API: [api.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/memory/api.py)

### Q16 — How should KNEZ represent “blocked” vs “failed” tasks in its work item tables?
Why it matters: “Pending forever” is forbidden; UI needs terminal states.
What breaks if ignored: Tasks never resolve; orchestration loops.
Where it applies:
- TAQWIN execution law: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)
- KNEZ DB tables: (TAQWIN MCP status shows work_items table exists but empty)

### Q17 — How is “resume snapshot” generated, stored, and validated?
Why it matters: Snapshots are recovery safelines.
What breaks if ignored: Cannot resume after crash; session continuity fails.
Where it applies:
- ID contract snapshot_id: [ID_CONTRACTS.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/ID_CONTRACTS.md)
- KNEZ session store modules (to be anchored via ingestion evidence)

### Q18 — How does KNEZ reconcile concurrent clients (multiple Control Apps) safely?
Why it matters: Avoids split-brain operator control.
What breaks if ignored: Conflicting approvals and duplicated tool calls.
Where it applies:
- FastAPI app orchestration: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py)
- Control App orchestrator: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

### Q19 — What is the security boundary for secrets used by KNEZ (API keys, tokens)?
Why it matters: Prevents leaking credentials via logs or UI.
What breaks if ignored: Key exposure; account compromise.
Where it applies:
- KNEZ config loading paths (search for env usage in KNEZ)
- Control App logging and error boundaries: [main.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/main.tsx)

### Q20 — How does KNEZ decide between local ≤7B and cloud models under latency constraints?
Why it matters: Routing must meet UX latency while preserving correctness and policy.
What breaks if ignored: Either unusable latency or unacceptable hallucination rates.
Where it applies:
- Router policy: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)
- Governance: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)

### Q21 — What is the failure-visibility contract from KNEZ to Control App?
Why it matters: Operators must see failures in real time with actionable details.
What breaks if ignored: Silent failures and “it just doesn’t work”.
Where it applies:
- UI failure surfaces: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)
- KNEZ response schemas (router + memory API)

### Q22 — How does KNEZ prevent “execution authority” from leaking into read-only phases?
Why it matters: Phase discipline avoids scope explosion and unsafe actions.
What breaks if ignored: Background actions start/stop systems without explicit approval.
Where it applies:
- Phase constraints: [phase.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/phase.md)
- Control App orchestration hooks: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

### Q23 — What is the canonical “observability payload” required for each backend?
Why it matters: Backend coverage requires standardized metrics and traces.
What breaks if ignored: Each backend is monitored differently; dashboards lie.
Where it applies:
- CP11 objective: [now.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/now.md)
- Backend feature map: [backend-feature-map.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/reports/backend-feature-map.md)

### Q24 — How should KNEZ implement load shedding to protect the UI from overload?
Why it matters: Prevents cascading failures.
What breaks if ignored: One burst takes down everything.
Where it applies:
- Event stream endpoints + router loops (KNEZ routers)
- Control App render loops (React panels)

### Q25 — What is the correct behavior when TAQWIN requests a tool not allowed by policy?
Why it matters: Denials must be explicit and logged.
What breaks if ignored: Silent failures or unauthorized tool execution.
Where it applies:
- TAQWIN tool policy: [tool_policy.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/taqwin/tool_policy.py)
- KNEZ approval UX: [ApprovalPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/ApprovalPanel.tsx)

### Q26 — What is the deterministic ordering for event replay and reconciliation?
Why it matters: Replay must reproduce reality; otherwise evidence is untrustworthy.
What breaks if ignored: Replays differ across runs; debugging is impossible.
Where it applies:
- Event store tables: (TAQWIN MCP status: system_events/interactions/tool_calls)
- UI replay surfaces: [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)

### Q27 — How does KNEZ prevent cross-tenant contamination if multiple projects share one server?
Why it matters: Safety in multi-workspace scenarios.
What breaks if ignored: One project’s memory influences another’s routing.
Where it applies:
- Session scoping in KNEZ (app + DB schema)
- TAQWIN memory law “project scoped”: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)

### Q28 — What is the upgrade/migration path for the sessions.db optimization warning?
Why it matters: Large DB (≈1GB) needs maintenance to avoid performance cliffs.
What breaks if ignored: UI searches slow down; tool calls degrade.
Where it applies:
- TAQWIN MCP status DB recommendations (captured in checkpoint_0001)
- Sessions DB location: `TAQWIN_V1/data/sessions/sessions.db` (from TAQWIN MCP status)

### Q29 — What constitutes “backend coverage verified” under CP11?
Why it matters: “Coverage” must map to endpoints, tests, and UI visibility.
What breaks if ignored: Tickets can be marked DONE without runtime proof.
Where it applies:
- Rule #15 runtime verification: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- CP11 tickets: [CP11.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/tickets/CP11.md)

### Q30 — What is KNEZ’s authoritative source of truth: runtime state, DB state, or UI state?
Why it matters: Prevents inconsistent “truth” definitions.
What breaks if ignored: Each layer claims authority; operators lose confidence.
Where it applies:
- KNEZ governance: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)
- UI “backend-truth” rule: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
