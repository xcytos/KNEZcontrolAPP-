# TICKET-2026-04-21: Runtime Crash Recovery Bundle

## Summary
Analysis of production logs reveals a critical cascading failure: health check timeout → phase corruption → TypeError crash → request lock stuck → all subsequent requests rejected. This ticket bundles 4 tightly coupled fixes that must be deployed together.

---

## TICKET-1: CRITICAL — PhaseManager crashes on "error" phase (TypeError)

**Severity**: P0 — App crashes, all subsequent interactions fail
**Component**: `src/services/chat/core/PhaseManager.ts`
**Assignee**: Backend / Chat Core

### Root Cause
`ChatService.setPhase("ERROR")` maps to `"error"` phase, then forwards it to `PhaseManager.setPhase()`. But `PhaseManager.ChatPhase` does NOT include `"error"`, and `VALID_TRANSITIONS` has no `"error"` key. The tolerant fallback at line 51 silently sets `currentPhase = "error"`, corrupting state. The NEXT call to `resetToIdle()` then tries `VALID_TRANSITIONS["error"]` which returns `undefined`, causing `undefined.includes()` → **TypeError**.

### Reproduction
1. Start app with backend down or slow
2. Send a message → health check times out
3. ChatService calls `setPhase("ERROR")` → PhaseManager state = "error"
4. Timer fires `resetToIdle()` → **crash**

### Fix
```typescript
// PhaseManager.ts
export type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "streaming"
  | "tool_running"
  | "completed"
  | "failed"
  | "error";  // <-- ADD

const VALID_TRANSITIONS: Record<ChatPhase, ChatPhase[]> = {
  idle: ["sending"],
  sending: ["thinking", "failed", "error"],
  thinking: ["streaming", "tool_running", "failed", "error"],
  streaming: ["streaming", "completed", "failed", "error"],
  tool_running: ["thinking", "streaming", "failed", "error"],
  completed: ["idle"],
  failed: ["idle"],
  error: ["idle"],  // <-- ADD
};
```

### Acceptance Criteria
- [ ] `PhaseManager.ts` includes `"error"` in `ChatPhase` and `VALID_TRANSITIONS`
- [ ] Health check failure no longer crashes the app
- [ ] `resetToIdle()` succeeds after error state
- [ ] Unit test: `setPhase("error")` followed by `setPhase("idle")` works

---

## TICKET-2: HIGH — Pre-flight health check timeout blocks all sends

**Severity**: P1 — Users cannot send messages when backend is slow to respond
**Component**: `src/services/ChatService.ts` (deliverQueueItem)
**Assignee**: Backend / Chat Core

### Root Cause
Pre-flight health check uses `timeoutMs: 2000`. On slower systems or when backend is warming up, this times out, causing the entire message send to fail with a hard error. The error path sets phase to `"error"` (triggering TICKET-1), and leaves the request lock active.

### Evidence from Logs
```
[chat] pre_flight_health_check_exception {error: 'Error: Health check timed out: http://127.0.0.1:8000/health'}
```

### Fix Options
**Option A (Recommended)**: Increase timeout + add retry
```typescript
const health = await knezClient.health({ timeoutMs: 5000, retries: 2 });
```

**Option B**: Make health check non-blocking (warn but proceed)
- If health check fails/timeout, log warning but still attempt the request
- Let the actual request fail naturally if backend is truly down
- Avoids false negatives from transient health check slowness

**Option C**: Cache health status
- Cache last known health status for 5-10 seconds
- Only perform health check if cache is stale
- Reduces health check frequency and timeout impact

### Recommended Fix (Combine A + C)
```typescript
// Cached health with 5s TTL
private lastHealthCheck: { result: any, timestamp: number } | null = null;

async checkHealthCached(): Promise<boolean> {
  const now = Date.now();
  if (this.lastHealthCheck && (now - this.lastHealthCheck.timestamp) < 5000) {
    return this.lastHealthCheck.result?.status === "ok";
  }
  try {
    const health = await knezClient.health({ timeoutMs: 5000 });
    this.lastHealthCheck = { result: health, timestamp: now };
    return health?.status === "ok";
  } catch {
    this.lastHealthCheck = { result: null, timestamp: now };
    return false;
  }
}
```

