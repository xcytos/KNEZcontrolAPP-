# CP02_SESSION_MEMORY_ANALYSIS — Ticket Set (15)

## CP02 Goal
Make session data durable, analyzable, and navigable via a consistent ID graph across Chat, Memory, Replay, and Reflection.

---

## CP02-T01 — Define stable ID contracts (session/message/snapshot/checkpoint)
Acceptance Criteria:
- Docs specify ID format and ownership.
- UI never reassigns IDs after persistence.

## CP02-T02 — Ensure chat persistence is complete and consistent
Acceptance Criteria:
- Every user message and assistant response is persisted.
- Edit/Resend keeps a single lineage pair (no clutter duplicates).

## CP02-T03 — Add “Analyze” flow that works for any session
Acceptance Criteria:
- Chat has a one-click “Analyze” navigation.
- Reflection pane loads summary + insights or shows actionable reason.

## CP02-T04 — Add “Session Library” with search and tags
Acceptance Criteria:
- Sessions list is searchable by name/id and tagged by outcome.

## CP02-T05 — Add session-to-memory links (evidence pointers)
Acceptance Criteria:
- Memory entries show evidence event ids and link back to timeline/replay.

## CP02-T06 — Reduce memory polling via cursor-based incremental fetch
Acceptance Criteria:
- Memory view fetches `since`/cursor instead of full list each time.

## CP02-T07 — Add “Checkpoint Browser” for checkpoints2 store
Acceptance Criteria:
- UI lists checkpoints by token_index and sha for a session.

## CP02-T08 — Add resume snapshot explorer UI
Acceptance Criteria:
- Shows snapshot_id, task state, accepted facts, constraints, open questions.

## CP02-T09 — Make lineage view show breadcrumb navigation and actions
Acceptance Criteria:
- Click ancestor session to switch view or open details.

## CP02-T10 — Add “Export Session Bundle” (chat + events + memory + checkpoints)
Acceptance Criteria:
- Export creates a bundle file via diagnostics export flow.

## CP02-T11 — Implement memory gate workflow end-to-end
Acceptance Criteria:
- Gate tab shows decisions and allows operator review actions.

## CP02-T12 — Add replay-to-chat reconciliation
Acceptance Criteria:
- Replay view can jump to the originating chat message id.

## CP02-T13 — Add cross-system flow links (Chat ↔ MCP ↔ Memory ↔ Replay)
Acceptance Criteria:
- UI provides consistent navigation shortcuts across views.

## CP02-T14 — Add tests for persistence + analysis flows
Acceptance Criteria:
- Unit tests for edit/resend pairing and persistence.
- E2E tests verify analysis reachable and non-stuck.

## CP02-T15 — Define microservice boundaries for low latency
Acceptance Criteria:
- Document target services/modules and critical paths.
- Budgets: chat stream p95, tool-call p95, memory query p95.

