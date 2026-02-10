# Control App: 30 MCP Improvement Tickets (GitHub MCP + TAQWIN)

This backlog focuses on making the Control App a robust MCP host for both local (STDIO) and remote (HTTP) MCP servers, with a first-class GitHub MCP integration and strong operational safety.

## Ticket Format
- Priority: P0 (critical), P1 (high), P2 (nice-to-have)
- Acceptance criteria should be objectively verifiable.

---

## 1) P0 — MCP HTTP Transport (Streamable HTTP + SSE)
**Problem / Value**: Control App must connect to remote MCP servers (e.g., GitHub MCP hosted endpoint).\n
**Scope**: MCP client transport + Inspector execution.\n
**Acceptance Criteria**:
- Supports `initialize`, `tools/list`, `tools/call` over HTTP POST.
- Handles both `application/json` and `text/event-stream` responses.
- Timeouts abort requests cleanly and produce actionable errors.

## 2) P0 — Inputs + ${input:...} Substitution (No Secret Persistence)
**Problem / Value**: MCP configs commonly require prompting for secrets; secrets must not be committed or persisted by default.\n
**Scope**: MCP config schema + runtime prompting.\n
**Acceptance Criteria**:
- Supports top-level `inputs` with `promptString` and `password` fields.
- Resolves `${input:<id>}` placeholders in `env` and `headers`.
- Secret values are not written into `mcp.config.json` by default.

## 3) P0 — GitHub MCP Remote Preset (Safe Defaults)
**Problem / Value**: Operators need a one-click, safe remote GitHub MCP config.\n
**Scope**: Default presets + docs.\n
**Acceptance Criteria**:
- Preset includes `type: \"http\"`, `url`, PAT-based auth placeholder, and safe toolset defaults.
- Preset enables `X-MCP-Readonly=true` by default and allows toolset override.
- Preset is disabled by default until configured.

## 4) P0 — GitHub MCP Local Preset (Docker STDIO)
**Problem / Value**: Local GitHub MCP server should be runnable without build-from-source.\n
**Scope**: Default presets + config validation.\n
**Acceptance Criteria**:
- Preset uses `docker run -i --rm ... ghcr.io/github/github-mcp-server`.
- PAT is provided via `${input:...}` env and not stored in repo.
- Preset is disabled by default until configured.

## 5) P0 — Inspector Parity for HTTP Servers
**Problem / Value**: Operators need the same observability for remote servers as local processes.\n
**Scope**: MCP Inspector UI.\n
**Acceptance Criteria**:
- Server card shows `type`, `url`, and headers (redacted where appropriate).
- Inspector logs show request/response JSON-RPC bodies for HTTP transport.
- Start/Initialize/tools/list/tools/call actions work for HTTP servers in web and Tauri.

## 6) P0 — Redaction Policy for MCP Config + Logs
**Problem / Value**: Tokens can leak via config, logs, and diagnostics exports.\n
**Scope**: Redaction utilities + UI surfaces.\n
**Acceptance Criteria**:
- Authorization-style headers are always masked in the UI.
- Exported diagnostic bundles never include tokens or bearer strings.
- Unit tests prove representative secrets are redacted.

## 7) P1 — GitHub Toolset Selector UX
**Problem / Value**: GitHub MCP has many toolsets; selection improves tool choice and reduces noise.\n
**Scope**: Inspector UI + config writer.\n
**Acceptance Criteria**:
- UI allows setting toolsets via `X-MCP-Toolsets` header.
- UI supports selecting a single toolset via URL path `/x/{toolset}`.
- UI includes a read-only toggle and shows the effective endpoint.

## 8) P1 — Lockdown Mode Toggle + Explanation
**Problem / Value**: Lockdown mode reduces exposure from public repos.\n
**Scope**: GitHub MCP remote preset + Inspector UX.\n
**Acceptance Criteria**:
- UI toggles `X-MCP-Lockdown` (remote) or `GITHUB_LOCKDOWN_MODE` (local).
- UI shows a brief explanation of impact on issue/PR content.

## 9) P1 — Insiders Mode Support (Remote + Local)
**Problem / Value**: Insiders enables early access; should be opt-in and explicit.\n
**Scope**: Presets + UI.\n
**Acceptance Criteria**:
- Remote supports `/insiders` path or `X-MCP-Insiders` header.
- Local supports `GITHUB_INSIDERS=true` env.
- UI makes insiders clearly visible when enabled.

## 10) P1 — Fine-Grained Tool Allow/Deny (Per Server)
**Problem / Value**: Tool-level restrictions are needed beyond global trust.\n
**Scope**: Governance + Inspector.\n
**Acceptance Criteria**:
- Per-server allow/deny list blocks tool execution in Inspector and in Chat tool calls.
- Blocked attempts generate clear operator messages and audit logs.

## 11) P1 — Standardized MCP Errors (HTTP + STDIO)
**Problem / Value**: Raw error strings are hard to interpret.\n
**Scope**: MCP client + UI mapping.\n
**Acceptance Criteria**:
- HTTP status errors map to user-facing messages (401/403/404/timeouts).
- STDIO failures map to actionable remediation hints.
- Errors are consistent across Inspector and TAQWIN Tools.

## 12) P1 — MCP “Test Connection” Wizard
**Problem / Value**: Operators need a guided way to verify config before running tools.\n
**Scope**: Inspector UI.\n
**Acceptance Criteria**:
- Wizard runs initialize → tools/list → optional tool call.
- Shows timings, framing/transport used, and last error details.

