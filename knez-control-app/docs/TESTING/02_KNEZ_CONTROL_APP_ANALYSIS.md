# knez-control-app Architecture Analysis

**Generated:** 2026-04-30  
**Purpose:** Deep analysis of knez-control-app structure, features, and integration patterns  
**Target:** Comprehensive testing strategy development

---

## Executive Summary

knez-control-app is a sophisticated Tauri v2 desktop application with React + TypeScript frontend, integrating with KNEZ backend via HTTP/WebSocket/SSE, featuring MCP (Model Context Protocol) integration, agent intelligence, and real-time streaming capabilities.

**Key Characteristics:**
- **Frontend:** React 19 + TypeScript + TailwindCSS
- **Backend:** Tauri v2 (Rust) + KNEZ (FastAPI Python)
- **Database:** IndexedDB (via Dexie) + SQLite (potential via Tauri SQL plugin)
- **Real-time:** WebSocket + Server-Sent Events (SSE)
- **MCP Integration:** Full MCP client with server orchestration
- **Agent Intelligence:** Tool execution, confidence scoring, dependency graph
- **Testing:** Vitest (unit) + Playwright (E2E) + Integration tests

---

## 1. Application Architecture

### 1.1 Technology Stack

**Frontend:**
```json
{
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "typescript": "~5.8.3",
  "vite": "^7.0.4",
  "tailwindcss": "^4.1.18",
  "lucide-react": "^0.563.0",
  "dexie": "^4.3.0"
}
```

**Tauri:**
```json
{
  "@tauri-apps/api": "^2.10.0",
  "@tauri-apps/plugin-fs": "^2.4.5",
  "@tauri-apps/plugin-opener": "^2",
  "@tauri-apps/plugin-shell": "^2.3.5",
  "@tauri-apps/cli": "^2"
}
```

**Testing:**
```json
{
  "vitest": "^4.0.18",
  "@playwright/test": "^1.58.1",
  "@testing-library/react": "^16.3.2",
  "@testing-library/jest-dom": "^6.9.1",
  "jsdom": "^28.0.0",
  "puppeteer-core": "^24.1.0"
}
```

### 1.2 Directory Structure

```
knez-control-app/
├── src/
│   ├── features/           # Feature modules (UI components)
│   │   ├── chat/          # Chat interface, messages, debug panel
│   │   ├── mcp/           # MCP inspector, tools visualization
│   │   ├── agent/         # Agent orchestration UI
│   │   ├── infrastructure/ # Infrastructure visualizer
│   │   ├── system/        # System orchestrator
│   │   └── settings/      # Settings management
│   ├── services/           # Business logic layer
│   │   ├── ChatService.ts # Core chat orchestration (3573 lines)
│   │   ├── chat/          # Chat core components
│   │   │   ├── core/      # PhaseManager, MessageStore, StreamController
│   │   │   ├── tools/     # ToolExecutionBridge, ToolExecutionService
│   │   │   └── config/    # ChatConfig
│   │   ├── mcp/           # MCP orchestration
│   │   │   ├── ToolExecutionService.ts
│   │   │   ├── ToolExposureService.ts
│   │   │   ├── ToolResultValidator.ts
│   │   │   └── ToolConfidenceScorer.ts
│   │   ├── websocket/     # WebSocket client
│   │   │   ├── WebSocketClient.ts
│   │   │   ├── MessageQueue.ts
│   │   │   ├── HealthMonitor.ts
│   │   │   └── BackpressureHandler.ts
│   │   ├── knez/          # KNEZ backend client
│   │   ├── memory/        # Memory services
│   │   ├── agent/         # Agent services
│   │   └── persistence/   # Persistence layer
│   ├── mcp/               # MCP client layer
│   │   ├── McpOrchestrator.ts
│   │   ├── client/        # MCP client implementations
│   │   ├── inspector/     # MCP inspector UI
│   │   └── config/        # MCP configuration
│   ├── domain/            # Domain models and contracts
│   │   ├── DataContracts.ts
│   │   ├── Errors.ts
│   │   └── WebSocketProtocol.ts
│   └── contexts/          # React contexts
├── tests/
│   ├── unit/              # Vitest unit tests (38 tests)
│   │   ├── chat/          # Chat service tests
│   │   ├── mcp/           # MCP orchestration tests
│   │   ├── agent-intelligence/  # Agent service tests
│   │   └── ui/            # Component tests
│   ├── integration/       # Integration tests (3 tests)
│   │   ├── diagnostic/    # Diagnostic integration
│   │   └── taqwinMcpRuntime.test.ts
│   ├── tauri-playwright/ # E2E tests (13 tests)
│   │   ├── smoke.spec.ts
│   │   ├── mcp-inspector.spec.ts
│   │   ├── streaming-correctness.spec.ts
│   │   └── agent-e2e.spec.ts
│   └── setup.ts           # Global test setup
└── src-tauri/             # Rust backend (not analyzed in detail)
```

