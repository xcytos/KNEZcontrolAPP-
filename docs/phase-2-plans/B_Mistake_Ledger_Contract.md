# Group B: Mistake Ledger Contract

## Definition
The **Mistake Ledger** is an immutable record of acknowledged errors, failures, and "lessons learned". It serves as the "negative memory" to prevent recurrence.

## Mistake Definition
A **Mistake** is:
- A decision that led to a governance violation.
- A code change that was reverted due to failure.
- A logic error acknowledged by the user (e.g., "I shouldn't have ignored that warning").
- A process violation (e.g., skipping a PRD step).

A **Mistake** is NOT:
- A syntax error caught by a linter.
- A temporary typo.
- A subjective preference change.

## Immutability Rules
1.  **No Silent Deletion**: Once a mistake is ledgered, it cannot be deleted without a trace. "Deletion" is implemented as "Archived/Resolved" with a timestamp and reason.
2.  **Disagreement Record**: If the user disagrees with KNEZ's assessment of a mistake, the disagreement itself is logged linked to the mistake. The mistake is NOT erased; it is annotated as "Disputed".

## Data Structure
- `id`: UUID
- `timestamp`: ISO8601
- `context`: Snapshot of the decision/action.
- `outcome`: What went wrong.
- `user_acknowledgement`: "Agreed", "Disputed", "Ignored".
- `recurrence_count`: Integer (auto-incremented on similar patterns).

## Visualization
- A dedicated view in Memory Explorer (filtered list).
- Visual "Heatmap" of mistake types (e.g., "Architecture" vs "Implementation").
