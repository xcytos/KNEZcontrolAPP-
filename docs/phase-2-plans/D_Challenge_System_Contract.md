# Group D: Challenge System Contract

## Definition
The **Challenge System** is the active governance voice of KNEZ. It interrupts or nudges the user when critical thresholds (Mistakes, Drift, Rule Violations) are crossed.

## Preconditions for Challenge
A challenge can ONLY be issued if:
1.  **Evidence Exists**: KNEZ can point to specific Memory or Rules.
2.  **Confidence > Threshold**: (Default 0.8).
3.  **Debounce Passed**: Not spamming the user (e.g., max 1 challenge per 10 minutes unless critical).

## Escalation Levels
1.  **Soft Nudge** (Presence: OBSERVING -> REFLECTING)
    - *UI*: Subtle indicator change, maybe a small icon.
    - *Message*: None (or passive "Pattern detected").
    - *Trigger*: Minor drift, low recurrence mistake.

2.  **Explicit Challenge** (Presence: RESPONDING)
    - *UI*: Chat message, amber border.
    - *Message*: "Are you sure? This contradicts Rule #4."
    - *Trigger*: Clear rule violation, repeated mistake (2+ times).

3.  **Hard Challenge** (Presence: ALERT - *New State potentially*)
    - *UI*: Modal or blocking interaction (if permitted by safety level).
    - *Message*: "STOP. Critical Governance Violation imminent."
    - *Trigger*: Attempting restricted actions (e.g., Phase violation, deleting Mistake Ledger).

## Non-Interruptive Principle
- Unless "Hard Challenge" is triggered (rare), challenges should not steal keyboard focus or block input. They appear in the periphery or chat stream.
