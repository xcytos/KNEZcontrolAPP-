# knez-control-app MCP Integration Documentation

## Overview

MCP (Model Control Plane) integration in knez-control-app provides the ability to manage MCP servers, discover tools, execute tools, and monitor tool execution.

## MCP Architecture

```
McpOrchestrator → Server lifecycle, tool discovery, status monitoring
McpStdioClient → JSON-RPC 2.0, process management, communication
McpInspectorService → Server monitoring, traffic logging, tool tracing
ToolExposureService → Tool catalog, model filtering, subscription updates
```

## McpOrchestrator

**Location:** `src/mcp/McpOrchestrator.ts`

### Responsibilities
Central coordinator for MCP server management.

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
- `startServer(id)`: Start MCP server
- `stopServer(id)`: Stop MCP server
- `restartServer(id)`: Restart server
- `getSnapshot()`: Get current state

### Features
- Auto-start configuration
- Crash history tracking
- Status monitoring via McpInspectorService

## McpStdioClient

**Location:** `src/mcp/client/McpStdioClient.ts`

### Responsibilities
STDIO-based MCP client with JSON-RPC 2.0 protocol.

### JSON-RPC 2.0
- Request: `{ jsonrpc: "2.0", id, method, params }`
- Response: `{ jsonrpc: "2.0", id, result }` or `{ jsonrpc: "2.0", id, error }`

### Key Methods
- `start(programName)`: Start server process
- `startWithConfig(server)`: Start with configuration
- `stop()`: Stop server process
- `initialize()`: Initialize handshake
- `notifyInitialized()`: Send initialized notification
- `request(method, params, options)`: Send JSON-RPC request

### Framing Modes
- **content-length**: Standard MCP framing with Content-Length header
- **line**: Line-delimited JSON for simpler servers

### Features
- Automatic framing detection
- Protocol version negotiation (2024-11-05, 1.0)
- Request chaining for sequential execution
- Timeout classification
- Traffic logging

## McpInspectorService

**Location:** `src/mcp/inspector/`

### Responsibilities
MCP server inspection and monitoring.

### Components
- **McpInspectorService**: Central inspection service
- **McpTraffic**: Traffic event types
- **McpLoggingConstants**: Logging categories
- **McpLoggingHelpers**: Logging utilities

### Features
- Server status monitoring
- Traffic logging and analysis
- Tool call tracing
- Health monitoring

## ToolExposureService

**Location:** `src/services/mcp/ToolExposureService.ts`

### Responsibilities
Tool catalog management and model compatibility filtering.

### Key Methods
- `getCatalog()`: Get all available tools
- `getToolsForModel()`: Get model-compatible tools
- `subscribe()`: Subscribe to catalog updates

### Features
- Tool catalog from all MCP servers
- Model compatibility filtering
- Subscription-based updates

## MCP Configuration

**Location:** `src/mcp/config/McpHostConfig.ts`

### Server Config
```typescript
interface McpServerConfig {
  id: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  autoStart?: boolean;
}
```

## MCP Authority

**Location:** `src/mcp/authority.ts`

### Authority Modes
- **rust**: Rust-based MCP management (Tauri plugin)
- **typescript**: TypeScript-based MCP management

### Features
- Authority detection
- Mode switching
- Fallback handling

## MCP Logging

**Location:** `src/mcp/inspector/McpLoggingConstants.ts`

### Log Categories
- `PREFIX_LOCAL(serverId)`: Server-specific logging
- `GENERIC`: Generic MCP logging

### Log Methods
- `SERVER_START`: Server start events
- `SERVER_STOP`: Server stop events
- `CLIENT_START`: Client start events
- `CLIENT_STOP`: Client stop events
- `REQUEST`: JSON-RPC requests
- `RESPONSE`: JSON-RPC responses
- `INITIALIZE`: Initialize handshake
- `INITIALIZE_ATTEMPT`: Initialize attempts

## MCP Traffic

**Location:** `src/mcp/inspector/McpTraffic.ts`

### Traffic Event Types
- `request`: JSON-RPC request
- `response`: JSON-RPC response
- `raw_stdout`: Raw stdout data
- `raw_stderr`: Raw stderr data
- `process_closed`: Process closed
- `spawn_error`: Spawn error
- `parse_error`: Parse error
- `unsolicited`: Unsolicited response

## Tool Execution Flow

1. **Tool Call Request**: ChatService requests tool execution
2. **Server Selection**: McpOrchestrator selects server
3. **Request Send**: McpStdioClient sends JSON-RPC request
4. **Response Receive**: McpStdioClient receives response
5. **Status Update**: Tool status updated in ChatService
6. **Result Return**: Tool result returned to ChatService

## Error Handling

### Timeout Classification
- Method-specific timeout classification
- Context-aware error messages
- Automatic server restart on timeout

### Process Errors
- Spawn errors logged
- Crash detection via exit code
- Automatic status update to "crashed"

### Communication Errors
- JSON parse errors logged
- Unsolicited responses logged
- Request timeout handling

## Summary

MCP integration provides:
- **McpOrchestrator**: Server lifecycle management
- **McpStdioClient**: JSON-RPC 2.0 client
- **McpInspectorService**: Monitoring and inspection
- **ToolExposureService**: Tool catalog management
