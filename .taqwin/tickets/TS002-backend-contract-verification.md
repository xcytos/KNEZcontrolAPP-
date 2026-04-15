# TS002 — Backend Contract Verification
**Status:** DONE  
**Priority:** P0 — BLOCKER  
**Executed:** 2026-04-15

## Tasks

| # | File | Change | Status |
|---|------|--------|--------|
| 2.1 | `cognitive/api.py` | Add GET /operator/influence/global endpoint | ✅ |
| 2.2 | `DataContracts.ts` | Expand ChatMessage.from types | ✅ |
| 2.3 | `DataContracts.ts` | Add toolExecutionTime, fallbackTriggered to metrics | ✅ |
| 2.4 | `DataContracts.ts` | Fix AuditResult shape to match backend | ✅ |
| 2.5 | `app.py` | Verify CORS allows localhost:8000/127.0.0.1 | ✅ |
| 2.6 | `completions.py` | Verify stream=true/false both work | ✅ |
| 2.7 | `health.py` | Verify /identity returns correct shape | ✅ |

## Root Cause
Client called GET /operator/influence/global but backend only had POST endpoint, causing silent 405 errors. DataContract types didn't match backend response shapes.

## Verification
- GET /operator/influence/global returns `{enabled, policies}`
- /identity returns `{knez_instance_id, fingerprint, version}`
- CORS regex matches `http://127.0.0.1:8000` and `http://localhost:8000`
