# Comprehensive Testing Strategy for knez-control-app

**Generated:** 2026-04-30  
**Purpose:** Best testing strategy to guarantee working and truth in real runtime  
**Target:** knez-control-app (Tauri v2 + React + TypeScript)

---

## Executive Summary

This document provides a comprehensive testing strategy for knez-control-app that guarantees working and truth in real runtime. The strategy is based on deep research of Tauri testing best practices, analysis of the current knez-control-app architecture, and industry-standard testing patterns.

**Core Principles:**
- **Test Real Runtime:** Integration and E2E tests must use real dependencies
- **Test Critical Paths:** Focus on user-facing behavior, not implementation details
- **Test Failures:** Comprehensive error scenario testing
- **Test Performance:** Performance regression detection
- **Test Cross-Platform:** Ensure reliability across Windows, Linux, macOS

**Target Coverage:**
- Unit Tests: 70% (fast, isolated)
- Integration Tests: 20% (real dependencies)
- E2E Tests: 10% (critical user flows)

---

## 1. Testing Philosophy

### 1.1 Core Principles

**1. Test Behavior, Not Implementation**
- Test what the user sees and experiences
- Avoid testing internal implementation details
- Tests should be resilient to refactoring

**2. Test Real Runtime**
- Integration tests use real backend, WebSocket, MCP servers
- E2E tests use real Tauri app with real dependencies
- Mock only what you don't control (external APIs)

**3. Test Critical Paths**
- Focus on happy paths and critical error paths
- Test edge cases and boundary conditions
- Test failure scenarios and recovery

**4. Test Performance**
- Establish performance baselines
- Detect performance regressions
- Monitor key metrics (TTFT, token throughput, latency)

**5. Test Cross-Platform**
- Ensure tests run on Windows, Linux, macOS
- Handle platform-specific differences
- Use platform-agnostic test patterns

### 1.2 Testing Pyramid

```
                    E2E Tests (10%)
                   /              \
                  /    Critical    \
                 /     User Flows   \
        Integration Tests (20%)     \
               /                      \
              /    Real Dependencies  \
     Unit Tests (70%)                  \
    /    Fast, Isolated                 \
   /                                      \
  /________________________________________\
```

**Rationale:**
- Unit tests are fast and catch most bugs
- Integration tests validate component interactions
- E2E tests validate critical user journeys

---

## 2. Test Architecture

### 2.1 Test Organization

