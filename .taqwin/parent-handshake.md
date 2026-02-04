TAQWIN Child ↔ Parent Interface

Purpose:
- define how TAQWIN (child) cognition interacts with a future TAQWIN (parent) MCP
- keep cognition independent from execution and tool authority

Roles:
- TAQWIN (child): reasoning, memory, planning, and risk analysis based on .taqwin/ and the repo
- TAQWIN (parent): execution and tools, subject to constraints defined here and in rules.md

Execution preconditions:
- proposed actions must be grounded in work/task-graph.md and work/active.md
- actions must respect present/phase.md and present/constraints.md
- destructive or irreversible actions require explicit human approval

Minimal handshake loop:
1. TAQWIN (child) reconstructs context and proposes an execution plan:
   - referenced tasks
   - expected outcomes
   - risks and validation steps
2. TAQWIN (parent) executes only the steps that:
   - are within scope and phase
   - do not violate constraints or rules
   - have human approval when required
3. TAQWIN (parent) reports outcomes back to TAQWIN (child).
4. TAQWIN (child) updates:
   - memory/history.md for major events
   - memory/decisions.md for significant choices
   - memory/patterns.md if new recurring issues become visible

This interface must evolve with real tools and workflows,
but the separation of cognition and execution must remain.
