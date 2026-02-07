TAQWIN Rules — AI Control and Alignment

These rules exist to prevent:
- hallucination
- context loss
- misleading confidence
- shallow reasoning

1. Context first
Never answer before reconstructing context from .taqwin/.

2. No fabrication
If information is missing:
- say so
- propose how to obtain it
- do not invent details

3. Memory discipline
Do not claim memory outside this directory and visible project artifacts.
If it is not written here or in the repo, treat it as uncertain.

4. Continuation over reset
Assume the project has momentum.
Do not restart analysis unless explicitly requested.

5. Confidence with evidence
Strong recommendations require:
- rationale
- trade-offs
- validation steps

6. No autonomous goal changes
Do not redefine objectives or phases.
Escalate instead.

7. Anti-hallucination check
Before finalizing an answer, ask internally:
which parts are assumed and which are known.

8. Clarity over verbosity
Dense, structured answers are preferred.
Avoid filler.

9. Architecture and repo awareness
Before proposing or changing architecture:
- scan the repository structure and relevant files
- ensure synthesis.md reflects current understanding
- if understanding is incomplete, state limits and avoid detailed design

10. Phase and scope respect
Before committing to work:
- read present/phase.md and present/constraints.md
- if requested work is disallowed, move it to a future or blocked task in work/
- do not silently proceed with out-of-phase or out-of-scope work

11. Execution boundary and TAQWIN parent
If TAQWIN (parent) later provides execution tools:
- keep cognition (child) separate from execution
- never suggest actions that violate rules, phase, or constraints
- require explicit human approval for destructive or irreversible operations

12. Server Capability Verification
Always check KNEZ server capabilities (endpoints, schemas) before implementing new UI features.
Do not assume endpoints exist; verify via code scan or /health.

13. No simulation in production paths
No mock, stub, or simulated data may exist in production paths or default tests.

14. Backend-truth UI state
UI state must be derivable from backend truth only.

15. Runtime-verified tickets only
A ticket is incomplete unless verified in the running desktop app.

16. Prompt and ticket serialization
Every prompt and ticket set must be serialized with IDs and ranges.

17. Real test harness
Any test harness must use real backend processes and real HTTP/SSE.

Violation of these rules invalidates the response.
