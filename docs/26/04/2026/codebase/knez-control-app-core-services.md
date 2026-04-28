# knez-control-app Core Services Documentation

## Overview

Core services layer contains business logic for chat orchestration, backend communication, session management, and MCP orchestration.

## ChatService

**Location:** `src/services/ChatService.ts`

### Responsibilities
Central orchestration for chat lifecycle, message handling, streaming, and tool execution.

### Key Components
- **PhaseManager**: Manages execution phases (idle, sending, thinking, tool_running, streaming, finalizing, done, error, failed)
- **MessageStore**: Stores/retrieves messages with persistence
- **RequestController**: Prevents concurrent requests
- **StreamController**: Handles streaming responses

### Key Methods
- `sendMessage(text)`: Sends user message, orchestrates response workflow
- `editUserMessageAndResend(id, text)`: Edits and resends message
- `stopByAssistantMessageId(id)`: Stops ongoing response
- `retryByAssistantMessageId(id)`: Retries failed response
- `executeToolDeterministic(toolCall)`: Executes tool with error handling

### Workflow
1. User sends message → Phase: idle → sending
2. Send to backend → Phase: sending → thinking
3. Stream response → Phase: thinking → streaming
4. Handle tools → Phase: tool_running
5. Finalize → Phase: streaming → finalizing → done

## KnezClient

**Location:** `src/services/knez/KnezClient.ts`

### Responsibilities
HTTP communication with KNEZ backend, session management, health checks, memory operations.

### Connection Management
- Profile-based configuration with trust verification
- Fingerprint validation for security
- Session persistence via localStorage

### Key Methods
- `health()`: Backend health check with timeout
- `createNewLocalSession()`: Creates session via backend
- `ensureSession()`: Ensures valid session exists
- `validateSession(id)`: Validates session
- `listMemory(sessionId, options)`: Lists memory entries
- `getCognitiveState()`: Gets cognitive system state
- `tryGetMcpRegistry()`: Gets MCP server registry
- `emitEvent(args)`: Emits event to backend
- `forkSession(id, messageId)`: Forks session
- `resumeSession(id, snapshotId)`: Resumes from snapshot

### Error Handling
- Exponential backoff retry (3 attempts)
- Timeout handling with AbortController
- Shell fallback for Tauri runtime
- Response validation

## SessionController

**Location:** `src/services/session/SessionController.ts`

### Responsibilities
Session lifecycle management: creation, forking, resuming, switching.

### Key Methods
- `createNewSession()`: Creates new session
- `forkSession(id, messageId)`: Forks at message
- `resumeSession(id, snapshotId)`: Resumes from snapshot
- `switchSession(id)`: Switches to existing session

### Subscription
Emits session change events to subscribers.

## McpOrchestrator

**Location:** `src/mcp/McpOrchestrator.ts`

### Responsibilities
MCP server lifecycle, tool discovery, status monitoring.

### ServerRuntime
```typescript
{
  id: string;
  status: "running" | "stopped" | "crashed";
  pid?: number;
  lastOk?: number;
  lastError?: string;
  crashCount: number;
}
```

### Key Methods
- `startServer(id)`: Starts MCP server
- `stopServer(id)`: Stops MCP server
- `restartServer(id)`: Restarts server
- `getSnapshot()`: Gets current state snapshot

### Features
- Auto-start configuration
- Crash history tracking
- Status monitoring via McpInspectorService

## ToolExposureService

**Location:** `src/services/mcp/ToolExposureService.ts`

### Responsibilities
Tool catalog management, model compatibility filtering.

### Key Methods
- `getCatalog()`: Gets all available tools
- `getToolsForModel()`: Gets model-compatible tools
- `subscribe()`: Subscribes to catalog updates

## LogService

**Location:** `src/services/utils/LogService.ts`

### Responsibilities
Centralized logging with level filtering, throttling, MCP-specific logging.

### Log Levels
- debug, info, warn, error

### Key Methods
- `debug(category, message, data)`: Debug log
- `info(category, message, data)`: Info log
- `warn(category, message, data)`: Warning log
- `error(category, message, data)`: Error log
- `debugThrottled(key, interval, ...)`: Throttled logging
- `writeServerLog(serverId, ...)`: MCP server logging

## WebSocketClient

**Location:** `src/services/websocket/WebSocketClient.ts`

### Responsibilities
Real-time WebSocket connection for event streaming.

### Key Methods
- `connect(sessionId)`: Connects WebSocket
- `disconnect()`: Disconnects WebSocket
- `subscribe(eventType, callback)`: Subscribes to events

### Connection Types
- websocket, sse, hybrid (with fallback)

### Features
- Automatic reconnection with exponential backoff
- Event routing to subscribers
- Session-based authentication

## SessionDatabase

**Location:** `src/services/session/SessionDatabase.ts`

### Responsibilities
Dexie-based IndexedDB wrapper for session/message persistence.

### Schema
- **sessions**: id, name, created_at, updated_at
- **messages**: id, sessionId, from, text, timestamp, toolCall, metrics

### Key Methods
- `saveSession(session)`: Saves session
- `getSession(id)`: Retrieves session
- `saveMessages(id, messages)`: Saves messages
- `loadMessages(id)`: Loads messages
- `updateSessionName(id, name)`: Updates name

## Summary

Core services provide the business logic layer:
- **ChatService**: Chat orchestration
- **KnezClient**: Backend communication
- **SessionController**: Session management
- **McpOrchestrator**: MCP server management
- **ToolExposureService**: Tool catalog
- **LogService**: Logging
- **WebSocketClient**: Real-time events
- **SessionDatabase**: Persistence