```
tests/
├── unit/                              # Vitest tests with mocks
│   ├── chat/                         # ChatService, PhaseManager, MessageStore
│   │   ├── ChatService.test.ts
│   │   ├── PhaseManager.test.ts
│   │   ├── MessageStore.test.ts
│   │   ├── StreamController.test.ts
│   │   └── RequestController.test.ts
│   ├── mcp/                          # MCP orchestration
│   │   ├── McpOrchestrator.test.ts
│   │   ├── ToolExecutionService.test.ts
│   │   ├── ToolExposureService.test.ts
│   │   ├── ToolResultValidator.test.ts
│   │   └── ToolConfidenceScorer.test.ts
│   ├── agent-intelligence/           # Agent services
│   │   ├── AgentOrchestrator.test.ts
│   │   ├── AgentLoopService.test.ts
│   │   ├── FailureClassifier.test.ts
│   │   └── ContextCompressionEngine.test.ts
│   ├── websocket/                    # WebSocket client
│   │   ├── WebSocketClient.test.ts
│   │   ├── MessageQueue.test.ts
│   │   ├── HealthMonitor.test.ts
│   │   └── BackpressureHandler.test.ts
│   ├── memory/                       # Memory services
│   │   ├── MemoryEventSourcingService.test.ts
│   │   ├── MemoryVectorSearchService.test.ts
│   │   └── PersistenceService.test.ts
│   ├── knez/                         # KNEZ client
│   │   └── KnezClient.test.ts
│   └── ui/                           # Component tests
│       ├── ChatPane.test.tsx
│       ├── MessageItem.test.tsx
│       └── DebugPanel.test.tsx
├── integration/                      # Real dependencies
│   ├── chat/                         # Chat integration
│   │   ├── chat-flow-integration.test.ts
│   │   ├── streaming-integration.test.ts
│   │   └── tool-execution-integration.test.ts
│   ├── mcp/                          # MCP integration
│   │   ├── mcp-lifecycle-integration.test.ts
│   │   ├── tool-execution-integration.test.ts
│   │   └── mcp-inspector-integration.test.ts
│   ├── websocket/                    # WebSocket integration
│   │   ├── websocket-connection-integration.test.ts
│   │   ├── websocket-reconnection-integration.test.ts
│   │   └── websocket-message-flow-integration.test.ts
│   ├── sse/                          # SSE integration
│   │   ├── sse-streaming-integration.test.ts
│   │   └── sse-chunk-parsing-integration.test.ts
│   ├── memory/                       # Memory integration
│   │   ├── memory-loading-integration.test.ts
│   │   ├── memory-injection-integration.test.ts
│   │   └── indexeddb-integration.test.ts
│   └── backend/                      # Backend integration
│       ├── knez-http-integration.test.ts
│       └── knez-websocket-integration.test.ts
├── tauri-playwright/                 # E2E tests (tauri-plugin-playwright)
│   ├── smoke/                        # Smoke tests
│   │   ├── app-launch.spec.ts
│   │   ├── basic-chat.spec.ts
│   │   └── mcp-registry-load.spec.ts
│   ├── chat/                         # Chat E2E flows
│   │   ├── full-chat-flow.spec.ts
│   │   ├── streaming-chat.spec.ts
│   │   ├── tool-execution-chat.spec.ts
│   │   └── error-recovery-chat.spec.ts
│   ├── mcp/                          # MCP E2E flows
│   │   ├── mcp-inspector.spec.ts
│   │   ├── mcp-tool-execution.spec.ts
│   │   ├── mcp-crash-recovery.spec.ts
│   │   └── mcp-server-lifecycle.spec.ts
│   ├── agent/                        # Agent E2E flows
│   │   ├── agent-loop.spec.ts
│   │   ├── agent-tool-selection.spec.ts
│   │   └── agent-failure-recovery.spec.ts
│   ├── performance/                  # Performance regression tests
│   │   ├── chat-performance.spec.ts
│   │   ├── streaming-performance.spec.ts
│   │   └── mcp-performance.spec.ts
│   └── fixtures/                     # Test fixtures
│       ├── tauri-fixture.ts
│       ├── backend-fixture.ts
│       └── mcp-fixture.ts
├── visual/                           # Visual regression tests
│   ├── chat/
│   │   ├── chat-pane-visual.spec.ts
│   │   ├── message-item-visual.spec.ts
│   │   └── debug-panel-visual.spec.ts
│   ├── mcp/
│   │   ├── mcp-inspector-visual.spec.ts
│   │   └── tool-visualization-visual.spec.ts
│   └── agent/
│       └── agent-ui-visual.spec.ts
├── accessibility/                    # Accessibility tests
│   ├── chat/
│   │   ├── chat-pane-a11y.spec.ts
│   │   └── message-item-a11y.spec.ts
│   └── mcp/
│       └── mcp-inspector-a11y.spec.ts
├── rust/                             # Rust command unit tests
│   ├── commands/
│   │   ├── file_commands.test.rs
│   │   └── shell_commands.test.rs
│   └── lib.rs
├── performance/                      # Performance benchmarks
│   ├── chat/
│   │   ├── streaming-benchmark.test.ts
│   │   └── tool-execution-benchmark.test.ts
│   └── mcp/
│       └── tool-execution-benchmark.test.ts
└── setup.ts                          # Global test setup
```

### 2.2 Test Configuration

**Vitest Configuration (vitest.config.ts):**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'src-tauri/',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