---

## 2. Core Features

### 2.1 Chat System

**Purpose:** AI chat interface with streaming responses, tool execution, and memory integration

**Key Components:**
- `ChatService.ts` (3573 lines) - Central orchestration
- `PhaseManager` - FSM for chat phases (IDLE, THINKING, STREAMING, FINALIZING)
- `MessageStore` - Message CRUD operations
- `StreamController` - Stream ownership validation
- `RequestController` - Request lock management
- `ResponseAssembler` - Block-based message assembly
- `ExecutionCoordinator` - Tool execution coordination
- `WebSocketClient` - Real-time streaming

**Chat Flow:**
```
User Input → ChatService.sendMessage() 
  → RequestController.acquireLock()
  → PhaseManager.setPhase(THINKING)
  → KNEZ backend HTTP request
  → WebSocket/SSE streaming response
  → PhaseManager.setPhase(STREAMING)
  → StreamController.validateStream()
  → Tool execution (if needed)
  → PhaseManager.setPhase(FINALIZING)
  → ResponseAssembler.assemble()
  → PhaseManager.setPhase(IDLE)
  → RequestController.releaseLock()
```

**Data Flow:**
```
ChatMessage (legacy) → AssistantMessage (block-based)
  → MessageStore.persist()
  → IndexedDB (via Dexie)
  → UI update via notify()
```

**Testing Requirements:**
- Unit: Phase transitions, stream validation, message assembly
- Integration: WebSocket/SSE streaming, tool execution
- E2E: Full chat flow with real backend

### 2.2 MCP Integration

**Purpose:** Model Context Protocol client for tool execution and AI agent capabilities

**Key Components:**
- `McpOrchestrator.ts` (350 lines) - MCP server lifecycle management
- `McpInspectorService` - MCP inspector UI
- `ToolExecutionService` - Tool execution logic
- `ToolExposureService` - Tool visibility management
- `ToolResultValidator` - Tool result validation
- `ToolConfidenceScorer` - Tool confidence scoring
- `ToolDependencyGraph` - Tool dependency analysis
- `ToolResultCache` - Tool result caching

**MCP Flow:**
```
MCP Server Start → McpOrchestrator.ensureStarted()
  → Rust event bridge → MCP server process (stdio/http)
  → Tool discovery → tools list
  → Tool execution → ToolExecutionService.execute()
  → Result validation → ToolResultValidator.validate()
  → Confidence scoring → ToolConfidenceScorer.score()
  → Result caching → ToolResultCache.cache()
```

**MCP Server Types:**
- **stdio:** Standard input/output JSON-RPC
- **http:** HTTP-based JSON-RPC
- **framing:** content-length, line, or HTTP

**Testing Requirements:**
- Unit: Server lifecycle, tool discovery, validation logic
- Integration: Real MCP server execution, tool execution
- E2E: MCP inspector UI, tool execution in chat

### 2.3 Agent Intelligence

**Purpose:** AI agent orchestration with tool execution, confidence scoring, and failure classification

