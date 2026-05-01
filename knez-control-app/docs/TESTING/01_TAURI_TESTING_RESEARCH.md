# Tauri Testing Research Report

**Generated:** 2026-04-30  
**Purpose:** Deep research on Tauri testing best practices, frameworks, and patterns  
**Target:** knez-control-app (Tauri v2 + React + TypeScript)

---

## Executive Summary

Tauri v2 provides comprehensive testing support through multiple approaches:
- **Unit/Integration Testing:** Mock runtime for testing without native webview
- **E2E Testing:** WebDriver protocol support (Windows/Linux) and tauri-plugin-playwright
- **IPC Testing:** mockIPC() for command interception and simulation
- **Plugin Testing:** WebSocket, SQL, and other plugins have specific testing patterns

---

## 1. Official Tauri Testing Documentation

### 1.1 Testing Modes

**Unit & Integration Testing (Mock Runtime)**
- Native webview libraries are NOT executed
- Uses mock runtime for fast, isolated testing
- Ideal for business logic, state management, IPC handlers
- Reference: https://v2.tauri.app/develop/tests/mocking/

**E2E Testing (WebDriver Protocol)**
- Desktop: Windows (WebView2), Linux (WebKitGTK) - WebDriver supported
- Desktop: macOS - WebDriver NOT supported (use tauri-plugin-playwright)
- Mobile: iOS, Android - WebDriver supported
- Reference: https://v2.tauri.app/develop/tests/webdriver/

### 1.2 Mock Runtime Benefits

**Advantages:**
- Fast execution (no native webview overhead)
- No OS-specific dependencies
- CI/CD friendly
- Isolated test environment

**Use Cases:**
- Business logic testing
- IPC command testing
- State management testing
- Service layer testing

---

## 2. E2E Testing Frameworks

### 2.1 tauri-plugin-playwright (Recommended)

**Source:** https://github.com/srsholmes/tauri-playwright  
**Version:** 0.1.0

**Key Features:**
- Controls real native webview (WKWebView, WebView2, WebKitGTK)
- Playwright-compatible API with auto-waiting
- Semantic selectors and locator assertions
- Network mocking capabilities
- Native screenshots and video recording
- Three testing modes from same test files:
  - `browser` - Headless Chrome (no Tauri needed)
  - `tauri` - Real Tauri app with webview control
  - `cdp` - Chrome DevTools Protocol mode (Windows only)

**Installation:**
```toml
# src-tauri/Cargo.toml
[features]
e2e-testing = ["tauri-plugin-playwright"]

[dependencies]
tauri-plugin-playwright = { version = "0.1", optional = true }
```

```typescript
// src-tauri/src/lib.rs
#[cfg(feature = "e2e-testing")]
builder = builder.plugin(tauri_plugin_playwright::init());
```

```bash
npm install -D @srsholmes/tauri-playwright @playwright/test
npx playwright install chromium
```

**Test Fixture Setup:**
```typescript
// e2e/fixtures.ts
import { createTauriTest } from '@srsholmes/tauri-playwright';

export const { test, expect } = createTauriTest({
  devUrl: 'http://localhost:1420',
  ipcMocks: {
    greet: (args) => `Hello, ${(args as { name?: string })?.name}!`,
  },
  mcpSocket: '/tmp/tauri-playwright.sock',
});
```

**Test Example:**
```typescript
// e2e/tests/app.spec.ts
import { test, expect } from '../fixtures';

test('counter increments', async ({ tauriPage }) => {
  await tauriPage.click('[data-testid="btn-increment"]');
  await expect(tauriPage.locator('[data-testid="counter-value"]')).toContainText('1');
});

test('greets via Tauri IPC', async ({ tauriPage }) => {
  await tauriPage.fill('[data-testid="greet-input"]', 'World');
  await tauriPage.click('[data-testid="btn-greet"]');
  await expect(tauriPage.getByTestId('greet-result')).toContainText('Hello, World!');
});
```

