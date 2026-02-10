# MCP Config Ingestion Audit — knez-control-app

Stamped: 2026-02-10

## Scope

This audit covers:

- MCP config ingestion (file load → JSON parse → runtime selection)
- Spawn pipeline (command/cwd/env → process spawn)
- Lifecycle ownership (client reuse, restart semantics, fallback triggers)
- Trust assignment (what “trusted” means for MCP connectivity)
- Tauri Playwright E2E coverage gaps and required hardening

Governing constraints:

- [.taqwin/rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- [.taqwin/work/active.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/active.md)

## Indexed Files

### MCP core (Control App)

- [McpHostConfig.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfig.ts)
- [McpHostConfigService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfigService.ts)
- [DefaultMcpHostConfig.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/DefaultMcpHostConfig.ts)
- [TaqwinMcpService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts)
- [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts)

### E2E (Playwright + Tauri)

- [tauri.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/tauri.ts)
- [smoke.spec.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/smoke.spec.ts)
- [taqwin-mcp.spec.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/taqwin-mcp.spec.ts)

## Mental Map: MCP Config Ingestion

### 1) File load + persistence

- Loader: [McpHostConfigService.load](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfigService.ts#L9-L29)
  - Reads `mcp.config.json` from `BaseDirectory.AppLocalData`.
  - If missing, falls back to legacy `mcp.host.json` and attempts to migrate into `mcp.config.json`.

- Saver: [McpHostConfigService.save](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfigService.ts#L35-L43)
  - Parses JSON, validates server(s), then writes raw JSON back to `mcp.config.json`.

### 2) JSON parse + schema ingestion

- Parser: [parseMcpHostConfigJson](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfig.ts#L41-L81)
  - Accepts:
    - Schema A: `{schema_version?, servers: {...}}`
    - Legacy schema: `{mcpServers: {...}}`
  - Unknown fields are tolerated (ignored).
  - working directory mapping:
    - reads `cwd` OR `working_directory` OR `workingDirectory` into internal `cwd`.

### 3) Default config

- Default provider: [getDefaultMcpHostConfig](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/DefaultMcpHostConfig.ts#L3-L33)
  - Current default is schema A (`servers`) with:
    - `command="python"`
    - `args=["-u","main.py","mcp"]`
    - `working_directory="..\\TAQWIN_V1"`

## Mental Map: Spawn Pipeline

- Owner: [TaqwinMcpService.getClient](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts#L84-L180)
  1. Load config via `mcpHostConfigService.load()` else default
  2. Select server: `servers["taqwin"]` else first entry
  3. Normalize TAQWIN args/env: [normalizeTaqwinMcpServer](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/config/McpHostConfig.ts#L113-L119)
  4. Inject runtime framing env:
     - `KNEZ_MCP_CLIENT_FRAMING`
     - `TAQWIN_MCP_OUTPUT_MODE`
  5. Spawn via [McpStdioClient.startWithConfig](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts#L114-L195)
  6. Initialize protocol via [McpStdioClient.initialize](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts#L445-L457)

### Ownership + lifecycle

- TaqwinMcpService maintains one `client` instance and uses an op-chain to serialize operations.
- Restart is implemented by:
  - generation++ and `client.stop()` then nulling client and caches.

## Mental Map: Fallback Triggers (Current)

### Fallback trigger A: initialize stall → framing flip

- Condition: first attempt fails with `mcp_request_timeout` and debug shows `stdoutBytes===0`
- Action: flip `framingPreference` and hard restart (stop + respawn)
- Implementation: [TaqwinMcpService.getClient](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts#L133-L156)

### Fallback trigger B: tools/list stall → framing flip + restart

- Condition: tools/list times out with `stdoutBytes===0`
- Action: may flip framing + restart and retry
- Implementation: [TaqwinMcpService.listTools](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts#L288-L340)

## Trust Assignment (Current vs Required)

Observed “trust” in UI is the KNEZ connection profile trust level:

- [TaqwinToolPermissions.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/TaqwinToolPermissions.ts#L33-L40)
- In TAQWIN Tools UI, trust is shown as `trust={knezClient.getProfile().trustLevel}` (KNEZ trust), which does not reflect MCP connection readiness.

Required by objective:

- Introduce MCP-local trust:
  - `trusted` once MCP initialize succeeds
  - must not depend on tools/list completion or tool registry population

## Config Incompatibility Findings (Current)

- Schema B as specified by objective omits `working_directory`.\n  - Current `McpStdioClient.startWithConfig` throws `mcp_config_missing_cwd` when `cwd` missing.\n  - Therefore schema B cannot be used safely unless `cwd` is optional or inferred.\n\n- `enabled=false` is parsed but not enforced:\n  - Current server selection in `TaqwinMcpService.getClient` does not filter out disabled servers.\n\n- Mixed schema presence rule is not explicit:\n  - Current parser returns `servers` if present, else `mcpServers`, but this should be enforced as a normalization rule with tests.\n\n## E2E Harness Findings (Current)\n\n- Page log buffer exists and can be used for negative assertions:\n  - [attachPageDiagnostics](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/tests/tauri-playwright/tauri.ts#L34-L68)\n  - It already captures `[mcp]` logs and timeout/permission indicators.\n\n- Current tests are not regression-proof:\n  - `smoke.spec.ts` and `taqwin-mcp.spec.ts` verify visibility/click flows but do not assert:\n    - PID uniqueness\n    - absence of framing fallback\n    - absence of restarts\n    - tools/list completion gating\n    - MCP trust transition\n+
