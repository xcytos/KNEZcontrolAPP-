# QA Test Protocol for Tauri Apps (CDP-First)

## Pre-requisites

1. **Tauri app running with CDP enabled**
   ```bash
   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run tauri dev
   ```

2. **MCP Playwright server with CDP tools available**
   - `playwright.connect_cdp`
   - `playwright.get_pages`
   - `playwright.select_page`

3. **CDP endpoint accessible**
   - Endpoint: http://localhost:9222
   - Verify: `curl http://localhost:9222/json`

## Test Flow

### Step 0: CDP Validation (Mandatory)

```javascript
// Validate CDP is available
const response = await fetch('http://localhost:9222/json');
const targets = await response.json();

if (!targets || targets.length === 0) {
  STOP → report "Tauri not running with CDP"
}
```

### Step 1: CDP Connection

```javascript
// Connect to CDP endpoint
await playwright.connect_cdp('http://localhost:9222');
```

### Step 2: Retrieve All Pages

```javascript
// Get all available pages
const pages = await playwright.get_pages();
```

### Step 3: Page Selection Logic

```javascript
// Select correct page (do NOT assume pages[0])
let targetPage = null;
for (const page of pages) {
  if (page.url.includes('localhost:5173') || page.title === 'KNEZ Control') {
    targetPage = page;
    break;
  }
}

if (!targetPage) {
  STOP → report "No matching WebView page found"
}

await playwright.select_page(targetPage);
```

### Step 4: Execute Test Steps

```javascript
// Wait for UI to be ready
await playwright.wait_for_selector('body', { visible: true });

// Execute test actions
await playwright.click(selector);
await playwright.fill(selector, value);
```

### Step 5: Verify Results

```javascript
// Verify via DOM snapshot
const snapshot = await playwright.snapshot();
// Check expected elements exist
```

## Selector Strategy (Priority Order)

1. Role / aria-label
2. Visible text
3. Placeholder
4. data-testid
5. CSS fallback (last)

**NEVER use:**
- nth-child
- Deep CSS chains
- Unstable selectors

## Failure Handling

### If CDP Disconnects

```javascript
// Reconnect
await playwright.connect_cdp('http://localhost:9222');
// Re-select page
await playwright.select_page(targetPage);
```

### If Page Reloads

```javascript
// Re-select page after reload
const pages = await playwright.get_pages();
// Re-apply page selection logic
```

### If State Mismatch

```javascript
// Re-scan DOM
const snapshot = await playwright.snapshot();
// Re-evaluate selectors
```

## Retry Logic

For EVERY action:
- wait_for_selector (visible=true, stable=true)
- perform action
- verify result via DOM

IF failure:
- retry up to 3 times
- re-evaluate selector using updated DOM snapshot

## Output Format

```json
{
  "cdp_connected": true,
  "pages_detected": number,
  "target_page_selected": true,
  "steps_executed": [...],
  "knez_status": "...",
  "chat_status": "...",
  "errors": [...],
  "final_status": "success" | "partial" | "failed"
}
```

## Execution Rules

**STRICT:**
- IF Tauri app → MUST use CDP
- IF CDP not available → STOP
- DO NOT fallback to browser tools (mcp0_browser_*)

**Behavior:**
- Deterministic
- Slow, careful execution
- Prefer correctness over speed
- Always verify before moving forward
