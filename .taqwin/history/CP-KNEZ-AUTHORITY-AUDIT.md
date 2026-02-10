CP-KNEZ-AUTHORITY-AUDIT — KNEZ × Control App × TAQWIN Authority Audit
=====================================================================

Stamped: 2026-02-10

Why this audit was needed
-------------------------

- KNEZ, TAQWIN_V1, the knez-control-app, and the .taqwin memory mesh formed a federated system with overlapping responsibility descriptions.
- Boundaries in .taqwin declared:
  - KNEZ as owner of orchestration and runtime hosting.
  - TAQWIN as owner of cognition, memory law, and tool governance.
  - Control App as owner of visualization and operator controls.
- Actual code paths showed:
  - Control App starting and stopping KNEZ and TAQWIN MCP processes via Tauri shell.
  - TAQWIN V1 acting as both a bounded MCP tool hub and a “superintelligence” activation surface.
  - .taqwin acting as authoritative governance memory for this repo, but not being enforced at runtime by KNEZ or TAQWIN.
- Without a dedicated authority audit:
  - It would be easy to mis-attribute failures or security risk to the wrong component.
  - Future evolution could accidentally collapse authority boundaries or introduce hidden autonomy.

What was unclear before
-----------------------

- Whether KNEZ was meant to be:
  - A pure router behind the Control App.
  - A primary governance engine with its own cognitive layer.
  - Or a thin adapter behind TAQWIN.
- Whether TAQWIN was:
  - A bounded intelligence layer accessed via MCP.
  - A memory owner with system-wide authority.
  - Or an overgrown backend being used beyond its intended scope.
- Whether the Control App:
  - Was a passive observer and visualizer.
  - Or an active controller with real authority over runtime processes and cognition activation.
- How .taqwin should be treated:
  - As passive documentation.
  - As an authoritative memory mesh.
  - Or as an unsafe, ad hoc collection of notes.

What is now explicit
--------------------

- KNEZ is:
  - The execution and routing engine, event and session truth owner, and governance analytics layer.
  - Non-autonomous, but with strong replay and reflection capabilities.
- TAQWIN is:
  - A powerful MCP tool hub and reasoning layer with its own internal memory and tool governance.
  - An HTTP advisor when run as taqwin.server with no persistence.
  - The conceptual owner of memory law and tool legality, but not the owner of all data stores.
- The Control App is:
  - An operator console and observability surface that also orchestrates local runtime processes (KNEZ, TAQWIN MCP, Ollama) via Tauri shell.
  - A policy overlay for TAQWIN tools, using KNEZ health as a trust signal.
  - A reader of .taqwin governance artifacts, not their owner.
- The .taqwin memory mesh is:
  - Trusted governance and reasoning memory for this repository.
  - Append-only, evidence-backed, and phase-aware.
  - Not yet enforced by backend code, but used as the canonical understanding for TAQWIN cognition.

Primary artifacts
-----------------

- System reality audit:
  - .taqwin/reports/KNEZ_SYSTEM_REALITY_AUDIT.md
- Evolution plan:
  - NEXTPLAN.md (Post KNEZ Authority Audit section)
- Active work record:
  - .taqwin/work/active.md updated with CP-KNEZ-AUTHORITY-AUDIT as DONE.

Authority collision table
-------------------------

| Domain                          | Intended Owner | Actual Owner(s)                | Risk level |
|---------------------------------|----------------|---------------------------------|-----------:|
| Session identity & lineage      | KNEZ           | KNEZ                            |       Low |
| Runtime hosting (KNEZ stack)    | KNEZ           | Control App (Tauri shell)      |     Medium |
| Runtime hosting (TAQWIN MCP)    | TAQWIN         | Control App (Tauri shell)      |     Medium |
| MCP tool legality               | TAQWIN         | TAQWIN + Control App overlay   |     Medium |
| TAQWIN proposal semantics       | TAQWIN         | KNEZ (events) + Control App UI |     Medium |
| Memory truth (events/sessions)  | KNEZ           | KNEZ                            |       Low |
| Memory law (.taqwin rules)      | TAQWIN         | TAQWIN (conceptual)            |    Med-High |
| Governance perception (operator)| .taqwin        | Control App                     |    Med-High |

Notes:
- Runtime hosting:
  - Docs say KNEZ owns hosting; code shows Control App starting/stopping processes.
  - Risk is misaligned incident response and misplaced hardening efforts.
- Tool legality:
  - TAQWIN tool_policy is authoritative for what the server allows.
  - Control App adds UI-level gating and trust, which can drift from server policy.
- Memory law vs memory truth:
  - KNEZ owns what actually happened (events, sessions).
  - .taqwin + TAQWIN own what is considered legal and intended.
  - If they diverge, governance conclusions can be wrong even when logs are correct.

.taqwin memory mesh verdict
---------------------------

- Nature:
  - Append-only governance and reasoning mesh for this repository.
  - Contains identity, rules, boundaries, phase constraints, and serialized audits.
- Writers:
  - Human operators and TAQWIN-governed processes (via explicit prompts).
  - Not mutated by KNEZ or Control App code paths.
- Readers:
  - Humans (for design and governance).
  - TAQWIN cognition (when instructed) as a law and context source.
- Corruption risks:
  - Logical: stale or inconsistent rules if .taqwin is not updated alongside code.
  - Operational: accidental edits; there is no code-level enforcement of append-only semantics.
- Scope:
  - Project-level and multi-phase; not per-session runtime state.

Verdict:
- .taqwin is **trusted reference memory**, not runtime state:
  - It should be treated as law and design source of truth.
  - But it is not yet enforced automatically by KNEZ or TAQWIN code.
- Risk posture:
  - Safe from direct runtime corruption (no write paths from servers).
  - Vulnerable to **drift** between written law and implemented behavior.
  - Requires periodic audits like this one to stay aligned.
