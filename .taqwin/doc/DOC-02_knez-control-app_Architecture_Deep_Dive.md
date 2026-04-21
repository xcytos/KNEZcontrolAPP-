# DOC-02: knez-control-app Architecture Deep Dive

## Executive Summary

knez-control-app is a React/TypeScript desktop application built with Tauri that serves as the frontend interface for the KNEZ AI agent system. It provides a chat-based UI, MCP tool orchestration, memory management, debugging capabilities, and integration with the KNEZ backend. The application follows a modern React architecture with feature-based organization, comprehensive state management, and extensive service layer for backend communication.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Chat System](#chat-system)
6. [MCP Orchestration](#mcp-orchestration)
7. [Service Layer](#service-layer)
8. [State Management](#state-management)
9. [Data Contracts](#data-contracts)
10. [UI Components](#ui-components)
11. [Memory Management](#memory-management)
12. [Debug & Diagnostics](#debug--diagnostics)
13. [Presence Engine](#presence-engine)
14. [Tool Execution](#tool-execution)
15. [Governance](#governance)
16. [Error Handling](#error-handling)
17. [Performance Optimizations](#performance-optimizations)
18. [Tauri Integration](#tauri-integration)
19. [Configuration](#configuration)
20. [Known Issues & Limitations](#known-issues--limitations)

---

## Architecture Overview

knez-control-app follows a feature-based architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Desktop Shell                    │
│  (main process, window management, native APIs)           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   React Application Layer                  │
│  (App.tsx, routing, context providers)                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Feature-Based Modules                   │
│  (features/chat, features/mcp, features/memory, etc)      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
│  (ChatService, KnezClient, McpOrchestrator, etc)          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                           │
│  (DataContracts, Errors, type definitions)                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   External Integration                      │
│  (KNEZ backend API, MCP servers, Tauri shell)              │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Feature-Based Organization**: Modules organized by feature, not type
2. **Service Layer Pattern**: Business logic separated from UI
3. **Type Safety**: Comprehensive TypeScript typing
4. **Event-Driven**: Service state changes emit events for UI updates
5. **Modular**: Clear boundaries between features
6. **Desktop-First**: Tauri for native desktop capabilities

---

## Directory Structure

```
knez-control-app/
├── src/
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # Application entry point
│   ├── index.css                  # Global styles
│   ├── App.css                    # App-specific styles
│   │
│   ├── domain/                    # Domain models and contracts
│   │   ├── DataContracts.ts       # Core data structures
│   │   └── Errors.ts              # Error definitions
│   │
│   ├── config/                    # Configuration
│   │   └── features.ts           # Feature flags
│   │
│   ├── contexts/                  # React contexts
│   │   ├── StatusProvider.tsx     # Connection status context
│   │   ├── ThemeContext.tsx       # Theme context
│   │   └── useStatus.ts           # Status hook
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useTaqwinActivationStatus.ts
│   │   └── useTaqwinMcpStatus.ts
│   │
│   ├── services/                  # Service layer (modularized)
│   │   ├── ChatService.ts         # Central chat orchestrator
│   │   ├── chat/                  # Chat subsystem
│   │   │   ├── core/              # Chat core infrastructure
│   │   │   │   ├── StreamController.ts    # Stream ownership + validation
│   │   │   │   ├── ResponseAssembler.ts   # Assistant response assembly
│   │   │   │   ├── MessageStore.ts        # Message state management
│   │   │   │   └── RequestController.ts   # Request lifecycle control
│   │   │   └── sync/              # Chat memory synchronization
│   │   │       └── ChatMemorySyncService.ts
│   │   ├── knez/                  # KNEZ backend integration
│   │   │   └── KnezClient.ts      # HTTP client for KNEZ API
│   │   ├── mcp/                   # MCP tool system
│   │   │   ├── McpTypes.ts        # MCP type definitions
│   │   │   ├── ToolExecutionService.ts  # Tool execution logic
│   │   │   ├── ToolExposureService.ts   # Tool catalog management
│   │   │   ├── ToolResultValidator.ts   # Tool result validation
│   │   │   └── McpOrchestrator.ts       # MCP server orchestration (re-export)
│   │   ├── session/               # Session management
│   │   │   ├── SessionDatabase.ts     # IndexedDB session storage
│   │   │   └── SessionController.ts   # Session lifecycle management
│   │   ├── memory/                # Memory subsystem
│   │   │   ├── storage/
│   │   │   │   └── MemoryEventSourcingService.ts
│   │   │   ├── tracking/
│   │   │   │   └── MemoryKnowledgeGraphService.ts
│   │   │   ├── persistence/
│   │   │   │   ├── MemoryBackupService.ts
│   │   │   │   ├── MemoryCompressionService.ts
│   │   │   │   ├── MemoryCRDTService.ts
│   │   │   │   ├── MemoryBloomFilterService.ts
│   │   │   │   └── MemoryBinarySerializationService.ts
│   │   │   └── MemoryInjectionService.ts
│   │   ├── agent/                 # Agent execution services
│   │   │   ├── AgentOrchestrator.ts
│   │   │   ├── AgentLoopService.ts
│   │   │   ├── AgentContext.ts
│   │   │   ├── LoopController.ts
│   │   │   ├── RetryStrategyEngine.ts
│   │   │   ├── ExecutionSandbox.ts
│   │   │   ├── ToolResultNormalizer.ts
│   │   │   ├── SecurityLayer.ts
│   │   │   ├── AgentTracer.ts
│   │   │   ├── FailureClassifier.ts
│   │   │   └── AgentRuntime.ts
│   │   ├── governance/            # Governance enforcement
│   │   │   └── GovernanceService.ts
│   │   ├── analytics/             # Diagnostics and analytics
│   │   │   └── DiagnosticsService.ts
│   │   ├── testing/               # Test execution
│   │   │   └── TestRunner.ts
│   │   ├── infrastructure/        # Infrastructure services
│   │   │   ├── persistence/
│   │   │   │   └── PersistenceService.ts
│   │   │   └── error/
│   │   │       └── TabErrorStore.ts
│   │   ├── utils/                 # Utility services
│   │   │   ├── LogService.ts
│   │   │   ├── ExtractionService.ts
│   │   │   ├── ErrorClassifier.ts
│   │   │   ├── FallbackStrategy.ts
│   │   │   ├── GracefulDegradation.ts
│   │   │   ├── LatencyOptimizer.ts
│   │   │   ├── RetryStrategy.ts
│   │   │   ├── TimeoutConfig.ts
│   │   │   ├── JsonRepair.ts
│   │   │   ├── OutputInterpreter.ts
│   │   │   ├── redact.ts
│   │   │   ├── health.ts
│   │   │   └── observer.ts
│   │   ├── KnezProfiles.ts        # Connection profile management
│   │   └── StaticMemoryLoader.ts  # Static memory data loader
│   │
│   ├── mcp/                       # MCP integration
│   │   ├── McpOrchestrator.ts     # MCP orchestration (main)
│   │   ├── McpErrorTaxonomy.ts    # MCP error classification
│   │   ├── authority.ts           # MCP authority management
│   │   ├── index.ts               # MCP exports
│   │   ├── mcpBoot.ts             # MCP bootstrap
│   │   ├── rustEventBridge.ts     # Rust event bridge
│   │   └── inspector/             # MCP inspector
│   │       └── McpInspectorService.ts
│   │
│   ├── presence/                  # Presence engine
│   │   └── PresenceEngine.ts
│   │
│   ├── components/                # Shared UI components
│   │   ├── layout/                # Layout components
│   │   └── ui/                    # UI primitives
│   │
│   ├── design/                    # Design system
│   │   └── tokens.ts              # Design tokens
│   │
│   ├── features/                  # Feature modules
│   │   ├── chat/                  # Chat feature
│   │   │   ├── ChatPane.tsx       # Main chat interface
│   │   │   ├── ChatTerminalPane.tsx # Terminal mode
│   │   │   ├── MessageItem.tsx    # Message rendering
│   │   │   ├── DebugPanel.tsx     # Debug panel
│   │   │   ├── MemoryModal.tsx    # Memory modal
│   │   │   ├── LineagePanel.tsx   # Session lineage panel
│   │   │   ├── SessionInspectorModal.tsx
│   │   │   ├── ChatMemorySyncModal.tsx
│   │   │   ├── TaqwinToolsModal.tsx
│   │   │   ├── ToolApprovalModal.tsx
│   │   │   ├── blocks/            # Message block components
│   │   │   │   ├── TextBlock.tsx
│   │   │   │   ├── MCPBlock.tsx
│   │   │   │   ├── ApprovalBlock.tsx
│   │   │   │   ├── FinalBlock.tsx
│   │   │   │   └── AssistantMessageRenderer.tsx
│   │   │   ├── components/        # Chat components
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── MessageAnalytics.tsx
│   │   │   ├── modals/            # Chat modals
│   │   │   │   ├── HistoryModal.tsx
│   │   │   │   ├── ForkModal.tsx
│   │   │   │   ├── RenameModal.tsx
│   │   │   │   ├── AuditModal.tsx
│   │   │   │   └── AvailableToolsModal.tsx
│   │   │   └── ChatUtils.ts       # Chat utilities
│   │   │
│   │   ├── mcp/                   # MCP feature UI
│   │   ├── memory/                # Memory feature UI
│   │   ├── cognitive/             # Cognitive feature UI
│   │   ├── governance/            # Governance feature UI
│   │   ├── diagnostics/           # Diagnostics feature UI
│   │   ├── drift/                 # Drift analysis UI
│   │   ├── events/                # Events feature UI
│   │   ├── extraction/            # Extraction feature UI
│   │   ├── infrastructure/        # Infrastructure UI
│   │   │   └── InfrastructureVisualizer.tsx
│   │   ├── logs/                  # Logs feature UI
│   │   ├── mistakes/              # Mistakes ledger UI
│   │   ├── perception/            # Perception feature UI
│   │   ├── performance/           # Performance metrics UI
│   │   ├── presence/              # Presence state UI
│   │   ├── reflection/            # Reflection feature UI
│   │   ├── replay/                # Replay feature UI
│   │   ├── settings/              # Settings UI
│   │   ├── skills/                # Skills feature UI
│   │   ├── system/                # System status UI
│   │   ├── timeline/              # Timeline visualization UI
│   │   ├── updates/               # Update management UI
│   │   └── voice/                 # Voice input UI
│   │
│   └── assets/                    # Static assets
│       └── ...
│
├── public/                        # Public assets
│   ├── memory/                    # Static memory files
│   └── ...
│
├── scripts/                       # Build/dev scripts
│   ├── clean.mjs
│   └── dev-all.ps1
│
├── src-tauri/                     # Tauri Rust backend
│   ├── src/
│   │   ├── lib.rs                 # Rust library entry
│   │   ├── main.rs                # Rust main entry
│   │   └── ...
│   ├── Cargo.toml                 # Rust dependencies
│   └── tauri.conf.json            # Tauri configuration
│
├── package.json                   # Node dependencies
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── .gitignore
└── README.md
```

---

## Technology Stack

### Frontend Framework

- **React 18**: UI framework
- **TypeScript 5**: Type safety
- **Vite**: Build tool and dev server

### Desktop Framework

- **Tauri 2**: Desktop application framework
  - Rust backend for native APIs
  - WebView2 on Windows
  - Cross-platform support

### UI Libraries

- **Tailwind CSS 4**: Utility-first CSS
- **Lucide React**: Icon library
- **shadcn/ui**: Component library (implied usage)

### State Management

- **React Context**: Global state
- **Custom Hooks**: Encapsulated state logic
- **Service Pattern**: Business logic state

### Data Persistence

- **Dexie**: IndexedDB wrapper for session storage
- **LocalStorage**: Profile and settings storage
- **Tauri File System**: Native file operations

### HTTP Client

- **@tauri-apps/api/http**: Tauri HTTP client
- **Fetch API**: Fallback HTTP client

### Testing

- **Vitest**: Unit testing framework
- **Playwright**: E2E testing framework
- **@testing-library/react**: React testing utilities

### Build Tools

- **Vite**: Build tool
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixes

---

## Core Components

### App.tsx

**Purpose**: Main application component, routing, layout

**Key Responsibilities**:
- Route management
- Context provider setup
- Layout structure
- Global error handling

### main.tsx

**Purpose**: Application entry point

**Key Responsibilities**:
- React root render
- Tauri event listeners
- Service initialization

---

## Chat System

### ChatPane.tsx

**Purpose**: Main chat interface component

**State Management**:
```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
const [phase, setPhase] = useState<"idle" | "sending" | "thinking" | "tool_running" | "streaming" | "finalizing" | "done" | "error">("idle");
const [inputValue, setInputValue] = useState("");
const [debugPanelOpen, setDebugPanelOpen] = useState(false);
const [mode, setMode] = useState<"chat" | "terminal">("chat");
```

**Key Features**:
- Message rendering with MessageItem
- Chat input with ChatInput
- Phase-based UI state (idle, sending, thinking, tool_running, streaming, etc.)
- Debug panel integration
- Terminal mode support
- Session management (fork, rename, history)
- Tool approval modal (removed - tools auto-approve)
- Memory modal
- Lineage panel

**Chat Phases**:
1. **idle**: Ready for input
2. **sending**: Message being sent
3. **thinking**: Backend processing
4. **tool_running**: MCP tool execution
5. **streaming**: Receiving streaming response
6. **finalizing**: Completing response
7. **done**: Response complete
8. **error**: Error occurred

---

### MessageItem.tsx

**Purpose**: Render individual chat messages

**Message Types Supported**:
- `user`: User messages (right-aligned, blue background)
- `assistant`/`knez`: Assistant messages (left-aligned, transparent)
- `tool_execution`: Tool execution blocks (transparent, full-width)
- `tool_result`: Tool results
- `system`: System messages

**Content Parts**:
- `text`: Regular text content
- `think`: Thought process (collapsible)
- `system`: System blocks (expandable)
- `code`: Code blocks (syntax highlighting)
- `tool_call`: Tool call metadata

**Tool Execution Rendering**:
```typescript
{msg.toolCall && (
  <div className="tool-execution-block">
    <div className="tool-header">
      <Badge status={msg.toolCall.status} />
      <span>{msg.toolCall.tool}</span>
    </div>
    {toolDetailsOpen && (
      <div className="tool-details">
        <div>REQUEST: {JSON.stringify(msg.toolCall.args)}</div>
        {msg.toolCall.result && <div>OUTPUT: {JSON.stringify(msg.toolCall.result)}</div>}
        {msg.toolCall.error && <div>ERROR: {msg.toolCall.error}</div>}
        {msg.toolCall.executionTimeMs && <div>Time: {msg.toolCall.executionTimeMs}ms</div>}
        {msg.toolCall.mcpLatencyMs && <div>MCP Latency: {msg.toolCall.mcpLatencyMs}ms</div>}
      </div>
    )}
  </div>
)}
```

**Status Badges**:
- `pending`: Yellow badge
- `running`: Blue badge with pulse animation
- `calling`: Blue badge
- `succeeded`/`completed`: Green badge
- `failed`: Red badge

---

### ChatUtils.ts

**Purpose**: Utility functions for chat processing

**Key Functions**:
- `parseMessageContent(text)`: Parse message into parts (think, system, code, text)
- `formatMarkdown(text)`: Format markdown into blocks
- `copyToClipboard(text)`: Copy text to clipboard

---

### DebugPanel.tsx

**Purpose**: Debug panel for tool call history and statistics

**Features**:
- Tool call history view
- Session filtering
- Statistics dashboard:
  - Total tool calls
  - Succeeded count
  - Failed count
  - Average execution time
  - Average MCP latency
- Individual tool call details
- Modal overlay with close button

---

### ChatTerminalPane.tsx

**Purpose**: Terminal mode for command execution

**Features**:
- PowerShell command execution
- CWD tracking
- Command history
- Output display
- Tauri shell integration

---

## MCP Orchestration

### McpOrchestrator.ts

**Purpose**: Central MCP server management and orchestration

**ServerRuntime Structure**:
```typescript
type ServerRuntime = {
  serverId: string;
  authority: McpAuthority;
  enabled: boolean;
  start_on_boot: boolean;
  allowed_tools: string[];
  blocked_tools: string[];
  type: "stdio" | "http";
  tags: string[];
  state: McpInspectorLifecycle;
  pid: number | null;
  running: boolean;
  framing: "content-length" | "line" | "http";
  generation: number;
  lastOkAt: number | null;
  initializedAt: number | null;
  initializeDurationMs: number | null;
  toolsListDurationMs: number | null;
  lastError: string | null;
  tools: McpToolDefinition[];
  toolsHash: string | null;
  toolsCacheAt: number | null;
  toolsPending: boolean;
  configSource?: "user" | "project" | "app_local" | "default";
};
```

**Key Methods**:
- `subscribe(fn)`: Subscribe to state changes
- `getSnapshot()`: Get current server state
- `getServer(serverId)`: Get specific server
- `getServers()`: Get all servers
- `getServerTools(serverId)`: Get tools for server
- `startServer(serverId)`: Start server
- `stopServer(serverId)`: Stop server
- `restartServer(serverId)`: Restart server
- `handshake(serverId, opts)`: Perform server handshake
- `refreshTools(serverId, opts)`: Refresh tool list
- `callTool(serverId, name, args, opts)`: Execute tool call
- `recordCrash(serverId, reason)`: Record server crash
- `getCrashHistory(serverId)`: Get crash history

**Auto-Start Logic**:
```typescript
constructor() {
  mcpInspectorService.subscribe(() => {
    this.rebuildFromInspector();
  });
  this.rebuildFromInspector();
  void this.maybeAttachRustEventListeners();
  // Ensure MCP servers bootstrap on app start
  void this.ensureStartedAll({ onlyEnabled: true, startOnBootOnly: true });
  void this.maybeAutoStartServers();
}
```

**Crash Tracking**:
- Maintains crash history per server (last 10 crashes)
- Implements exponential backoff for auto-restart
- Tracks crash timestamps and reasons

---

### authority.ts

**Purpose**: MCP authority management (permissions, tool allowlists)

**Authority Structure**:
```typescript
type McpAuthority = {
  serverId: string;
  allowedTools: string[];
  blockedTools: string[];
  trustLevel: "trusted" | "untrusted" | "sandbox";
};
```

---

### McpErrorTaxonomy.ts

**Purpose**: MCP error classification and taxonomy

**Error Codes**:
- `mcp_tool_not_found`: Tool not found in catalog
- `mcp_not_started`: MCP server not started
- `mcp_not_ready`: MCP server not ready
- `mcp_permission_denied`: Tool blocked by governance
- `mcp_timeout`: Tool execution timeout
- `mcp_parse_error`: Response parsing error
- `mcp_network_error`: Network communication error

---

### rustEventBridge.ts

**Purpose**: Bridge between Rust MCP inspector and TypeScript

**Features**:
- Tauri event listeners for MCP events
- Event translation between Rust and TypeScript
- State synchronization

---

## Service Layer

### ChatService.ts

**Purpose**: Central chat orchestrator coordinating all chat subsystems

**State Structure**:
```typescript
interface ChatState {
  messages: ChatMessage[];
  assistantMessages: AssistantMessage[];
  phase: ChatPhase;
  activeTools: { search: boolean };
  searchProvider: "off" | "taqwin" | "proxy";
  pendingToolApproval: ToolApprovalRequest | null;
}
```

**Chat Phases**:
```typescript
type ChatPhase =
  | "idle"
  | "sending"
  | "thinking"
  | "tool_running"
  | "streaming"
  | "finalizing"
  | "done"
  | "error";
```

**Key Methods**:
- `subscribe(fn)`: Subscribe to state changes
- `sendMessage(text)`: Send user message
- `editUserMessageAndResend(messageId, newText)`: Edit and resend message
- `continueGeneration()`: Continue stopped generation
- `stopGeneration()`: Stop current generation
- `persistToolTrace(toolCall)`: Persist tool execution trace
- `updateToolTrace(messageId, updates)`: Update tool trace
- `executeToolDeterministic(tool, args)`: Execute tool with deterministic tracking
- `appendSyntheticToolError(tool, error)`: Add synthetic tool error

**Chat Core Subsystem** (see `chat/core/` directory):
- **StreamController**: Validates stream ownership, prevents concurrent streams
- **ResponseAssembler**: Binds to assistantId, appends chunks, enforces content integrity
- **MessageStore**: Central message state management
- **RequestController**: Request lifecycle and abort handling

**Streaming Handling**:
- SSE (Server-Sent Events) parsing
- Token-by-token message building
- Phase transitions based on events
- UI update throttling (33ms during streaming)
- Stream ownership enforcement via StreamController

**Tool Execution Flow**:
1. Backend emits `tool_call_start` event
2. ChatService creates tool execution message (type: `tool_execution`)
3. Backend emits `tool_call_completed` event
4. ChatService updates tool result with execution metrics
5. Model generates explanation
6. Response streamed to UI

---

### KnezClient.ts (`services/knez/`)

**Purpose**: HTTP client for KNEZ backend API

**Location**: `src/services/knez/KnezClient.ts`

**Connection Profiles**:
```typescript
type ConnectionProfile = {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  createdAt: string;
};
```

**Key Methods**:
- `getProfiles()`: Get all connection profiles
- `getCurrentProfile()`: Get active profile
- `setCurrentProfile(profileId)`: Set active profile
- `health()`: Health check
- `events(filters)`: Query events
- `memory(filters)`: Query memory
- `chatCompletion(request)`: Chat completion with streaming
- `sessionResume(sessionId, options)`: Resume session
- `sessionFork(sessionId, options)`: Fork session
- `sessionLineage(sessionId)`: Get session lineage
- `sessionTools(sessionId, limit)`: Get tool calls

**Streaming Implementation**:
```typescript
async chatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamEvent, void> {
  const profile = this.getCurrentProfile();
  const response = await fetch(`${profile.endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        yield data;
      }
    }
  }
}
```

**Fallback to Tauri Shell**:
- If fetch fails, attempts Tauri shell command
- Used for environments with restricted network access

---

### Session Subsystem (`services/session/`)

**SessionDatabase.ts**:

**Purpose**: IndexedDB-based session storage

**Location**: `src/services/session/SessionDatabase.ts`

**Database Schema**:
```typescript
interface SessionRecord {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
```

**Key Methods**:
- `getSession(sessionId)`: Get session
- `saveSession(session)`: Save session
- `listSessions()`: List all sessions
- `deleteSession(sessionId)`: Delete session

---

**SessionController.ts**:

**Purpose**: Session lifecycle management

**Location**: `src/services/session/SessionController.ts`

**Key Methods**:
- `createSession()`: Create new session
- `switchSession(sessionId)`: Switch to session
- `deleteSession(sessionId)`: Delete session
- `renameSession(sessionId, name)`: Rename session

---

### ToolExecutionService.ts (`services/mcp/`)

**Purpose**: Tool execution with governance and error handling

**Location**: `src/services/mcp/ToolExecutionService.ts`

**Execution Outcome Types**:
```typescript
type ToolExecutionDenied = {
  ok: false;
  kind: "denied";
  error: McpErrorClassification;
  tool: { namespacedName: string; serverId?: string; originalName?: string };
};

type ToolExecutionFailed = {
  ok: false;
  kind: "failed";
  error: McpErrorClassification;
  tool: { namespacedName: string; serverId?: string; originalName?: string };
  durationMs?: number;
};

type ToolExecutionSucceeded = {
  ok: true;
  kind: "succeeded";
  tool: { namespacedName: string; serverId: string; originalName: string };
  durationMs: number;
  result: any;
};
```

**Key Methods**:
- `executeNamespacedTool(namespacedName, args, opts)`: Execute tool by namespaced name
- `resolveNamespacedName(serverId, originalName)`: Resolve to namespaced name

**Execution Flow**:
1. Validate namespaced name format
2. Get tool metadata from catalog
3. Check server is running
4. Apply governance rules
5. Execute tool via McpOrchestrator
6. Classify and return result

---

### ToolExposureService.ts (`services/mcp/`)

**Purpose**: Tool catalog management and exposure to models

**Location**: `src/services/mcp/ToolExposureService.ts`

**Tool Metadata**:
```typescript
type ExposedToolMeta = {
  name: string;              // Namespaced name (server__tool)
  serverId: string;
  originalName: string;
  description: string;
  inputSchema: any;
  enabled: boolean;
};
```

**Key Methods**:
- `getCatalog()`: Get all exposed tools
- `getToolByName(namespacedName)`: Get tool by name
- `getToolsForModel()`: Get tools allowed for current model
- `updateTool(meta)`: Update tool metadata

---

### GovernanceService.ts (`services/governance/`)

**Purpose**: Governance enforcement for tool execution

**Location**: `src/services/governance/GovernanceService.ts`

**Governance Decision**:
```typescript
type GovernanceDecision = {
  allowed: boolean;
  reason?: string;
};
```

**Key Methods**:
- `decideTool(toolMeta, serverRuntime)`: Decide if tool execution is allowed

**Governance Rules**:
- Tool allowlist/blocklist
- Server trust level
- Risk ceiling enforcement
- Proposal cap limits

---

## Chat Core Subsystem

### StreamController.ts (`services/chat/core/`)

**Purpose**: Stream ownership validation and concurrency control

**Location**: `src/services/chat/core/StreamController.ts`

**Rules**: Only ONE stream per request; any second stream is rejected

**Constructor**:
```typescript
constructor(sessionId: string = "")
```

**Methods**:
- `startStream(streamId, assistantId)`: Start a new stream (throws if stream already active)
- `validateOwnership(streamId, assistantId)`: Validate stream ownership
- `endStream(streamId)`: End active stream
- `cancelStream(streamId)`: Cancel active stream
- `isActive(streamId)`: Check if stream is active
- `getActiveStream(): string | null`: Get active stream ID
- `start(assistantId, streamId): boolean`: Wrapper that returns boolean instead of throwing
- `end(assistantId, streamId): void`: Wrapper for endStream
- `append(messageId, activeStreamId): boolean`: Validate message can append to stream

### ResponseAssembler.ts (`services/chat/core/`)

**Purpose**: Append and finalize assistant responses

**Location**: `src/services/chat/core/ResponseAssembler.ts`

**Responsibilities**:
- Bind to assistantId
- Append chunks safely
- Enforce content integrity

**Rules**:
- Cannot append if message missing
- Cannot finalize twice
- If no content → fallback

### MessageStore.ts (`services/chat/core/`)

**Purpose**: Central message state management

**Location**: `src/services/chat/core/MessageStore.ts`

### RequestController.ts (`services/chat/core/`)

**Purpose**: Request lifecycle and abort control

**Location**: `src/services/chat/core/RequestController.ts`

---

## State Management

### React Context

**StatusProvider.tsx**:
- Manages connection status (online/offline)
- Health monitoring
- Backend status tracking

**ThemeContext.tsx**:
- Theme management (dark/light)
- Design token application

### Service State Pattern

Services use a subscriber pattern for state management:

```typescript
class ChatService {
  private state: ChatState;
  private subscribers = new Set<(state: ChatState) => void>();
  
  subscribe(fn: (state: ChatState) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  
  private notify() {
    for (const fn of this.subscribers) {
      fn(this.state);
    }
  }
  
  setState(updates: Partial<ChatState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }
}
```

---

## Data Contracts

### DataContracts.ts

**Purpose**: Central type definitions for data structures

**Message Types**:
```typescript
type MessageFrom = "user" | "assistant" | "tool_execution" | "tool_result" | "system" | "knez";
```

**ChatMessage**:
```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  from: MessageFrom;
  text: string;
  createdAt: string;
  sequenceNumber?: number;
  relativeTimeLabel?: string;
  hiddenLocally?: boolean;
  refusal?: boolean;
  isPartial?: boolean;
  hasReceivedFirstToken?: boolean;
  deliveryStatus?: "queued" | "pending" | "delivered" | "failed";
  deliveryError?: string;
  replyToMessageId?: string;
  correlationId?: string;
  traceId?: string;
  toolCallId?: string;
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
  influence?: {
    vote?: InfluenceVote;
    reason?: string;
  };
}
```

**ToolCallMessage**:
```typescript
interface ToolCallMessage {
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
  groupingId?: string;
  sequenceOrder?: number;
}
```

**AssistantMessage**:
```typescript
interface AssistantMessage {
  id: string;
  sessionId: string;
  role: "assistant";
  state: MessageState;
  blocks: Block[];
  createdAt: number;
  finalizedAt?: number;
  sequenceNumber?: number;
}
```

**Block Types**:
```typescript
type Block =
  | { type: "text"; content: string }
  | { type: "approval"; tool: string; args: any; status: "pending" | "approved" | "rejected" }
  | { type: "mcp_call"; tool: string; args: any; status: "pending" | "running" | "success" | "failed"; result?: any; error?: string; executionTimeMs?: number; mcpLatencyMs?: number }
  | { type: "final"; content: string };
```

---

## UI Components

### Layout Components

**Header**: Navigation, session info, debug button
**Sidebar**: Session list, navigation
**Main**: Chat pane, modals
**Footer**: Status bar

### UI Primitives

**Button**: Standard button component
**Input**: Text input component
**Modal**: Modal dialog component
**Badge**: Status badge component
**Toast**: Toast notification component

---

## Memory Management

### MemoryEventSourcingService.ts

**Purpose**: Event sourcing for memory operations

**Features**:
- Event-based memory updates
- Event log persistence
- Memory reconstruction from events

### MemoryBackupService.ts

**Purpose**: Memory backup and restore

**Features**:
- Export memory to file
- Import memory from file
- Backup scheduling

### MemoryCompressionService.ts

**Purpose**: Memory compression for storage efficiency

**Features**:
- Text compression
- Deduplication
- Delta encoding

### MemoryCRDTService.ts

**Purpose**: Conflict-free replicated data types for memory

**Features**:
- Last-write-wins semantics
- Conflict resolution
- Distributed sync

### MemoryBloomFilterService.ts

**Purpose**: Bloom filter for memory deduplication

**Features**:
- Fast membership testing
- Memory-efficient
- False positive handling

### MemoryBinarySerializationService.ts

**Purpose**: Binary serialization for memory

**Features**:
- Compact binary format
- Fast serialization/deserialization
- Schema evolution support

---

## Debug & Diagnostics

### DiagnosticsService.ts

**Purpose**: System diagnostics and health checks

**Features**:
- System health monitoring
- Performance metrics
- Error tracking
- Log aggregation

### ErrorClassifier.ts

**Purpose**: Error classification and taxonomy

**Features**:
- Error categorization
- Root cause analysis
- Error severity assignment

---

## Presence Engine

### PresenceEngine.ts

**Purpose**: Manage AI presence state (silent, observing, reflecting, responding)

**Presence States**:
```typescript
type PresenceState = "SILENT" | "OBSERVING" | "REFLECTING" | "RESPONDING";
```

**State Transitions**:
- SILENT → OBSERVING: When user starts typing
- OBSERVING → REFLECTING: When user sends message
- REFLECTING → RESPONDING: When backend starts generating
- RESPONDING → SILENT: When response complete

---

## Tool Execution

### Tool Execution Flow

```
Model outputs tool_call
    ↓
ChatService receives via SSE
    ↓
ChatService.persistToolTrace()
    ↓
ToolExecutionService.executeNamespacedTool()
    ↓
GovernanceService.decideTool()
    ↓
McpOrchestrator.callTool()
    ↓
MCP server executes tool
    ↓
Result returned
    ↓
ChatService.updateToolTrace()
    ↓
Model receives result
    ↓
Model generates explanation
    ↓
Response streamed to UI
```

---

## Governance

### GovernanceService.ts

**Purpose**: Enforce governance rules for tool execution

**Governance Rules**:
- Tool allowlist/blocklist
- Server trust level
- Risk ceiling
- Proposal cap

**Governance Decision Flow**:
1. Check tool in allowlist
2. Check tool not in blocklist
3. Check server trust level
4. Check risk ceiling
5. Check proposal cap
6. Return decision with reason

---

## Error Handling

### Error Types

**Errors.ts**:
```typescript
type ErrorCategory =
  | "api_error"
  | "data_contract_violation"
  | "presence_spec_violation"
  | "governance_violation"
  | "ui_render_error"
  | "unknown";

interface AppError {
  id: string;
  category: ErrorCategory;
  createdAt: string;
  userMessage: string;
  diagnosticMessage?: string;
  canRetry: boolean;
}
```

### Error Classification

**McpErrorTaxonomy.ts**:
- `mcp_tool_not_found`
- `mcp_not_started`
- `mcp_not_ready`
- `mcp_permission_denied`
- `mcp_timeout`
- `mcp_parse_error`
- `mcp_network_error`

---

## Performance Optimizations

### UI Update Throttling

**ChatService.notify()**:
- Throttles to 33ms during streaming
- Prevents excessive re-renders
- Maintains responsiveness

### Message Pagination

**ChatPane.tsx**:
- Only renders last N messages (default: 50)
- "Load more" button for older messages
- Reduces DOM size for long sessions

### Event Queue

**Event Store**:
- Async queue for event writes
- Non-blocking event emission
- Background task flushes to disk

### Connection Reuse

**KnezClient.ts**:
- Reuses HTTP connections
- Connection pooling
- Reduces TCP handshake overhead

---

## Tauri Integration

### Tauri APIs Used

- **@tauri-apps/api/http**: HTTP requests
- **@tauri-apps/api/event**: Event system
- **@tauri-apps/plugin-shell**: Shell command execution
- **@tauri-apps/plugin-fs**: File system operations
- **@tauri-apps/plugin-dialog**: File dialogs

### Rust Backend

**src-tauri/src/**:
- MCP inspector integration
- Native event bridge
- Shell command execution
- File system operations

---

## Configuration

### Feature Flags

**config/features.ts**:
```typescript
export const features = {
  enableDebugPanel: true,
  enableTerminalMode: true,
  enableVoiceInput: true,
  enableMemorySync: true,
  enablePresenceEngine: true,
  // ... additional flags
};
```

### Connection Profiles

**LocalStorage Keys**:
- `knez_connection_profile`: Active profile ID
- `knez_session_id`: Current session ID

**Default Profile**:
```typescript
{
  id: "default",
  name: "Local KNEZ",
  endpoint: "http://127.0.0.1:8000",
  enabled: true,
}
```

---

## Known Issues & Limitations

### Current Limitations

1. **No Offline Mode**: Requires backend connection
2. **Limited Mobile Support**: Desktop-focused design
3. **Memory Bloat**: No cleanup for old sessions
4. **Event Log Growth**: events.log can grow unbounded
5. **Single Backend**: No multi-backend support in UI
6. **No Collaboration**: No multi-user support
7. **Limited Export**: No export to other formats

### Resolved Issues

1. **TypeScript Import Paths**: All import paths have been corrected to match the modularized service structure (Apr 2026)
2. **StreamController API**: Constructor and method signatures aligned with ChatService usage (Apr 2026)
3. **Tauri Build**: Clean build with 0 TypeScript errors achieved (Apr 2026)

### Potential Issues

1. **IndexedDB Quota**: Can hit storage limits with many sessions
2. **Memory Leaks**: Potential memory leaks in long-running sessions
3. **State Sync**: Complex state synchronization between services
4. **Error Recovery**: Limited error recovery mechanisms
5. **Performance**: Degraded performance with very long sessions

### Recommended Improvements

1. Add offline mode with local caching
2. Implement session archival and cleanup
3. Add event log rotation
4. Implement multi-backend UI support
5. Add collaboration features
6. Add export to PDF/Markdown
7. Implement memory leak detection
8. Add comprehensive error recovery
9. Optimize for very long sessions
10. Add mobile-responsive design

---

## Conclusion

knez-control-app is a well-structured, feature-rich frontend application that provides:

- **Modern React Architecture**: Feature-based organization, comprehensive state management
- **Modular Service Layer**: Services organized by domain (knez, mcp, chat, memory, agent, governance, etc.)
- **Chat Core Subsystem**: Dedicated infrastructure for stream control, response assembly, message storage, and request lifecycle
- **MCP Orchestration**: Centralized MCP server management with crash recovery
- **Tool Execution**: Governed tool execution with error classification and live status transitions
- **Debug Capabilities**: Comprehensive debug panel and diagnostics with tool call history
- **Memory Management**: Multiple memory services for different use cases
- **Presence Engine**: AI presence state management
- **Desktop Integration**: Tauri for native capabilities
- **Type Safety**: Comprehensive TypeScript typing with clean build

The architecture is solid and production-ready, with a recently completed modularization effort that reorganized the service layer into domain-specific subdirectories for improved maintainability.

---

**Document Version**: 1.1  
**Last Updated**: 2026-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-03 (Integration Patterns), DOC-04 (Component Analysis)