**Playwright Configuration:**
```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'browser-only',
      use: { 
        ...devices['Desktop Chrome'], 
        mode: 'browser' 
      },
    },
    {
      name: 'tauri',
      use: { mode: 'tauri' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 1420,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Running Tests:**
```bash
# Browser mode (headless, no Tauri needed)
npx playwright test --project=browser-only

# Tauri mode (start the app first)
# Terminal 1
cargo tauri dev --features e2e-testing

# Terminal 2
npx playwright test --project=tauri
```

**Why Recommended for knez-control-app:**
- Already uses Playwright (13 tauri-playwright tests exist)
- Supports WebSocket and SSE testing through real webview
- Network mocking for backend integration testing
- Cross-platform (except macOS WebDriver, but tauri-plugin-playwright works)
- MCP testing support through IPC mocking

### 2.2 WebDriver Protocol (Official Tauri)

**Limitations:**
- macOS desktop WebDriver not supported
- Requires platform-specific driver setup (msedgedriver for Windows)
- Less feature-rich than Playwright
- Reference: https://v2.tauri.app/develop/tests/webdriver/

**Not Recommended** for knez-control-app due to macOS limitations and existing Playwright investment.

---

## 3. IPC Command Testing

### 3.1 Mock IPC with mockIPC()

**Documentation:** https://v2.tauri.app/develop/tests/mocking/

**Basic Mocking:**
```typescript
import { mockIPC } from "@tauri-apps/api/mocks";
import { invoke } from "@tauri-apps/api/core";

test("invoke simple", async () => {
  mockIPC((cmd, args) => {
    if(cmd === "add") {
      return (args.a as number) + (args.b as number);
    }
  });
  
  expect(invoke("add", { a: 12, b: 15 })).resolves.toBe(27);
});
```

**Spying on IPC Calls:**
```typescript
import { mockIPC } from "@tauri-apps/api/mocks";
import { invoke } from "@tauri-apps/api/core";
import { vi } from "vitest";

test("invoke with spy", async () => {
  mockIPC((cmd, args) => {
    if(cmd === "add") {
      return (args.a as number) + (args.b as number);
    }
  });
  
  const spy = vi.spyOn(window.__TAURI_INTERNALS__, "invoke");
  expect(invoke("add", { a: 12, b: 15 })).resolves.toBe(27);
  expect(spy).toHaveBeenCalled();
});
```

**Mocking Sidecar/Shell Commands:**
```typescript
mockIPC(async (cmd, args) => {
  if (args.message.cmd === 'execute') {
    const eventCallbackId = `_${args.message.onEventFn}`;
    const eventEmitter = window[eventCallbackId];
    
    // 'Stdout' event can be called multiple times
    eventEmitter({ 
      event: 'Stdout', 
      payload: 'some data sent from the process', 
    });
    
    // 'Terminated' event must be called at the end
    eventEmitter({ 
      event: 'Terminated', 
      payload: { code: 0, signal: 'kill' }, 
    });
  }
});
```

### 3.2 Rust Command Unit Testing

**Documentation:** https://docs.rs/tauri/latest/tauri/test/index.html

**Example:**
```rust
use tauri::test::{mock_builder, mock_context, noop_assets};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn create_app<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::App<R> {
    builder
        .invoke_handler(tauri::generate_handler![ping])
        .build(mock_context(noop_assets()))
        .unwrap()
}

#[test]
fn test_ping_command() {
    let app = create_app(tauri::test::mock_builder());
    // Test command logic
}
```

---

## 4. Plugin-Specific Testing

### 4.1 WebSocket Plugin Testing

**Documentation:** https://v2.tauri.app/plugin/websocket/

**Testing Strategy:**
- Mock WebSocket connections for unit tests
- Use real WebSocket server for integration tests
- Test reconnection logic with simulated network failures
- Test message ordering and backpressure

**Mocking Approach:**
```typescript
// Mock WebSocket for unit tests
vi.mock('@tauri-apps/plugin-websocket', () => ({
  WebSocket: {
    connect: vi.fn(() => Promise.resolve({
      addListener: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    })),
  },
}));
```

**Integration Testing:**
```typescript
// Use real WebSocket server for integration tests
import WebSocket from '@tauri-apps/plugin-websocket';

