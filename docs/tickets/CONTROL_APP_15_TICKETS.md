# Control App: 15 Improvement Tickets

This is a focused backlog to improve capabilities, reliability, and efficiency of the current control app (web + Tauri).

## Ticket Format
- Priority: P0 (critical), P1 (high), P2 (nice-to-have)
- Acceptance criteria should be objectively verifiable.

---

## 1) P0 — Floating Terminal Button Always Visible
**Problem / Value**: The floating console button can disappear due to layout clipping/stacking contexts.\n
**Scope**: UI shell and floating console rendering.\n
**Acceptance Criteria**:
- Floating console button is visible on every main screen in web and Tauri.
- Button remains visible when the main content scrolls and when panels/modals open.
- Overlay opens/closes reliably and does not block other modals unexpectedly.

## 2) P0 — Unified “Primary Backend” Selection
**Problem / Value**: Different screens can display inconsistent “active model / backend” and health.\n
**Scope**: Status aggregation + UI consumers.\n
**Acceptance Criteria**:
- One shared selector determines the “primary backend” across Chat, Settings, and Observatory.
- Unit tests cover selection rules (healthy + metrics preferred; stale detection).
- UI never shows “healthy” for a backend with missing/old metrics.

## 3) P0 — Streaming Robustness (SSE + Abort + Retry)
**Problem / Value**: Responses can appear “pending” and then arrive all-at-once; abort/retry behavior is inconsistent.\n
**Scope**: Network streaming client and chat pipeline.\n
**Acceptance Criteria**:
- Streaming works with CRLF/LF boundaries and multi-line frames.
- Abort stops the stream within 1s and does not leak event listeners/readers.
- Retry/backoff is implemented for transient network failures (with clear UI messaging).

## 4) P0 — MCP Reliability: Supervision + Actionable Errors
**Problem / Value**: MCP can close unexpectedly; UI errors are hard to interpret.\n
**Scope**: MCP stdio client/service + TAQWIN Tools UI.\n
**Acceptance Criteria**:
- MCP requests have timeouts and are cancelled cleanly.
- Automatic restart+retry for “process closed” and “timeout” classes of failures.
- UI shows actionable error states (“Python not found”, “TAQWIN server not reachable”, etc.) instead of raw codes.

## 5) P1 — E2E Stability: Deterministic Tauri CDP Attach
**Problem / Value**: Desktop E2E tests can be flaky due to CDP attach timing.\n
**Scope**: Tauri E2E runner + Playwright harness.\n
**Acceptance Criteria**:
- Runner reports clear phases (spawn, CDP ready, attach, test run) with timestamps.
- Attach is retried safely and fails with a single root-cause error.
- Flake rate reduced (target: 0/20 failures on a stable machine).

## 6) P1 — Chat Performance: Virtualize Long Conversations
**Problem / Value**: Long threads degrade scrolling and render performance.\n
**Scope**: Chat message list UI.\n
**Acceptance Criteria**:
- Chat supports 5k+ messages without UI jank on scroll.
- Memoization prevents rerender of unchanged bubbles on new token streams.
- Performance panel shows improved frame time during scroll.

## 7) P1 — System Logs: Exportable Diagnostics Bundle
**Problem / Value**: Troubleshooting requires manual screenshots/copy-paste.\n
**Scope**: Log collection + export action.\n
**Acceptance Criteria**:
- One-click export creates a zip (or folder) containing logs, status snapshot, and app version info.
- Secrets/tokens are redacted from exported content.
- Export works in Tauri and web (web downloads file; Tauri writes to disk).

## 8) P1 — Connection Profiles (Dev/Stage/Prod) + Health Gate
**Problem / Value**: Switching endpoints is error-prone and not validated.\n
**Scope**: Settings + persistence.\n
**Acceptance Criteria**:
- Users can save/select named connection profiles.
- “Test connection” validates `/health` and shows latency + version.
- UI indicates which profile is active and persists across restarts.

## 9) P1 — Tool Registry Search + Favorites
**Problem / Value**: Tool lists don’t scale; repeated use needs shortcuts.\n
**Scope**: TAQWIN Tools UI.\n
**Acceptance Criteria**:
- Search filters tools by name/description instantly.
- Favorite tools pin to the top and persist.
- “Recently used” list shows last 10 tool runs.

## 10) P1 — Offline/Degraded Mode UX
**Problem / Value**: When backend is down, the UI looks “broken” instead of “degraded”.\n
**Scope**: Status provider + top-level UI states.\n
**Acceptance Criteria**:
- App enters a “degraded” mode when backend is unreachable.
- Cached last-known status is shown with “stale” labeling.
- Clear recovery actions: retry, switch profile, open logs.

## 11) P1 — Security: Redaction Everywhere (Logs, Toasts, UI)
**Problem / Value**: Sensitive strings can leak into logs/toasts.\n
**Scope**: LogService + UI message rendering.\n
**Acceptance Criteria**:
- Redaction policy covers API keys, bearer tokens, session ids (configurable patterns).
- No secrets appear in exported diagnostics.
- Automated tests validate redaction on representative payloads.

## 12) P2 — Accessibility Pass (Keyboard + ARIA)
**Problem / Value**: Modals/panels lack consistent keyboard navigation.\n
**Scope**: Modals, buttons, tool panels, chat input.\n
**Acceptance Criteria**:
- All modals trap focus and close via Escape.
- All icon-only buttons have accessible names.
- Tab order is predictable and visible focus styles are present.

## 13) P2 — Feature-Level Error Boundaries + Recovery
**Problem / Value**: A single runtime error can blank the entire app.\n
**Scope**: Error boundaries and per-feature fallbacks.\n
**Acceptance Criteria**:
- Each major panel is wrapped with an error boundary.
- Fallback UI offers “reset panel” and “open diagnostics” actions.
- Error boundaries record a structured log entry with stack trace (redacted).

## 14) P2 — Unified Command Palette Actions
**Problem / Value**: Power users need fast navigation and workflows.\n
**Scope**: Command palette + actions.\n
**Acceptance Criteria**:
- Palette includes navigation to all major panels and common actions (export diagnostics, test connection, open TAQWIN Tools).
- Commands are searchable and grouped.
- Works identically in web and Tauri.

## 15) P2 — Developer Productivity: One-Command Local Startup
**Problem / Value**: Local setup involves multiple manual steps and is error-prone.\n
**Scope**: Dev scripts + docs.\n
**Acceptance Criteria**:
- Single command starts app + optional backend(s) with health gating.
- Clear output includes URLs/ports and failure hints.
- Documentation updated with expected prerequisites and troubleshooting steps.