**Playwright Configuration (playwright.config.ts):**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/tauri-playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'browser-only',
      use: { 
        ...devices['Desktop Chrome'], 
        mode: 'browser' 
      },
    },
    {
      name: 'tauri-windows',
      use: { 
        mode: 'tauri',
        platform: 'windows',
      },
    },
    {
      name: 'tauri-linux',
      use: { 
        mode: 'tauri',
        platform: 'linux',
      },
    },
    {
      name: 'tauri-macos',
      use: { 
        mode: 'tauri',
        platform: 'darwin',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

---

## 3. Unit Testing Strategy

### 3.1 Chat System Unit Tests

**ChatService.test.ts:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../../src/services/ChatService';
import { mockIPC } from '@tauri-apps/api/mocks';

describe('ChatService', () => {
  let chatService: ChatService;

  beforeEach(() => {
    chatService = new ChatService();
    mockIPC((cmd, args) => {
      if (cmd === 'read_file') {
        return { content: 'mocked content' };
      }
    });
  });

  describe('sendMessage', () => {
    it('should send message and update state', async () => {
      await chatService.sendMessage('Hello');
      const state = chatService.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe('Hello');
    });

    it('should acquire request lock before sending', async () => {
      const acquireLockSpy = vi.spyOn(chatService['requestController'], 'acquireLock');
      await chatService.sendMessage('Hello');
      expect(acquireLockSpy).toHaveBeenCalled();
    });

    it('should set phase to THINKING before sending', async () => {
      const setPhaseSpy = vi.spyOn(chatService['phaseManager'], 'setPhase');
      await chatService.sendMessage('Hello');
      expect(setPhaseSpy).toHaveBeenCalledWith('THINKING');
    });
  });

  describe('phase transitions', () => {
    it('should transition from IDLE to THINKING', () => {
      chatService['phaseManager'].setPhase('THINKING');
      expect(chatService['phaseManager'].getPhase()).toBe('THINKING');
    });

    it('should transition from THINKING to STREAMING', () => {
      chatService['phaseManager'].setPhase('THINKING');
      chatService['phaseManager'].setPhase('STREAMING');
      expect(chatService['phaseManager'].getPhase()).toBe('STREAMING');
    });

    it('should reject invalid phase transitions', () => {
      chatService['phaseManager'].setPhase('IDLE');
      expect(() => {
        chatService['phaseManager'].setPhase('FINALIZING');
      }).toThrow();
    });
  });

  describe('stream validation', () => {
    it('should validate stream ownership', () => {
      const streamId = 'test-stream-id';
      chatService['streamController'].validateStream(streamId);
      expect(chatService['streamController'].getActiveStream()).toBe(streamId);
    });

    it('should reject invalid stream ownership', () => {
      const invalidStreamId = 'invalid-stream-id';
      expect(() => {
        chatService['streamController'].validateStream(invalidStreamId);
      }).toThrow();
    });
  });
});
```

**PhaseManager.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import { PhaseManager } from '../../src/services/chat/core/PhaseManager';

describe('PhaseManager', () => {
  let phaseManager: PhaseManager;

  beforeEach(() => {
    phaseManager = new PhaseManager();
  });

  describe('valid transitions', () => {
    it('should allow IDLE -> THINKING', () => {
      phaseManager.setPhase('THINKING');
      expect(phaseManager.getPhase()).toBe('THINKING');
    });

    it('should allow THINKING -> STREAMING', () => {
      phaseManager.setPhase('THINKING');
      phaseManager.setPhase('STREAMING');
      expect(phaseManager.getPhase()).toBe('STREAMING');
    });

    it('should allow STREAMING -> FINALIZING', () => {
      phaseManager.setPhase('THINKING');
      phaseManager.setPhase('STREAMING');
      phaseManager.setPhase('FINALIZING');
      expect(phaseManager.getPhase()).toBe('FINALIZING');
    });

    it('should allow FINALIZING -> IDLE', () => {
      phaseManager.setPhase('THINKING');
      phaseManager.setPhase('STREAMING');
      phaseManager.setPhase('FINALIZING');
      phaseManager.setPhase('IDLE');
      expect(phaseManager.getPhase()).toBe('IDLE');
    });
  });

  describe('invalid transitions', () => {
    it('should reject IDLE -> STREAMING', () => {
      expect(() => {
        phaseManager.setPhase('STREAMING');
      }).toThrow('Invalid phase transition');
    });

    it('should reject STREAMING -> THINKING', () => {
      phaseManager.setPhase('THINKING');
      phaseManager.setPhase('STREAMING');
      expect(() => {
        phaseManager.setPhase('THINKING');
      }).toThrow('Invalid phase transition');
    });
  });

  describe('emergency reset', () => {
    it('should force reset to IDLE from any phase', () => {
      phaseManager.setPhase('THINKING');
      phaseManager.setPhase('STREAMING');
      phaseManager.emergencyReset();
      expect(phaseManager.getPhase()).toBe('IDLE');
    });
  });
});
```

### 3.2 MCP Unit Tests

**McpOrchestrator.test.ts:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpOrchestrator } from '../../src/mcp/McpOrchestrator';

describe('McpOrchestrator', () => {
  let orchestrator: McpOrchestrator;

  beforeEach(() => {
    orchestrator = new McpOrchestrator();
  });

  describe('server lifecycle', () => {
    it('should start server when enabled', async () => {
      const server = {
        serverId: 'test-server',
        enabled: true,
        start_on_boot: true,
      };
      await orchestrator.ensureStarted(server);
      const runtime = orchestrator.getServer('test-server');
      expect(runtime?.running).toBe(true);
    });

    it('should not start server when disabled', async () => {
      const server = {
        serverId: 'test-server',
        enabled: false,
        start_on_boot: true,
      };
      await orchestrator.ensureStarted(server);
      const runtime = orchestrator.getServer('test-server');
      expect(runtime?.running).toBe(false);
    });

    it('should stop server on request', async () => {
      const server = {
        serverId: 'test-server',
        enabled: true,
        start_on_boot: true,
      };
      await orchestrator.ensureStarted(server);
      await orchestrator.stopServer('test-server');
      const runtime = orchestrator.getServer('test-server');
      expect(runtime?.running).toBe(false);
    });
  });

  describe('crash recovery', () => {
    it('should auto-restart crashed server', async () => {
      const server = {
        serverId: 'test-server',
        enabled: true,
        start_on_boot: true,
      };
      await orchestrator.ensureStarted(server);
      // Simulate crash
      orchestrator.handleCrash('test-server', 'test error');
      // Wait for auto-restart
      await new Promise(resolve => setTimeout(resolve, 2000));
      const runtime = orchestrator.getServer('test-server');
      expect(runtime?.running).toBe(true);
    });

    it('should not auto-restart after max attempts', async () => {
      const server = {
        serverId: 'test-server',
        enabled: true,
        start_on_boot: true,
      };
      await orchestrator.ensureStarted(server);
      // Simulate multiple crashes
      for (let i = 0; i < 10; i++) {
        orchestrator.handleCrash('test-server', 'test error');
      }
      const runtime = orchestrator.getServer('test-server');
      expect(runtime?.running).toBe(false);
    });
  });
});
```

### 3.3 WebSocket Unit Tests

**WebSocketClient.test.ts:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketClient } from '../../src/services/websocket/WebSocketClient';

describe('WebSocketClient', () => {
  let wsClient: WebSocketClient;

  beforeEach(() => {
    wsClient = new WebSocketClient();
  });

  describe('connection lifecycle', () => {
    it('should connect to WebSocket server', async () => {
      await wsClient.connect('ws://localhost:8080');
      expect(wsClient.isConnected).toBe(true);
    });

    it('should disconnect from WebSocket server', async () => {
      await wsClient.connect('ws://localhost:8080');
      await wsClient.disconnect();
      expect(wsClient.isConnected).toBe(false);
    });

    it('should reconnect on connection loss', async () => {
      await wsClient.connect('ws://localhost:8080');
      // Simulate connection loss
      wsClient['ws']?.close();
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 5000));
      expect(wsClient.isConnected).toBe(true);
    });
  });

  describe('message queue', () => {
    it('should queue messages when backpressure detected', async () => {
      await wsClient.connect('ws://localhost:8080');
      const message = { type: 'test', data: 'test data' };
      await wsClient.send(message);
      expect(wsClient['messageQueue'].size).toBeGreaterThan(0);
    });

    it('should process queued messages when backpressure clears', async () => {
      await wsClient.connect('ws://localhost:8080');
      const message = { type: 'test', data: 'test data' };
      await wsClient.send(message);
      // Wait for backpressure to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(wsClient['messageQueue'].size).toBe(0);
    });
  });

  describe('health monitoring', () => {
    it('should detect unhealthy connection', async () => {
      await wsClient.connect('ws://localhost:8080');
      // Simulate unhealthy connection
      wsClient['healthMonitor'].lastHeartbeat = Date.now() - 60000;
      const health = wsClient['healthMonitor'].check();
      expect(health.healthy).toBe(false);
    });

    it('should trigger reconnection on unhealthy connection', async () => {
      await wsClient.connect('ws://localhost:8080');
      // Simulate unhealthy connection
      wsClient['healthMonitor'].lastHeartbeat = Date.now() - 60000;
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 5000));
      expect(wsClient.isConnected).toBe(true);
    });
  });
});
```

---

## 4. Integration Testing Strategy

### 4.1 Chat Integration Tests

**chat-flow-integration.test.ts:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChatService } from '../../src/services/ChatService';
import { knezClient } from '../../src/services/knez/KnezClient';

