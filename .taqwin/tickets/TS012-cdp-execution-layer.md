# TS012 — CDP Execution Layer for Tauri Testing
**Status:** DONE  
**Priority:** P0 — BLOCKER  
**Executed:** 2026-04-15

## Tasks

| # | File | Change | Status |
|---|------|--------|--------|
| 15.1 | `.taqwin/docs/cdp-enablement.md` | Document CDP enablement via environment variable (NOT config) | ✅ |
| 15.2 | `.taqwin/rules/execution.md` | Add CDP-first testing rule for Tauri applications | ✅ |
| 15.3 | `.taqwin/docs/qa-protocol.md` | Document QA protocol with CDP validation and page selection | ✅ |
| 15.4 | `.taqwin/docs/mcp-cdp-requirements.md` | Document MCP Playwright tool requirements | ✅ |

## Root Cause
Original plan attempted to use config file for CDP enablement (unstable in Tauri v2) and lacked CDP validation, page selection logic, and tool routing.

## Implementation

### Step 1: CDP Enablement (Correct Method)
- Use environment variable: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`
- Do NOT use config file (additionalBrowserArguments can break WebViews)
- Documented in `.taqwin/docs/cdp-enablement.md`

### Step 2: System Rules Update
- Added CDP-first testing rule to `.taqwin/rules/execution.md`
- IF Tauri app → MUST use CDP
- DO NOT fallback to browser tools (mcp0_browser_*)
- IF CDP not available → STOP execution

### Step 3: QA Protocol Update
- Created `.taqwin/docs/qa-protocol.md`
- CDP validation step (GET http://localhost:9222/json)
- Page selection logic (iterate pages, select matching URL/title)
- Retry logic and failure handling

### Step 4: MCP Tool Requirements
- Created `.taqwin/docs/mcp-cdp-requirements.md`
- Specified required tools: playwright.connect_cdp, playwright.get_pages, playwright.select_page
- Documented tool schemas and execution logic
- Noted this is external MCP server configuration (not app code)

## External Dependencies

**MCP Playwright Server Update Required:**
- Add playwright.connect_cdp tool
- Add playwright.get_pages tool
- Add playwright.select_page tool
- This is MCP server configuration, not KNEZ-Control-App code

## Verification

To verify CDP layer works:
```bash
# Enable CDP and start Tauri
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run tauri dev

# Verify CDP endpoint
curl http://localhost:9222/json

# Use CDP tools (once MCP server updated)
# 1. playwright.connect_cdp("http://localhost:9222")
# 2. playwright.get_pages()
# 3. playwright.select_page(page_id)
# 4. Execute test steps
```

## Next Steps

1. Update MCP Playwright server to add CDP tools
2. Test CDP connection with Tauri desktop app
3. Execute full E2E test flow for T8-T10 fixes (health check, auto-boot, chat)
