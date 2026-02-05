# Mistake Ledger

- 2026-02-05 — Mistake: Polling-based health gating in desktop orchestration
  - Cause: Waiting for health check before showing UI state
  - Impact: Slow perception, stuck "STARTING" state, blocked chat
  - Correction: Optimistic UI (launchAndAssumeRunning) with background verification (CP2-A)

- 2026-02-05 — Mistake: Assuming local storage persistence was enough for complex state
  - Cause: Session complexity grew (forks, resumes)
  - Impact: UI state drift from backend truth
  - Correction: Implemented `StatusProvider` (CP5-10) to enforce single source of truth from backend.

- 2026-02-05 — Mistake: CP6 marked complete without observational verification
  - Cause: Trusted code implementation without validating runtime behavior via observation
  - Impact: Potential false confidence and hallucinated integrations
  - Correction: Introduced Playwright-based truth layer (CP6.1)