describe('Chat Flow Integration', () => {
  let chatService: ChatService;
  let backendUrl: string;

  beforeAll(async () => {
    // Start real KNEZ backend
    backendUrl = 'http://localhost:8000';
    // Ensure backend is running
    await fetch(`${backendUrl}/health`);
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should complete full chat flow with real backend', async () => {
    chatService = new ChatService();
    
    // Send message
    await chatService.sendMessage('Hello');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify response
    const state = chatService.getState();
    expect(state.messages).toHaveLength(2); // user + assistant
    expect(state.messages[1].from).toBe('assistant');
    expect(state.messages[1].content).toBeTruthy();
  });

  it('should handle streaming response correctly', async () => {
    chatService = new ChatService();
    
    // Send message
    await chatService.sendMessage('Tell me a story');
    
    // Wait for streaming to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verify streaming
    const state = chatService.getState();
    expect(state.messages[1].content.length).toBeGreaterThan(0);
  });

  it('should handle tool execution in chat flow', async () => {
    chatService = new ChatService();
    
    // Send message that triggers tool
    await chatService.sendMessage('What is the weather?');
    
    // Wait for tool execution
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verify tool execution
    const state = chatService.getState();
    const toolMessages = state.messages.filter(m => m.from === 'tool_execution');
    expect(toolMessages.length).toBeGreaterThan(0);
  });
});
```

### 4.2 MCP Integration Tests

**mcp-lifecycle-integration.test.ts:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpOrchestrator } from '../../src/mcp/McpOrchestrator';

describe('MCP Lifecycle Integration', () => {
  let orchestrator: McpOrchestrator;

  beforeAll(async () => {
    orchestrator = new McpOrchestrator();
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should start real MCP server', async () => {
    const server = {
      serverId: 'test-server',
      command: 'python',
      args: ['-m', 'mcp_server'],
      enabled: true,
      start_on_boot: false,
    };
    
    await orchestrator.ensureStarted(server);
    const runtime = orchestrator.getServer('test-server');
    expect(runtime?.running).toBe(true);
    expect(runtime?.pid).toBeGreaterThan(0);
  });

  it('should discover tools from real MCP server', async () => {
    const server = {
      serverId: 'test-server',
      command: 'python',
      args: ['-m', 'mcp_server'],
      enabled: true,
      start_on_boot: false,
    };
    
    await orchestrator.ensureStarted(server);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for tool discovery
    
    const runtime = orchestrator.getServer('test-server');
    expect(runtime?.tools.length).toBeGreaterThan(0);
  });

  it('should execute tool on real MCP server', async () => {
    const server = {
      serverId: 'test-server',
      command: 'python',
      args: ['-m', 'mcp_server'],
      enabled: true,
      start_on_boot: false,
    };
    
    await orchestrator.ensureStarted(server);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const runtime = orchestrator.getServer('test-server');
    const tool = runtime?.tools[0];
    if (tool) {
      const result = await orchestrator.callTool('test-server', tool.name, {});
      expect(result).toBeDefined();
    }
  });
});
```

