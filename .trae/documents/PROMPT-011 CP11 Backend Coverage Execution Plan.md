## What I Found (Baseline, No Assumptions)

* KNEZ is launched via [run.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/run.py) and serves the **core** FastAPI app [knez\_core/app.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/app.py) (not the compat app).

* Control App calls KNEZ only through [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts).

* Subsystems already reachable from Control App:

  * Chat completions (used), Memory (used), Events (used), Cognitive state (used), Influence operator controls (used), MCP (used but backend currently returns hard-404), Sessions/Replay/Audit (partial).

* Key backend gaps that are real (not hypothetical):

  * Memory store + knowledge base are in-memory globals (non-persistent).

  * Approval endpoints in cognitive API are explicitly placeholders.

  * MCP endpoints exist but intentionally hard-404.

  * Telemetry has Prometheus metrics objects but no `/metrics` route.

  * Shadow simulator is a placeholder.

## PHASE 0 — SERIALIZATION (MANDATORY)

After approval, perform **only non-destructive writes**:

* Create `.taqwin/prompts/` (currently missing) and append the prompt verbatim to `.taqwin/prompts/2026-02-08-PROMPT-011.md`.

* Update `.taqwin/work/active.md` → add `CP11: ACTIVE` with goal/current/next.

* Update `.taqwin/work/task-graph.md` → add `CP11` node with dependencies and unblock criteria.

* Update `.taqwin/present/now.md` → set focus = “Backend Coverage”.

Stop immediately if any serialization step cannot be applied.

## PHASE 1 — BACKEND FEATURE INVENTORY

* Scan the entire `KNEZ/` directory (already partially mapped) and produce a definitive table with:

  * Subsystem, Files, APIs, Used by Control App, Tested, Notes.

* Write the table to `.taqwin/reports/backend-feature-map.md` (create `.taqwin/reports/` if missing).

* “Used by Control App” will be backed by specific call-sites in [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts).

## PHASE 2 — GAP IDENTIFICATION

* For every subsystem with Used = NO/PARTIAL, create an explicit atomic ticket.

* Each ticket will include acceptance + automated test criteria.

## PHASE 3 — TICKET SET (EXACTLY 15)

Create `.taqwin/work/tickets/CP11.md` (directory doesn’t exist yet) containing exactly:**SQLite, atomicdb , vectordb or postgres whichever is better)**

1. **CP11-1: Persistent Memory Store ()**
2. **CP11-2: Persistent Knowledge Base (SQLite)**
3. **CP11-3: Memory Gate Violations Observable in UI**
4. **CP11-4: Replay Correctness vs Event Stream (Backend Test + UI)**
5. **CP11-5: Replay UI Playback with Checkpoints**
6. **CP11-6: Influence Denial Surface (UI + Events)**
7. **CP11-7: Approval Workflow Real Endpoints + UI Panel**
8. **CP11-8: Router Decision Transparency (Trace + UI)**
9. **CP11-9: Model Routing Visibility (Scores, Selected Backend)**
10. **CP11-10: Event Causality Chain (Cause/Effect Rendering)**
11. **CP11-11: Sessions Metadata (Name/Tags) + Resume/New UX**
12. **CP11-12: Failover Observability + Manual Trigger Path**
13. **CP11-13: Telemetry** **`/metrics`** **+ UI Summary**
14. **CP11-14: MCP Registry Enablement + Execution Boundaries**
15. **CP11-15: Shadow Subsystem Delta Visibility (Backend + UI)**

Each ticket will contain Type, Description, Acceptance, Tests (TestRunner/Playwright + pytest where relevant).

## PHASE 4 — EXECUTION (ONE BY ONE)

For each CP11 ticket:

* Implement backend changes in `KNEZ/` and/or frontend changes in `knez-control-app/`.

* Add automated tests:

  * Backend: `pytest` under `KNEZ/tests/` (already present in repo).

  * Frontend: extend TestRunner and Playwright specs under `knez-control-app/tests/playwright/`.

* Run builds each ticket:

  * `npm run build`

  * `npm run tauri build`

* Update `.taqwin/work/tickets/CP11.md` status: TODO → IN\_PROGRESS → VERIFIED.

## PHASE 5 — SYSTEM VERIFICATION

After all 15 tickets:

* Run full Diagnostics inside the app.

* Run all Playwright suites (`npx playwright test`).

* Perform and record 3 real chat scenarios (Factual, Web-assisted, Memory recall).

* Log results to `.taqwin/reports/CP11-verification.md`.

## PHASE 6 — GOVERNANCE UPDATE

* Update `.taqwin/identity/persona.md` to reflect backend-first verification discipline.

* Update `.taqwin/rules.md` adding rule:

  * “No backend subsystem is considered operational unless observable and testable from Control App.”

## PHASE 7 — NEXT TICKET GENERATION

* Create `NEXTPLAN.md` (5 Major, 3 Minor, 2 Micro) with focus:

  * Cloud deployment, Auth, Multi-operator control, Remote perception, Production hardening.

## Stop Conditions Handling

* If any backend API behavior is ambiguous (e.g., conflicting routes or missing schema), stop and ask.

* If any destructive action is required (data migration that overwrites existing stores), stop and ask.

* If a new trust boundary is crossed (remote DB, external secrets), stop and ask.

