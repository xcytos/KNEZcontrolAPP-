# TAQWIN Policies (CP12 Scan)

## Server-Side Tool Allowlist
- `TAQWIN_V1/taqwin/tool_policy.py` defines a minimal allowlist:
  - allowed: `session`, `session_v2`
  - everything else raises `ToolPolicyError`

## Control App Policy Overlay (CP12)
- Control App must enforce an operator-visible policy layer before tool invocation:
  - safe-mode defaults (bounded tools only)
  - per-tool enable/disable toggle
  - trust gating (untrusted vs verified)

## Audit Requirements
- Every tool call must produce an auditable record:
  - tool name, arguments, result/error, timestamp, correlation id
- Audit records must be persisted locally (IndexedDB) even if KNEZ is offline.
