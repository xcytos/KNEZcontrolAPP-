# KNEZ Control App - Current State Analysis

**Generated:** April 22, 2026  
**Version:** 0.1.0  
**Analysis Scope:** knez-control-app directory only

---

## Executive Summary

The KNEZ Control App is a Tauri-based desktop application that provides a comprehensive interface for interacting with the KNEZ AI backend. It serves as an AI Operating System with execution visibility, featuring chat capabilities, MCP (Model Context Protocol) integration, memory management, governance controls, and system orchestration.

---

## Technology Stack

### Frontend
- **Framework:** React 19.1.0
- **Language:** TypeScript 5.8.3
- **Build Tool:** Vite 7.0.4
- **Styling:** Tailwind CSS 4.1.18
- **Icons:** Lucide React 0.563.0
- **Database:** Dexie 4.3.0 (IndexedDB wrapper)

### Desktop Framework
- **Tauri:** 2.10.0
- **Tauri Plugins:**
  - `@tauri-apps/plugin-fs` (2.4.5) - File system access
  - `@tauri-apps/plugin-opener` (2) - URL opening
  - `@tauri-apps/plugin-shell` (2.3.5) - Shell command execution
  - `tauri-plugin-single-instance` (2.3.7) - Single instance enforcement

### Backend Integration
- **KNEZ Backend:** Python-based (via HTTP)
- **Default Endpoint:** `http://127.0.0.1:8000`
- **Model:** qwen2.5:7b-instruct-q4_K_M (via Ollama)
- **Ollama:** Local inference server on port 11434

### Development Tools
- **Testing:** Vitest 4.0.18, Playwright 1.58.1
- **Babel:** 7.25.0
- **PostCSS:** 8.5.6

---

## Architecture Overview

### Directory Structure

```
knez-control-app/
├── src/                          # Frontend source code
│   ├── components/               # UI components
│   │   ├── layout/              # Layout components (MainLayout, Sidebar)
│   │   └── ui/                  # Reusable UI components
│   ├── config/                  # Configuration files
│   ├── contexts/                # React contexts (StatusProvider, ThemeProvider)
│   ├── domain/                  # Data contracts and types
│   ├── features/                # Feature modules
│   │   ├── agent/               # Agent-related features
│   │   ├── chat/                # Chat interface
│   │   ├── cognitive/           # Cognitive state visualization
│   │   ├── drift/               # Drift analysis
│   │   ├── events/              # Event handling
│   │   ├── governance/          # Governance controls
│   │   ├── infrastructure/      # Infrastructure panel
│   │   ├── logs/                # Log viewer
│   │   ├── mcp/                 # MCP integration
│   │   ├── memory/              # Memory management
│   │   ├── mistakes/            # Mistake ledger
│   │   ├── perception/          # Perception features
│   │   ├── reflection/          # Reflection tools
│   │   ├── replay/              # Session replay
│   │   ├── settings/            # Settings modal
│   │   ├── skills/              # Skills view
│   │   ├── system/              # System orchestration
│   │   └── timeline/            # Session timeline
│   ├── hooks/                   # Custom React hooks
│   ├── mcp/                     # MCP client implementation
│   │   ├── client/             # MCP client
│   │   ├── config/             # MCP configuration
│   │   ├── inspector/          # MCP inspector
│   │   ├── registry/           # MCP registry
│   │   └── supervisor/         # MCP supervision
│   ├── services/                # Business logic services
│   │   ├── agent/              # Agent services
│   │   ├── analytics/          # Analytics
│   │   ├── chat/               # Chat services
│   │   ├── connection/         # Connection management
│   │   ├── execution/          # Execution services
│   │   ├── governance/         # Governance services
│   │   ├── infrastructure/     # Infrastructure services
│   │   ├── knez/               # KNEZ client
│   │   ├── mcp/                # MCP services
│   │   ├── memory/             # Memory services
│   │   ├── session/            # Session management
│   │   └── utils/              # Utility services
│   ├── utils/                   # Utility functions
│   ├── App.tsx                  # Main application component
│   └── main.tsx                 # Application entry point
├── src-tauri/                   # Tauri (Rust) backend
│   ├── src/
│   │   ├── lib.rs              # Tauri commands and setup
│   │   ├── main.rs             # Entry point
│   │   └── mcp_host.rs         # MCP stdio host implementation
│   ├── capabilities/           # Tauri capabilities
│   └── Cargo.toml              # Rust dependencies
├── public/                      # Static assets
├── docs/                        # Documentation
├── scripts/                     # Build/deployment scripts
└── tests/                       # Test files
```

