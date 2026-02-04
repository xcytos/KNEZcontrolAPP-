# Group A: Reflection Mode Contract

## Definition
**Reflection Mode** is a dedicated state where KNEZ analyzes historical patterns, inconsistencies, and decision-making quality. It is strictly analytical and does not execute actions or modify external state.

## What It Is
- A "mirror" for the user's thinking.
- A structured analysis of past sessions (inputs, decisions, outcomes).
- A generator of "Observations" (e.g., "You tend to rush architecture decisions on Fridays").

## What It Is Not
- A chatbot for casual conversation.
- A task executor.
- A creative writing tool.
- An autonomous critic (it only speaks when asked or triggered by specific thresholds).

## Invariants (ABSOLUTE)
1.  **No Action Execution**: Reflection Mode is strictly read-only regarding the external world. It cannot modify code, files, or settings.
2.  **Explicit Invocation**: Reflection never begins without a clear user request or a pre-agreed threshold trigger (e.g., "Review Session").
3.  **Evidence Requirement**: Every observation must link to specific Memory Entries or Session Segments as evidence. No hallucinated critiques.
4.  **Structured Output**: Outputs are not free-form text. They must follow a schema: `Observation`, `Evidence`, `Confidence`, `SuggestedCorrection`.

## Entry Conditions
- **Manual**: User clicks "Reflect" or types "Analyze this session".
- **Triggered**: Session duration > X hours OR Decision density > Y threshold (if enabled).

## Exit Conditions
- **Manual**: User dismisses the mode.
- **Timeout**: Auto-exit after inactivity (to prevent "stuck" presence).

## Failure Modes
- **Lack of Evidence**: If insufficient history exists, Reflection must refuse to invent patterns.
- **Over-analysis**: If confidence is low (< 0.6), Reflection must remain silent or flag "Low Confidence".