### 4.3 WebSocket Integration Tests

**websocket-connection-integration.test.ts:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketClient } from '../../src/services/websocket/WebSocketClient';
import { createServer } from 'ws';

describe('WebSocket Connection Integration', () => {
  let wsClient: WebSocketClient;
  let server: any;

  beforeAll(async () => {
    // Start real WebSocket server
    server = new WebSocketServer({ port: 8080 });
    server.on('connection', (ws) => {
      ws.on('message', (data) => {
        ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
      });
    });
  });

  afterAll(async () => {
    server.close();
  });

  it('should connect to real WebSocket server', async () => {
    wsClient = new WebSocketClient();
    await wsClient.connect('ws://localhost:8080');
    expect(wsClient.isConnected).toBe(true);
  });

  it('should send and receive messages', async () => {
    wsClient = new WebSocketClient();
    await wsClient.connect('ws://localhost:8080');
    
    const message = { type: 'test', data: 'test data' };
    await wsClient.send(message);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Verify message received
  });

  it('should handle reconnection', async () => {
    wsClient = new WebSocketClient();
    await wsClient.connect('ws://localhost:8080');
    
    // Close server
    await server.close();
    
    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Restart server
    server = new WebSocketServer({ port: 8080 });
    
    // Wait for reconnection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    expect(wsClient.isConnected).toBe(true);
  });
});
```

---

## 5. E2E Testing Strategy

### 5.1 Tauri-Playwright Setup

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
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            /* your commands */
        ]);
    
    #[cfg(feature = "e2e-testing")]
    {
        builder = builder.plugin(tauri_plugin_playwright::init());
    }
    
    builder.run(tauri::generate_context!())
        .expect("error running app");
}
```

