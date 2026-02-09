# Temporal Labels (Outdated / Present / Next)

Stamped: 2026-02-10T01:10+05:30

## Evidence Anchor
- Ingestion run: `e9212f692fbc420f846d7db14af0a278`
- Evidence index: `../ingestion/INDEX_e9212f692fbc420f846d7db14af0a278.md`

## Present (Authoritative “Now”)
- Source: `now.md`
- Active objective: CHECKPOINT 11 — Backend Coverage
- Success signal: CP11 tickets verified with tests/builds

## Present (Authoritative “Phase”)
- Source: `phase.md`
- Phase name: CHECKPOINT 1 — KNEZ ↔ Control App Protocol Alignment
- Phase update: CHECKPOINT 1.5 — Runtime Discovery & Observability

## Outdated (Evidence-Based Heuristic)
- Any checkpoint/ticket set explicitly superseded by a later `now.md` objective is OUTDATED unless referenced by an active ticket.
- Any document whose links point to non-existent paths (as of the ingestion run) is OUTDATED until repaired.

## Next (Evidence-Based Heuristic)
- Items declared as `next_checkpoint` in `.TAQWIN.md` are NEXT until promoted to Present.
- Roadmap items in `ROADMAP.md` not yet represented as ACTIVE tickets are NEXT.
