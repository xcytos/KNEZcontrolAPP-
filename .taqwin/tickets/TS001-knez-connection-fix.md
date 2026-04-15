# TS001 — KNEZ Connection Fix
**Status:** DONE  
**Priority:** P0 — BLOCKER  
**Executed:** 2026-04-15

## Tasks

| # | File | Change | Status |
|---|------|--------|--------|
| 1.1 | `useSystemOrchestrator.ts:136` | `verifyHealthLoop` timeout 900→4500ms | ✅ |
| 1.2 | `useSystemOrchestrator.ts:52` | fast-path timeout 900→4500ms | ✅ |
| 1.3 | `App.tsx:117-119` | auto-launch port 8001→8000 | ✅ |
| 1.4 | `health.py` | Ollama check cached with 5s TTL | ✅ |
| 1.5 | `ConnectionSettings.tsx:110` | manual check timeout 2000→5000ms | ✅ |

## Root Cause
`verifyHealthLoop` used 900ms timeout. KNEZ `/health` endpoint makes a 3s `httpx` call to Ollama.
Client timed out before server could respond → "Health check timed out" on every probe.

## Verification
- `health_probe` should reach `succeeded` within first 3 attempts after KNEZ starts
- `trust=verified` after successful health check
- MCP tools become available after trust is verified