**Key Components:**
- `AgentOrchestrator` - Agent lifecycle management
- `AgentLoopService` - Agent execution loop
- `FailureClassifier` - Failure pattern classification
- `ToolConfidenceScorer` - Tool confidence scoring
- `StreamingChannelIsolator` - Stream isolation
- `SmartPaginationController` - Pagination control
- `SessionIsolationHardener` - Session isolation
- `LatencyOptimizer` - Latency optimization
- `FailurePatternLearner` - Failure pattern learning
- `ExecutionGraphTracker` - Execution graph tracking
- `ContextCompressionEngine` - Context compression

**Agent Flow:**
```
Agent Start → AgentOrchestrator.start()
  → AgentLoopService.run()
  → Tool selection → ToolConfidenceScorer.score()
  → Tool execution → ToolExecutionService.execute()
  → Result validation → ToolResultValidator.validate()
  → Failure classification → FailureClassifier.classify()
  → Pattern learning → FailurePatternLearner.learn()
  → Context compression → ContextCompressionEngine.compress()
```

**Testing Requirements:**
- Unit: Confidence scoring, failure classification, pattern learning
- Integration: Agent loop with real tools, context compression
- E2E: Agent execution in chat with real backend

### 2.4 Real-Time Communication

**Purpose:** Real-time streaming and WebSocket communication

**Key Components:**
- `WebSocketClient` - WebSocket connection management
- `MessageQueue` - Message queue with backpressure
- `HealthMonitor` - Connection health monitoring
- `BackpressureHandler` - Backpressure handling
- `ConnectionManager` - Dual-channel (SSE + WebSocket) management
- `RealtimeEventHandler` - Real-time event handling
- `RealtimeToolExecutor` - Real-time tool execution

**WebSocket Flow:**
```
WebSocket Connect → WebSocketClient.connect()
  → HealthMonitor.start()
  → MessageQueue.start()
  → BackpressureHandler.start()
  → Message receive → MessageQueue.enqueue()
  → Backpressure check → BackpressureHandler.check()
  → Message dispatch → handlers.get(event).emit()
  → Health check → HealthMonitor.check()
  → Reconnection → WebSocketClient.reconnect()
```

**SSE Flow:**
```
SSE Connect → fetch('/api/stream')
  → Response stream → ReadableStream
  → Chunk parsing → parseSSEChunk()
  → Event emission → emit SSE event
  → Stream end → close connection
```

**Testing Requirements:**
- Unit: Message queue, backpressure, health monitoring
- Integration: WebSocket connection, SSE streaming
- E2E: Real-time chat with streaming

### 2.5 Memory System

**Purpose:** Memory storage, retrieval, and injection

**Key Components:**
- `MemoryEventSourcingService` - Event-sourced memory
- `MemoryVectorSearchService` - Vector-based search
- `MemoryLoaderService` - Memory file loading
- `MemoryInjectionService` - Memory injection
- `PersistenceService` - Persistence layer
- `SessionDatabase` - Session storage (IndexedDB via Dexie)

**Memory Flow:**
```
Memory Load → MemoryLoaderService.load()
  → Memory file parsing → parseMemoryFile()
  → Memory injection → MemoryInjectionService.inject()
  → Event sourcing → MemoryEventSourcingService.append()
  → Vector search → MemoryVectorSearchService.search()
  → Persistence → PersistenceService.persist()
```

**Database:**
- **IndexedDB:** Session storage, message persistence
- **SQLite (potential):** Rust backend data storage

**Testing Requirements:**
- Unit: Memory parsing, vector search, event sourcing
- Integration: Memory file loading, IndexedDB operations
- E2E: Memory injection in chat

---

## 3. Integration Patterns

### 3.1 Backend Integration

**KNEZ Backend Integration:**
- **HTTP API:** REST endpoints for chat, sessions, events
- **WebSocket:** Real-time streaming and events
- **SSE:** Server-Sent Events for streaming responses
- **Health Check:** Backend health monitoring

**HTTP Client:**
- `KnezClient` - HTTP client for KNEZ backend
- Connection pooling and retry logic
- Error handling and fallback

**WebSocket Client:**
- `WebSocketClient` - WebSocket connection management
- Reconnection logic with exponential backoff
- Message queue with backpressure
- Health monitoring

