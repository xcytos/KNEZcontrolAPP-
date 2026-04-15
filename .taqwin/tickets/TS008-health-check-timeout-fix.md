# TS008 — Health Check Timeout Fix
**Status:** DONE  
**Priority:** P0 — BLOCKER  
**Executed:** 2026-04-15

## Tasks

| # | File | Change | Status |
|---|------|--------|--------|
| 8.1 | `useSystemOrchestrator.ts` | Add 5s initial delay before health checks start after spawn | ✅ |
| 8.2 | `useSystemOrchestrator.ts` | Increase timeout to 8000ms for first 10 attempts, then 4500ms | ✅ |
| 8.3 | `health.py` | Make Ollama check return "unavailable" immediately on first cold check | ✅ |

## Root Cause
Health checks started IMMEDIATELY after spawn before KNEZ was fully ready. 4500ms timeout was insufficient for cold-start Ollama check. First health check would block on Ollama API call even with cache empty.

## Verification
- Health checks now wait 5s after spawn before starting
- First 10 attempts use 8000ms timeout (cold start), subsequent use 4500ms
- Ollama check returns "unavailable" immediately on first check (cache empty)
- Subsequent checks populate cache with real status
