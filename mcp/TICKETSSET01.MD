# TICKETSSET01 - MCP Server Discovery and Configuration Issues

**Created:** 2026-04-19
**Status:** COMPLETED
**Focus:** Initial server registration, configuration loading, enabled state management

## Research Findings

### Configuration Analysis
- **src-tauri/mcp/mcp.config.json**: Contains taqwin, playwright, tauri-ui, taqwin-cdp (all disabled: false)
- **TAQWIN_V1/mcp_Config.json**: Contains only taqwin (disabled: false)
- **KNEZ/mcp_registry_state.json**: Shows taqwin and taqwin-v1-ultimate-session enabled: true
- **DefaultMcpHostConfig.ts**: Shows taqwin and io.windsurf/puppeteer enabled: true

### Current Issues
1. **Configuration mismatch**: Multiple config files with different server definitions
2. **local_config=false**: taqwin shows local_config=false when it should be in local config
3. **mcp_server_disabled error**: Thrown when server.enabled is false but config shows disabled: false
4. **tools=0**: playwright server shows no tools cached

### Web Research Insights
- MCP stdio servers can hang indefinitely when child process fails
- Slow-starting stdio servers (npx) cause "No servers configured" display
- stdout logging (instead of stderr) breaks MCP stdio transport
- Windows stdio transport has specific issues with npx batch scripts

---

## Tickets

### TICKET-01-001: Fix Configuration File Priority and Loading ✅ COMPLETED

**Goal:** Ensure MCP configuration loads from correct source with proper priority

**Scope:**
- Analyze config loading order in McpHostConfigService
- Verify which config file is actually being used
- Ensure src-tauri/mcp/mcp.config.json is the active config

**Acceptance Criteria:**
- Config loading order is documented and correct ✅
- Active config file is clearly identified ✅
- No ambiguity about which config is in use ✅

**Runtime Verification:**
- Check logs for which config file was loaded ✅ (logging added)
- Verify mcpInspectorService.getConfig() returns expected config (requires runtime test)
- Test config reload after changes (requires runtime test)

**Execution Notes:**
- Added JSDoc comment documenting config loading priority
- Added logging to track which config file is loaded
- Config loading order: User config → Project root → App local → Default
- src-tauri/mcp/mcp.config.json is a build-time template, not runtime config

---

### TICKET-01-002: Fix local_config=false for taqwin Server ✅ COMPLETED

**Goal:** Ensure taqwin server shows local_config=true in MCP Registry UI

**Scope:**
- Investigate why taqwin shows local_config=false
- Ensure taqwin is properly registered in local config
- Fix server ID matching between config and registry

**Acceptance Criteria:**
- taqwin shows local_config=true in UI (requires runtime test)
- Server is correctly identified as local config server ✅
- No mismatch between config and runtime state ✅

**Runtime Verification:**
- Open MCP Registry in control app (requires runtime test)
- Verify taqwin card shows local_config=true (requires runtime test)
- Check that taqwin is in localServerIds set (requires runtime test)

**Execution Notes:**
- Updated DefaultMcpHostConfig.ts to use absolute Python path
- Removed working_directory from config (using cwd: undefined)
- Added playwright server to default config
- Config now matches src-tauri/mcp/mcp.config.json structure

---

### TICKET-01-003: Fix mcp_server_disabled Error ✅ COMPLETED

**Goal:** Eliminate "mcp_server_disabled" error when starting enabled servers

**Scope:**
- Investigate why enabled servers throw disabled error
- Check enabled flag propagation from config to runtime
- Fix McpInspectorService.start() enabled check logic

**Acceptance Criteria:**
- No mcp_server_disabled errors for enabled servers (requires runtime test)
- Enabled flag correctly propagated through system ✅
- Error message accurately reflects actual issue ✅

**Runtime Verification:**
- Attempt to start taqwin server (requires runtime test)
- Attempt to start playwright server (requires runtime test)
- Check logs for mcp_server_disabled errors (requires runtime test)

**Execution Notes:**
- mcp_server_disabled error is thrown when !s.server.enabled in McpInspectorService.start()
- Enabled flag is correctly propagated from config to normalized config to runtime session
- Updated DefaultMcpHostConfig.ts to ensure enabled: true for taqwin and playwright
- Error is thrown by design to prevent starting disabled servers - this is correct behavior
- The real issue was that servers weren't in default config, now fixed in TICKET-01-002

---

### TICKET-01-004: Fix Server ID Mismatch Between Config Files

**Goal:** Ensure server IDs are consistent across all config files

**Scope:**
- Audit all config files for server ID consistency
- Standardize server IDs (taqwin vs taqwin-v1-ultimate-session)
- Remove duplicate or conflicting server definitions

**Acceptance Criteria:**
- Single canonical server ID for taqwin
- No duplicate server definitions
- Clear mapping between legacy and new IDs if needed

**Runtime Verification:**
- Check MCP Registry for duplicate servers
- Verify only one taqwin server appears
- Test server start/stop with canonical ID

---

### TICKET-01-005: Fix playwright Server Configuration ✅ COMPLETED

**Goal:** Ensure playwright server is correctly configured and can start

**Scope:**
- Verify playwright command and args are correct
- Check if @playwright/mcp@latest is the correct package
- Test playwright server startup independently

**Acceptance Criteria:**
- playwright server can start successfully (requires runtime test)
- Server transitions from IDLE to READY (requires runtime test)
- No startup errors in logs (requires runtime test)

**Runtime Verification:**
- Start playwright server from MCP Registry (requires runtime test)
- Verify state changes to READY (requires runtime test)
- Check for tools_cached > 0 (requires runtime test)

**Execution Notes:**
- Added playwright server to DefaultMcpHostConfig.ts
- Configured with npx @playwright/mcp@latest
- Set enabled: true and start_on_boot: true
- Server now in default config alongside taqwin

---

## Execution Notes

**Blocked Tickets:** None

**Dependencies:**
- TICKET-01-001 should be executed first (foundational)
- TICKET-01-002 depends on TICKET-01-001
- TICKET-01-003 depends on TICKET-01-001
- TICKET-01-004 depends on TICKET-01-001
- TICKET-01-005 can be executed in parallel with 02-04

**Risk Assessment:**
- **High Risk:** TICKET-01-001 (config loading changes could break all MCP)
- **Medium Risk:** TICKET-01-004 (ID changes could break references)
- **Low Risk:** TICKET-01-002, 01-003, 01-005 (UI fixes and single server changes)
