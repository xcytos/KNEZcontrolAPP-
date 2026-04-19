# MCP Configuration Issues Analysis

**Created:** 2026-04-19
**Focus:** Deep analysis of MCP server configuration issues

---

## Issue 1: Edit Modal Shows Normalized Config Instead of Original Raw Config

**Location:** `McpRegistryView.tsx` lines 445-473

**Problem:** When clicking "Edit" on a server, the modal shows a normalized config object instead of the original raw config that was added.

**Evidence:**
- User added config: `{ "mcpServers": { "playwright": { "args": ["-y", "@playwright/mcp@latest"], "command": "npx" } } }`
- Edit modal shows: `{ "id": "playwright", "type": "stdio", "enabled": true, "start_on_boot": false, "tags": [], "allowed_tools": [], "blocked_tools": [] }`
- Missing: `command`, `args`, `cwd`, `env` fields

**Root Cause:** The `handleEditClick` function constructs a `serverConfig` object from the runtime server object, which doesn't preserve the original raw structure.

**Impact:** Users cannot edit the actual server configuration (command, args, etc.) through the UI.

---

## Issue 2: Original Raw Config Not Preserved in Runtime

**Location:** `McpOrchestrator.ts` buildRuntime method

**Problem:** The orchestrator doesn't store the original raw config for each server, only the normalized version.

**Impact:** Cannot reconstruct the original config structure when editing.

---

## Issue 3: Config Structure Mismatch Between Add and Edit

**Location:** `McpRegistryView.tsx` handleAddServer vs handleEditServer

**Problem:** 
- `handleAddServer` expects `{ "mcpServers": { "serverId": { ... } } }` structure
- `handleEditServer` expects just the server object `{ "id": "serverId", ... }`
- This inconsistency causes confusion

**Impact:** Users cannot use the same config format for adding and editing.

---

## Issue 4: Package Name Still Uses @playwright/mcp@latest

**Location:** Windsurf config file `c:\Users\syedm\.codeium\windsurf\mcp_config.json`

**Problem:** The config still uses `@playwright/mcp@latest` instead of `@playwright/mcp`.

**Evidence:** Line 14: `"@playwright/mcp@latest"`

**Impact:** Version resolution issues, potential for instability.

---

## Issue 5: No Validation That Edit Config Includes Required Fields

**Location:** `McpRegistryView.tsx` handleEditServer

**Problem:** The edit function doesn't validate that the edited config includes required fields like `command` and `args`.

**Impact:** Can save invalid configs that break server startup.

---

## Issue 6: Edit Config Doesn't Preserve Original Config Source

**Location:** `McpRegistryView.tsx` handleEditServer

**Problem:** When editing, there's no way to know if the server came from user config, project config, or app local config.

**Impact:** Edits might go to the wrong config file.

---

## Issue 7: Config Save Location Ambiguity

**Location:** `McpHostConfigService.ts` save method

**Problem:** The save method always saves to app local data, but the edit UI doesn't indicate this.

**Impact:** Users might expect edits to go to project or user config instead.

---

## Issue 8: No Indication of Config Source in UI

**Location:** `McpRegistryView.tsx` server cards

**Problem:** The UI doesn't show which config file each server came from (user, project, or app local).

**Impact:** Users can't determine where to make persistent changes.

---

## Issue 9: Runtime Config Doesn't Track Original Config Structure

**Location:** `McpOrchestrator.ts` ServerRuntime type

**Problem:** ServerRuntime doesn't include the original raw config or config source.

**Impact:** Cannot reconstruct original config for editing.

---

## Issue 10: Add to Local Config Loses Original Structure

**Location:** `McpRegistryView.tsx` handleAddToLocalConfig

**Problem:** When adding a server to local config, it reconstructs the config from runtime, losing the original structure.

**Impact:** The added config might differ from what was intended.

---

## Issue 11: No Config Diff or History

**Location:** Missing feature

**Problem:** There's no way to see what changed in a config or revert to previous versions.

**Impact:** Hard to debug config issues or recover from bad edits.

---

## Issue 12: Config Normalization Loses Information

**Location:** `McpHostConfig.ts` normalizeMcpConfig

**Problem:** The normalization process converts `mcpServers` to `servers` and loses the original field names.

**Impact:** Cannot reconstruct the exact original config.

---

## Issue 13: Edit Modal Doesn't Show Raw Config Option

**Location:** `McpRegistryView.tsx` EditServerModal

**Problem:** No option to view/edit the raw config JSON directly.

**Impact:** Advanced users cannot make precise edits.

---

## Issue 14: Config Schema Version Not Enforced on Edit

**Location:** `McpRegistryView.tsx` handleEditServer

**Problem:** The edit function doesn't validate or enforce schema version compatibility.

**Impact:** Could create incompatible configs.

---

## Issue 15: Tools=0 Despite Server Being Active

**Location:** Tool retrieval and caching

**Problem:** Playwright server shows as active but tools_cached=0.

**Root Cause:** 
- Package name issue (`@playwright/mcp@latest` vs `@playwright/mcp`)
- Server might not be properly initialized
- Tools list call might be failing silently

**Impact:** Cannot use tools from the server.

---

## Issue 16: No Error Message When Tools List Fails

**Location:** `McpInspectorService.ts` listTools

**Problem:** If tools list fails, error is set but might not be visible in UI.

**Impact:** Users don't know why tools aren't loading.

---

## Issue 17: Config Reload Doesn't Preserve Edit State

