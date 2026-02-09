# TAQWIN Master Tickets (Food Supply)

Stamped: 2026-02-10T01:00+05:30

Status legend: PENDING · ACTIVE · DONE · BLOCKED

This file is append-only. Never delete closed tickets; mark terminal status and add postmortem notes.

## Ticket Index

Pending population: TQ-001..TQ-015 (PROMPT-1)

---
## TQ-001 — Canonicalize .taqwin link integrity
Status: DONE
Scope: TAQWIN / Control App
Files affected:
- [.taqwin/INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)
- [.taqwin/MEMORY_MESH.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/MEMORY_MESH.md)
- [.taqwin/ARCHITECTURE.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/ARCHITECTURE.md)
Acceptance criteria:
- No `.taqwin` docs link to non-existent paths without an explicit “NOT INGESTED / MISSING” label.
- Windows-case-sensitive portability issues are eliminated (no `.TAQWIN` vs `.taqwin` confusion).
Failure modes:
- Operators follow broken links and treat missing artifacts as existing truth.

Evidence:
- Link audit (before): [link-audit_2026-02-10T012851.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/reports/link-audit_2026-02-10T012851.md)
- Link audit (after): [link-audit_2026-02-10T013201.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/reports/link-audit_2026-02-10T013201.md)

## TQ-002 — Web Intelligence directory reality + indexing
Status: PENDING
Scope: TAQWIN
Files affected:
- [.taqwin/INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)
- [TAQWIN_V1/core/web_intelligence_manager.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/web_intelligence_manager.py)
Acceptance criteria:
- `web_intelligence/` persistence is either implemented and created, or INDEX explicitly marks it as absent with no false claims.
- Web outputs are always source-cited and stored as evidence artifacts (manifest or dedicated store).
Failure modes:
- “Entity graph exists” claim with no underlying storage.

## TQ-003 — Standardize ingestion manifests as first-class evidence
Status: PENDING
Scope: TAQWIN / KNEZ / Control App
Files affected:
- [TAQWIN_V1/scripts/prompt1_ingest_repo.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/scripts/prompt1_ingest_repo.py)
- [.taqwin/checkpoints/checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)
- [knez-control-app/src/features/governance/GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)
Acceptance criteria:
- Control App can locate latest manifest summary, display totals, and open raw JSONL safely (paged).
- Checkpoints reference manifests by ingestion_run_id.
Failure modes:
- Evidence exists but is invisible or unusable in UI.

## TQ-004 — Implement safe .md stamping (sidecar → optional in-place)
Status: PENDING
Scope: TAQWIN
Files affected:
- [.taqwin/rules/memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)
- `.taqwin/ingestion/*` (new artifacts)
Acceptance criteria:
- Every markdown file gets a sidecar stamp entry (doc_id, sha256, line_count, label).
- Optional in-place stamping is gated and reversible, and never destroys original content.
Failure modes:
- Mass edits corrupt docs; Git noise overwhelms review.

## TQ-005 — Enforce non-overridable boundaries in tool dispatch
Status: PENDING
Scope: TAQWIN
Files affected:
- [TAQWIN_V1/core/tool_registry.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py)
- [TAQWIN_V1/taqwin/tool_policy.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/taqwin/tool_policy.py)
- [.taqwin/boundaries/taqwin.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/taqwin.md)
Acceptance criteria:
- Policy denies are explicit and produce structured “denied” events.
- Boundary violations cannot be executed through indirect tool calls.
Failure modes:
- Tools bypass governance and mutate memory or execute unsafe actions.

## TQ-006 — KNEZ ↔ TAQWIN event contract hardening
Status: PENDING
Scope: KNEZ / TAQWIN
Files affected:
- [KNEZ/knez/integrations/taqwin/adapter.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/integrations/taqwin/adapter.py)
- [TAQWIN_V1/core/contracts/tools_v1.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/contracts/tools_v1.py)
Acceptance criteria:
- Event schema versioned and validated at ingestion.
- Invalid events are rejected with actionable errors and logged.
Failure modes:
- Silent schema drift; corrupted event streams.

