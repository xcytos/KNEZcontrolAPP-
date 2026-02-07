# CP12 Verification Report

Date: 2026-02-08

## Summary
- Chat sends are now durable: every Send persists immediately with `pending/delivered/failed` and never disappears on refresh/crash.
- Failed sends are queued persistently and retried with backoff.
- Session switching/fork/resume no longer depends on full reload; one controller owns session authority.
- TAQWIN tools are surfaced in Chat, tool calls are visualized inline, and permissions/trust gating is enforced.

## Automated Checks

### TypeScript
- `npm run build` (tsc + vite build): PASS

### Playwright
- `npx playwright test`: PASS (2 passed, 8 skipped)
- New suite: `tests/playwright/taqwin-tools.spec.ts`: PASS

## Scenario Validation (Functional)

### Chat Durability Ledger (CP12-1)
- Send creates 2 persisted rows immediately:
  - user message: `deliveryStatus=pending`
  - assistant placeholder: `deliveryStatus=pending`
- UI renders pending/failed badges and messages remain after refresh.

### Outgoing Queue + Retry (CP12-2)
- Persistent outgoing queue table stores undelivered sends.
- Failures mark messages as `failed` and schedule retries; successful delivery removes queue item.

### Session Authority + Correlation (CP12-3/4)
- Session ID mutations flow through `SessionController`.
- Late stream tokens and finalization attach to the correct `messageId` and persist to DB even after session switches.

### Tool Surfacing + Visualization (CP12-11/12)
- Tools modal lists tools and runs calls.
- Tool calls render inline with:
  - tool name
  - arguments
  - result or error

### Tool Permission + Trust UI (CP12-13)
- Tool enable/disable persisted locally.
- Untrusted mode blocks high-risk tools even if toggled on (safe allowlist enforced).

## Known Gaps / Follow-ups
- “Real Tauri window” Playwright automation is not yet wired; current tests validate the browser path and MCP mock fallback.
- TAQWIN MCP server spawn relies on local repo layout and `python` availability; packaging-side distribution of TAQWIN runtime is not yet implemented.
