# Control App Research (Canonical)

Stamped: 2026-02-10T01:00+05:30

This file is the canonical location for the 30 Control App UX/latency/failure-visibility questions required by PROMPT-1.

Evidence anchor:
- Ingestion run: `e9212f692fbc420f846d7db14af0a278`
- Ingestion index: `../ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md`

Source mirror (legacy location):
- `../memory_mesh/control_layer/CONTROL_APP_RESEARCH.md`

---
## 30 UX / Latency / Failure-Visibility Questions (Control App)

### Q01 — What is the Control App’s definition of “truth” and where does it come from?
Why it matters: The UI must render backend truth, not simulated state.
What breaks if ignored: Operators act on fake data; governance collapses.
Where it applies:
- Top-level UI: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)
- Rules: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)

### Q02 — How should the UI represent UNKNOWN vs NOT_EXPOSED vs ERROR vs OFFLINE?
Why it matters: These states drive operator decisions and triage.
What breaks if ignored: Confusion, repeated retries, and false confidence.
Where it applies:
- Error boundary and mount: [main.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/main.tsx)
- Governance surfaces: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q03 — What is the minimum always-visible “system status strip” for survival-mode operation?
Why it matters: Operators need immediate visibility (KNEZ health, TAQWIN health, active session, tool lock).
What breaks if ignored: Debugging requires hunting through panels; slow incident response.
Where it applies:
- App shell: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)
- Orchestrator: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

### Q04 — How does the UI guarantee “approval required” for any execution authority?
Why it matters: Prevents accidental execution and boundary violations.
What breaks if ignored: Unsafe actions occur without human intent.
Where it applies:
- Approval UI: [ApprovalPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/ApprovalPanel.tsx)
- Governance panel triggers: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q05 — What is the UX contract for “checkpoint barrier reached” (checkpoint_0001)?
Why it matters: The UI must show a hard stop with evidence links, not a generic success toast.
What breaks if ignored: Operators push beyond allowed scope; governance fails.
Where it applies:
- Checkpoint file: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)
- Governance panel “activation” flows: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q06 — How does the UI render very large logs (millions of lines) without freezing?
Why it matters: Ingestion evidence and event stores are massive.
What breaks if ignored: UI becomes unusable when inspecting truth.
Where it applies:
- Memory explorer: [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)

### Q07 — What is the pagination/search strategy for sessions.db-sized data sets?
Why it matters: DB is ~1GB; naive rendering will fail.
What breaks if ignored: Timeouts, OOM, slow queries, UI stalls.
Where it applies:
- Memory explorer: [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)
- KNEZ memory endpoints (backend contract): [api.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/memory/api.py)

### Q08 — How does the UI surface “why a decision happened” (router/governance reasons)?
Why it matters: Operators need explainability to trust automation.
What breaks if ignored: Decisions look random; operators disable automation.
Where it applies:
- Governance panel: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)
- KNEZ router: [router.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/KNEZ/knez/knez_core/router/router.py)

### Q09 — What is the correct UI treatment for “broken Markdown links” in .taqwin docs?
Why it matters: The memory mesh is navigated by links; broken links are integrity failures.
What breaks if ignored: Operator cannot reach evidence; corrupted navigation persists.
Where it applies:
- Index: [INDEX.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/INDEX.md)
- Governance doc viewers in UI (search within GovernancePanel and file viewer utilities)

### Q10 — What is the operator workflow for “outdated/present/next” temporal labeling?
Why it matters: Helps prevent acting on outdated guidance.
What breaks if ignored: Operators implement old plans, causing rework.
Where it applies:
- Temporal labels: [temporal_labels.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/temporal_labels.md)
- App navigation: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)

### Q11 — How should the UI reflect “tool legality” (allowed/denied) in real time?
Why it matters: Denials must be visible and traceable.
What breaks if ignored: Users repeat actions without understanding policy.
Where it applies:
- TAQWIN tool policy: [tool_policy.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/taqwin/tool_policy.py)
- Approval UI: [ApprovalPanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/ApprovalPanel.tsx)

### Q12 — What is the UI contract for “manifest evidence” viewing (JSONL + summary)?
Why it matters: PROMPT-1 evidence lives in `.taqwin/ingestion/*`.
What breaks if ignored: Ingestion exists but cannot be audited by operator.
Where it applies:
- Ingestion index: [INDEX_e9212f...](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md)
- Governance panel “file viewing”: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q13 — What is the safest UI model for editing append-only files (logbooks, tickets)?
Why it matters: Append-only must be enforced at the UI layer too.
What breaks if ignored: UI enables destructive edits; lineage breaks.
Where it applies:
- Memory log: [log.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/memory/log.md)
- Tickets log: [TQ_MASTER_LOG.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/tickets/TQ_MASTER_LOG.md)

### Q14 — How should the UI display “confidence” without encouraging hallucination?
Why it matters: Confidence should be evidence-based, not style-based.
What breaks if ignored: Operators trust high-confidence claims with no evidence.
Where it applies:
- Checkpoint confidence: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)

### Q15 — What is the correct UX for “HALT conditions” (read fail, boundary conflict)?
Why it matters: Halts are not errors; they are safety barriers.
What breaks if ignored: Users treat halts as bugs and bypass them.
Where it applies:
- Execution law: [execution.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/execution.md)
- Orchestrator and panels: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