## TQ-007 — Control App “System Status Strip” (truth-first)
Status: PENDING
Scope: Control App
Files affected:
- [knez-control-app/src/App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)
- [knez-control-app/src/features/system/useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)
Acceptance criteria:
- Always-visible indicators: KNEZ health, TAQWIN MCP health, active session_id, tool-lock state.
- Each indicator links to the underlying evidence (endpoint/manifest/log).
Failure modes:
- UI looks healthy while backends are dead.

## TQ-008 — Memory Explorer scalability (DB + huge logs)
Status: PENDING
Scope: Control App / KNEZ
Files affected:
- [knez-control-app/src/features/memory/MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)
- [KNEZ/knez/knez_core/memory/api.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/memory/api.py)
Acceptance criteria:
- Pagination, search, and virtualized rendering are in place for large datasets.
- UI never blocks main thread when rendering long content.
Failure modes:
- UI freezes or OOMs when opening evidence.

## TQ-009 — Sessions DB maintenance and optimization evidence
Status: PENDING
Scope: TAQWIN / KNEZ
Files affected:
- `TAQWIN_V1/data/sessions/sessions.db` (operational)
- `.taqwin/checkpoints/*` (evidence)
Acceptance criteria:
- Maintenance routine documented and executed safely (no data loss).
- Optimization results captured as a checkpoint evidence entry.
Failure modes:
- DB grows until queries degrade; UI becomes unusable.

## TQ-010 — Formalize “DONE” states and forbid infinite pending
Status: PENDING
Scope: TAQWIN / KNEZ / Control App
Files affected:
- [.taqwin/rules/memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)
- [.taqwin/rules/execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)
- Work tracking: [.taqwin/work/tickets.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/tickets.md)
Acceptance criteria:
- Every tracked unit resolves to SUCCESS / FAILED / ABORTED (or DONE/BLOCKED with reason).
- UI surfaces unresolved pending items as a visible hazard.
Failure modes:
- Indefinite limbo tasks; dead cognition loops.

## TQ-011 — Unify duplicated .taqwin roots (repo vs app-local)
Status: PENDING
Scope: TAQWIN / Control App
Files affected:
- [.taqwin](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin)
- [knez-control-app/.taqwin](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/.taqwin)
Acceptance criteria:
- One canonical governance root is declared; app-local `.taqwin` becomes a subordinate mirror or is explicitly scoped.
- No conflicting rules/indices.
Failure modes:
- Split-brain governance; inconsistent operator behavior.

## TQ-012 — Prompt serialization hardening (IDs, ranges, lineage)
Status: PENDING
Scope: TAQWIN / Control App
Files affected:
- [.taqwin/serialization/prompts.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/prompts.md)
- `.taqwin/prompts/*`
Acceptance criteria:
- Prompts include stable IDs, scope, and affected file list.
- Control App can display prompt lineage and diffs.
Failure modes:
- Prompts drift; cannot reproduce governance state.

## TQ-013 — Repair phase naming/domain drift (“TrendyToys” vs controlAPP)
Status: PENDING
Scope: TAQWIN
Files affected:
- [.taqwin/present/phase.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/phase.md)
- [.taqwin/present/constraints.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/constraints.md)
Acceptance criteria:
- Phase docs correctly reference this repo/module set (TAQWIN_V1/KNEZ/knez-control-app).
- Domain assumptions are explicitly labeled as constraints until evidenced.
Failure modes:
- Mis-scoped work and incorrect assumptions.

## TQ-014 — “Artwordfast ciphering” output encoding spec (high-signal stamping)
Status: PENDING
Scope: TAQWIN / Control App
Files affected:
- [.taqwin/rules/memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)
- `.taqwin/ingestion/*`
Acceptance criteria:
- Define a compact, high-signal encoding for stamps: doc_id, chunk_id, status, scope, evidence pointer.
- UI can render and filter stamps by scope/status quickly.
Failure modes:
- Stamps exist but are too verbose or inconsistent to use.

## TQ-015 — Checkpoint orchestration inside Control App (auto-diff every N changes)
Status: PENDING
Scope: Control App
Files affected:
- [knez-control-app/src/features/system/useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)
- `.taqwin/work/*`
Acceptance criteria:
- Auto-generated diff/verification prompts are produced at a configurable cadence (default: every 10 meaningful changes).
- Output is stored as an append-only report and linked from active work.
Failure modes:
- Constant noise; performance regressions; missing audit trail.
