# MCP Playwright Tool Requirements for CDP

## Required Tools

The MCP Playwright server MUST implement the following tools for Tauri WebView2 testing via CDP:

### 1. playwright.connect_cdp

**Purpose:** Connect to Chrome DevTools Protocol endpoint

**Schema:**
```json
{
  "name": "playwright.connect_cdp",
  "description": "Connect to Chrome DevTools Protocol endpoint",
  "inputSchema": {
    "type": "object",
    "properties": {
      "endpoint": {
        "type": "string",
        "description": "CDP endpoint URL (e.g., http://localhost:9222)"
      }
    },
    "required": ["endpoint"]
  }
}
```

**Execution Logic:**
```javascript
async function connect_cdp(endpoint) {
  const browser = await chromium.connectOverCDP(endpoint);
  return browser;
}
```

### 2. playwright.get_pages

**Purpose:** Retrieve all available pages from connected CDP session

**Schema:**
```json
{
  "name": "playwright.get_pages",
  "description": "Retrieve all available pages from CDP session",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Execution Logic:**
```javascript
async function get_pages() {
  const contexts = browser.contexts();
  const pages = [];
  for (const context of contexts) {
    pages.push(...context.pages());
  }
  return pages.map(page => ({
    url: page.url(),
    title: await page.title(),
    id: page.guid
  }));
}
```

### 3. playwright.select_page

**Purpose:** Select a specific page for subsequent operations

**Schema:**
```json
{
  "name": "playwright.select_page",
  "description": "Select a specific page for subsequent operations",
  "inputSchema": {
    "type": "object",
    "properties": {
      "page_id": {
        "type": "string",
        "description": "Page ID from get_pages"
      }
    },
    "required": ["page_id"]
  }
}
```

**Execution Logic:**
```javascript
async function select_page(page_id) {
  const contexts = browser.contexts();
  for (const context of contexts) {
    const page = context.pages().find(p => p.guid === page_id);
    if (page) {
      activePage = page;
      return page;
    }
  }
  throw new Error(`Page not found: ${page_id}`);
}
```

## Tool Registration in MCP Server

The MCP server configuration must register these tools:

```typescript
// In MCP server setup
server.addTool({
  name: 'playwright.connect_cdp',
  description: 'Connect to Chrome DevTools Protocol endpoint',
  inputSchema: {
    type: 'object',
    properties: {
      endpoint: { type: 'string' }
    },
    required: ['endpoint']
  },
  handler: async (args) => {
    return await connect_cdp(args.endpoint);
  }
});

server.addTool({
  name: 'playwright.get_pages',
  description: 'Retrieve all available pages from CDP session',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    return await get_pages();
  }
});

server.addTool({
  name: 'playwright.select_page',
  description: 'Select a specific page for operations',
  inputSchema: {
    type: 'object',
    properties: {
      page_id: { type: 'string' }
    },
    required: ['page_id']
  },
  handler: async (args) => {
    return await select_page(args.page_id);
  }
});
```

## Current Status

**Available Tools (io.windsurf/mcp-playwright):**
- ✅ playwright.navigate
- ✅ playwright.snapshot
- ✅ playwright.click
- ✅ playwright.fill
- ✅ playwright.evaluate
- ✅ playwright.screenshot
- ❌ playwright.connect_cdp (MISSING)
- ❌ playwright.get_pages (MISSING)
- ❌ playwright.select_page (MISSING)

**Action Required:**
The MCP Playwright server needs to be updated to add the missing CDP tools.

## Implementation Notes

1. **CDP Connection:** Uses Playwright's `chromium.connectOverCDP()` method
2. **Page Management:** Must handle multiple contexts and pages
3. **Error Handling:** Must validate endpoint availability before connection
4. **Cleanup:** Must handle browser disconnection gracefully

## Testing CDP Tools

Once implemented, test with:

```bash
# Start Tauri with CDP
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run tauri dev

# Test CDP connection
curl http://localhost:9222/json

# Test MCP tools via agent
# 1. playwright.connect_cdp("http://localhost:9222")
# 2. playwright.get_pages()
# 3. playwright.select_page(page_id)
# 4. playwright.snapshot()
```

## External Dependency

This is an **MCP server configuration change**, not app code. The changes must be made in:
- MCP Playwright server source code
- MCP server tool registration
- MCP server deployment

Cannot be implemented directly in KNEZ-Control-App codebase.