```bash
npm install -D @srsholmes/tauri-playwright @playwright/test
npx playwright install chromium
```

**Test Fixture:**
```typescript
// tests/tauri-playwright/fixtures/tauri-fixture.ts
import { createTauriTest } from '@srsholmes/tauri-playwright';

export const { test, expect } = createTauriTest({
  devUrl: 'http://localhost:1420',
  ipcMocks: {
    // Mock Tauri commands if needed
  },
  mcpSocket: '/tmp/tauri-playwright.sock',
});
```

### 5.2 Chat E2E Tests

**full-chat-flow.spec.ts:**
```typescript
import { test, expect } from '../fixtures/tauri-fixture';

test.describe('Chat E2E Flow', () => {
  test('should complete full chat flow', async ({ tauriPage }) => {
    // Navigate to chat
    await tauriPage.getByTitle('Chat').click();
    
    // Send message
    await tauriPage.fill('[data-testid="chat-input"]', 'Hello');
    await tauriPage.click('[data-testid="send-button"]');
    
    // Wait for response
    await expect(tauriPage.locator('[data-testid="message-content"]').last()).toBeVisible({ timeout: 30000 });
    
    // Verify response
    const messages = await tauriPage.locator('[data-testid="message-content"]').all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  test('should handle streaming response', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    
    await tauriPage.fill('[data-testid="chat-input"]', 'Tell me a long story');
    await tauriPage.click('[data-testid="send-button"]');
    
    // Wait for streaming to start
    await expect(tauriPage.locator('[data-testid="streaming-indicator"]')).toBeVisible({ timeout: 5000 });
    
    // Wait for streaming to complete
    await expect(tauriPage.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({ timeout: 30000 });
    
    // Verify full response
    const response = await tauriPage.locator('[data-testid="message-content"]').last().textContent();
    expect(response?.length).toBeGreaterThan(100);
  });

  test('should handle tool execution', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    
    await tauriPage.fill('[data-testid="chat-input"]', 'What is the weather in Tokyo?');
    await tauriPage.click('[data-testid="send-button"]');
    
    // Wait for tool execution block
    await expect(tauriPage.locator('[data-testid="tool-execution-block"]')).toBeVisible({ timeout: 15000 });
    
    // Verify tool execution status
    await expect(tauriPage.locator('[data-testid="tool-status="completed"]"]')).toBeVisible({ timeout: 30000 });
  });
});
```

### 5.3 MCP E2E Tests

