# Group C: Behavioral Drift Analysis Contract

## Definition
**Behavioral Drift Analysis** monitors the divergence between "stated intent" (e.g., PRD goals, rules) and "actual behavior" (e.g., code changes, chat interactions) over time.

## Signals
- **Intent**: PRD text, "Rules" memory entries.
- **Behavior**: Git commits (frequency, size), Chat sentiment/focus, Session duration.

## Drift Types
1.  **Scope Drift**: Working on features not in the active PRD.
2.  **Rule Drift**: Violating established constraints (e.g., "No autonomous action") repeatedly.
3.  **Focus Drift**: Rapid context switching between unrelated tasks.

## Visualization Rules (Non-Judgmental)
- **Show, Don't Tell**: Display the data (e.g., "80% of recent edits are outside the planned module"), do not scold (e.g., "You are distracted").
- **Neutral Framing**: Use terms like "Divergence", "Variance", "Unmapped Activity".
- **Visual Only**: Drift Analysis produces graphs/charts. It does not interrupt the user unless the **Challenge System** threshold is crossed.

## Failure Modes
- **False Positives**: High drift detected during legitimate exploration/refactoring. Mitigation: User can "Bless" a drift as a "Pivot".
