# knez-control-app Architecture Overview

## System Architecture

The knez-control-app is a desktop application built with React, TypeScript, and Tauri that serves as the control interface for the KNEZ backend system. The architecture follows a layered design with clear separation of concerns between UI, services, and data layers.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri Desktop Window                    │
├─────────────────────────────────────────────────────────────────┤
│  React UI Layer                                                  │
│  ├── App.tsx (Main Entry Point)                                 │
│  ├── ChatPane (Chat Interface)                                  │
│  ├── AgentPane (Agent Management)                               │
│  ├── MemoryPane (Memory Browser)                                │
│  └── SettingsPane (Configuration)                               │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer (Business Logic)                                  │
│  ├── ChatService (Chat Orchestration)                           │
│  ├── KnezClient (Backend Communication)                         │
│  ├── SessionController (Session Management)                     │
│  ├── McpOrchestrator (MCP Server Management)                    │
│  ├── ToolExposureService (Tool Catalog)                         │
│  └── LogService (Logging)                                       │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (Persistence)                                        │
│  ├── SessionDatabase (Dexie/IndexedDB)                         │
│  ├── MemoryEventSourcingService (Memory Storage)                │
│  └── StaticMemoryLoader (Static Memory)                          │
├─────────────────────────────────────────────────────────────────┤
│  Communication Layer                                              │
│  ├── WebSocketClient (Real-time Events)                         │
│  ├── HTTP Client (REST API)                                      │
│  └── Tauri IPC (Native Operations)                              │
├─────────────────────────────────────────────────────────────────┤
│  Tauri Backend (Rust)                                            │
│  ├── Shell Plugin (Command Execution)                           │
│  ├── FS Plugin (File System Access)                             │
│  ├── HTTP Plugin (HTTP Client)                                  │
│  └── Single Instance Plugin                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  KNEZ Backend   │
                    │  (FastAPI/Python)│
                    └─────────────────┘
