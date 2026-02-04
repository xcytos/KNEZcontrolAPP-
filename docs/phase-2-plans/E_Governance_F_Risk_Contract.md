# Group E: Governance & Approval Surfaces Contract

## Approval Surface Contract
Phase 2 introduces "Assisted Action" drafts (Phase 3 precursor) or logic that *could* have side effects. Governance requires explicit approval for these.

### What Requires Approval
- **Drafting Code**: Even if just showing a snippet, user must "Accept" it into the clipboard/file.
- **Ledgering a Mistake**: User must acknowledge or dispute.
- **Changing Rules**: Modifying core memories or constraints.
- **Phase Transition**: Moving from Phase 1 to Phase 2 (this very process).

### What Never Can Be Approved (In Phase 2)
- **Autonomous Execution**: "Fix this bug for me" (System runs `npm test` and edits files). -> **FORBIDDEN**.
- **Background Commits**: -> **FORBIDDEN**.
- **Secret Monitoring**: -> **FORBIDDEN**.

## Auditability
- **Action Log**: Every "Approve" and "Reject" click is logged to a secure, immutable session log.
- **Traceability**: Every KNEZ suggestion must link back to the *why* (Memory/Rule).

# Group F: Risk Register & Failure Analysis

## Risk 1: Over-Challenge (The "Nag" Factor)
- **Risk**: KNEZ challenges too often, user ignores it or disables it.
- **Mitigation**: Strict "Silence Bias". Start with high thresholds. User can "Snooze" challenges.

## Risk 2: Trust Erosion via Hallucination
- **Risk**: Reflection Mode invents a pattern that doesn't exist.
- **Mitigation**: **Evidence Linking is Mandatory**. If no linkable evidence, NO observation. "I don't know" is better than a guess.

## Risk 3: Cognitive Overload
- **Risk**: Drift Analysis + Mistakes + Reflection = Too much info.
- **Mitigation**: Progressive Disclosure. Phase 2 starts with Reflection *only*. Mistake Ledger and Drift are unlocked progressively or kept in background.

## Risk 4: Phase Leakage
- **Risk**: Phase 2 features accidentally enable Phase 3 autonomy.
- **Mitigation**: Strict separation of "Reasoning" vs "Acting" interfaces. The "Action" button simply *does not exist* in the Phase 2 UI kit.