**Testing Requirements:**
- Unit: HTTP client retry logic, WebSocket reconnection
- Integration: Real backend HTTP/WebSocket/SSE
- E2E: Full chat flow with real backend

### 3.2 Tauri Integration

**Tauri Plugins Used:**
- `@tauri-apps/plugin-fs` - File system access
- `@tauri-apps/plugin-opener` - URL opening
- `@tauri-apps/plugin-shell` - Shell commands

**Tauri IPC Commands:**
- File operations (read, write, delete)
- Shell command execution
- URL opening
- System information

**Testing Requirements:**
- Unit: IPC command mocking with mockIPC()
- Integration: Real Tauri IPC commands
- E2E: File operations in Tauri app

### 3.3 MCP Integration

**MCP Client Architecture:**
- `McpOrchestrator` - Server lifecycle management
- `McpInspectorService` - Inspector UI
- MCP client implementations (stdio, http)
- Tool execution and validation

**MCP Server Configuration:**
- Server ID and authority
- Allowed/blocked tools
- Start-on-boot configuration
- Crash recovery

**Testing Requirements:**
- Unit: Server lifecycle, tool discovery, validation
- Integration: Real MCP server execution
- E2E: MCP inspector UI, tool execution

---

## 4. Data Flow Patterns

### 4.1 Chat Data Flow

```
User Input
  → ChatService.sendMessage()
  → PhaseManager.setPhase(THINKING)
  → KnezClient.sendMessage()
  → HTTP POST /api/chat
  → WebSocket/SSE streaming
  → PhaseManager.setPhase(STREAMING)
  → StreamController.validateStream()
  → MessageStore.appendMessage()
  → IndexedDB persist
  → UI update via notify()
  → PhaseManager.setPhase(FINALIZING)
  → ResponseAssembler.assemble()
  → PhaseManager.setPhase(IDLE)
```

### 4.2 MCP Data Flow

```
Tool Request
  → McpOrchestrator.getServer(serverId)
  → ToolExecutionService.execute()
  → MCP client call_tool()
  → Tool execution in MCP server
  → Result return
  → ToolResultValidator.validate()
  → ToolConfidenceScorer.score()
  → ToolResultCache.cache()
  → Result return to chat
```

### 4.3 WebSocket Data Flow

```
WebSocket Connect
  → WebSocketClient.connect(url)
  → HealthMonitor.start()
  → MessageQueue.start()
  → BackpressureHandler.start()
  → Message receive
  → MessageQueue.enqueue(message)
  → BackpressureHandler.check()
  → Handler dispatch
  → HealthMonitor.check()
  → Reconnection (if needed)
```

---

## 5. State Management

### 5.1 Chat State

**ChatService State:**
```typescript
interface ChatState {
  messages: ChatMessage[];
  assistantMessages: AssistantMessage[];
  currentStreamId: string | null;
  activeTools: { search: boolean };
  searchProvider: "off" | "taqwin" | "proxy";
  pendingToolApproval: { id: string; toolName: string; args: Record<string, any> } | null;
  responseStart?: number;
  responseEnd?: number;
  sequenceCounter: number;
}
```

**Phase State (PhaseManager):**
```typescript
type ChatPhase = "IDLE" | "THINKING" | "STREAMING" | "FINALIZING" | "ERROR";
```

### 5.2 MCP State

**McpOrchestrator State:**
```typescript
interface ServerRuntime {
  serverId: string;
  authority: McpAuthority;
  enabled: boolean;
  start_on_boot: boolean;
  allowed_tools: string[];
  blocked_tools: string[];
  type: "stdio" | "http";
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  tools: McpToolDefinition[];
  lastError: string | null;
}
```

### 5.3 WebSocket State

**WebSocketClient State:**
```typescript
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error"
}
```

---

## 6. Error Handling

### 6.1 Error Types

**AppError:**
```typescript
class AppError extends Error {
  code: string;
  context?: Record<string, any>;
}
```

