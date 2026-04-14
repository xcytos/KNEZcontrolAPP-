# R-P2.1 — Streaming Hardening Retrospective

**Phase:** P2 → P2.1 → P2.2
**Recorded:** 2026-04-14
**Status:** COMPLETE

---

## What Was Built

### P2 — Streaming Enabled
- `ChatService.deliverQueueItem` switched from `chatCompletionsNonStream` to `chatCompletionsStream`
- Real-time chunk appending via `this.state.messages.map(...)` inside loop
- `streaming` / `currentStreamId` added to `ChatState`
- `MessageItem` shows animated `Typing...` dots + blinking cursor during stream
- `ChatPane` send button disables + relabels during streaming

### P2.1 — Stream ID Enforcement + Single Write Path
- `appendToMessage(messageId, text)` replaces `appendToLastMessage` — targets by ID, not last
- `hasReceivedFirstToken` flag added to `ChatMessage` — explicit, not text-inferred
- `streamId = newMessageId()` generated per delivery, set as `currentStreamId`
- All `map(... text: accumulated)` mutations inside loop removed
- `if (streamId !== currentStreamId) break` added (loop guard)
- `if (controller.signal.aborted) break` added (abort guard)
- `accumulated` variable eliminated — `finalText` read from live state

### P2.2 — State Isolation Guarantee
- `streamId` hoisted outside `try` block — accessible in `finally`
- `break` → `return` for stale stream detection (SYSTEM LAW: no old stream modifies current state)
- `throw DOMException` → `return` for post-loop abort guard
- Success finalization gated: `if (streamId === currentStreamId)`
- Finally finalization gated: `if (streamId !== undefined && streamId === currentStreamId)`
- `appendToMessage` adds `console.error` when message ID not found
- `flushOutgoingQueue` streaming guard: `if (this.state.streaming) return`

---

## System Laws Enforced

```
NO STREAM MAY MODIFY STATE UNLESS IT IS THE ACTIVE STREAM
NO OLD STREAM MAY MODIFY CURRENT STATE
NO PARTIAL EXECUTION MAY FINALIZE STATE
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/ChatService.ts` | Core streaming loop, state management, write isolation |
| `src/domain/DataContracts.ts` | `hasReceivedFirstToken` field on `ChatMessage` |
| `src/features/chat/MessageItem.tsx` | Typing... indicator, hasReceivedFirstToken check |
| `src/features/chat/ChatPane.tsx` | streaming state subscription, send button guard |

---

## Test Coverage

`tests/tauri-playwright/streaming-correctness.spec.ts`

- HEALTH: backend + model available
- TEST1: settings → connect
- TEST2: send → stream → final message, no JSON leak
- TEST3: send → Stop → new message → no old token bleed
- TEST4: rapid send → queue guard → correct ordering

---

## Lessons

See `.taqwin/memory/development/learnings_streaming.json`

Key insight: **Streaming is a concurrency control problem, not a UI problem.**