---

## Core Components

### 1. Application Entry Point

**File:** `src/main.tsx`

**Initialization Sequence:**
1. Imports observer utility for telemetry
2. Initializes Rust event bridge for MCP
3. Initializes governance service
4. Renders App component with ErrorBoundary

**Key Notes:**
- MemoryLoaderService is disabled (browser compatibility issue with Node.js fs)
- Governance service initialized on startup

### 2. Main Application Component

**File:** `src/App.tsx`

**Responsibilities:**
- View routing (chat, agent, memory, timeline, reflection, governance, infrastructure, mcp, logs, replay, updates, extraction, diagnostics, skills)
- Session management via SessionController
- Connection status monitoring via StatusProvider
- System orchestration (auto-launch KNEZ backend)
- MCP boot initialization
- Static memory loading
- Command palette (Ctrl/Cmd + K)
- Settings modal management
- TAQWIN activation support

**State Management:**
- Active view
- Command palette open/close
- Presence state (SILENT, OBSERVING, REFLECTING, RESPONDING)
- Settings modal open/close
- Session ID
- Read-only mode (based on connection status)
- Chat sending status
- Tab errors tracking

**Auto-Launch Logic:**
- Checks if endpoint is local (localhost:8000 or 127.0.0.1:8000)
- Checks if running in Tauri runtime
- Checks if keep-alive is enabled
- Attempts auto-launch with max 3 attempts
- Skips if system is already starting or running

### 3. KNEZ Client Service

**File:** `src/services/knez/KnezClient.ts`

**Responsibilities:**
- HTTP client for KNEZ backend communication
- Connection profile management (localStorage)
- Session management (create, validate, ensure)
- Health checks with retry logic
- MCP registry fetching
- Event emission
- Memory operations
- Cognitive state fetching
- Governance snapshot fetching
- Session operations (fork, resume)
- Perception and knowledge operations

**Connection Profile:**
- Default: `http://127.0.0.1:8000`
- Stored in localStorage under `knez_connection_profile`
- Supports trust verification with fingerprint pinning
- Endpoint normalization (localhost → 127.0.0.1 in Tauri)

**Health Check:**
- Default timeout: 15 seconds
- Fallback to shell curl in Tauri if fetch fails
- Exponential backoff retry with jitter
- Throttled logging (every 3 minutes)

**Session Management:**
- Session ID stored in localStorage under `knez_session_id`
- Auto-creates session on launch if not exists
- Validates session via events endpoint
- Emits bootstrap event on session creation

### 4. Chat Service

**File:** `src/services/ChatService.ts`

**Responsibilities:**
- Chat message lifecycle management
- Tool execution orchestration
- Streaming response handling
- Phase management (idle, sending, thinking, tool_running, streaming, finalizing, done, error)
- Message persistence
- Outgoing queue management
- Request locking (single active request per session)
- Stream ownership validation
- Assistant message block management

**Modular Chat Core:**
- MessageStore: Message CRUD operations
- RequestController: Request lifecycle management
- PhaseManager: Phase transition validation
- StreamController: Stream ownership enforcement
- ResponseAssembler: Block-based message assembly (deferred)
- ToolExecutionBridge: Tool execution abstraction

**Message Types:**
- user
- assistant
- tool_execution
- tool_result
- system

