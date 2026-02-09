# ID Contracts (CP02)

## IDs are Opaque
- Treat all IDs as opaque strings in UI, persistence, and logs.
- Never parse semantics from the ID beyond display-shortening.

## session_id
- Owner: KNEZ (server) and Control App (client fallback).
- Format: UUID without dashes (`uuid4().hex`) or equivalent opaque string.
- Invariant: once a session is created/selected, its ID never changes.

## message_id
- Owner: Control App (local persistence / UI).
- Format: UUID without dashes (preferred), otherwise time+random fallback.
- Invariant: a user message keeps the same `message_id` for retry/edit-resend.
- Pairing rule: assistant placeholder ID is `${message_id}-assistant` and must be stable.

## event_id
- Owner: KNEZ event store.
- Format: UUID.
- Invariant: immutable; used to reconcile replay ↔ memory evidence ↔ chat.

## snapshot_id (resume snapshots)
- Owner: KNEZ session store.
- Format: opaque string.
- Invariant: immutable once created; referenced by lineage entries.

## checkpoint (checkpoints2)
- Owner: KNEZ checkpoint writer.
- Identity: `(session_id, token_index, sha)` where `sha` verifies integrity.
- UI surface: show `token_index`, `sha` prefix, and `created_at`.

## Reconciliation Events
- Chat emits `chat_user_message` and `chat_assistant_message` into KNEZ events with payload fields:\n  - `message_id`, `from`, `reply_to_message_id`, `correlation_id`\n- Replay and Memory can use these events to jump back to the exact chat message.\n+

## doc_id (repository document identity)
- Owner: TAQWIN ingestion runner.
- Format: opaque string derived from `repo_relative_path + sha256_prefix` (do not parse semantics beyond display).
- Invariant: stable for a specific file content hash; if file content changes, doc_id changes.

## ingestion_run_id
- Owner: TAQWIN ingestion runner.
- Format: UUID without dashes (`uuid4().hex`) or equivalent opaque string.
- Invariant: unique per ingestion execution; used to join manifest + checkpoint evidence.

## chunk_id (hierarchical chunk identity)
- Owner: TAQWIN ingestion runner.
- Format: opaque string, hierarchy represented by delimiter only for display (do not parse for logic).
- Invariant: stable within a single ingestion_run_id; must include a reference to `doc_id`.

## manifest_id (evidence ledger identity)
- Owner: TAQWIN ingestion runner.
- Format: opaque string naming the manifest file(s) that record evidence for an ingestion run.
- Invariant: append-only; never rewrite prior manifests, add new segments if needed.
