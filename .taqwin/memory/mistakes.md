# Mistake Ledger

- 2026-02-05 — Mistake: Shell execution assumed without Tauri capability grant
  - Cause: Missed Tauri v2 permission model
  - Impact: UI orchestration blocked (shell.spawn not allowed)
  - Correction: Capability-based spawn authorization enforced (PROMPT-1.82)

- 2026-02-05 — Mistake: Treated OS binary as shell command identifier
  - Cause: Used "powershell.exe" as identifier instead of registering named logical command
  - Impact: "Scoped command not found" error despite capability presence
  - Correction: Registered logical command "start-local-stack" in default.json and updated frontend to invoke it by name.
