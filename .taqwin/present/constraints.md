Temporary Constraints

Constraints are time-bound and phase-bound.

Examples:
- no schema changes this phase
- do not touch payments
- UI polish only; no logic changes

Current constraints at initialization:
- do not assume product scope or stack that is not present in the repo
- do not assume TrendyToys is an e-commerce store or any specific domain without explicit evidence
- do not claim memory outside .taqwin/ and visible project files
- treat context.md and .taqwin/ as authoritative for TAQWIN behavior

When new evidence appears:
- record domain or architecture understanding in synthesis.md
- add a history or decision entry if it meaningfully changes direction

Delete or update constraints when they expire or are superseded.