**Tool Call Status States:**
- pending
- running
- calling
- succeeded
- failed
- completed

**Phase Transitions:**
- USER_SEND → sending
- MODEL_CALL_START → thinking
- FIRST_TOKEN → streaming
- TOOL_START → tool_running
- TOOL_END → thinking
- STREAM_END → finalizing
- ERROR → error

**Queue Management:**
- Max outgoing per session: 1
- Max outgoing attempts: 3
- Max outgoing age: 5 minutes
- Flush interval: 500ms

### 5. Status Provider

**File:** `src/contexts/StatusProvider.tsx`

**Responsibilities:**
- Health check polling with adaptive intervals
- Cognitive state fetching
- Connection status derivation
- Force check capability

**Polling Strategy:**
- Healthy: 30 seconds
- Unhealthy: Exponential backoff (2.5s * 2^attempt, max 60s)
- Hidden tab penalty: +180 seconds
- Jitter: +0-500ms

**Derived States:**
- `online`: Health check succeeded
- `isConnected`: online AND health.status === "ok"
- `isDegraded`: online AND health.status !== "ok"

### 6. Session Controller

**File:** `src/services/session/SessionController.ts`

**Responsibilities:**
- Session ID management
- Session lifecycle operations
- Session operation locking
- Observer pattern for state changes

**Operations:**
- `ensureLocalSession()`: Creates local session if not exists
- `ensureOnlineSession()`: Validates/creates session with backend
- `createNewSession()`: Creates fresh session
- `useSession()`: Switches to existing session
- `resumeSession()`: Resumes from snapshot
- `forkSession()`: Creates fork from existing session

### 7. System Orchestrator

**File:** `src/features/system/useSystemOrchestrator.ts`

**Responsibilities:**
- System requirements checking (Python, Ollama, port availability)
- Ollama startup/management
- KNEZ backend startup/management
- Model warmup
- Process cleanup
- Health probe with retry logic

**Startup Sequence:**
1. System requirements check
2. Fast-path verification (check if already running)
3. Ollama startup (if not running)
   - Kill existing processes
   - Spawn ollama serve
   - Wait for API ready (20 attempts)
4. KNEZ startup (if not running)
   - Kill existing Python processes
   - Spawn uvicorn process
   - Wait for health check (30 attempts)
5. Model warmup (load model into memory)

**Configuration:**
- KNEZ Path: `C:\Users\syedm\Downloads\ASSETS\controlAPP\KNEZ`
- Model: qwen2.5:7b-instruct-q4_K_M
- Endpoint: http://127.0.0.1:8000
- Ollama Port: 11434

**Timeouts:**
- Startup timeout: 120 seconds
- Health check timeout: 2 seconds
- Model warmup timeout: 60 seconds

### 8. MCP Integration

**Frontend MCP:** `src/mcp/`
- `McpOrchestrator.ts`: MCP client orchestration
- `mcpBoot.ts`: Boot sequence initialization
- `inspector/`: MCP inspection tools
- `registry/`: MCP registry management
- `client/`: MCP client implementation

**Backend MCP (Rust):** `src-tauri/src/mcp_host.rs`
- Stdio server process management
- JSON-RPC protocol handling
- Traffic event logging
- Tool discovery
- Request/response tracking

**MCP Runtime States:**
- IDLE
- STARTING
- SPAWNING
- INITIALIZING
- INITIALIZED
- DISCOVERING
- READY
- ERROR
- STOPPING
- STOPPED

**Traffic Events:**
- Raw stdout/stderr
- Parse errors
- Requests
- Responses
- Unsolicited messages
- Process closed
- Spawn errors
- State transitions

---

## Data Contracts

### Message Types

