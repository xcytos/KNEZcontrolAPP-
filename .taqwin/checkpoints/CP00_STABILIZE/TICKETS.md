# CP00_STABILIZE — Ticket Set (15)

## Ticket Template (Rule)
Each ticket must include: Context, Scope, Acceptance Criteria, Tests, Performance Budget, Dependencies.

---

## CP00-T01 — Rate-limit health logs to 1 per 3 minutes
Context: The UI log stream is flooded by “Health check passed”.  
Scope: Add per-key throttled logging and use it for health-pass logging.  
Acceptance Criteria:
- “Health check passed” appears at most once per 180 seconds.
- No loss of error logs.
Tests:
- Unit: verify throttling map behavior.
Performance Budget:
- O(1) per log call.
Dependencies:
- [LogService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/LogService.ts)
- [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts)

## CP00-T02 — Reduce /health polling frequency and add backoff
Context: `/health` is polled too frequently in steady state.  
Scope: Increase healthy interval and add exponential backoff when unhealthy.  
Acceptance Criteria:
- Healthy polling interval ≥ 30s.
- Unhealthy polling uses exponential backoff capped at 60s.
- Hidden tab adds large penalty delay.
Tests:
- Unit: deterministic delay function (optional).
Dependencies:
- [StatusProvider.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/contexts/StatusProvider.tsx)

## CP00-T03 — Reduce orchestrator startup log spam
Context: Startup loops log too frequently.  
Scope: Emit progress at a time cadence instead of attempt-count cadence.  
Acceptance Criteria:
- Startup logs appear at most once per 5 seconds during wait loops.
Dependencies:
- [useSystemOrchestrator.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/system/useSystemOrchestrator.ts)

## CP00-T04 — Introduce JSON MCP spawn config for TAQWIN MCP
Context: TAQWIN MCP must be startable via a professional JSON config.  
Scope: Add `mcp.config.json` for command/args/env/cwd and standardize usage.  
Acceptance Criteria:
- Config supports: `command`, `args`, `env`, `working_directory`.
- Defaults work for a fresh clone on Windows.
Dependencies:
- [mcp.config.json](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/mcp/mcp.config.json)

## CP00-T05 — Update TAQWIN MCP startup script to use JSON config
Context: Desktop spawn must match the config (Warp-proven format).  
Scope: Make `start_taqwin_mcp.ps1` read config and execute without hardcoding.  
Acceptance Criteria:
- TAQWIN MCP starts from config and responds to `initialize` + `tools/list`.
Tests:
- Run [mcp_handshake_test.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/tools/mcp_handshake_test.py) successfully.
Dependencies:
- [start_taqwin_mcp.ps1](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/scripts/start_taqwin_mcp.ps1)

## CP00-T06 — Eliminate MCP `mcp_request_timeout` for tools/list
Context: UI reports `TAQWIN MCP listTools failed after retry`.  
Scope: Fix spawn/cwd/env and validate stdio handshake end-to-end.  
Acceptance Criteria:
- Two consecutive `tools/list` calls succeed without timeout.
Tests:
- Desktop: TAQWIN Tools view loads tools list.
Dependencies:
- [TaqwinMcpService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/TaqwinMcpService.ts)
- [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/McpStdioClient.ts)

## CP00-T07 — Make MCP logs visible in Floating Console
Context: Operators cannot verify MCP runtime status via logs.  
Scope: Add MCP tab/filter in floating console and show recent MCP logs.  
Acceptance Criteria:
- “mcp” category entries are visible under an MCP tab.
Dependencies:
- [FloatingConsole.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/components/ui/FloatingConsole.tsx)

## CP00-T08 — Add Chat shortcuts for Console, MCP Registry, Analyze
Context: High-frequency operator actions must be one click away in Chat.  
Scope: Add header buttons that open Console, navigate to MCP Registry, and navigate to Reflection (Analyze).  
Acceptance Criteria:
- Buttons work without reloading the app.
Dependencies:
- [ChatPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/ChatPane.tsx)
- [App.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/App.tsx)

## CP00-T09 — Floating Console fixed bottom-right, always visible
Context: Console must not be clipped or hidden behind modals.  
Scope: Ensure fixed positioning and high z-index for button and overlay.  
Acceptance Criteria:
- Console button stays bottom-right and opens above the app.
Dependencies:
- [FloatingConsole.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/components/ui/FloatingConsole.tsx)

## CP00-T10 — Expandable MCP Registry UI
Context: Operators need quick status + drilldown.  
Scope: Add per-item “Details” expand and show last_error/enabled.  
Acceptance Criteria:
- “Details” shows enabled + last_error when present.
Dependencies:
- [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx)

## CP00-T11 — Implement KNEZ MCP registry backend (remove 404)
Context: Registry endpoint is currently unavailable.  
Scope: Implement `/mcp/registry` and `/mcp/registry/{id}/toggle` with file-backed state.  
Acceptance Criteria:
- `GET /mcp/registry` returns at least TAQWIN MCP item from config.
- Toggle persists enabled state.
Dependencies:
- [api.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez/knez/mcp/api.py)

## CP00-T12 — Fix MCP toggle client to send one correct request
Context: Client currently does two toggle requests.  
Scope: Make toggle use a single query-param call.  
Acceptance Criteria:
- Exactly one request per toggle.
Dependencies:
- [KnezClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/KnezClient.ts)

## CP00-T13 — Add lineage chain endpoint in KNEZ and render correctly
Context: Lineage panel is snapshot-only and misleading.  
Scope: Add `/sessions/{id}/lineage` and update UI to render chain.  
Acceptance Criteria:
- UI shows chain (session_id + resume_mode) and current head.
Dependencies:
- [sessions.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez/knez/knez_core/api/sessions.py)
- [LineagePanel.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/LineagePanel.tsx)

## CP00-T14 — Session recording is durable and analyzable
Context: Session is recorded, but operators need reliable later analysis.  
Scope: Ensure chats are persisted locally and analysis endpoints are reachable from UI.  
Acceptance Criteria:
- Reflection “Analyze Session” works for any active session (or shows actionable error).
Dependencies:
- [ReflectionPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/reflection/ReflectionPane.tsx)

## CP00-T15 — Reduce Memory page polling and avoid hidden-tab work
Context: Memory view polls too frequently and adds load/latency.  
Scope: Increase interval and pause when hidden.  
Acceptance Criteria:
- Polling interval ≥ 30s.
- No fetch while document is hidden.
Dependencies:
- [MemoryExplorer.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/memory/MemoryExplorer.tsx)

