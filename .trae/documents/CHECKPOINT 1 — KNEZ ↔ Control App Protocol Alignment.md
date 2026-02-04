## Checkpoint State
- Identify **CHECKPOINT 1** as ACTIVE (Protocol Alignment) per roadmap.
- Treat `.taqwin/work/active.md` as the source of truth and reconcile it to reflect CHECKPOINT 1 (append-only history; PROMPT-005/006 remain recorded as completed milestones).

## Repository Survey (Read-Only Evidence)
- KNEZ runs a FastAPI server: [app.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/app.py#L18-L52)
- Key existing KNEZ endpoints:
  - Health: [health.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/api/health.py#L12-L19)
  - Chat completions (OpenAI-like, supports SSE streaming): [completions.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/api/completions.py#L184-L230)
  - Memory (read-only listing, includes confidence + evidence event IDs): [memory/api.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/memory/api.py#L13-L35)
  - Events tail (for presence/influence/governance traces): [events/api.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/events/api.py#L14-L21)
  - Replay/insights (reflection delegation): [replay/api.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/replay/api.py#L12-L35)
  - Session resume/fork (KNEZ-owned session lineage): [sessions.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/api/sessions.py#L31-L176)
- TAQWIN’s own KNEZ client uses `/v1/chat/completions` with `stream: False` and defaults KNEZ base URL to `http://localhost:8000`: [knez_client.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/taqwin/knez_client.py#L9-L28)

## Derived Work (Checkpoint 1 A–F)

### A) KNEZ Client Integration (HTTP)
- Replace the current Control App mock-first client with a strict **KNEZ-backed** client:
  - Base URL default aligns to KNEZ (`http://localhost:8000`).
  - Remove “silent mock fallback” behaviors; if KNEZ is unreachable, UI becomes read-only with explicit banner.
  - Implement a small, typed API layer matching KNEZ’s real routes:
    - `GET /health`
    - `POST /v1/chat/completions` (stream true/false)
    - `GET /events` (tail)
    - `GET /memory`
    - `GET /sessions/{id}/insights` and `/summary` (or `/replay` if needed)

### B) Session Bootstrap & Continuity
- On startup:
  - Load last **session pointer** from UI storage.
  - Validate it exists (e.g., `GET /events?limit=1&session_id=...` or `GET /memory?session_id=...`).
  - If valid: reuse it.
  - If invalid/absent: generate a new session ID (client-side uuid) and start it by sending first completion request with that `session_id` (KNEZ will record lineage as fresh).
- The Control App stores only the session ID pointer; no local reconstruction.
- Optional UI action (not automatic): “Resume session” can call KNEZ `/sessions/{session_id}/resume` which returns a **new session ID**.

### C) Message Flow Replacement (No Simulation)
- Replace simulated chat response flow with KNEZ completions:
  - Use `POST /v1/chat/completions` with `session_id`.
  - Do **not** provide `model` (Control App does not choose models).
  - Support both:
    - `stream: false` (simple JSON response)
    - `stream: true` SSE parsing (`data: {...}` chunks + `data: [DONE]`), as implemented in KNEZ: [completions.py](file:///c:/Users/syedm/Downloads/ASSETS/KNEZ/knez/knez_core/api/completions.py#L88-L166)
- Presence must mirror KNEZ-derived events:
  - At minimum: set RESPONDING during streaming/completion request; set OBSERVING at completion.
  - Pull latest `/events?session_id=...` after each message to display governance/influence traces without background polling.

### D) Memory Transparency (Read-Only)
- Remove local memory synthesis; Memory view becomes a rendering of `GET /memory`.
- Map KNEZ fields to UI:
  - `memory_id`, `summary`, `confidence`, `evidence_event_ids`, `retention_policy`, `created_at`, `session_id`.
- “Gaps” are rendered honestly:
  - If the API does not provide gaps, show “No gap data provided by KNEZ” rather than inventing.
  - Link evidence refs to `GET /events` lookups.

### E) Reflection Delegation
- Reflection button triggers KNEZ replay/insight endpoints:
  - `GET /sessions/{session_id}/insights` and `GET /sessions/{session_id}/summary`.
- Remove local reflection generation and display KNEZ-returned insight structures.

### F) Challenge & Influence Sync
- Challenges originate from KNEZ governance/influence traces (no local challenge invention).
- Implement a “KNEZ Events” section (or reuse existing Challenge UI) fed by `GET /events?session_id=...`:
  - Highlight events tagged `influence_execution`, `agent_governance`, `reflection`, `influence_kill_switch`, etc.
  - Render severity/type/name/payload safely (no raw stack traces).

## Settings / Trust Confirmation
- Settings page shows:
  - Endpoint
  - `/health` backends list + status
  - “Unverified” → user explicitly clicks “Trust this KNEZ instance” (stored as UI-only preference)
- No arbitrary URLs are treated as trusted unless health call succeeds and user confirms.

## Verification (Evidence-Driven)
- Start KNEZ server (local) and verify Control App:
  - Successful health check.
  - Session pointer created and persisted; restart resumes.
  - Chat message produces KNEZ completion text (no simulation).
  - Memory view populated from KNEZ `/memory`.
  - Reflection view populated from `/insights` + `/summary`.
  - Event traces visible after completions.
- Failure tests:
  - Stop KNEZ: Control App enters explicit read-only degradation mode; no fake responses.

## .taqwin Updates (Append-Only, Post-Verification)
- After verification, append checkpoint progress to:
  - `.taqwin/work/active.md`
  - `.taqwin/work/task-graph.md`
  - `.taqwin/present/now.md`
  - `.taqwin/present/phase.md`

## STOP CONDITIONS
- Ask human only for:
  - enabling cloud backends explicitly (KNEZ_CLOUD_* URLs)
  - any new auth/remote trust scheme
  - any request to permit MCP execution
  - any deployment choice