**ChatMessage:**
```typescript
{
  id: string;
  sessionId: string;
  from: "user" | "knez" | "assistant" | "tool_execution" | "tool_result" | "system";
  text: string;
  createdAt: string;
  sequenceNumber?: number;
  deliveryStatus?: "queued" | "pending" | "delivered" | "failed";
  toolCall?: ToolCallMessage;
  metrics?: {
    timeToFirstTokenMs?: number;
    totalTokens?: number;
    finishReason?: string;
    modelId?: string;
    backendStatus?: string;
    responseTimeMs?: number;
    toolExecutionTime?: number;
    fallbackTriggered?: boolean;
  };
}
```

**ToolCallMessage:**
```typescript
{
  tool: string;
  args: any;
  status: "pending" | "running" | "calling" | "succeeded" | "failed" | "completed";
  result?: any;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  executionTimeMs?: number;
  mcpLatencyMs?: number;
  phase?: ExecutionPhase;
  pattern?: ExecutionPattern;
}
```

**AssistantMessage (Block-based):**
```typescript
{
  id: string;
  sessionId: string;
  role: "assistant";
  state: MessageState;
  blocks: Block[];
  createdAt: number;
}
```

**Block Types:**
- `text`: Plain text content
- `approval`: Tool approval request
- `mcp_call`: MCP tool execution
- `final`: Final response content

### Health Response

**KnezHealthResponse:**
```typescript
{
  status: "ok" | string;
  model: string;
  backends: HealthBackend[];
  ollama?: {
    reachable: boolean;
  };
  model_state?: {
    state: "unloaded" | "loading" | "loaded";
    last_loaded_at: number | null;
  };
}
```

### Cognitive State

**CognitiveState:**
```typescript
{
  governance?: {
    active_insights?: number;
    blocked?: number;
    monitoring?: number;
    eligible?: number;
  };
  influence?: {
    enabled?: boolean;
    eligible_contracts?: number;
  };
  stability?: {
    drift?: string;
    confidence?: string;
  };
  taqwin?: {
    sessions_observed?: number;
    proposals_observed?: number;
    rejections?: number;
  };
}
```

---

## Feature Modules

### 1. Chat Interface
- Real-time streaming responses
- Tool execution visualization
- Message history with lineage
- Debug panel with tool call history
- Execution time tracking
- MCP latency tracking

### 2. Memory Management
- Memory explorer with clustering
- Memory injection service
- Static memory loading
- Memory gap detection
- Knowledge base management

### 3. Governance
- Governance snapshot viewing
- Influence contract management
- Operator controls
- Policy enforcement
- Phase violation detection

### 4. Infrastructure
- System status monitoring
- Backend health visualization
- Ollama status tracking
- System orchestration controls
- Health probe with retry logic

### 5. MCP Integration
- MCP registry view
- MCP inspector
- Tool execution service
- MCP runtime monitoring
- Traffic event logging

### 6. Session Management
- Session timeline
- Session lineage tracking
- Fork/resume operations
- Session snapshots
- Replay functionality

### 7. Reflection & Analysis
- Reflection observations
- Mistake ledger
- Drift analysis
- Challenge system
- Cognitive state visualization

### 8. Perception
- Snapshot capture
- Active window info
- Perception data management

---

## Configuration

### Feature Flags
**File:** `src/config/features.ts`

```typescript
{
  taqwinTools: true,
  floatingConsole: true,
  mcpViews: true,
  logViews: true
}
```

### Timeout Configuration
```typescript
{
  DEFAULT_UI_TIMEOUT_MS: 5000,
  DEFAULT_UI_INTERVAL_MS: 100,
  TOOL_CACHE_DEFAULT_TTL_MS: 300000,
  TOOL_CACHE_MAX_ENTRIES: 1000,
  PROGRESSIVE_LOAD_DELAY_MS: 1000,
  CONTENT_LENGTH_THRESHOLD: 100,
  HEALTH_BACKEND_STALE_MS: 60000,
  TEST_RUNNER_TIMEOUT_MS: 8000,
  TEST_RUNNER_INTERVAL_MS: 250,
  CACHE_CLEANUP_INTERVAL_MS: 300000,
  CONTEXT_WINDOW_TOKENS: 128000
}
```