## 13) P1 — Persisted MCP Diagnostic Snapshot
**Problem / Value**: Repro requires stable snapshots of last known MCP runtime.\n
**Scope**: Persistence + UI.\n
**Acceptance Criteria**:
- Stores last successful initialize/tools/list metadata per server.
- UI shows “last known good” even after restart.

## 14) P1 — Config Migration: Preserve inputs + http servers
**Problem / Value**: Editing tools should not delete inputs or non-TAQWIN servers.\n
**Scope**: Config editor + auto-fix tools.\n
**Acceptance Criteria**:
- Auto-fix keeps `inputs` intact.
- Auto-fix preserves `type: \"http\"` server entries unchanged.

## 15) P1 — GitHub MCP Read-Only First Workflow
**Problem / Value**: Most operations should start in read-only mode.\n
**Scope**: Presets + UX flows.\n
**Acceptance Criteria**:
- Default GitHub remote preset is read-only.
- UI must make write-enabling a deliberate operator action.

## 16) P1 — GitHub MCP Token Handling Guide
**Problem / Value**: Operators need a clear, safe token workflow.\n
**Scope**: Docs.\n
**Acceptance Criteria**:
- Guide covers PAT scopes, rotation, and why tokens must not be committed.
- Guide includes examples for remote and local configs using inputs.

## 17) P2 — Optional “Remember Inputs for Session” Toggle
**Problem / Value**: Repeated prompts are annoying but persistence is risky.\n
**Scope**: UX.\n
**Acceptance Criteria**:
- Inputs can be remembered in-memory until app restart.\n- UI indicates when a value is cached.\n

## 18) P2 — Optional OS Keychain Storage (Tauri)
**Problem / Value**: Secure persistence for tokens would improve usability.\n
**Scope**: Tauri plugin integration.\n
**Acceptance Criteria**:
- Secrets stored in OS keychain, not plaintext files.
- UI allows clear/revoke stored secrets.

## 19) P2 — Support GET SSE “listen” stream (if server offers)
**Problem / Value**: Some servers may send notifications asynchronously.\n
**Scope**: HTTP transport.\n
**Acceptance Criteria**:
- Optional GET SSE stream can be opened and closed.
- Notifications appear in Inspector logs without breaking tool calls.

## 20) P2 — MCP Session ID Handling (HTTP)
**Problem / Value**: Some servers require session affinity for streamable HTTP.\n
**Scope**: HTTP transport.\n
**Acceptance Criteria**:
- Stores session id if provided by server and reuses it on subsequent requests.
- Session reset is possible from UI.

## 21) P1 — GitHub MCP “Tool Search” Helper (Local Binary)
**Problem / Value**: GitHub MCP provides a tool-search CLI; surfacing it helps operators.\n
**Scope**: UX integration.\n
**Acceptance Criteria**:
- UI shows a command recipe to run `tool-search` for local docker/binary setups.
- Result can be pasted into Chat/notes easily.

## 22) P1 — Server-Specific Default Tool Arguments Templates
**Problem / Value**: Tool calls are error-prone without templates.\n
**Scope**: Inspector tool caller.\n
**Acceptance Criteria**:
- Known GitHub tools (issue_read, pull_request_read, get_file_contents) have starter JSON templates.
- Templates do not embed secrets.

## 23) P2 — “Workspace MCP Config Export” (VS Code Compatibility)
**Problem / Value**: Operators want to share configs with other MCP hosts.\n
**Scope**: Export UI.\n
**Acceptance Criteria**:
- Exports a VS Code compatible `mcp.json` snippet with inputs and servers.
- Export output redacts actual secret values.

## 24) P1 — Multi-Server Orchestration: Start/Stop All
**Problem / Value**: Operators need quick lifecycle control.\n
**Scope**: Inspector.\n
**Acceptance Criteria**:
- Start all enabled servers; stop all running servers.
- Clear per-server status while running batch actions.

## 25) P1 — Stronger Runtime Status in Header
**Problem / Value**: Operator must see MCP state at a glance.\n
**Scope**: UI shell.\n
**Acceptance Criteria**:
- Top-level status shows number of running servers and any errors.
- Clicking status jumps to MCP Inspector.

## 26) P2 — Rate-Limit and Retry Policy for HTTP MCP
**Problem / Value**: Remote servers can throttle; naive retries can worsen.\n
**Scope**: HTTP client.\n
**Acceptance Criteria**:
- Backoff retry for transient network errors (not for 401/403).
- UI surfaces when throttling is detected.

## 27) P2 — Streaming Tool Result Viewer
**Problem / Value**: Large tool outputs are hard to inspect.\n
**Scope**: Inspector tool output panel.\n
**Acceptance Criteria**:
- Supports collapsing/expanding large JSON.
- Copy-to-clipboard works and redacts secrets.

## 28) P2 — Per-Server Audit Trail Export
**Problem / Value**: Repro requires traceable MCP request history.\n
**Scope**: Diagnostics.\n
**Acceptance Criteria**:
- Export includes last N request/response pairs per server.
- Export is consistently redacted and includes timestamps/durations.

## 29) P1 — Consistent Config Validation for HTTP Servers
**Problem / Value**: Misconfigured URLs/headers cause confusing runtime errors.\n
**Scope**: Config validation.\n
**Acceptance Criteria**:
- Warns if `type:http` servers are missing `url`.
- Warns if Authorization header is present but empty.

## 30) P2 — Add “MCP Recipes” Library
**Problem / Value**: Operators need ready-made recipes for common workflows.\n
**Scope**: Docs + UI.\n
**Acceptance Criteria**:
- Includes GitHub read-only repo browsing, issue triage, and PR review recipes.
- Includes TAQWIN self-test and activation recipes.