### Acceptance Criteria
- [ ] Health check timeout increased to 5000ms minimum
- [ ] Health check uses cached result within 5-second window
- [ ] Message can still be sent if health check times out but backend recovers
- [ ] Log shows `pre_flight_health_check_passed` or `pre_flight_health_check_cached`

---

## TICKET-3: HIGH — Stuck request lock blocks all new messages after error

**Severity**: P1 — After any error, user must reload app to send new messages
**Component**: `src/services/ChatService.ts` (request controller / activeRequestLock)
**Assignee**: Backend / Chat Core

### Root Cause
When health check fails (TICKET-2), the error path does NOT clear `activeRequestLock`. The `request_controller` then rejects all new requests:
```
[request_controller] request_rejected {activeRequest: '...', attemptedRequest: '...'}
[chat_service] request_rejected_active {error: 'Error: Request already active: ...'}
```

### Evidence from Logs
After health check failure:
```
[message_store] message_created {...}
[request_controller] request_rejected {activeRequest: '5a59a...', attemptedRequest: '74a98...'}
```

The first request (`5a59a...`) is stuck in `activeRequestLock` even though it failed. The second request (`74a98...`) from the user is rejected.

### Fix
**In error paths, ALWAYS clear the request lock and reset phase.**

In `deliverQueueItem`, wrap the entire method in `try/finally`:
```typescript
private async deliverQueueItem(item: QueueItem): Promise<void> {
  this.activeRequestLock = { requestId: item.id, timestamp: Date.now() };
  try {
    // ... existing logic ...
  } catch (error) {
    // ... error handling ...
    this.resetToIdle();
  } finally {
    // CRITICAL: Always clear lock
    if (this.activeRequestLock?.requestId === item.id) {
      this.activeRequestLock = null;
    }
    // Also clear stream controller
    this.streamController = new StreamController(this.sessionId);
  }
}
```

### Acceptance Criteria
- [ ] After health check failure, `activeRequestLock` is cleared
- [ ] User can send a new message without reloading
- [ ] `request_rejected_active` log should only appear for truly concurrent requests
- [ ] Unit test: failed request releases lock, next request succeeds

---

## TICKET-4: MEDIUM — Backend 404 endpoints spam console and fail silently

**Severity**: P2 — Console noise, poor UX when lineage data unavailable
**Component**: `src/features/chat/LineagePanel.tsx`, `src/services/knez/KnezClient.ts`
**Assignee**: Frontend / UX

### Root Cause
`LineagePanel.tsx` calls two endpoints that return 404:
- `GET /sessions/{id}/resume_snapshot`
- `GET /sessions/{id}/lineage`

The `Promise.allSettled` in `LineagePanel.tsx` catches the rejection, but the `fetch()` calls inside `KnezClient.ts` log 404 errors to the console before returning `null`.

### Evidence from Logs
```
GET http://127.0.0.1:8000/sessions/.../resume_snapshot 404 (Not Found)
GET http://127.0.0.1:8000/sessions/.../lineage 404 (Not Found)
```

### Fix
**In KnezClient.ts**: Suppress expected 404s
```typescript
async getResumeSnapshot(sessionId: string): Promise<ResumeSnapshot | null> {
  try {
    const resp = await fetch(`${this.baseUrl()}/sessions/${sessionId}/resume_snapshot`);
    if (resp.status === 404) return null; // Expected when no snapshot exists
    if (!resp.ok) {
      logger.debug("knez_client", "resume_snapshot_not_found", { sessionId, status: resp.status });
      return null;
    }
    return await resp.json();
  } catch (err) {
    logger.debug("knez_client", "resume_snapshot_error", { sessionId, error: String(err) });
    return null;
  }
}
```