### Slice Limits
```typescript
{
  LOG_LINES: 150,
  URL_ALTERNATIVES: 4,
  MEMORY_RETRIEVAL: 2,
  HEADINGS: 6,
  LINKS: 8,
  CONSOLE_ERRORS: 5
}
```

---

## Build Configuration

### Vite Configuration
**File:** `vite.config.ts`

- Dev server port: 5173
- Strict port enforcement
- HMR enabled (WebSocket protocol)
- Proxy configuration for KNEZ backend endpoints:
  - `/taqwin` → http://127.0.0.1:8000
  - `/mcp` → http://127.0.0.1:8000
  - `/health` → http://127.0.0.1:8000
  - `/events` → http://127.0.0.1:8000
  - `/identity` → http://127.0.0.1:8000
  - `/state` → http://127.0.0.1:8000
  - `/sessions` → http://127.0.0.1:8000
  - `/governance` → http://127.0.0.1:8000
  - `/v1` → http://127.0.0.1:8000
  - `/approvals` → http://127.0.0.1:8000
  - `/audit` → http://127.0.0.1:8000
  - `/perception` → http://127.0.0.1:8000
  - `/operator` → http://127.0.0.1:8000
  - `/runbooks` → http://127.0.0.1:8000

- Aliases for Node.js modules (browser compatibility):
  - `better-sqlite3` → stub
  - `crypto` → stub

### Tauri Configuration
**File:** `src-tauri/tauri.conf.json`

- Product name: knez-control-app
- Version: 0.1.0
- Identifier: com.syedm.knez-control-app
- Dev URL: http://127.0.0.1:5173
- Frontend dist: ../dist
- Window:
  - Width: 1280
  - Height: 800
  - Min width: 1024
  - Min height: 640
  - Centered
  - Resizable
  - Background color: #242424

### TypeScript Configuration
- Target: ES2020
- Module: ESNext
- JSX: react-jsx
- Strict mode enabled
- No unused locals/parameters
- No fallthrough cases in switch

---

## Scripts

### Development
- `npm run dev` - Start Vite dev server
- `npm run dev:all` - Start all services (PowerShell script)
- `npm run tauri dev` - Start Tauri dev mode

### Build
- `npm run build` - TypeScript + Vite build
- `npm run clean` - Clean build artifacts
- `npm run clean:build` - Clean then build
- `npm run tauri build` - Build Tauri app

### Testing
- `npm test` - Run Vitest tests
- `npm run test:watch` - Watch mode Vitest
- `npm run e2e:tauri` - Run E2E tests (spawn and run)
- `npm run e2e:tauri:attach` - Attach to running instance
- `npm run e2e:tauri:puppeteer` - Puppeteer E2E tests

---

## Persistence

### LocalStorage Keys
- `knez_connection_profile` - Connection profile
- `knez_session_id` - Current session ID
- `knez_mcp_enabled` - MCP enabled flag
- `chat_search_enabled:{sessionId}` - Search enabled per session

### IndexedDB (Dexie)
- SessionDatabase:
  - Messages
  - Assistant messages
  - Outgoing queue
  - Session metadata

### File System (Tauri)
- UI preferences: `{app_data_dir}/ui_prefs.json`
- Theme settings
- Layout density settings

---

## Current Implementation Status

### Completed Features
✅ Chat interface with streaming  
✅ Tool execution with MCP  
✅ Session management (fork, resume, lineage)  
✅ Memory management  
✅ Governance controls  
✅ System orchestration (auto-launch)  
✅ MCP stdio host (Rust)  
✅ Health check polling  
✅ Debug panel with tool history  
✅ Infrastructure visualization  
✅ Cognitive state monitoring  
✅ Command palette  
✅ Settings modal  
✅ Theme provider  

