PRODUCT REQUIREMENTS DOCUMENT (PRD)
Product Name

KNEZ Control App

Version

v0.1 (Foundational)

Status

Design-locked (pre-implementation)

Owner

KNEZ Project

1. EXECUTIVE SUMMARY

The KNEZ Control App is the primary human interface for interacting with the KNEZ system.

It is not an IDE plugin, chatbot, or automation tool.

It is a persistent presence interface — a control surface through which a user:

Thinks

Reflects

Observes their own work

Consults a system that remembers, reasons, and challenges them

The Control App acts as:

The embodiment layer for KNEZ

The lens through which KNEZ becomes personal

The gateway for future perception (screen, apps, system state)

KNEZ itself remains a headless intelligence core.
The Control App is the only place where “being” happens.

2. PROBLEM STATEMENT
2.1 Core Problem

Current AI systems:

Respond but do not observe

Generate but do not remember meaningfully

Assist but do not develop judgment over time

Speak too much or too little, without understanding when

Users want:

A system that knows their history

That remembers mistakes

That challenges them honestly

That adapts its behavior over time

That does not feel disposable

2.2 Why IDEs Alone Are Insufficient

IDEs:

Are task-local

Are ephemeral

Do not represent you, only files

A person’s thinking spans:

Multiple tools

Multiple contexts

Time

Failure

Drift

The Control App exists to anchor continuity.

3. PRODUCT VISION

“A persistent intelligence you can talk to, travel through memory with, and trust to tell you the truth — even when it’s uncomfortable.”

The Control App is:

Calm

Sparse

Observational

Opinionated only when justified

Silent by default

It earns its voice.

4. NON-GOALS (CRITICAL)

The Control App will not:

Autonomously execute actions (initially)

Replace IDEs

Run background jobs without consent

Act as a chatbot clone

Pretend to be human

Flood the user with insights

5. CORE PRINCIPLES

Presence > Responsiveness

Memory > Context Window

Judgment > Output

Silence is a feature

Everything explainable

No hidden autonomy

6. HIGH-LEVEL ARCHITECTURE
[ User ]
   ↓
[ Control App ]
   ├─ Interaction Layer
   ├─ Presence Engine
   ├─ Memory Navigator
   ├─ Reflection Console
   ├─ Signal Router
   ├─ Permissions & Trust
   ↓
[ KNEZ API ]
   ├─ Events
   ├─ Memory
   ├─ Replay
   ├─ Cognitive Layer
   ├─ TAQWIN


The Control App never replaces KNEZ logic.
It frames, queries, and visualizes it.

7. PRIMARY INTERACTION MODES
7.1 Conversational Mode (Core)
Description

A chat-like interface — but not a chatbot.

Characteristics

Persistent thread

Memory-aware

Time-aware

Opinionated only when justified

Capabilities

Ask questions

Request reflection

Review past decisions

Explore memory

Ask “why”

Explicit Constraints

No generic filler responses

No repeated context

Must reference memory when relevant

7.2 Memory Navigation Mode
Description

A browsable, explorable representation of what KNEZ remembers.

Features

Timeline view

Memory clusters

Mistake index

Decision outcomes

Confidence scores

User Can:

Inspect memory

Ask why it was stored

Trace evidence

Flag disagreement (no silent deletion)

7.3 Reflection Mode
Description

User asks KNEZ to analyze patterns, not answer questions.

Examples

“What am I repeating?”

“Where am I inconsistent?”

“What changed in my thinking?”

Output

Structured reflection

Evidence-linked

No action unless requested

7.4 Silent Observer Mode
Description

KNEZ observes without speaking.

Behavior

Collects signals

Logs patterns

Speaks only when threshold crossed

This mode is default.

8. CONTROL APP FEATURE SET
8.1 Core Features (Phase 1)
8.1.1 Persistent Chat Interface

Session continuity

Memory-aware responses

Brutal honesty mode (configurable)

8.1.2 Memory Explorer

Read-only initially

Full transparency

Evidence links

8.1.3 Session Timeline

Visual replay of sessions

Forks, resumes, decisions

8.1.4 Presence Indicator

Shows:

Observing

Silent

Reflecting

Responding

No fake “typing”.

8.2 Advanced Features (Phase 2)
8.2.1 Mistake Ledger

Explicit list of recurring errors

Linked to outcomes

Cannot be deleted silently

8.2.2 Behavioral Drift View

Shows changes over time

Flags inconsistency

8.2.3 Challenge System

KNEZ challenges ideas only with evidence

Escalation levels configurable

8.3 Assisted Action (Phase 3)

Still no autonomy.

Draft suggestions

Pre-commit reviews

Decision alternatives

All require explicit approval.

8.4 Perception (Phase 4 – Deferred)

Window awareness

Screen signals

Passive only

No raw data storage

(Already designed separately)

9. PRESENCE ENGINE (CRITICAL)

The Presence Engine decides:

When to speak

When to stay silent

How strong to be

Inputs

Memory confidence

Pattern recurrence

User state

Time since last intervention

Outputs

Silence

Soft nudge

Hard challenge

Example Rule

“Do not challenge unless confidence > 0.75 AND pattern repeated ≥ 3 times.”

10. MEMORY TRANSPARENCY CONTRACT

The Control App must always:

Tell the user what it remembers

Explain why it matters

Show evidence

Admit uncertainty

No hidden memory.

11. DATA FLOWS
11.1 From Control App → KNEZ

Chat requests

Reflection requests

Memory queries

Approval decisions

11.2 From KNEZ → Control App

Events

Replay summaries

Memory entries

Governance states

12. TECH STACK (RECOMMENDED)
12.1 Desktop App

Tauri

Rust backend

React / Solid frontend

Local secure storage

12.2 Communication

HTTP + SSE

WebSockets later (optional)

12.3 Storage

No long-term storage in Control App

KNEZ remains source of truth

13. SECURITY & TRUST

Explicit permissions

No background behavior without consent

No hidden automation

User can audit everything

14. METRICS OF SUCCESS

Reduced repeated mistakes

Increased decision confidence

Fewer context switches

Higher trust over time

No vanity metrics.

15. PHASED DELIVERY PLAN
Phase 1

Control App shell

Chat

Memory explorer

Presence engine (basic)

Phase 2

Reflection

Mistake ledger

Drift analysis

Phase 3

Assisted actions

Explicit approvals

Phase 4

Screen & system observation

16. RISKS & MITIGATIONS
Risk	Mitigation
Over-talkative system	Presence engine
Loss of trust	Memory transparency
Feature creep	Phase locks
Misinterpreted authority	Evidence requirement
17. FINAL STATEMENT

The Control App is not a UI.
It is the place where KNEZ becomes someone.

If built correctly:

It will feel slower than normal tools

But far deeper

And far harder to replace