**In LineagePanel.tsx**: Show friendly empty state immediately on 404
```typescript
useEffect(() => {
  if (!sessionId) return;
  setLoading(true);
  Promise.allSettled([
    knezClient.getResumeSnapshot(sessionId),
    knezClient.getSessionLineageChain(sessionId),
  ]).then(([snap, lin]) => {
    // 404 is expected — don't treat as failure
    setSnapshot(snap.status === "fulfilled" ? snap.value : null);
    setChain(lin.status === "fulfilled" ? (lin.value?.chain ?? null) : null);
  }).finally(() => setLoading(false));
}, [sessionId]);
```

### Acceptance Criteria
- [ ] 404 on `resume_snapshot` and `lineage` does not log console error
- [ ] LineagePanel shows "No lineage data available" gracefully
- [ ] No React stack traces in console from these endpoints
- [ ] Backend endpoints can be implemented later without client changes

---

## TICKET-5: LOW — MCP tools list loading time is inconsistent (2.5s spikes)

**Severity**: P3 — Performance degradation, slow tool discovery
**Component**: `src/mcp/McpOrchestrator.ts` or MCP server
**Assignee**: Backend / MCP

### Root Cause
From logs:
```
[mcp_audit] handshake_completed {serverId: 'taqwin', tools: 21, initMs: 43, toolsListMs: 2510}
[mcp_audit] handshake_completed {serverId: 'taqwin', tools: 21, initMs: 137, toolsListMs: 83}
```

`toolsListMs` varies from **83ms to 2510ms** (30x variance). This indicates cold-start latency when the MCP server process is not warmed up.

### Fix Options
**Option A**: Pre-warm MCP servers on app startup
- Start all `start_on_boot` servers during app initialization
- Accept longer startup time for faster first use

**Option B**: Cache tools list
- Cache tools list in `McpOrchestrator` after first load
- Use cached list for subsequent handshakes (with TTL)
- Only re-fetch if tools hash changes or server restarts

**Option C**: Parallelize tools list with timeout
- Set a hard timeout (e.g., 1000ms) for tools list
- If timeout exceeded, use cached/last-known tools list
- Log warning but don't block handshake

### Recommended Fix (Option B)
```typescript
// In McpOrchestrator ServerRuntime
interface ServerRuntime {
  // ... existing fields ...
  toolsCached: McpToolDefinition[] | null;
  toolsCacheAt: number | null;
}

// In handshake/refresh logic
async refreshTools(serverId: string, opts?: { force?: boolean }) {
  const server = this.servers.get(serverId);
  if (!server) return;
  
  // Use cache if fresh (< 5 min) and not forced
  const cacheAge = server.toolsCacheAt ? Date.now() - server.toolsCacheAt : Infinity;
  if (!opts?.force && server.toolsCached && cacheAge < 300000) {
    logger.debug("mcp", "tools_cache_hit", { serverId, cacheAge });
    return server.toolsCached;
  }
  
  // Fetch fresh
  const tools = await this.fetchToolsWithTimeout(serverId, 2000);
  server.toolsCached = tools;
  server.toolsCacheAt = Date.now();
  return tools;
}
```

### Acceptance Criteria
- [ ] Tools list loads from cache on warm handshakes (< 100ms)
- [ ] Cold handshake still fetches fresh list but with 2s timeout
- [ ] Cache invalidates on server restart
- [ ] Log shows `tools_cache_hit` or `tools_cache_miss` for observability

---

## Deployment Order

1. **TICKET-1** (PhaseManager fix) — Deploy first, unblocks all error recovery
2. **TICKET-3** (Request lock cleanup) — Deploy with TICKET-1, prevents stuck locks
3. **TICKET-2** (Health check resilience) — Deploy after, reduces error frequency
4. **TICKET-4** (404 suppression) — Deploy independently, UX improvement
5. **TICKET-5** (MCP cache) — Deploy last, performance optimization

## Rollback Plan
- All changes are additive / bug fixes
- No breaking API changes
- Rollback: revert `PhaseManager.ts`, `ChatService.ts`, `KnezClient.ts`
