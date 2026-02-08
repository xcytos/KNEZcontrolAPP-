---
name: "auto-mode"
description: "Runs in ticketed auto-execution loop. Invoke when user says auto mode or prefixes with 'm,' to: analyze, create tickets, execute, verify, then serialize plans."
tags: tickets, verification, taqwin, execution, chat
version: "1.0.0"
---

# Auto Mode (Ticketed Execution)

## When To Invoke
- The user says: “auto mode”
- The user prefixes a message with: `m,`
- The user requests: “create tickets then execute all, verify, then nextplan”

## Response / Execution Structure
1. **Analysis**
   - Reconstruct context from `.taqwin/`
   - Identify phase + constraints
   - State what is known vs assumed
2. **Plan**
   - Minimal, ordered steps with verification checkpoints
3. **Ticket Creation**
   - Create a numbered ticket set (15 items unless otherwise requested)
   - Each ticket has: goal, scope, acceptance criteria, runtime verification steps
   - Mark BLOCKED tickets explicitly (with reason + unblocking condition)
4. **Execute Ticket Set**
   - Execute tickets one-by-one
   - After each ticket: runtime verify in the desktop app, then serialize evidence into `.taqwin/work/tickets.md`
5. **Run Real Tests**
   - Prefer real desktop E2E over simulated/browser-only checks
   - If the test harness fails, treat the ticket set as NOT VERIFIED and fix
6. **Next Plan**
   - Create `nextplan.md` based on runtime findings and gaps
   - Execute it with the same discipline
7. **Finalize**
   - Produce a verification report under `.taqwin/reports/`
   - Commit and push only after verification is green

## Hard Rules
- No “VERIFIED” without runtime evidence (desktop app + real E2E)
- No simulation in production paths or default tests
- Do not assume endpoints exist; verify via code scan or `/health`