### Partially Implemented
⚠️ Live status transitions (pending → running → completed) - UI ready, backend integration pending  
⚠️ Tool execution time propagation - Tracked in events, not yet in toolCall object  
⚠️ MCP latency tracking - Infrastructure ready, not yet populated  

### Deferred
📋 ResponseAssembler integration - Deferred until block-based message architecture migration  
📋 MemoryLoaderService - Disabled due to Node.js fs compatibility issues  

---

## Known Limitations

1. **Browser Mode:** Some features (system orchestration, MCP host) require Tauri runtime
2. **Memory Loader:** File watching disabled due to Node.js fs incompatibility with browser/Tauri
3. **Single Request:** Only one outgoing request per session allowed
4. **Hardcoded Paths:** KNEZ path hardcoded to `C:\Users\syedm\Downloads\ASSETS\controlAPP\KNEZ`
5. **Windows Only:** System orchestration uses Windows-specific commands (cmd, taskkill)

---

## Dependencies Summary

### Runtime Dependencies
- React 19.1.0
- React DOM 19.1.0
- @tauri-apps/api 2.10.0
- @tauri-apps/plugin-fs 2.4.5
- @tauri-apps/plugin-opener 2
- @tauri-apps/plugin-shell 2.3.5
- Dexie 4.3.0
- Lucide React 0.563.0

### Development Dependencies
- TypeScript 5.8.3
- Vite 7.0.4
- @vitejs/plugin-react 4.6.0
- Tailwind CSS 4.1.18
- @tailwindcss/postcss 4.1.18
- Vitest 4.0.18
- Playwright 1.58.1
- @tauri-apps/cli 2
- Tauri 2 (Rust)
- tauri-plugin-shell 2
- tauri-plugin-fs 2
- tauri-plugin-http 2
- tauri-plugin-single-instance 2.3.7
- serde (Rust)
- serde_json (Rust)
- uuid (Rust)

---

## Security Considerations

1. **Trust Verification:** Connection profiles support fingerprint pinning
2. **CSP:** Content Security Policy disabled (null) in Tauri config
3. **Capabilities:** Uses default Tauri capabilities
4. **Localhost Only:** Default endpoint is localhost (no remote by default)
5. **Shell Access:** Plugin-shell enabled for system orchestration

---

## Performance Optimizations

1. **Health Check Caching:** 5-second TTL to reduce redundant checks
2. **Streaming Throttling:** 33ms throttle during streaming to reduce re-renders
3. **Connection Reuse:** HTTP client connection pooling (via browser)
4. **Adaptive Polling:** Health check intervals adapt based on health status
5. **Hidden Tab Penalty:** Reduced polling when tab is not visible
6. **Progressive Loading:** Delayed loading for large content
7. **Slice Limits:** Configurable limits for log lines, URLs, etc.

---

## Monitoring & Observability

### Logging
- LogService with structured logging
- Throttled debug logs (3-minute intervals)
- Observer pattern for telemetry
- Event emission to backend

### Metrics
- Response time tracking
- Tool execution time tracking
- MCP latency tracking
- First token time tracking
- Token count tracking
- Backend status tracking

### Events
- Chat events (user message, tool execution)
- System events (session start, phase transitions)
- Governance events (violations, blocks)
- MCP events (tool calls, errors)

---

## Conclusion

The KNEZ Control App is a sophisticated desktop application that provides comprehensive control over the KNEZ AI backend. It features a modern React-based UI with Tauri for native capabilities, extensive MCP integration, and robust system orchestration. The application is well-architected with modular services, comprehensive error handling, and adaptive performance optimizations.

Key strengths include:
- Comprehensive feature set (chat, memory, governance, MCP, orchestration)
- Modern tech stack (React 19, Tauri 2, TypeScript)
- Robust error handling and retry logic
- Adaptive performance optimizations
- Extensive observability and monitoring

Areas for future enhancement:
- Complete live status transition implementation
- Propagate execution time metrics to UI
- Cross-platform system orchestration
- Configuration-based path management
- Enhanced browser mode support
