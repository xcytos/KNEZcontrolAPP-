Task Graph

Represent work as a graph, not a flat list.

For each task capture:
- status (done, active, blocked, future)
- dependencies
- why it exists
- what unblocks it

Current graph seeds:
- Task: bootstrap .taqwin/ cognition layer for TrendyToys
  - Status: done
  - Dependencies: context.md canonical TAQWIN layout
  - Why: enable persistent AI cognition and continuity
  - Unblocked by: initial creation of .taqwin/ and core files

- Task: PROMPT-002B — Control App Phase-1 verification
  - Status: done
  - Dependencies: dev server availability (Vite port free), tauri/api version match
  - Why: ensure runtime correctness; eliminate silent errors and invariant violations
  - Unblocked by: fixing broken dependencies (@babel/code-frame, generator), tauri.conf.json window label, and migrating lib.rs to Tauri 2 API.

- Task: PROMPT-003 — Phase-1 Control App Hardening & Governance Completion
  - Status: done
  - Dependencies: PROMPT-002B (runtime stability)
  - Why: ensure system is governed, truthful, and resistant to failure before adding features.
  - Unblocked by: successful completion of Group A-G verification tasks.

- Task: PROMPT-004 — Phase-2 Planning & Contract Definition
  - Status: done
  - Dependencies: PROMPT-003 (Governance established)
  - Why: Design Phase-2 cognitive expansion safely before writing dangerous code.
  - Unblocked by: Completion of planning artifacts and contracts.

- Task: PROMPT-005 — Phase-2 Execution
  - Status: done
  - Dependencies: PROMPT-004 (Contracts defined)
  - Why: Implement Reflection, Mistake Ledger, and Drift Analysis.
  - Unblocked by: Approval of PROMPT-004 output.

- Task: PROMPT-006 — KNEZ Handshake, Session & Memory Protocol
  - Status: done
  - Dependencies: PROMPT-005 (Features ready for data)
  - Why: Connect Control App to real KNEZ backend (API, Handshake, Memory).
  - Unblocked by: Implementation of KnezClient and Session Logic.

- Task: CHECKPOINT 1 — KNEZ ↔ CONTROL APP PROTOCOL ALIGNMENT
  - Status: active
  - Dependencies: PROMPT-005 (UI surfaces exist), PROMPT-006 (initial integration scaffolding)
  - Why: Replace simulated cognition with real KNEZ delegation and align protocols to KNEZ core.
  - Unblocked by: KNEZ runtime having at least one reachable generation backend (local preferred) so /v1/chat/completions returns assistant text instead of structured backend errors.

- Task: CHECKPOINT 1.5 — RUNTIME DISCOVERY & OBSERVABILITY
  - Status: active
  - Dependencies: CHECKPOINT 1 (delegation wired), KNEZ /health and /events availability for read-only inspection
  - Why: Provide visibility into runtime truth (connectivity, backends, degradation) without granting control.
  - Unblocked by: Verified runtime panels showing accurate /health output, honest handling of missing MCP registry endpoints, and no UI paths that select/start/stop backends.

- Task: CHECKPOINT 1.76 — REPOSITORY SANITIZATION & EXECUTION VERIFICATION
  - Status: done
  - Dependencies: CHECKPOINT 1.5
  - Why: Ensure reproducible baseline and repo hygiene.
  - Unblocked by: Repository sanitation, git init, build/script verification.
