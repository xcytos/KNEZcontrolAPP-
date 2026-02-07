Task Graph

Represent work as a graph, not a flat list.

For each task capture:
- status (done, active, blocked, future)
- dependencies
- why it exists
- what unblocks it

Current graph seeds:
... (previous entries)

- Task: CHECKPOINT 11 — BACKEND FEATURE COVERAGE & CONTROL APP INTEGRATION
  - Status: active
  - Dependencies: CP7 baseline runtime verification
  - Why: No backend subsystem is considered operational unless observable and testable from Control App.
  - Unblocked by: Backend feature map + CP11-1 → CP11-15 verified with tests and builds.

- Task: CHECKPOINT 6 — NEW SUBSYSTEMS
  - Status: done
  - Dependencies: CP5
  - Why: Expand agent capabilities (Perception, Automation).
  - Unblocked by: Completion of CP6 tickets.

- Task: CHECKPOINT 7 — DEPLOYMENT & SCALING
  - Status: future
  - Dependencies: CP6
  - Why: Production readiness.

- Task: CP7-A — CLOUD SYNC
  - Status: future
  - Dependencies: CP7
  - Why: Multi-device.
