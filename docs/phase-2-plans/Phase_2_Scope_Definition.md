# Phase-2 Scope Definition: Cognitive Expansion

## Overview
Phase 2 expands the Control App from a "Passive Observer" to an "Active Reflector". It introduces the ability for KNEZ to reason about history, identify patterns, and challenge the user—but NOT to act autonomously.

## Core Features (Unlocked in Phase 2)
1.  **Reflection Mode**: Structured analysis of past sessions.
2.  **Mistake Ledger**: Immutable record of errors and lessons.
3.  **Behavioral Drift Analysis**: Visual monitoring of intent vs. behavior.
4.  **Challenge System**: Governance voice that interrupts when rules are violated.

## Non-Goals (Strictly Forbidden)
- **Autonomous Coding**: KNEZ cannot write to files without user copy-paste.
- **Background Actions**: No hidden processes or network calls.
- **Moralizing**: Feedback is data-driven, not emotional.

## Governance & Safety
- **Explicit Approval**: All state changes (ledgering mistakes, updating rules) require user confirmation.
- **Evidence Linking**: All insights must link to raw memory/session data.
- **Silence Bias**: The system defaults to silence unless thresholds are met.

## Risk Analysis Summary
- **Primary Risk**: Trust erosion due to hallucinated patterns.
- **Mitigation**: Strict evidence requirements; "I don't know" default.
- **Secondary Risk**: "Nagging" behavior.
- **Mitigation**: High thresholds for Challenge System; Debouncing.

## Execution Recommendation
**PROCEED to PROMPT-005 (Phase-2 Execution)**.
The contracts are defined, risks are mitigated, and the boundary between reasoning (Phase 2) and acting (Phase 3) is clear.
