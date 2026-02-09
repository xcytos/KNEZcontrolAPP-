# TAQWIN Core Research (Canonical)

Stamped: 2026-02-10T01:00+05:30

This file is the canonical location for the 30 TAQWIN cognition questions required by PROMPT-1.

Evidence anchor:
- Ingestion run: `e9212f692fbc420f846d7db14af0a278`
- Ingestion index: `../ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md`

Source mirror (legacy location):
- `../memory_mesh/taqwin_layer/TAQWIN_CORE_RESEARCH.md`

---
## 30 Core Cognition Questions (TAQWIN)

### Q01 — What is the minimal “truth surface” TAQWIN must maintain to avoid hallucination?
Why it matters: TAQWIN must know what is evidence-backed vs inferred to preserve cognition survival.
What breaks if ignored: The system can “sound correct” while corrupting the memory mesh with false claims.
Where it applies:
- TAQWIN tool dispatch: [mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py), [tool_registry.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py)
- Governance rules: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md), [survival.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/survival.md)

### Q02 — How does TAQWIN prove a repo-wide statement without quoting entire files?
Why it matters: Repo-wide claims need scalable evidence (manifests) to avoid brittle “manual reading”.
What breaks if ignored: Either the system skips evidence or floods output, both causing cognition failure.
Where it applies:
- Ingestion runner: [prompt1_ingest_repo.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/scripts/prompt1_ingest_repo.py)
- Memory law: [memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)

### Q03 — What is the canonical identity for a document, a chunk, and an ingestion run?
Why it matters: Stable identity enables replay, dedup, and lineage.
What breaks if ignored: Merges become ambiguous; “where did this come from?” cannot be answered.
Where it applies:
- ID contracts: [ID_CONTRACTS.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/ID_CONTRACTS.md)
- Execution law: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)

### Q04 — When should TAQWIN HALT vs degrade gracefully?
Why it matters: Survival requires hard stops for integrity failures, soft stops for non-critical missing optional data.
What breaks if ignored: Either constant halts (no progress) or silent corruption (hallucination risk).
Where it applies:
- Authority contract: [authority.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/authority.md)
- TAQWIN MCP activation behavior: (tool responses captured in checkpoint_0001)

### Q05 — How should TAQWIN model “unknown” vs “unverified” vs “false”?
Why it matters: These states drive whether to proceed, ask for evidence, or block execution.
What breaks if ignored: False confidence becomes indistinguishable from verified truth.
Where it applies:
- Rules: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md), [constraints.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/constraints.md)
- UI truth surfaces: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q06 — What is the minimal checkpoint payload that enables full recovery?
Why it matters: Checkpoints are the safeline; they must contain enough evidence pointers to resume ingestion or audit.
What breaks if ignored: “Checkpoint files exist” but cannot restore context; recovery is fake.
Where it applies:
- Checkpoint barrier: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)
- Existing checkpoint ticket sets: [checkpoints/](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/)

### Q07 — How does TAQWIN guarantee append-only updates for Markdown governance files?
Why it matters: Governance artifacts must be auditable and lineage-safe.
What breaks if ignored: Rules drift silently and invalidate prior decisions.
Where it applies:
- Memory log: [log.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/memory/log.md)
- README/INDEX append sections: [README.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/README.md), [INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)

### Q08 — What is TAQWIN’s “tool legality gate” and how is it enforced?
Why it matters: Prevents tools from violating boundaries and memory truth.
What breaks if ignored: Tools become a bypass of governance (silent writes, secret leaks, unsafe exec).
Where it applies:
- Tool policy: [tool_policy.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/taqwin/tool_policy.py)
- Tool registry: [tool_registry.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py)

### Q09 — How should TAQWIN represent “boundaries” as executable rules, not prose?
Why it matters: Boundaries must be enforceable by the system, not only readable by humans.
What breaks if ignored: Boundary docs exist but violations still occur.
Where it applies:
- Boundaries: [taqwin.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/taqwin.md), [knez.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/knez.md), [control_app.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/control_app.md)
- KNEZ ↔ TAQWIN bridge: [adapter.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/integrations/taqwin/adapter.py)

### Q10 — What is the correct “authority ladder” when TAQWIN and KNEZ disagree?
Why it matters: Prevents deadlocks and maintains deterministic governance.
What breaks if ignored: Conflicting persistence decisions cause memory corruption or loss.
Where it applies:
- Governance doc: [README.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/README.md)
- KNEZ governance logic: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)

### Q11 — How does TAQWIN ensure “sessions are task-bound” in storage and UI?
Why it matters: Prevents cross-task contamination and uncontrolled memory blending.
What breaks if ignored: Old tasks leak into new tasks, creating false continuity.
Where it applies:
- Sessions tool: [handler.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/tools/sessions/handler.py)
- Control UI session explorer: [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)

### Q12 — What is the minimal “anti-fabrication” checklist before producing a final output?
Why it matters: Prevents corrupted delivery as “confident” answers.
What breaks if ignored: Output contains invented endpoints, wrong folder paths, or missing-file claims.
Where it applies:
- Rules: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- Checkpoint barrier contract: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)

### Q13 — How should TAQWIN treat Markdown links that point to missing paths?
Why it matters: Broken links are integrity failures in the memory mesh.
What breaks if ignored: Operators navigate into voids; knowledge graphs become misleading.
Where it applies:
- Index links: [INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)
- Mesh map: [MEMORY_MESH.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/MEMORY_MESH.md)