**Error Categories:**
- Network errors (HTTP, WebSocket)
- MCP errors (server failure, tool failure)
- Chat errors (streaming, validation)
- Memory errors (persistence, injection)
- System errors (Tauri IPC, file system)

### 6.2 Error Handling Patterns

**Try-Catch Wrappers:**
- All service methods wrapped in try-catch
- Error logging with context
- User-friendly error messages
- Error recovery strategies

**Fallback Mechanisms:**
- HTTP client fallback to shell commands
- WebSocket fallback to SSE
- MCP server fallback to alternative servers
- Memory fallback to default values

**Testing Requirements:**
- Unit: Error handling logic, fallback mechanisms
- Integration: Error scenarios with real dependencies
- E2E: Error recovery in user flows

---

## 7. Performance Considerations

### 7.1 Streaming Performance

**Optimizations:**
- Stream ownership validation (StreamController)
- Request lock management (RequestController)
- Message queue with backpressure (MessageQueue)
- Health monitoring (HealthMonitor)
- Latency optimization (LatencyOptimizer)

**Metrics:**
- Time to first token (TTFT)
- Token throughput
- Stream latency
- Reconnection time

### 7.2 Memory Performance

**Optimizations:**
- Context compression (ContextCompressionEngine)
- Memory caching (ToolResultCache)
- IndexedDB indexing
- Lazy loading

**Metrics:**
- Memory usage
- Cache hit rate
- Compression ratio
- Load time

### 7.3 MCP Performance

**Optimizations:**
- Tool confidence scoring (ToolConfidenceScorer)
- Tool dependency graph (ToolDependencyGraph)
- Tool result caching (ToolResultCache)
- Concurrent tool execution

**Metrics:**
- Tool execution time
- Cache hit rate
- Confidence score distribution
- Failure rate

**Testing Requirements:**
- Unit: Optimization logic, caching strategies
- Integration: Performance with real data
- E2E: Performance in user flows

---

## 8. Security Considerations

### 8.1 IPC Security

**Validation:**
- Command validation
- Input sanitization
- Permission checks
- Rate limiting

### 8.2 MCP Security

**Validation:**
- Tool authority checks
- Input validation
- Output sanitization
- Permission management

### 8.3 Network Security