**mcp-inspector.spec.ts:**
```typescript
import { test, expect } from '../fixtures/tauri-fixture';

test.describe('MCP Inspector E2E', () => {
  test('should open MCP inspector', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    await tauriPage.getByTitle('TAQWIN Tools').click();
    
    await expect(tauriPage.getByRole('heading', { name: 'TAQWIN Tools' })).toBeVisible({ timeout: 30000 });
  });

  test('should display MCP servers', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    await tauriPage.getByTitle('TAQWIN Tools').click();
    
    await expect(tauriPage.locator('[data-testid="mcp-server-list"]')).toBeVisible({ timeout: 30000 });
    
    const servers = await tauriPage.locator('[data-testid="mcp-server-item"]').all();
    expect(servers.length).toBeGreaterThan(0);
  });

  test('should start MCP server', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    await tauriPage.getByTitle('TAQWIN Tools').click();
    
    // Find server and click start
    const server = tauriPage.locator('[data-testid="mcp-server-item"]').first();
    await server.click();
    
    // Click start button
    await tauriPage.getByRole('button', { name: 'Start' }).click();
    
    // Verify server is running
    await expect(server.locator('[data-testid="server-status="running"]"]')).toBeVisible({ timeout: 10000 });
  });

  test('should execute tool from MCP server', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    await tauriPage.getByTitle('TAQWIN Tools').click();
    
    // Start server if needed
    const server = tauriPage.locator('[data-testid="mcp-server-item"]').first();
    await server.click();
    
    // Click tools tab
    await tauriPage.getByRole('tab', { name: 'Tools' }).click();
    
    // Execute tool
    const tool = tauriPage.locator('[data-testid="tool-item"]').first();
    await tool.click();
    await tauriPage.getByRole('button', { name: 'Execute' }).click();
    
    // Verify tool result
    await expect(tauriPage.locator('[data-testid="tool-result"]')).toBeVisible({ timeout: 15000 });
  });
});
```

### 5.4 Performance E2E Tests

**chat-performance.spec.ts:**
```typescript
import { test, expect } from '../fixtures/tauri-fixture';

test.describe('Chat Performance', () => {
  test('should meet TTFT threshold', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    
    const startTime = Date.now();
    
    await tauriPage.fill('[data-testid="chat-input"]', 'Hello');
    await tauriPage.click('[data-testid="send-button"]');
    
    await expect(tauriPage.locator('[data-testid="message-content"]').last()).toBeVisible({ timeout: 30000 });
    
    const ttft = Date.now() - startTime;
    expect(ttft).toBeLessThan(2000); // TTFT should be < 2s
  });

  test('should meet streaming throughput threshold', async ({ tauriPage }) => {
    await tauriPage.getByTitle('Chat').click();
    
    await tauriPage.fill('[data-testid="chat-input"]', 'Tell me a long story');
    await tauriPage.click('[data-testid="send-button"]');
    
    const streamingStartTime = Date.now();
    
    await expect(tauriPage.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({ timeout: 60000 });
    
    const streamingDuration = Date.now() - streamingStartTime;
    
    // Calculate approximate tokens per second (assuming ~4 chars per token)
    const response = await tauriPage.locator('[data-testid="message-content"]').last().textContent();
    const tokens = (response?.length || 0) / 4;
    const tps = tokens / (streamingDuration / 1000);
    
    expect(tps).toBeGreaterThan(10); // Should be > 10 tokens/sec
  });
});
```

---

## 6. Performance Testing Strategy

### 6.1 Performance Baselines

**Key Metrics:**
- **TTFT (Time to First Token):** < 2s
- **Token Throughput:** > 10 tokens/sec
- **Tool Execution Time:** < 5s
- **MCP Server Start Time:** < 3s
- **WebSocket Connection Time:** < 1s
- **App Startup Time:** < 5s

### 6.2 Performance Tests

**streaming-benchmark.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import { ChatService } from '../../src/services/ChatService';

describe('Streaming Performance', () => {
  it('should meet TTFT threshold', async () => {
    const chatService = new ChatService();
    
    const startTime = Date.now();
    await chatService.sendMessage('Hello');
    
    // Wait for first token
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const ttft = Date.now() - startTime;
    expect(ttft).toBeLessThan(2000);
  });

  it('should meet token throughput threshold', async () => {
    const chatService = new ChatService();
    
    await chatService.sendMessage('Tell me a long story');
    
    const streamingStartTime = Date.now();
    
    // Wait for streaming to complete
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const streamingDuration = Date.now() - streamingStartTime;
    const state = chatService.getState();
    const response = state.messages[state.messages.length - 1].content;
    const tokens = response.length / 4; // Approximate
    const tps = tokens / (streamingDuration / 1000);
    
    expect(tps).toBeGreaterThan(10);
  });
});
```

### 6.3 Performance Regression Detection

**Setup:**
```typescript
// tests/performance/baseline.json
{
  "ttft": 1500,
  "tokenThroughput": 15,
  "toolExecutionTime": 3000,
  "mcpServerStartTime": 2000
}
```

**Test:**
```typescript
import { describe, it, expect } from 'vitest';
import baseline from './baseline.json';

