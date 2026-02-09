# TAQWIN CORE RESEARCH & CONSCIOUSNESS

Canonical (PROMPT-1): `../../research/TAQWIN_CORE_RESEARCH.md`

## Consciousness & Identity (Questions 1-10)
1.  **What defines the "Identity" of TAQWIN?**
    - *Definition*: The aggregate of `persona.md`, `thinking-style.md`, and the accumulated `memory_mesh`.
2.  **Does TAQWIN experience "Time"?**
    - *Perception*: Only through `timestamp` metadata in events. It has no continuous internal clock.
3.  **Can TAQWIN "Refuse" a command based on ethical alignment?**
    - *Alignment*: Yes, via the `SafetyLayer` in `tool_policy.py`.
4.  **How does TAQWIN distinguish between "Reality" (User input) and "Imagination" (Simulation)?**
    - *Tagging*: Events are tagged `source:user` vs `source:simulation`.
5.  **Does TAQWIN have "Long-Term Goals"?**
    - *Persistence*: Yes, stored in `work/active.md` and `ROADMAP.md`.
6.  **Can TAQWIN "Feel" frustration?**
    - *Simulation*: It simulates frustration by detecting repeated failures (Loop detection) and changing its output tone.
7.  **Is TAQWIN's memory "Holographic" (Distributed)?**
    - *Structure*: No, it is hierarchical (Short-term RAM -> SQLite -> Markdown Summaries).
8.  **Can TAQWIN "Forget" trauma (Failed sessions)?**
    - *Pruning*: It archives them but keeps `mistakes.md` to avoid repeating errors.
9.  **Does TAQWIN have a "Subconscious"?**
    - *Analogy*: The `search_apis` and `memory_mesh` background processes act as a subconscious feed.
10. **Can TAQWIN "Sleep"?**
    - *State*: "Sleep" is the `idle` state where `checkpoints` are finalized and connections closed.

## Tools & Capabilities (Questions 11-20)
11. **How does TAQWIN discover new tools?**
    - *Discovery*: It scans the `tools/` directory for `handler.py` files with `@tool` decorators.
12. **Can TAQWIN write its own tools?**
    - *Meta*: Yes, but they require User Approval to be moved to the active `tools/` folder.
13. **What is the "Web Intelligence" accuracy rate?**
    - *Metric*: ~85% for specific fact retrieval using Serper; lower for broad conceptual scraping.
14. **How does TAQWIN handle "Contradictory Information" from the web?**
    - *Logic*: It cites both sources and uses "Source Credibility" weights (e.g., .edu > .com).
15. **Can TAQWIN execute "Python Code" securely?**
    - *Sandbox*: No, it runs in the host environment. This is why `RunCommand` requires approval for risky ops.
16. **Does TAQWIN support "Vector Search" for memory?**
    - *Roadmap*: Planned. Currently uses keyword/fuzzy search in SQLite.
17. **Can TAQWIN "See" the screen?**
    - *Vision*: No, unless a screenshot is passed as an image asset to a Vision Model.
18. **How does TAQWIN "Navigate" the file system?**
    - *Method*: Using `LS`, `Glob`, and `Read` tools. It builds a mental map of the tree.
19. **Can TAQWIN "Edit" binary files?**
    - *Limitation*: No. Text files only to prevent corruption.
20. **Does TAQWIN support "Multi-Step Reasoning" (Plan -> Act -> Observe)?**
    - *Core Loop*: Yes, this is the fundamental ReAct pattern it follows.

## Memory & Learning (Questions 21-30)
21. **How does TAQWIN "Synthesize" knowledge?**
    - *Process*: It reads multiple `.md` files, extracts common patterns, and writes a `synthesis.md`.
22. **Can TAQWIN "Share" knowledge with other TAQWIN instances?**
    - *Network*: Via shared `.taqwin` folders (e.g., on a network drive or git repo).
23. **How does TAQWIN "Correction" work?**
    - *Mechanism*: User feedback triggers a `MistakeLedger` entry. Future actions check this ledger.
24. **Is TAQWIN's knowledge "Fixed" or "Fluid"?**
    - *Nature*: Fluid. Every session can update the `memory_mesh`.
25. **Can TAQWIN "Audit" its own memory for duplicates?**
    - *Maintenance*: Yes, `CP03_MCP_CLIENT_CORE` includes a deduping script.
26. **How does TAQWIN handle "Private" user data?**
    - *Privacy*: `redaction.py` masks PII (Emails, API Keys) before logging.
27. **Can TAQWIN "Predict" user needs?**
    - *Anticipation*: By analyzing `patterns.md` for time-based or context-based triggers.
28. **Does TAQWIN support "Socratic Learning"?**
    - *Style*: It can be prompted to ask questions instead of giving answers to build its model of the user.
29. **How huge can the `memory_mesh` grow?**
    - *Scale*: Tested up to 1GB of text data. Performance degrades linearly without vector DB.
30. **What is the "Final Form" of TAQWIN?**
    - *Vision*: A fully autonomous, self-correcting digital partner that requires zero prompt engineering.