### Q16 — How does the UI ensure stable IDs for messages and replay pointers?
Why it matters: Prevents drift between chat, tools, and event logs.
What breaks if ignored: Replays cannot correlate to UI messages.
Where it applies:
- ID contracts: [ID_CONTRACTS.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/ID_CONTRACTS.md)
- Memory explorer: [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)

### Q17 — What is the UI’s performance budget for streaming events (SSE) and rendering?
Why it matters: Prevents UI degradation and memory leaks.
What breaks if ignored: Stutters, CPU spikes, eventual crash.
Where it applies:
- Event consumption components (search for SSE/eventstream in `src/`)
- Error boundary: [main.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/main.tsx)

### Q18 — How does the Control App orchestrator start/stop local services safely?
Why it matters: Local models/backends can consume resources; must be controlled and visible.
What breaks if ignored: Zombie processes, port conflicts, and false “running” state.
Where it applies:
- Orchestrator: [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)
- Tauri shell integration: [lib.rs](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/src/lib.rs)

### Q19 — What is the minimal UI feature set to match “Cursor/Warp-like” operator flow?
Why it matters: Operator speed depends on navigation/search/command palette.
What breaks if ignored: Users leave the tool and operate via terminal only.
Where it applies:
- App shell: [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)

### Q20 — How should the UI represent “model selection is disallowed this phase”?
Why it matters: Phase discipline must be enforced visually.
What breaks if ignored: Users attempt forbidden actions; confusion rises.
Where it applies:
- Phase rules: [phase.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/present/phase.md)
- Governance panel: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q21 — What is the UX contract for “tickets as food supply” (PENDING/ACTIVE/DONE/BLOCKED)?
Why it matters: Tickets are the operator’s control mechanism for work.
What breaks if ignored: Work becomes untrackable; success signals vanish.
Where it applies:
- Tickets log: [TQ_MASTER_LOG.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/tickets/TQ_MASTER_LOG.md)
- Work tracking: [tickets.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/tickets.md)

### Q22 — How should the UI show “files affected” and link to exact code locations?
Why it matters: Acceptance criteria must be inspectable.
What breaks if ignored: Tickets become vague; verification stalls.
Where it applies:
- Ticket viewer components (search in UI codebase)
- Backend feature map: [backend-feature-map.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/reports/backend-feature-map.md)

### Q23 — What is the safest way to render Markdown with untrusted content?
Why it matters: Prevents XSS or unsafe link execution in a desktop app.
What breaks if ignored: Security vulnerabilities and compromised operator machine.
Where it applies:
- Markdown viewers (search in UI for markdown rendering libraries)
- Tauri security config (search in `src-tauri/` for allowlists)

### Q24 — How should the UI display cross-layer boundaries so operators can’t request impossible actions?
Why it matters: Prevents asking TAQWIN to do UI work or Control App to mutate memory.
What breaks if ignored: Invalid requests dominate; user trust erodes.
Where it applies:
- Boundaries: [boundaries/](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/boundaries/)
- Navigation/education surfaces: [GovernancePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/governance/GovernancePanel.tsx)

### Q25 — How should the UI handle massive file trees (48k files) for search/navigation?
Why it matters: Ingestion run proved repo scale.
What breaks if ignored: File browsing becomes unusable.
Where it applies:
- Ingestion index: [INDEX_e9212f...](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md)

### Q26 — What is the UI strategy for surfacing “broken invariants” (ID drift, missing manifests)?
Why it matters: Invariant failures must be obvious.
What breaks if ignored: System quietly becomes untrustworthy.
Where it applies:
- ID contracts: [ID_CONTRACTS.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/serialization/ID_CONTRACTS.md)
- Checkpoint barrier: [checkpoint_0001.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/checkpoints/checkpoint_0001.md)

### Q27 — How does the desktop host manage permissions for fs/shell/network plugins?
Why it matters: Prevents unintended escalation and unsafe operations.
What breaks if ignored: App can become a local exploit surface.
Where it applies:
- Tauri entry: [main.rs](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/src/main.rs)
- Tauri wiring: [lib.rs](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/src/lib.rs)

### Q28 — How should the UI expose “reset / recovery / rollback” without deleting history?
Why it matters: Recovery must be safe and lineage-preserving.
What breaks if ignored: Users “reset” by deleting evidence; governance dies.
Where it applies:
- Memory law: [memory.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules/memory.md)
- Work logs: [history.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/memory/history.md)

### Q29 — How should the UI prove “runtime-verified tickets only” as DONE?
Why it matters: “Done” must be tied to real runtime evidence.
What breaks if ignored: Tickets marked DONE without proof, causing regressions.
Where it applies:
- Rule #15: [rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- Verification reports: [CP12-verification.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/.taqwin/reports/CP12-verification.md)

### Q30 — What is the UX for “automatic diffs every 10 changes” (sidequest) without distracting operators?
Why it matters: Continuous feedback helps, but noise kills productivity.
What breaks if ignored: Operators ignore diffs or disable the feature.
Where it applies:
- UI driver skill docs: [SKILL.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/skills/ui-driver/SKILL.md)
- Work tracking surfaces: [task-graph.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/task-graph.md)