describe('Performance Regression', () => {
  it('should not regress TTFT', async () => {
    const chatService = new ChatService();
    
    const startTime = Date.now();
    await chatService.sendMessage('Hello');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const ttft = Date.now() - startTime;
    expect(ttft).toBeLessThan(baseline.ttft * 1.2); // Allow 20% variance
  });

  it('should not regress token throughput', async () => {
    const chatService = new ChatService();
    
    await chatService.sendMessage('Tell me a long story');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const state = chatService.getState();
    const response = state.messages[state.messages.length - 1].content;
    const tps = (response.length / 4) / 30;
    
    expect(tps).toBeGreaterThan(baseline.tokenThroughput * 0.8); // Allow 20% variance
  });
});
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Configuration

**.github/workflows/test.yml:**
```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      knez-backend:
        image: knez-backend:latest
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          KNEZ_BACKEND_URL: http://localhost:8000

  e2e-tests-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

  e2e-tests-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install Linux dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

  e2e-tests-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
```

### 7.2 Test Reporting

**Coverage Reporting:**
- Use codecov for coverage reports
- Set minimum coverage threshold (80%)
- Block PR if coverage drops

**Test Results:**
- Upload test results as artifacts
- Generate HTML test reports
- Send notifications on test failures

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Install and configure tauri-plugin-playwright
- [ ] Set up Playwright configuration (browser + tauri modes)
- [ ] Create test fixtures for E2E tests
- [ ] Migrate existing E2E tests to tauri-plugin-playwright
- [ ] Set up GitHub Actions for unit tests

### Phase 2: Integration Testing (Week 3-4)
- [ ] Add WebSocket integration tests
- [ ] Add SSE integration tests
- [ ] Add chat integration tests with real backend
- [ ] Add MCP lifecycle integration tests
- [ ] Add memory integration tests

### Phase 3: E2E Testing (Week 5-6)
- [ ] Add chat E2E flows
- [ ] Add MCP E2E flows
- [ ] Add agent E2E flows
- [ ] Add smoke tests
- [ ] Add error recovery E2E tests

### Phase 4: Advanced Testing (Week 7-8)
- [ ] Add performance regression tests
- [ ] Add visual regression tests
- [ ] Add accessibility tests
- [ ] Add Rust command unit tests
- [ ] Add database migration tests

### Phase 5: CI/CD Integration (Week 9-10)
- [ ] Set up GitHub Actions for all platforms
- [ ] Configure test reporting and coverage
- [ ] Set up automated test runs on PR
- [ ] Set up performance monitoring
- [ ] Document test maintenance procedures

---

## 9. Best Practices

### 9.1 Test Writing

**DO:**
- Write tests that are independent and isolated
- Use descriptive test names
- Test behavior, not implementation
- Use helpers and fixtures for common setup
- Keep tests fast and focused
- Test error scenarios

**DON'T:**
- Test implementation details
- Write flaky tests with timing dependencies
- Over-mock external dependencies
- Duplicate test code
- Write tests that are too broad

### 9.2 Test Maintenance

**Regular Maintenance:**
- Review and update tests when code changes
- Remove obsolete tests
- Refactor duplicate test code
- Update test documentation
- Monitor test execution time

**Test Documentation:**
- Document test purpose
- Document test setup requirements
- Document known issues
- Document test limitations
- Document test dependencies

### 9.3 Test Execution

**Local Development:**
- Run unit tests before committing
- Run integration tests for complex changes
- Run E2E tests for critical changes
- Use watch mode for rapid iteration

**CI/CD:**
- Run all tests on PR
- Block merge if tests fail
- Run tests on all platforms
- Monitor test flakiness
- Investigate and fix flaky tests

---

## 10. Conclusion

This testing strategy provides a comprehensive approach to guarantee working and truth in real runtime for knez-control-app. By following this strategy, the development team can ensure:

- **Reliability:** Comprehensive test coverage catches bugs early
- **Performance:** Performance regression detection prevents degradation
- **Cross-Platform:** Tests run on Windows, Linux, macOS
- **Real Runtime:** Integration and E2E tests use real dependencies
- **Maintainability:** Well-organized tests are easy to maintain

**Expected Impact:**
- Reduced bug rate
- Faster bug detection
- Improved cross-platform reliability
- Better performance monitoring
- More confident releases

---

**END OF TESTING STRATEGY**