**Validation:**
- TLS/SSL for HTTPS
- WebSocket secure (wss://)
- API key management
- CORS configuration

**Testing Requirements:**
- Unit: Validation logic, sanitization
- Integration: Security with real dependencies
- E2E: Security in user flows

---

## 9. Current Test Infrastructure

### 9.1 Unit Tests (38 tests)

**Chat Tests (11 tests):**
- chatToolLoop.test.ts
- chatPersistence.test.ts
- health.test.ts
- extractionGovernance.test.ts
- knezClientShellFallback.test.ts
- memoryDriftGuard.test.ts
- stdioHeuristics.test.ts
- strictJsonFallbackValidation.test.ts
- toolExposureService.test.ts
- toolExecutionService.test.ts
- taqwinActivationToolResolution.test.ts

**MCP Tests (10 tests):**
- mcpAuthority.test.ts
- mcpBootAutoStart.test.ts
- mcpCrashAuthority.test.ts
- mcpHttpClient.test.ts
- mcpHostConfig.test.ts
- mcpImportConfig.test.ts
- mcpOrchestrator.test.ts
- mcpStdioClientParsing.test.ts
- mcpTimeoutClassification.test.ts
- mcpValidationMatrix.test.ts

**Agent Intelligence Tests (11 tests):**
- ContextCompressionEngine.test.ts
- DeterminismTestSuite.test.ts
- DOMAwarenessInjector.test.ts
- EventBasedUIProtocol.test.ts
- ExecutionGraphTracker.test.ts
- FailurePatternLearner.test.ts
- LatencyOptimizer.test.ts
- SessionIsolationHardener.test.ts
- SessionIsolationHardener.test.ts
- SmartPaginationController.test.ts
- StreamingChannelIsolator.test.ts
- ToolConfidenceScorer.test.ts

**UI Tests (4 tests):**
- (Component tests)

**Service Tests (2 tests):**
- KnezClient.test.ts
- memory-injection.test.ts

### 9.2 Integration Tests (3 tests)

**Diagnostic Tests (2 tests):**
- nodeDiagnostic.test.ts
- layerDiagnostic.test.ts

**MCP Runtime Test (1 test):**
- taqwinMcpRuntime.test.ts

### 9.3 E2E Tests (13 tests)

**Tauri-Playwright Tests:**
- smoke.spec.ts
- mcp-inspector.spec.ts
- mcp-inspection-comprehensive.spec.ts
- mcp-github.spec.ts
- mcp-fixes.spec.ts
- taqwin-mcp.spec.ts
- streaming-correctness.spec.ts
- local-model-reply.spec.ts
- chat-mcp-isolation.spec.ts
- button-click-verification.spec.ts
- agent-e2e.spec.ts
- (2 more tests)

### 9.4 Test Setup

**Global Setup (tests/setup.ts):**
- IndexedDB mock (in-memory Map)
- localStorage mock
- sessionStorage mock
- WebCrypto mock

**Test Configuration:**
- Vitest for unit tests
- Playwright for E2E tests
- jsdom for DOM mocking
- Custom Puppeteer setup (not tauri-plugin-playwright)

---

## 10. Testing Gaps and Recommendations

### 10.1 Critical Gaps

**1. WebSocket/SSE Integration Tests**
- **Gap:** No integration tests for WebSocket connection lifecycle
- **Impact:** Real-time features not validated in integration
- **Recommendation:** Add WebSocket connection, reconnection, message flow tests

**2. Rust Command Unit Tests**
- **Gap:** No unit tests for Tauri Rust commands
- **Impact:** Backend logic not tested in isolation
- **Recommendation:** Add Rust command unit tests using tauri::test

**3. Database Migration Tests**
- **Gap:** No tests for IndexedDB schema migrations
- **Impact:** Schema changes not validated
- **Recommendation:** Add migration tests with rollback verification

**4. Performance Regression Tests**
- **Gap:** No performance baseline or regression detection
- **Impact:** Performance degradation not detected
- **Recommendation:** Add performance tests with baseline metrics

**5. Visual Regression Tests**
- **Gap:** No visual regression testing
- **Impact:** UI changes not validated
- **Recommendation:** Add visual regression tests with Playwright

### 10.2 Medium Priority Gaps

**6. MCP Lifecycle Tests**
- **Gap:** Limited MCP server lifecycle testing
- **Impact:** MCP reliability not fully validated
- **Recommendation:** Add comprehensive MCP lifecycle tests

**7. Agent Loop Integration Tests**
- **Gap:** Agent loop not tested in integration
- **Impact:** Agent reliability not validated
- **Recommendation:** Add agent loop integration tests

**8. Memory Integration Tests**
- **Gap:** Memory system not tested in integration
- **Impact:** Memory reliability not validated
- **Recommendation:** Add memory integration tests

**9. Error Scenario Tests**
- **Gap:** Limited error scenario testing
- **Impact:** Error handling not fully validated
- **Recommendation:** Add comprehensive error scenario tests

**10. Accessibility Tests**
- **Gap:** No accessibility testing
- **Impact:** Accessibility not validated
- **Recommendation:** Add accessibility tests with axe-core

### 10.3 Low Priority Gaps

**11. Security Tests**
- **Gap:** No security testing
- **Impact:** Security not validated
- **Recommendation:** Add security tests (IPC validation, input sanitization)

**12. Load Tests**
- **Gap:** No load testing
- **Impact:** System not validated under load
- **Recommendation:** Add load tests with k6 or similar

---

## 11. Recommended Testing Strategy

### 11.1 Testing Pyramid

```
                    E2E Tests (10%)
                   /              \
                  /                \
                 /                  \
        Integration Tests (20%)     \
               /                      \
              /                        \
     Unit Tests (70%)                  \
    /                                    \
   /                                      \
  /________________________________________\
```

**Target Coverage:**
- Unit Tests: 70% of test suite (fast, isolated)
- Integration Tests: 20% of test suite (real dependencies)
- E2E Tests: 10% of test suite (critical user flows)

### 11.2 Test Organization

```
tests/
├── unit/                    # Vitest tests with mocks
│   ├── chat/               # ChatService, PhaseManager, MessageStore
│   ├── mcp/                # McpOrchestrator, ToolExecutionService
│   ├── agent-intelligence/ # Agent services
│   ├── websocket/          # WebSocketClient, MessageQueue
│   ├── memory/             # Memory services
│   └── ui/                 # Component tests
├── integration/            # Real dependencies
│   ├── chat/               # Chat integration with real backend
│   ├── mcp/                # MCP integration with real servers
│   ├── websocket/          # WebSocket integration with real server
│   ├── memory/             # Memory integration with real files
│   └── backend/            # Backend integration with KNEZ
├── tauri-playwright/       # E2E tests (tauri-plugin-playwright)
│   ├── smoke/              # Smoke tests
│   ├── chat/               # Chat E2E flows
│   ├── mcp/                # MCP E2E flows
│   ├── agent/              # Agent E2E flows
│   └── performance/        # Performance regression tests
├── visual/                 # Visual regression tests
│   ├── chat/               # Chat visual tests
│   ├── mcp/                # MCP visual tests
│   └── agent/              # Agent visual tests
├── accessibility/          # Accessibility tests
│   ├── chat/               # Chat accessibility
│   ├── mcp/                # MCP accessibility
│   └── agent/              # Agent accessibility
└── setup.ts                # Global test setup
```

### 11.3 Testing Tools

**Unit Testing:**
- Vitest (already used)
- mockIPC() for Tauri IPC mocking
- jsdom for DOM mocking
- IndexedDB mock (already implemented)

**Integration Testing:**
- Vitest with real dependencies
- Real WebSocket server (ws)
- Real HTTP server (or KNEZ backend)
- Real MCP servers

**E2E Testing:**
- tauri-plugin-playwright (recommended migration)
- Playwright for browser mode
- Real Tauri app for tauri mode

**Visual Testing:**
- Playwright screenshot comparison
- Percy or similar for visual regression

**Accessibility Testing:**
- axe-core with Playwright
- @axe-core/playwright

**Performance Testing:**
- Playwright performance metrics
- Lighthouse CI
- Custom performance benchmarks

---

## 12. Implementation Priorities

### Phase 1: Foundation (Week 1-2)
- [ ] Migrate to tauri-plugin-playwright
- [ ] Set up Playwright configuration (browser + tauri modes)
- [ ] Add WebSocket integration tests
- [ ] Add SSE integration tests

### Phase 2: Critical Integration (Week 3-4)
- [ ] Add MCP lifecycle integration tests
- [ ] Add chat integration tests with real backend
- [ ] Add memory integration tests
- [ ] Add error scenario tests

### Phase 3: Advanced Testing (Week 5-6)
- [ ] Add Rust command unit tests
- [ ] Add database migration tests
- [ ] Add performance regression tests
- [ ] Add visual regression tests

### Phase 4: CI/CD and Maintenance (Week 7-8)
- [ ] Set up GitHub Actions for all platforms
- [ ] Configure test reporting and coverage
- [ ] Set up automated test runs on PR
- [ ] Document test maintenance procedures

---

## 13. Conclusion

knez-control-app is a sophisticated application with complex integration patterns. The current test infrastructure is good but has gaps in integration testing, particularly for WebSocket/SSE, MCP lifecycle, and performance validation.

**Key Recommendations:**
1. Migrate to tauri-plugin-playwright for better cross-platform support
2. Add comprehensive integration tests for real-time features
3. Add performance regression tests to detect degradation
4. Add visual regression tests for UI consistency
5. Improve test coverage for error scenarios and edge cases

**Expected Impact:**
- Improved reliability through comprehensive testing
- Faster bug detection with regression tests
- Better cross-platform support with tauri-plugin-playwright
- Improved performance through performance monitoring
- Better UX consistency through visual regression testing

---

**END OF ANALYSIS**
