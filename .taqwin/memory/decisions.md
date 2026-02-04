Decision Record

This file captures important decisions and trade-offs for TrendyToys.

Purpose:
- prevent re-litigation
- avoid circular debates
- preserve reasoning

Format for each decision:
- decision
- alternatives considered
- why chosen
- consequences (good and bad)

Seed decision:
- Decision: adopt canonical TAQWIN (child) v1.0 structure from context.md as the cognition layer
- Alternatives: operate without a structured cognition layer; use ad-hoc notes outside the repo
- Why chosen: improves continuity, reduces hallucination risk, and centralizes AI-facing state
- Consequences: requires discipline to keep .taqwin/ updated; adds a small maintenance surface

- Decision: route Control App cognition through real KNEZ HTTP endpoints instead of simulated clients
  - Alternatives: keep simulated KnezClient in the UI, only hit /health, or introduce a separate proxy that re-simulates responses.
  - Why chosen: ensures the Control App follows the real KNEZ protocol (health, events, memory, replay, completions), exercises actual governance paths, and keeps UI behavior aligned with KNEZ state.
  - Consequences: ties Control App behavior to KNEZ and its local generation backend availability; outages appear as explicit structured errors that the UI must render and handle safely.