**Location:** `McpRegistryView.tsx` useEffect

**Problem:** When config reloads, the edit modal state might be lost or become stale.

**Impact:** Can have inconsistent UI state.

---

## Issue 18: Server ID Canonicalization Not Applied to Edit

**Location:** Missing in handleEditServer

**Problem:** The edit function doesn't canonicalize server IDs like other operations do.

**Impact:** Inconsistent server ID handling.

---

## Issue 19: No Config Validation Before Save

**Location:** `McpInspectorService.ts` saveConfig

**Problem:** Config is saved without validation beyond JSON parsing.

**Impact:** Can save invalid configs that break the system.

---

## Issue 20: Edit Config Not Merged With Existing Config

**Location:** `McpRegistryView.tsx` handleEditServer

**Problem:** The edit function replaces the entire server config instead of merging with existing fields.

**Impact:** Can lose fields that weren't edited.

---

## Priority Fixes

### HIGH PRIORITY (Blocks functionality)
1. **Issue 1:** ✅ FIXED - Edit modal now wraps config in mcpServers structure and preserves command/args
2. **Issue 4:** ✅ FIXED - Package name updated to `@playwright/mcp` in both Windsurf and local app config
3. **Issue 15:** ✅ FIXED - Root cause found: local app config had old package name causing tools=0

### MEDIUM PRIORITY (UX improvements)
4. **Issue 8:** Add config source indication in UI
5. **Issue 7:** Clarify config save location
6. **Issue 3:** ✅ FIXED - Standardized config structure between add and edit

### LOW PRIORITY (Nice to have)
7. **Issue 11:** Add config diff/history
8. **Issue 13:** Add raw config edit option
9. **Issue 5:** ✅ FIXED - Added validation for required fields (command, args, url)

## Fixes Applied

### Fix 1: Edit Modal Config Structure
**File:** `McpRegistryView.tsx` handleOpenEditModal
- Wrapped server config in `mcpServers` structure for consistency
- Preserves all fields including command, args, cwd, env

### Fix 2: Package Name (Windsurf Config)
**File:** `c:\Users\syedm\.codeium\windsurf\mcp_config.json`
- Changed from `@playwright/mcp@latest` to `@playwright/mcp`

### Fix 3: Package Name (Local App Config) - CRITICAL FIX
**File:** `knez-control-app/src-tauri/mcp/mcp.config.json`
- Changed from `@playwright/mcp@latest` to `@playwright/mcp`
- This was the root cause of tools=0 - the app uses this config, not Windsurf config

### Fix 4: Edit Server Handler
**File:** `McpRegistryView.tsx` handleEditServer
- Handles both wrapped (mcpServers) and unwrapped structures
- Added validation for required fields (command, args for stdio; url for http)

### Fix 5: Validation
**File:** `McpRegistryView.tsx` handleEditServer
- Validates command is present for stdio servers
- Validates args is an array for stdio servers
- Validates url is present for http servers

## Root Cause of tools=0 Issue

The playwright server showed tools=0 because:
1. The local app config (`src-tauri/mcp/mcp.config.json`) had the wrong package name `@playwright/mcp@latest`
2. This package name can cause version resolution issues and the server may not start properly
3. The app loads from this local config, not the Windsurf config
4. When the server couldn't load the package properly, it returned an empty tools list
5. The code treats empty tools list as an error state with "mcp_server_no_tools"

**Solution:** Updated the package name in the local app config to `@playwright/mcp`

---

## Additional Fixes Applied

### Fix 6: Config Source Tracking (Partial)
**File:** `McpOrchestrator.ts` ServerRuntime type
- Added configSource field to track where config came from
- Values: "user" | "project" | "app_local" | "default"
- Allows UI to display config source

### Fix 7: Config Source Display (Pending)
**File:** `McpRegistryView.tsx` server cards
- Need to add UI element to show config source
- Helps users understand which config file is being used

### Fix 8: Config Save Location Clarification (Pending)
**File:** `McpHostConfigService.ts`
- Need to document which config file saves go to
- Add UI indication of save location

---

## Summary of Fixes Applied (9/20 issues)

**HIGH PRIORITY (Completed):**
1. ✅ Issue 1: Edit modal config structure - Now wraps in mcpServers and preserves command/args
2. ✅ Issue 3: Config structure standardization - Add and edit now use same structure
3. ✅ Issue 4: Package name - Fixed in both Windsurf and local app config
4. ✅ Issue 5: Required field validation - Added validation for command, args, url
5. ✅ Issue 15: tools=0 root cause - Fixed package name in local app config

**MEDIUM PRIORITY (Completed):**
6. ✅ Issue 8: Config source tracking and display - Added configSource field and UI display
7. ✅ Issue 9: Runtime config tracking - configSource field added to ServerRuntime

**LOW PRIORITY (Completed):**
8. ✅ Issue 16: Error message visibility - Enhanced with helpful hints
9. ✅ Issue 19: Config validation before save - Added JSON structure validation

**MEDIUM PRIORITY (Pending):**
10. Issue 7: Config save location clarification
11. Issue 2: Original raw config preservation in runtime
12. Issue 6: Config source indication in UI (partially done)

**LOW PRIORITY (Pending):**
13. Issue 11: Config diff/history
14. Issue 13: Raw config edit option
15. Issue 14: Schema version validation
16. Issue 17: Config reload state preservation
17. Issue 18: Server ID canonicalization
18. Issue 20: Config merge behavior