```

## Component Architecture

### Entry Point: App.tsx

**Location:** `src/App.tsx`

**Responsibilities:**
- Main React application entry point
- View routing and navigation (chat, agent, memory, settings)
- Global state management (session ID, connection status)
- System orchestration initialization
- Keyboard shortcut handling
- Static memory loading

**Key Features:**
- Manages view state via `currentView` state
- Integrates `ChatService` for chat functionality
- Integrates `SessionController` for session management
- Integrates `useSystemOrchestrator` for system initialization
- Handles command palette (Ctrl+K)
- Loads static memory on mount

### Chat Interface: ChatPane

**Location:** `src/features/chat/ChatPane.tsx`

**Responsibilities:**
- Primary chat interface for user interaction
- Message rendering and display
- Input handling and message sending
- Tool execution visualization
- Session management (rename, fork, export, import)
- Terminal integration for command execution
- Debug panel integration

**Key Features:**
- Message list with virtual scrolling
- Real-time phase progress indicator (AgentProgressBar)
- Tool execution status display
- Session export/import functionality
- In-chat terminal with PowerShell integration
- Debug panel for tool execution history
- Voice input support
- Message editing and retry

**State Management:**
- Syncs with `ChatService` for messages and phase
- Uses `SessionController` for session operations
- Subscribes to `McpOrchestrator` for MCP server status
- Subscribes to `ToolExposureService` for tool catalog

## Service Layer Architecture

### ChatService

**Location:** `src/services/ChatService.ts`

**Responsibilities:**
- Core chat orchestration and state management
- Phase management (idle, sending, thinking, tool_running, streaming, finalizing, done)
- Message persistence and retrieval
- Tool execution coordination
- Streaming response handling
- WebSocket event integration
- Request locking to prevent concurrent operations

**Key Components:**
- **PhaseManager:** Manages execution phase transitions
- **MessageStore:** Stores and retrieves chat messages
- **RequestController:** Prevents concurrent requests
- **StreamController:** Handles streaming responses

**Workflow:**
1. User sends message via `sendMessage()`
2. Phase transitions: idle → sending → thinking
3. Request sent to KNEZ backend via KnezClient
4. Streaming response received via WebSocket
5. Phase transitions: thinking → streaming → finalizing → done
6. Tool execution during streaming phase
7. Messages persisted to SessionDatabase

### KnezClient

**Location:** `src/services/knez/KnezClient.ts`

**Responsibilities:**
- HTTP communication with KNEZ backend
- WebSocket connection management
- Session creation and validation
- Health checks and backend status
- Memory operations (list, get, check gate)
- Governance and cognitive state retrieval
- MCP registry access
- TAQWIN event emission

**Key Methods:**
- `health()` - Backend health check
- `createNewLocalSession()` - Create new session
- `ensureSession()` - Ensure valid session exists
- `listEvents()` - Retrieve event history
- `listMemory()` - Retrieve memory entries
- `getCognitiveState()` - Get cognitive system state
- `getGovernanceSnapshot()` - Get governance state
- `tryGetMcpRegistry()` - Get MCP server registry
- `emitEvent()` - Emit events to backend

**Connection Management:**
- Profile-based connection configuration
- Trust management with fingerprint verification
- Automatic session persistence via localStorage
- WebSocket connection on session set
- Shell fallback for Tauri runtime

### SessionController

**Location:** `src/services/session/SessionController.ts`

**Responsibilities:**
- Session lifecycle management
- Session creation, forking, and resuming
- Session lineage tracking
- Session switching

**Key Methods:**
- `createNewSession()` - Create new session
- `forkSession()` - Fork from existing session at message
- `resumeSession()` - Resume from snapshot
- `switchSession()` - Switch to different session

### McpOrchestrator

**Location:** `src/mcp/McpOrchestrator.ts`

**Responsibilities:**
- MCP server lifecycle management (start, stop, restart)
- Tool discovery and catalog management
- Server status monitoring
- Auto-start configuration
- Crash history tracking
- Communication with McpInspectorService

**Key Features:**
- Subscribes to McpInspectorService for server status
- Manages server runtime state (running, stopped, crashed)
- Auto-starts servers on application startup
- Tracks crash history for stability monitoring
- Provides snapshot of current server state

**Server Runtime:**
```typescript
type ServerRuntime = {
  id: string;
  status: "running" | "stopped" | "crashed";
  pid?: number;
  lastOk?: number;
  lastError?: string;
  crashCount: number;
}
```

### ToolExposureService

**Location:** `src/services/mcp/ToolExposureService.ts`

**Responsibilities:**
- Tool catalog management
- Tool filtering for model compatibility
- Tool exposure configuration
- Subscription-based updates

**Key Methods:**
- `getCatalog()` - Get all available tools
- `getToolsForModel()` - Get tools compatible with current model
- `subscribe()` - Subscribe to catalog updates

## Data Layer Architecture

### SessionDatabase

**Location:** `src/services/session/SessionDatabase.ts`

**Responsibilities:**
- Dexie-based IndexedDB wrapper
- Session persistence
- Message persistence
- Session metadata storage

**Schema:**
- **sessions:** Session metadata (id, name, created_at, updated_at)
- **messages:** Chat messages (id, sessionId, from, text, timestamp, toolCall, metrics)

**Key Methods:**
- `saveSession()` - Save session metadata
- `getSession()` - Retrieve session
- `saveMessages()` - Save messages
- `loadMessages()` - Load messages for session
- `updateSessionName()` - Update session name

### MemoryEventSourcingService

**Location:** `src/services/memory/storage/MemoryEventSourcingService.ts`

**Responsibilities:**
- Memory entry persistence
- Event-sourced memory storage
- Memory retrieval and filtering

### StaticMemoryLoader

**Location:** `src/services/memory/StaticMemoryLoader.ts`

**Responsibilities:**
- Load static memory from files
- Provide memory data to application
- Memory caching

## Communication Layer Architecture

### WebSocketClient

**Location:** `src/services/websocket/WebSocketClient.ts`

**Responsibilities:**
- Real-time event streaming from KNEZ backend
- Connection management (connect, disconnect, reconnect)
- Event routing to subscribers
- Connection type management (SSE, WebSocket, Hybrid)

**Key Features:**
- Automatic reconnection on disconnect
- Event-based subscription model
- Connection type fallback (WebSocket → SSE → Hybrid)
- Session-based authentication

**Event Types:**
- Token stream events
- Tool execution events
- Cognitive state updates
- Governance events
- System status events

### HTTP Client

**Location:** Integrated in KnezClient

**Responsibilities:**
- REST API communication
- Request/response handling
- Error handling and retry logic
- Shell fallback for Tauri runtime

**Key Features:**
- Exponential backoff retry
- Timeout handling
- Shell command fallback for Tauri
- JSON parsing with error handling

## MCP Integration Architecture

### MCP Client: McpStdioClient

**Location:** `src/mcp/client/McpStdioClient.ts`

**Responsibilities:**
- STDIO-based MCP client implementation
- JSON-RPC 2.0 protocol handling
- Process lifecycle management (start, stop, restart)
- Request/response correlation
- Framing detection (content-length vs line-delimited)
- Timeout handling and classification
- Traffic logging and inspection

**Key Features:**
- Automatic framing detection
- Protocol version negotiation (2024-11-05, 1.0)
- Initialize handshake with retry
- Request chaining for sequential execution
- Pending request tracking
- Stdout/stderr buffering and parsing

**Framing Modes:**
- **content-length:** Standard MCP framing with Content-Length header
- **line:** Line-delimited JSON for simpler servers

**Timeout Classification:**
- Method-specific timeout classification
- Context-aware error messages
- Automatic server restart on timeout

### MCP Inspector

**Location:** `src/mcp/inspector/`

**Responsibilities:**
- MCP server inspection and monitoring
- Traffic logging and analysis
- Server health monitoring
- Tool call tracing

**Components:**
- **McpInspectorService:** Central inspection service
- **McpTraffic:** Traffic event types and logging
- **McpLoggingConstants:** Logging categories and methods
- **McpLoggingHelpers:** Logging utility functions

## Domain Layer Architecture

### DataContracts

**Location:** `src/domain/DataContracts.ts`

**Responsibilities:**
- Type definitions for all data structures
- Interface definitions for services
- Enum definitions for states and phases

**Key Types:**
- **ChatMessage:** Base message structure
- **AssistantMessage:** Assistant response with blocks
- **ToolCallMessage:** Tool execution message
- **Session:** Session metadata
- **MemoryEntry:** Memory record
- **GovernanceEvent:** Governance system event
- **KnezConnectionProfile:** Backend connection profile
- **McpRegistryItem:** MCP server registry entry

**Key Enums:**
- **MessageState:** Message state (pending, delivered, failed)
- **ExecutionPhase:** Execution phase (idle, sending, thinking, tool_running, streaming, finalizing, done)
- **ExecutionPattern:** Execution pattern (sequential, parallel)

## UI Component Architecture

### Message Rendering

**Location:** `src/features/chat/blocks/`

**Responsibilities:**
- Assistant message block rendering
- Tool call visualization
- Code block rendering
- Markdown rendering

**Components:**
- **AssistantMessageRenderer:** Main assistant message renderer
- **ToolCallBlock:** Tool execution visualization
- **CodeBlock:** Code syntax highlighting
- **MarkdownBlock:** Markdown rendering

### Debug Panel

**Location:** `src/features/chat/DebugPanel.tsx`

**Responsibilities:**
- Tool execution history display
- Session filtering
- Statistics calculation
- Individual tool call details

**Features:**
- Tool call history with timestamps
- Execution time tracking
- MCP latency tracking
- Status badges (pending, running, succeeded, failed)
- Expandable tool details

### Modals

**Location:** `src/features/chat/modals/`

**Components:**
- **HistoryModal:** Session history browser
- **ForkModal:** Session fork confirmation
- **RenameModal:** Session rename dialog
- **AuditModal:** Audit results display
- **AvailableToolsModal:** Tool catalog display
- **MemoryModal:** Memory browser

## Phase Management Architecture

### PhaseManager

**Location:** Integrated in ChatService

**Responsibilities:**
- Execution phase state management
- Phase transition validation
- Phase-based UI updates

**Phases:**
1. **idle:** No active operation
2. **sending:** Message being sent to backend
3. **thinking:** Backend processing request
4. **tool_running:** Tool execution in progress
5. **streaming:** Response streaming from backend
6. **finalizing:** Response finalization
7. **done:** Operation complete
8. **error:** Operation failed
9. **failed:** Critical failure

**Phase Transitions:**
- Phase transitions are validated before execution
- UI updates based on current phase
- AgentProgressBar displays current phase

## Error Handling Architecture

### Error Types

**Location:** `src/domain/Errors.ts`

**Error Categories:**
- **AppError:** Application-specific errors
- **KNEZ Errors:** Backend communication errors
- **MCP Errors:** MCP client errors
- **Session Errors:** Session management errors

### Error Handling Strategy

1. **Service Layer:** Catches and logs errors, emits to subscribers
2. **UI Layer:** Displays user-friendly error messages
3. **Logging:** Detailed error logging via LogService
4. **Recovery:** Automatic retry where applicable
5. **User Notification:** Toast notifications for user feedback

## Logging Architecture

### LogService

**Location:** `src/services/utils/LogService.ts`

**Responsibilities:**
- Centralized logging service
- Log level filtering (debug, info, warn, error)
- Throttled logging to prevent performance degradation
- MCP server-specific logging
- Console and file output

**Log Levels:**
- **debug:** Detailed debugging information
- **info:** General informational messages
- **warn:** Warning messages
- **error:** Error messages

**Features:**
- Throttled logging (configurable interval)
- Category-based logging
- MCP server-specific log categories
- Structured log data

## Security Architecture

### Connection Security

- **Profile-based trust management:** Connection profiles with trust levels
- **Fingerprint verification:** Backend identity verification
- **Session-based authentication:** Session ID for WebSocket authentication
- **Local storage encryption:** Sensitive data in localStorage

### Data Security

- **IndexedDB sandbox:** Local data in browser sandbox
- **No sensitive data in localStorage:** Session IDs only
- **UUID generation:** Cryptographically random session IDs

### Tauri Security

- **Capability system:** Tauri capabilities for native access
- **File system permissions:** Explicit file system access
- **Shell command control:** Controlled shell execution

## Performance Architecture

### Rendering Performance

- **React 18 concurrent features:** Improved rendering performance
- **Virtual scrolling:** Efficient message list rendering
- **Memoization:** useMemo and useCallback for expensive operations
- **Lazy loading:** Components loaded on demand

### Data Performance

- **IndexedDB:** Efficient local storage
- **Throttled logging:** Prevents performance degradation
- **Request locking:** Prevents concurrent expensive operations
- **Connection pooling:** Reuses HTTP connections

### Build Performance

- **Vite:** Fast development server with HMR
- **Code splitting:** Optimized bundle size
- **Tree shaking:** Removes unused code
- **Minification:** Production bundle optimization

## Summary

The knez-control-app architecture follows a layered design with clear separation of concerns:

1. **UI Layer:** React components for user interaction
2. **Service Layer:** Business logic and orchestration
3. **Data Layer:** Persistence and storage
4. **Communication Layer:** HTTP and WebSocket communication
5. **Tauri Backend:** Native OS integration

Key architectural patterns:
- **Service-oriented:** Clear service boundaries
- **Event-driven:** WebSocket events for real-time updates
- **Subscription-based:** Services expose subscription APIs
- **Phase-based:** Execution phases for clear state management
- **Type-safe:** TypeScript for compile-time type checking

This architecture provides a maintainable, scalable, and performant foundation for the KNEZ control interface.
