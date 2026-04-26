# TICKET-012 — ARCHITECTURE ENFORCEMENT LAYER

## STATUS
**ACTIVE** - Critical architectural violations detected post-TICKET-011

## PRIORITY
**CRITICAL** - System is operationally unsafe despite architectural correctness

## AUDIT FINDINGS

### ❌ ISSUE 1 — DUAL STREAM STILL EXISTS (FATAL)
**Evidence:**
```
[realtime_handler] token_received
WebSocketClient Message received: {type: token}
```

**Problem:** Tokens are STILL coming via WebSocket despite SSE-only design

**Impact:**
- Duplicate token streams
- Race conditions
- FSM instability
- Incomplete separation

---

### ❌ ISSUE 2 — CONNECTION FALLBACK IS CONCEPTUALLY WRONG
**Problem:** Implemented SSE ↔ WebSocket fallback

**Reality:**
- SSE = deterministic streaming (request channel)
- WebSocket = event bus (system channel)

**Impact:** Reintroduced dual responsibility overlap

---

### ❌ ISSUE 3 — BACKEND START ORDER FAILURE
**Evidence:**
```
ERR_CONNECTION_REFUSED
connection_degraded
```

**Problem:** Frontend booted BEFORE backend

**Impact:**
- Broken health state
- Failed event emission
- Inconsistent connection flags
- Misleading UI state

---

### ❌ ISSUE 4 — MEMORY SYSTEM DUPLICATION
**Evidence:**
```
Fetching /memory/knez-control-app.md
Fetching /memory/test-memory.md
→ SAME content parsed twice
```

**Impact:**
- Duplicate memory injection
- Context pollution
- Token waste
- Degraded model reasoning

---

### ❌ ISSUE 5 — SHELL FALLBACK FAILURE
**Evidence:**
```
shell_fallback_event_emit_failed
```

**Problem:** Fallback safety layer is unreliable

**Impact:**
- Unreliable notifications
- Failed system events
- Broken agent updates

---

## REQUIRED FIXES

### ✅ FIX 1 — HARD KILL WEBSOCKET TOKEN FLOW
**File:** `KNEZ/knez/knez_core/api/completions.py`

**Action:** DELETE all token-related WebSocket emissions
- `realtime_token`
- `token_stream`
- `realtime_stream_end`

**Rule:** If event == token → MUST be SSE ONLY

---

### ✅ FIX 2 — REMOVE CONNECTION FALLBACK BETWEEN TYPES
**File:** `knez-control-app/src/services/connection/ConnectionManager.ts`

**Action:** DELETE
- `attemptWebSocketFallback()`
- `attemptSSEFallback()`

**Replace with:**
- SSE = request channel (never fallback)
- WebSocket = system channel (auto reconnect only)

---

### ✅ FIX 3 — STARTUP ORCHESTRATOR
**File:** `knez-control-app/src/services/StartupOrchestrator.ts` (NEW)

**Flow:**
1. Start backend
2. Wait for /health = OK
3. Start WebSocket
4. Enable UI

---

### ✅ FIX 4 — STRICT EVENT FIREWALL
**File:** `knez-control-app/src/services/connection/ConnectionManager.ts`

**Action:** Add event validation
```ts
if (event.type === 'token') {
  if (source !== 'sse') {
    DROP EVENT
  }
}
```

---

### ✅ FIX 5 — SINGLE SOURCE OF STREAM TRUTH
**Rule:** StreamController ← SSE ONLY

**Action:** WebSocket MUST NEVER touch message content

---

### ✅ FIX 6 — MEMORY DEDUP
**File:** `knez-control-app/src/services/memory/StaticMemoryLoader.ts`

**Action:** Add hash-based deduplication
```ts
hash(memoryContent)
if exists → skip
```

---

### ✅ FIX 7 — SHELL FALLBACK REMOVE OR HARDEN
**File:** `knez-control-app/src/services/knez/KnezClient.ts`

**Action:** Either remove or guarantee delivery queue

---

## VALIDATION CRITERIA

- ✅ No tokens via WebSocket
- ✅ SSE-only token streaming
- ✅ No connection type fallback
- ✅ Backend-first startup
- ✅ Event firewall active
- ✅ Memory dedup working
- ✅ Reliable event emission

## DEPENDENCIES
- TICKET-011 (Dual-Channel Architecture) - COMPLETED but incomplete

## ESTIMATED EFFORT
2-3 hours for full enforcement and validation