### Q14 — How should TAQWIN summarize “what exists” without being tricked by case-insensitive paths?
Why it matters: Windows path casing can hide portability bugs.
What breaks if ignored: Linux/CI runs break while Windows seems fine.
Where it applies:
- Repo docs that reference `.TAQWIN` vs `.taqwin`: [synthesis.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/synthesis.md), [MEMORY_MESH.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/MEMORY_MESH.md)

### Q15 — What is the “minimum viable evidence” for web intelligence outputs?
Why it matters: Web claims must be traceable to sources to prevent corruption.
What breaks if ignored: Scraped/queried data becomes indistinguishable from hallucination.
Where it applies:
- Web intelligence manager: [web_intelligence_manager.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/web_intelligence_manager.py)

### Q16 — How does TAQWIN separate cognition from execution in code paths?
Why it matters: Prevents unsafe execution triggered by “thought”.
What breaks if ignored: Tools become used as implicit execution rather than controlled operations.
Where it applies:
- MCP server: [mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py)
- Execution law: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)

### Q17 — What should be the canonical prompt serialization format (IDs, ranges, lineage)?
Why it matters: Enables deterministic replay and auditing of prompt-driven changes.
What breaks if ignored: Prompt drift makes it impossible to know which rules were active.
Where it applies:
- Prompt serialization: [prompts.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/prompts.md)
- Prompts archive: [prompts/](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/prompts/)

### Q18 — How does TAQWIN quantify “hallucination risk” as a decision input?
Why it matters: HALT conditions must be triggered by a consistent rule, not vibes.
What breaks if ignored: Either paranoid halting or reckless invention.
Where it applies:
- Rules: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- Authority: [authority.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/authority.md)

### Q19 — What is the smallest set of invariants that must never change across versions?
Why it matters: Defines “constitution” of TAQWIN governance.
What breaks if ignored: Every refactor invalidates memory truth and checkpoints.
Where it applies:
- Survival law: [survival.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/survival.md)
- Authority: [authority.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/authority.md)

### Q20 — How should TAQWIN represent “XP” without letting it bias truth?
Why it matters: XP is accounting, not evidence; truth must remain evidence-based.
What breaks if ignored: The system optimizes for XP accumulation rather than correctness.
Where it applies:
- Ingestion summary output: [INDEX_e9212f...](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md)

### Q21 — How does TAQWIN handle binary files under “read everything” law?
Why it matters: Monorepos contain binaries; ingestion must not fail or pretend.
What breaks if ignored: Either ingestion halts unnecessarily or files are silently skipped.
Where it applies:
- Ingestion runner streaming: [prompt1_ingest_repo.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/scripts/prompt1_ingest_repo.py)

### Q22 — What is the canonical definition of “DONE” for an indexing update?
Why it matters: Prevents false completion claims.
What breaks if ignored: “Index updated” becomes meaningless and untestable.
Where it applies:
- Index: [INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)
- Work logs: [work/ticket-history.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/ticket-history.md)

### Q23 — What “council” behaviors are allowed under strict boundaries?
Why it matters: Councils amplify capability but can violate memory truth if unconstrained.
What breaks if ignored: Delegated agents can create conflicting outputs or unauthorized writes.
Where it applies:
- Council bridge behavior: [mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py)
- KNEZ governance: [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)

### Q24 — How does TAQWIN ensure “no file may be skipped” is measurable?
Why it matters: “No skip” must be verifiable.
What breaks if ignored: Hidden exclusions become silent corruption vectors.
Where it applies:
- Ingestion manifest footer evidence: `.taqwin/ingestion/manifest_*.jsonl` (run-specific)
- Checkpoint evidence: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)

### Q25 — What is the governance-safe way to update existing `.md` files (“stamping”)?
Why it matters: Mass edits can corrupt meaning; must be controlled and reversible.
What breaks if ignored: Git noise, broken docs, and loss of original intent.
Where it applies:
- Append-only rule: [memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)
- Change log: [log.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/memory/log.md)

### Q26 — How does TAQWIN treat “present/phase” documents that mention unrelated domains?
Why it matters: Misnamed domains can misroute cognition; must treat as constraints, not truth.
What breaks if ignored: Incorrect domain assumptions get embedded into memory mesh.
Where it applies:
- Phase constraints: [phase.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/phase.md)
- Constraints: [constraints.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/constraints.md)

### Q27 — How should TAQWIN support local ≤7B models without losing correctness?
Why it matters: Capability limits require stronger serialization and stricter evidence references.
What breaks if ignored: Local models hallucinate or lose long context during ingestion.
Where it applies:
- Execution law checkpoint budgeting: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)
- Ingestion manifest (externalized memory): `.taqwin/ingestion/*`

### Q28 — What is the canonical “handoff” format from TAQWIN to Control App?
Why it matters: Operators need deterministic, scannable outputs to act safely.
What breaks if ignored: UI cannot display, filter, or confirm results reliably.
Where it applies:
- Tool contracts: [tools_v1.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/contracts/tools_v1.py)
- Governance UI: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q29 — How does TAQWIN represent “boundary conflicts” so they are actionable?
Why it matters: Conflicts must be diagnosable (which rule, which file, which scope).
What breaks if ignored: Endless debates and “soft failures” that never resolve.
Where it applies:
- Boundaries docs: [boundaries/](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/)
- KNEZ router/governance: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py), [governance.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/cognitive/governance.py)

### Q30 — What is the exact definition of “SYSTEM STATE: STABLE” at Checkpoint-0001?
Why it matters: Stability must be measurable (no read failures, manifests exist, links navigable).
What breaks if ignored: “Stable” becomes ceremonial and cannot guard further execution.
Where it applies:
- Checkpoint barrier: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)
- Ingestion evidence: [INDEX_e9212f...](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md)
