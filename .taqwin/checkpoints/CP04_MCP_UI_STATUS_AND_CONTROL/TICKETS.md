# CP04_MCP_UI_STATUS_AND_CONTROL — Ticket Set (10)

## CP04 Goal
Make MCP and TAQWIN controls visibly truthful and operator-friendly, with consistent status surfaces across the app.

---

## CP04-T01 — Create global MCP status store and subscriptions
Acceptance Criteria:
- UI observes MCP state without manual refresh (header + chat + modal).
- Store supports multiple servers (at least TAQWIN).
Tests:
- Unit: subscription updates on status change.

## CP04-T02 — Make TAQWIN ACTIVATE button stateful
Acceptance Criteria:
- States: idle → starting → running → error.
- Shows spinner during activation and last error on failure.
- Does not silently fail; always surfaces outcome.
Tests:
- Unit: state transitions for success/failure.

## CP04-T03 — Show MCP status badge on Tools button
Acceptance Criteria:
- Tools button displays badge: running/down/error.
- Badge updates from global store.
Tests:
- Unit: badge mapping from status.

## CP04-T04 — Fix Start/Reconnect button behavior
Acceptance Criteria:
- “Reconnect” is enabled when connected/degraded.
- Disabled only while starting, not while running.
Tests:
- Unit: button disabled logic for each state.

## CP04-T05 — Align status chips across header and modals
Acceptance Criteria:
- One shared mapping to: starting/running/degraded/down/error.
- No conflicting labels between MainLayout and Tools modal.

## CP04-T06 — Improve UI error mapping and deep links
Acceptance Criteria:
- Normalize common errors (config invalid, stdin denied, timeout, process closed).
- Provide “Open MCP Logs” deep link from errors.

## CP04-T07 — Add Windows auto-detect for Python and TAQWIN path
Acceptance Criteria:
- One-click auto-fill finds Python executable and TAQWIN_V1 main.py path when present.
- Falls back to manual edit with clear guidance when not found.
Tests:
- Unit: path detection helpers (mocked inputs).

## CP04-T08 — Add MCP Health panel UI
Acceptance Criteria:
- Shows: pid, framing, last start, last ok, last error, failures.
- Can copy diagnostics bundle (text) for support.

## CP04-T09 — Add optional chat audit trail for tool calls
Acceptance Criteria:
- Optional toggle to display tool-call events as chat/system messages.
- Shows tool name + duration + ok/error.

## CP04-T10 — Add regression tests for status rendering
Acceptance Criteria:
- Tests cover: activate button, tools badge, start/reconnect, error banners.