test('WebSocket connection and message flow', async () => {
  const ws = await WebSocket.connect('ws://127.0.0.1:8080');
  const messages: string[] = [];
  
  const removeListener = ws.addListener((msg) => {
    messages.push(msg);
  });
  
  await ws.send('Hello World!');
  await expect(messages).toContain('Hello World!');
  
  removeListener();
  await ws.disconnect();
});
```

### 4.2 SQL Plugin Testing

**Documentation:** https://v2.tauri.app/plugin/sql/

**Supported Engines:**
- SQLite (default for Tauri apps)
- MySQL
- PostgreSQL

**Testing Strategy:**
- Use in-memory SQLite for unit tests
- Use test database for integration tests
- Test migrations with rollback
- Test query syntax and parameter binding

**Unit Testing with In-Memory DB:**
```typescript
import Database from '@tauri-apps/plugin-sql';

test('SQLite operations', async () => {
  const db = await Database.load('sqlite::memory:');
  
  await db.execute('CREATE TABLE todos (id INTEGER PRIMARY KEY, title TEXT)');
  await db.execute('INSERT INTO todos (title) VALUES ($1)', ['Test todo']);
  
  const result = await db.select('SELECT * FROM todos');
  expect(result.length).toBe(1);
  expect(result[0].title).toBe('Test todo');
});
```

**Migration Testing:**
```typescript
test('database migrations', async () => {
  const db = await Database.load('sqlite:test.db');
  
  // Apply migration
  await db.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
    )
  `);
  
  // Verify schema
  const schema = await db.select("SELECT sql FROM sqlite_master WHERE type='table'");
  expect(schema.length).toBeGreaterThan(0);
});
```

---

## 5. MCP Integration Testing

### 5.1 Tauri MCP Server (tauri-mcp)

**Source:** https://github.com/dirvine/tauri-mcp  
**Purpose:** MCP server for testing and interacting with Tauri v2 applications

**Core Tools:**
- **Process Management:** launch_app, stop_app, get_app_logs, monitor_resources
- **Window Manipulation:** take_screenshot, get_window_info
- **Input Simulation:** send_keyboard_input, send_mouse_click
- **Debugging Tools:** execute_js, get_devtools_info, WebDriver integration
- **IPC Interaction:** list_ipc_handlers, call_ipc_command

**Automated Testing Script Example:**
```python
import asyncio
from mcp import Client

async def test_tauri_app():
    client = Client("tauri-mcp")
    
    # Launch app
    result = await client.call_tool("launch_app", {
        "app_path": "./my-app",
        "args": ["--test-mode"]
    })
    process_id = result["process_id"]
    
    # Wait for app to start
    await asyncio.sleep(2)
    
    # Take screenshot
    await client.call_tool("take_screenshot", {
        "process_id": process_id,
        "output_path": "./test-screenshot.png"
    })
    
    # Send input
    await client.call_tool("send_keyboard_input", {
        "process_id": process_id,
        "keys": "Hello, Tauri!"
    })
    
    # Get logs
    logs = await client.call_tool("get_app_logs", {
        "process_id": process_id,
        "lines": 50
    })
    print("App logs:", logs)
    
    # Stop app
    await client.call_tool("stop_app", { "process_id": process_id })

asyncio.run(test_tauri_app())
```

**Relevance to knez-control-app:**
- Can test MCP server lifecycle (start, stop, crash recovery)
- Can test tool execution and validation
- Can test IPC command invocation
- Can test resource monitoring

### 5.2 MCP Inspector Testing

**Documentation:** https://v2.tauri.app/plugin/websocket/ (WebSocket for MCP communication)

**Testing Strategy:**
- Test MCP server initialization
- Test tool discovery and listing
- Test tool execution with various inputs
- Test error handling and timeout scenarios
- Test concurrent tool execution

---

## 6. Backend Integration Testing

### 6.1 HTTP Client Testing

**Testing Approaches:**
- Mock HTTP responses for unit tests
- Use real backend for integration tests
- Test retry logic and error handling
- Test SSE streaming

**Mocking HTTP:**
```typescript
import { vi } from 'vitest';

vi.mock('./services/knez/KnezClient', () => ({
  knezClient: {
    sendMessage: vi.fn(() => Promise.resolve({
      content: 'Mocked response',
      role: 'assistant',
    })),
  },
}));
```

**Integration Testing with Real Backend:**
```typescript
test('backend HTTP integration', async () => {
  const response = await fetch('http://localhost:8000/api/chat');
  const data = await response.json();
  
  expect(response.status).toBe(200);
  expect(data).toHaveProperty('content');
});
```

### 6.2 WebSocket/SSE Testing

**WebSocket Testing:**
```typescript
test('WebSocket connection lifecycle', async () => {
  const ws = new WebSocket('ws://localhost:8000/ws');
  
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  
  expect(ws.readyState).toBe(WebSocket.OPEN);
  
  ws.close();
});
```

**SSE Testing:**
```typescript
test('SSE streaming', async () => {
  const response = await fetch('http://localhost:8000/api/stream');
  const reader = response.body?.getReader();
  
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }
  
  expect(chunks.length).toBeGreaterThan(0);
});
```

---

## 7. Database Testing Patterns

### 7.1 IndexedDB Testing (Dexie)

**Current Setup in knez-control-app:**
- Uses Dexie for IndexedDB wrapper
- Has comprehensive mock in `tests/setup.ts`
- Mock uses in-memory Map for storage

**Testing Strategy:**
```typescript
// Unit tests use mock from setup.ts
test('IndexedDB operations', async () => {
  const db = new Dexie('TestDB');
  db.version(1).stores({ todos: '++id, title' });
  
  await db.todos.add({ title: 'Test todo' });
  const todo = await db.todos.get(1);
  
  expect(todo?.title).toBe('Test todo');
});

// Integration tests use real IndexedDB
test('IndexedDB integration', async () => {
  const db = new Dexie('TestDB');
  db.version(1).stores({ todos: '++id, title' });
  
  await db.todos.add({ title: 'Integration test' });
  const count = await db.todos.count();
  
  expect(count).toBe(1);
});
```

### 7.2 SQLite Testing (if using Tauri SQL plugin)

**Not currently used in knez-control-app**, but documented for future reference.

---

## 8. CI/CD Integration

### 8.1 GitHub Actions with tauri-action

**Official Action:** https://github.com/tauri-apps/tauri-action

**Example Configuration:**
```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
```

### 8.2 Platform-Specific Considerations

**Windows:**
- WebView2 WebDriver support
- msedgedriver setup required for official WebDriver
- tauri-plugin-playwright works without driver setup

**Linux:**
- WebKitGTK WebDriver support
- tauri-plugin-playwright works

**macOS:**
- WebDriver NOT supported for desktop
- tauri-plugin-playwright REQUIRED for E2E testing
- Browser mode (headless Chrome) works as fallback

---

## 9. Best Practices Summary

### 9.1 Testing Pyramid

```
        E2E Tests (tauri-plugin-playwright)
       /                                    \
      /                                      \
     /   Integration Tests (Real Backend)    \
    /                                          \
   /    Unit Tests (Mock Runtime + mockIPC)   \
  /                                              \
 /________________________________________________\
```

**Recommended Ratio:**
- 70% Unit Tests (fast, isolated)
- 20% Integration Tests (real dependencies)
- 10% E2E Tests (critical user flows)

### 9.2 Test Organization

```
tests/
├── unit/              # Vitest tests with mocks
│   ├── chat/         # ChatService, MessageStore, etc.
│   ├── mcp/          # MCP orchestrator, tool execution
│   ├── agent-intelligence/  # Agent services
│   └── ui/           # Component tests
├── integration/       # Real backend, WebSocket, MCP
│   ├── diagnostic/    # Diagnostic integration
│   └── taqwinMcpRuntime.test.ts
├── tauri-playwright/ # E2E tests with tauri-plugin-playwright
│   ├── smoke.spec.ts
│   ├── mcp-inspector.spec.ts
│   └── streaming-correctness.spec.ts
└── setup.ts          # Global test setup (IndexedDB mocks)
```

### 9.3 Key Testing Principles

1. **Isolation:** Each test should be independent
2. **Speed:** Unit tests should run in < 100ms
3. **Reliability:** Tests should be flake-free
4. **Coverage:** Test critical paths, not just happy paths
5. **Reality:** Integration/E2E tests should use real dependencies
6. **Maintainability:** Tests should be easy to understand and modify

### 9.4 Common Pitfalls

**Avoid:**
- Testing implementation details (test behavior, not code)
- Flaky tests with timing dependencies
- Over-mocking (mock only external dependencies)
- Test duplication (DRY principle applies to tests too)
- Ignoring edge cases and error scenarios

**Prefer:**
- Testing user-facing behavior
- Deterministic tests with explicit waits
- Strategic mocking (mock what you control)
- Reusable test helpers and fixtures
- Comprehensive error testing

---

## 10. Recommendations for knez-control-app

### 10.1 Current State Analysis

**Strengths:**
- ✅ Extensive unit test coverage (38 tests)
- ✅ E2E tests with Playwright (13 tests)
- ✅ Integration tests for MCP and diagnostics
- ✅ Comprehensive IndexedDB mocking
- ✅ Test setup with proper mocks

**Gaps:**
- ⚠️ No tauri-plugin-playwright integration (using custom Puppeteer setup)
- ⚠️ Limited WebSocket/SSE integration tests
- ⚠️ No Rust command unit tests
- ⚠️ No database migration tests
- ⚠️ No performance regression tests

### 10.2 Recommended Improvements

**Priority 1 (High Impact):**
1. **Migrate to tauri-plugin-playwright** - Better cross-platform support, official Tauri integration
2. **Add WebSocket integration tests** - Critical for real-time features
3. **Add SSE streaming tests** - Critical for chat streaming
4. **Add MCP lifecycle tests** - Test server start/stop/crash recovery

**Priority 2 (Medium Impact):**
5. **Add Rust command unit tests** - Test backend logic in isolation
6. **Add database migration tests** - Ensure schema evolution safety
7. **Add performance regression tests** - Detect performance degradation
8. **Add visual regression tests** - Ensure UI consistency

**Priority 3 (Low Impact):**
9. **Add accessibility tests** - Ensure WCAG compliance
10. **Add security tests** - Test IPC validation, input sanitization

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Install and configure tauri-plugin-playwright
- [ ] Migrate existing E2E tests to tauri-plugin-playwright
- [ ] Set up Playwright configuration for browser + tauri modes
- [ ] Document test running procedures

### Phase 2: Integration Testing (Week 2)
- [ ] Add WebSocket connection lifecycle tests
- [ ] Add SSE streaming correctness tests
- [ ] Add backend HTTP integration tests
- [ ] Add MCP server lifecycle tests

### Phase 3: Advanced Testing (Week 3)
- [ ] Add Rust command unit tests
- [ ] Add database migration tests
- [ ] Add performance regression tests
- [ ] Add visual regression tests

### Phase 4: CI/CD Integration (Week 4)
- [ ] Set up GitHub Actions for all platforms
- [ ] Configure test reporting and coverage
- [ ] Set up automated test runs on PR
- [ ] Document test maintenance procedures

---

## 12. References

### Official Documentation
- Tauri Testing: https://v2.tauri.app/develop/tests/
- Mock Tauri APIs: https://v2.tauri.app/develop/tests/mocking/
- WebDriver Support: https://v2.tauri.app/develop/tests/webdriver/
- WebSocket Plugin: https://v2.tauri.app/plugin/websocket/
- SQL Plugin: https://v2.tauri.app/plugin/sql/

### Community Tools
- tauri-plugin-playwright: https://github.com/srsholmes/tauri-playwright
- tauri-mcp (MCP Server): https://github.com/dirvine/tauri-mcp
- tauri-action (CI/CD): https://github.com/tauri-apps/tauri-action

### Testing Libraries
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- Testing Library: https://testing-library.com/

---

**END OF RESEARCH REPORT**
