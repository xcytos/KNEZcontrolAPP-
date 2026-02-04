Project History (Condensed)

This file records major milestones and shifts for the TrendyToys repository.

Not every commit.
Only moments that changed direction, capability, or risk.

For each entry capture:
- date or period
- what changed
- why it mattered
- what it enabled or broke

Seed entry:
- 2026-01-31 — Initialized .taqwin/ cognition layer for TrendyToys
  - What changed: added TAQWIN (child) structure and bootstrap content
  - Why it mattered: enabled AI work with persistent, repo-embedded context
  - Enabled: continuity across sessions and reduced need to re-explain history

- 2026-02-04 — CHECKPOINT 1 — KNEZ ↔ Control App Protocol Alignment
  - What changed: Control App now delegates cognition to real KNEZ HTTP core (health, events, memory, replay, completions) instead of simulated responses; Reflection, Chat, and Memory UIs are wired to KNEZ.
  - Why it mattered: removed simulated behavior, aligned the UI with KNEZ governance and protocol, and ensured the Control App mirrors actual KNEZ state.
  - Enabled: real-time KNEZ insights, session continuity via events, and explicit surfacing of failures when the local generation backend is unreachable.
