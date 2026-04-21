# MCP Logging Implementation Analysis & Plan

## Executive Summary

The control app's MCP logging system lacks the detailed lifecycle visibility that Trae IDE provides. Current logs show basic process events but miss connection details, tool execution context, and server-specific prefixes needed for effective debugging.

## Current State Analysis

### Existing Logging Infrastructure

**Files:**
- `src/mcp/client/McpStdioClient.ts` - STDIO MCP client with traffic logging
- `src/mcp/client/McpHttpClient.ts` - HTTP MCP client with traffic logging
- `src/mcp/inspector/McpTraffic.ts` - Traffic event types
- `src/mcp/inspector/McpInspectorService.ts` - Inspector orchestration
- `src/features/mcp/inspector/McpInspectorPanel.tsx` - UI log viewer
- `src/services/LogService.ts` - Central logging service

**Current Traffic Events:**
```typescript
export type McpTrafficEvent =
  | { kind: "raw_stdout"; at: number; text: string }
  | { kind: "raw_stderr"; at: number; text: string }
  | { kind: "parse_error"; at: number; framing: "content-length" | "line"; detail: string; preview: string }
  | { kind: "request"; at: number; id: string; method: string; json: any }
  | { kind: "response"; at: number; id: string; ok: boolean; json: any }
  | { kind: "unsolicited"; at: number; id: string | null; ok: boolean; json: any }
  | { kind: "process_closed"; at: number; code: number | null }
  | { kind: "spawn_error"; at: number; message: string };
```

### Current Logging Behavior

**McpStdioClient logs:**
```typescript
logger.info("mcp", "MCP process started", { programName, pid: this.child.pid });
logger.error("mcp", "MCP spawn error", { error: this.lastError });
logger.error("mcp", "MCP process shutdown", { code: evt.code ?? null, stderrTail });
```

**McpInspectorService logs:**
```typescript
logger.info("mcp_audit", "handshake_started", { serverId, authority, type });
logger.info("mcp_audit", "handshake_completed", { serverId, tools, initMs, toolsListMs });
logger.info("mcp_audit", "tool_call_started", { serverId, tool, traceId });
logger.info("mcp_audit", "tool_call_completed", { serverId, tool, durationMs });
```

### Current Log Display (McpInspectorPanel)

**Lifecycle logs are synthesized from traffic events:**
```typescript
const lifecycleLogs = useMemo(() => {
  // Detects initialize request/response
  // Detects tools/list request/response
  // Shows "Connecting:", "Connected.", "Listing tools...", "Got N tools: ..."
  // Shows process exit codes
}, [traffic]);
```

## Gaps & Issues

### Gap 1: Missing MCPServerManager-Style Lifecycle Logging

**Current:** Basic process events (started, stopped, crashed)
**Expected:** Granular lifecycle steps with method names

**Trae IDE Example:**
```
2026-04-20T21:50:56.089+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#start Connecting with config...
2026-04-20T21:50:56.092+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPClient#start Start With StdioServerParameters
2026-04-20T21:51:03.065+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#start Connected.
2026-04-20T21:51:03.066+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#listTools Listing tools...
2026-04-20T21:51:03.081+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#listTools Got tools: browser_close, browser_resize...
2026-04-20T21:58:58.608+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#callTool (browser_navigate): {"url":"..."}
2026-04-20T21:59:03.476+05:30 [info] [mcp.config.usrlocalmcp.playwright] MCPServerManager#callTool (browser_navigate) result: {...}
```

**Control App Current:**
```
[mcp] MCP process started { programName: "cmd", pid: 12345 }
[mcp_audit] handshake_started { serverId: "playwright", authority: "typescript" }
[mcp_audit] handshake_completed { serverId: "playwright", tools: 21, initMs: 450 }
[mcp_audit] tool_call_started { serverId: "playwright", tool: "browser_navigate" }
[mcp_audit] tool_call_completed { serverId: "playwright", tool: "browser_navigate", durationMs: 5000 }
```

### Gap 2: Missing Connection Parameter Details

**Current:** Logs server ID and basic info
**Expected:** Full connection parameters (command, args, env_keys, path)

**Trae IDE Example:**
```
MCPClient#start Start With StdioServerParameters {
  "command": "npx",
  "args": ["-y", "@playwright/mcp"],
  "cwd": "C:\\Users\\syedm",
  "stderr": "pipe",
  "env_keys": ["OPENAI_API_KEY", "PATH", ...],
  "path": "c:\\Users\\syedm\\.trae\\sdks\\...\\node\\current;..."
}
```

**Control App Current:**
```
MCP process started {
  programName: "cmd",
  serverId: "playwright",
  cwd: "C:\\Users\\syedm",
  command: "npx",
  pid: 12345
}
```

### Gap 3: Missing Server-Specific Log Prefix

**Current:** Generic category "mcp" or "mcp_audit"
**Expected:** Server-specific prefix `mcp.config.usrlocalmcp.{server_name}`

**Trae IDE Example:**
```
[mcp.config.usrlocalmcp.playwright] MCPServerManager#start
[mcp.config.usrlocalmcp.Puppeteer] MCPServerManager#start
```

**Control App Current:**
```
[mcp] MCP process started
[mcp_audit] handshake_started
```

### Gap 4: Missing Tool Execution Details in Logs

**Current:** Tool calls logged but without full request/response payloads in lifecycle view
**Expected:** Tool calls show full arguments and results in lifecycle logs

**Trae IDE Example:**
```
MCPServerManager#callTool (browser_navigate): {"url":"https://www.therealglow.in"}
MCPServerManager#callTool (browser_navigate) result: {
  "content": [{
    "type": "text",
    "text": "### Ran Playwright code\n```js\nawait page.goto('https://www.therealglow.in');\n```..."
  }]
}
```

**Control App Current:**
```
[mcp_audit] tool_call_started { serverId: "playwright", tool: "browser_navigate" }
[mcp_audit] tool_call_completed { serverId: "playwright", tool: "browser_navigate", durationMs: 5000 }
```

### Gap 5: Log Location Mismatch

**Current:** Logs written to `app-runtime.log` via LogService
**Expected:** Logs should be visible in the inspector panel with proper server filtering

**Trae IDE:** Logs are written to the IDE's output channel with MCP-specific formatting
**Control App:** Logs are in a separate file and not shown in the inspector panel's lifecycle view

## Root Cause Analysis

### Why Logging Is Different

1. **Architecture Difference**: Trae IDE uses a Rust-based MCP client with structured logging, while control app uses TypeScript clients with custom traffic events
2. **Log Aggregation**: Trae IDE has a centralized log aggregator that formats logs with server prefixes, while control app uses a generic LogService
3. **Traffic vs Lifecycle**: Control app separates traffic events (for inspector) from lifecycle logs (for LogService), while Trae IDE combines them
4. **Inspector Focus**: Control app's inspector focuses on traffic events, not lifecycle logs

### Why "refresh tools failed: mcp not initialized" Error

**Location:** `McpInspectorService.ts` line 585
```typescript
if (!s.initializedAt) throw new Error("mcp_not_initialized");
```

**Cause:** The server process is running but hasn't completed the MCP initialize handshake. This can happen when:
- Server starts but doesn't receive initialize request
- Initialize request times out
- Server crashes during initialization
- Server is in STARTING state but never transitions to INITIALIZED

**Current Logging:** Only shows "handshake_started" and "handshake_failed" if error occurs
**Missing:** Detailed step-by-step logging of initialization progress

## Implementation Plan

### Phase 1: Enhanced Log Categories & Prefixes

**Objective:** Add server-specific log categories

**Changes:**

1. **Update LogService to support nested categories:**
```typescript
// src/services/LogService.ts
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string; // Change to support "mcp.config.usrlocalmcp.playwright"
  message: string;
  details?: any;
}
```

2. **Add helper to generate server-specific category:**
```typescript
// src/mcp/inspector/McpInspectorService.ts
private getServerLogCategory(serverId: string): string {
  const authority = getMcpAuthority();
  if (authority === "rust") {
    return `mcp.config.usrlocalmcp.${serverId}`;
  }
  return `mcp.local.${serverId}`;
}
```

3. **Update all logger calls to use server-specific category:**
```typescript
// Before
logger.info("mcp", "MCP process started", { serverId, pid });

// After
logger.info(this.getServerLogCategory(serverId), "MCPServerManager#start", { 
  serverId, 
  pid,
  command: server.command,
  args: server.args
});
```

### Phase 2: Add MCPServerManager-Style Method Logging

**Objective:** Add granular lifecycle method names to logs

**Changes:**

1. **Add method name constants:**
```typescript
// src/mcp/inspector/McpLoggingConstants.ts
export const MCP_LOG_METHODS = {
  SERVER_START: "MCPServerManager#start",
  SERVER_STOP: "MCPServerManager#stop",
  CLIENT_START: "MCPClient#start",
  CLIENT_STOP: "MCPClient#stop",
  INITIALIZE: "MCPClient#initialize",
  LIST_TOOLS: "MCPServerManager#listTools",
  CALL_TOOL: "MCPServerManager#callTool",
} as const;
```

2. **Update McpStdioClient to use method names:**
```typescript
// src/mcp/client/McpStdioClient.ts
import { MCP_LOG_METHODS } from "../inspector/McpLoggingConstants";

async startWithConfig(server: McpServerConfig): Promise<void> {
  const category = this.getServerLogCategory(server.id);
  logger.info(category, MCP_LOG_METHODS.SERVER_START, {
    message: "Connecting with config...",
    command: server.command,
    args: server.args,
    cwd: server.cwd,
    env: Object.keys(server.env ?? {})
  });
  
  // ... existing code ...
  
  logger.info(category, MCP_LOG_METHODS.CLIENT_START, {
    message: "Start With StdioServerParameters",
    command: server.command,
    args: server.args,
    cwd: server.cwd,
    env_keys: Object.keys(server.env ?? {}),
    path: process.env.PATH
  });
  
  this.child = await cmd.spawn();
  
  logger.info(category, MCP_LOG_METHODS.SERVER_START, {
    message: "Connected.",
    pid: this.child.pid
  });
}
```

3. **Update McpHttpClient similarly:**
```typescript
async startWithConfig(server: McpServerConfig): Promise<void> {
  const category = this.getServerLogCategory(server.id);
  logger.info(category, MCP_LOG_METHODS.SERVER_START, {
    message: "Connecting with config...",
    url: server.url,
    headers: Object.keys(server.headers ?? {})
  });
  
  logger.info(category, MCP_LOG_METHODS.CLIENT_START, {
    message: "Start With HttpServerParameters",
    url: server.url,
    headers: server.headers
  });
  
  // ... existing code ...
  
  logger.info(category, MCP_LOG_METHODS.SERVER_START, {
    message: "Connected."
  });
}
```

### Phase 3: Add Full Connection Parameter Logging

**Objective:** Log all connection parameters in detail

**Changes:**

1. **Add parameter extraction helper:**
```typescript
// src/mcp/inspector/McpLoggingHelpers.ts
export function extractConnectionParams(server: McpServerConfig) {
  if (server.type === "http") {
    return {
      url: server.url,
      headers: server.headers,
      type: "http"
    };
  }
  return {
    command: server.command,
    args: server.args,
    cwd: server.cwd,
    env: server.env,
    env_keys: Object.keys(server.env ?? {}),
    path: process.env.PATH,
    type: "stdio"
  };
}
```

2. **Update startWithConfig to log full params:**
```typescript
async startWithConfig(server: McpServerConfig): Promise<void> {
  const category = this.getServerLogCategory(server.id);
  const params = extractConnectionParams(server);
  
  logger.info(category, MCP_LOG_METHODS.SERVER_START, {
    message: "Connecting with config...",
    ...params
  });
  
  // ... existing code ...
}
```

### Phase 4: Add Tool Execution Details to Lifecycle Logs

**Objective:** Log full tool request/response in lifecycle view

**Changes:**

1. **Update McpInspectorService.callTool to log details:**
```typescript
async callTool(
  serverId: string,
  name: string,
  args: any,
  optsOrTimeout: number | { timeoutMs?: number; traceId?: string; toolCallId?: string; correlationId?: string }
): Promise<{ result: any; durationMs: number }> {
  const category = this.getServerLogCategory(serverId);
  
  logger.info(category, MCP_LOG_METHODS.CALL_TOOL, {
    message: `(${name})`,
    arguments: args
  });
  
  try {
    const res = await s.client.callTool(name, args, { timeoutMs });
    const durationMs = Math.round(performance.now() - startedAt);
    
    logger.info(category, MCP_LOG_METHODS.CALL_TOOL, {
      message: `(${name}) result:`,
      result: res,
      durationMs
    });
    
    return { result: res, durationMs };
  } catch (e: any) {
    logger.error(category, MCP_LOG_METHODS.CALL_TOOL, {
      message: `(${name}) failed:`,
      error: String(e?.message ?? e),
      durationMs
    });
    throw e;
  }
}
```

### Phase 5: Update Inspector Panel to Show Lifecycle Logs

**Objective:** Display server-specific lifecycle logs in inspector

**Changes:**

1. **Add lifecycle log filtering in McpInspectorPanel:**
```typescript
// src/features/mcp/inspector/McpInspectorPanel.tsx

// Add state for showing LogService logs
const [showAppLogs, setShowAppLogs] = useState(false);
const appLogs = useMemo(() => {
  if (!selectedId) return [];
  const category = `mcp.local.${selectedId}`;
  return logger.getLogs().filter(log => log.category === category);
}, [selectedId]);

// Add tab for app logs
const logTabs: LogTab[] = ["lifecycle", "traffic", "stdout", "stderr", "parse", "app_logs"];

// Render app logs in new tab
{logTab === "app_logs" && (
  <div className="space-y-1">
    {appLogs.map((log) => (
      <div key={log.id} className={`text-xs ${log.level === "error" ? "text-red-300" : log.level === "warn" ? "text-yellow-200" : "text-zinc-300"}`}>
        <span className="text-zinc-500">{formatTime(log.timestamp)}</span>
        <span>{log.message}</span>
        {log.details && <pre className="text-[10px] bg-zinc-950 p-1 rounded">{JSON.stringify(log.details, null, 2)}</pre>}
      </div>
    ))}
  </div>
)}
```

2. **Update lifecycle logs to include LogService entries:**
```typescript
const lifecycleLogs = useMemo(() => {
  if (!selectedId) return [];
  const category = `mcp.local.${selectedId}`;
  const appLogsForServer = logger.getLogs().filter(log => log.category === category);
  
  // Combine traffic-based lifecycle logs with LogService logs
  const trafficLogs = /* existing traffic-based logic */;
  
  const combined = [
    ...appLogsForServer.map(log => ({
      at: new Date(log.timestamp).getTime(),
      level: log.level === "ERROR" ? "error" : log.level === "WARN" ? "warn" : "info",
      text: log.message,
      details: log.details
    })),
    ...trafficLogs
  ];
  
  combined.sort((a, b) => a.at - b.at);
  return combined.slice(Math.max(0, combined.length - trafficLimit));
}, [selectedId, trafficLimit]);
```

### Phase 6: Fix "mcp not initialized" Error Visibility

**Objective:** Make initialization errors visible in logs

**Changes:**

1. **Add detailed initialization progress logging:**
```typescript
// src/mcp/inspector/McpInspectorService.ts
async initialize(serverId: string): Promise<any> {
  const category = this.getServerLogCategory(serverId);
  const s = this.sessions.get(serverId);
  
  logger.info(category, MCP_LOG_METHODS.INITIALIZE, {
    message: "Starting initialization",
    running: s.client.getDebugState().running
  });
  
  if (!s.client.getDebugState().running) {
    logger.warn(category, MCP_LOG_METHODS.INITIALIZE, {
      message: "Server not running, starting first"
    });
    // ... start logic ...
  }
  
  const startedAt = performance.now();
  s.state = "STARTING";
  this.emit();
  
  logger.info(category, MCP_LOG_METHODS.INITIALIZE, {
    message: "Sending initialize request",
    protocolVersion: "2024-11-05"
  });
  
  try {
    const res = await s.client.initialize();
    
    logger.info(category, MCP_LOG_METHODS.INITIALIZE, {
      message: "Initialize response received",
      durationMs: Math.round(performance.now() - startedAt)
    });
    
    // ... rest of logic ...
  } catch (e: any) {
    logger.error(category, MCP_LOG_METHODS.INITIALIZE, {
      message: "Initialize failed",
      error: String(e?.message ?? e),
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw e;
  }
}
```

2. **Add initialization timeout logging:**
```typescript
// src/mcp/client/McpStdioClient.ts
async initialize(): Promise<any> {
  const category = this.getServerLogCategory(this.lastConfig?.id ?? "unknown");
  
  logger.info(category, MCP_LOG_METHODS.INITIALIZE, {
    message: "Initialize attempt starting",
    framing: this.requestFraming,
    protocolVersion: "2024-11-05",
    timeoutMs: initTimeoutMs
  });
  
  try {
    const res = await this.request("initialize", params, { 
      timeoutMs: initTimeoutMs, 
      stopOnTimeout: false, 
      logTimeoutLevel: "error",
      logTimeoutMessage: `MCP initialize timed out after ${initTimeoutMs}ms`
    });
    
    logger.info(category, MCP_LOG_METHODS.INITIALIZE, {
      message: "Initialize succeeded",
      framing: this.requestFraming,
      protocolVersion,
      attemptDurationMs: Math.round(performance.now() - attemptStartedAt)
    });
    
    return res;
  } catch (e: any) {
    logger.error(category, MCP_LOG_METHODS.INITIALIZE, {
      message: "Initialize attempt failed",
      framing: this.requestFraming,
      protocolVersion,
      error: String(e?.message ?? e),
      attemptDurationMs: Math.round(performance.now() - attemptStartedAt)
    });
    throw e;
  }
}
```

### Phase 7: Add Connection/Disconnection Lifecycle Logging

**Objective:** Log all connection state changes

**Changes:**

1. **Add connection state logging in McpStdioClient:**
```typescript
cmd.on("close", (evt) => {
  const category = this.getServerLogCategory(this.lastConfig?.id ?? "unknown");
  
  logger.info(category, MCP_LOG_METHODS.CLIENT_STOP, {
    message: "MCPClient#onClose",
    code: evt.code,
    isNormalShutdown,
    stderrTail: stderrTail.trim() || null
  });
  
  logger.info(category, MCP_LOG_METHODS.SERVER_STOP, {
    message: "Disconnected.",
    code: evt.code
  });
  
  // ... existing logic ...
});

cmd.on("error", (err) => {
  const category = this.getServerLogCategory(this.lastConfig?.id ?? "unknown");
  
  logger.error(category, MCP_LOG_METHODS.SERVER_START, {
    message: "MCPServerManager#onError",
    error: String(err?.message ?? err)
  });
  
  // ... existing logic ...
});
```

2. **Add similar logging for McpHttpClient:**
```typescript
// On fetch errors
logger.error(category, MCP_LOG_METHODS.CLIENT_STOP, {
  message: "MCPClient#onError",
  error: msg,
  status: res.status
});

logger.error(category, MCP_LOG_METHODS.SERVER_STOP, {
  message: "Disconnected.",
  error: msg
});
```

## Implementation Order

1. **Phase 1** - Log categories & prefixes (foundational)
2. **Phase 2** - Method names (logging structure)
3. **Phase 3** - Connection parameters (detail level)
4. **Phase 4** - Tool execution details (completeness)
5. **Phase 5** - Inspector panel updates (visibility)
6. **Phase 6** - Initialization error visibility (debugging)
7. **Phase 7** - Connection lifecycle (completeness)

## Expected Outcome

After implementation, logs should look like:

```
[mcp.local.playwright] MCPServerManager#start Connecting with config... {
  command: "npx",
  args: ["-y", "@playwright/mcp"],
  cwd: "C:\\Users\\syedm",
  env_keys: ["OPENAI_API_KEY", "PATH", ...],
  path: "c:\\Users\\syedm\\AppData\\Roaming\\npm;..."
}
[mcp.local.playwright] MCPClient#start Start With StdioServerParameters {
  command: "npx",
  args: ["-y", "@playwright/mcp"],
  cwd: "C:\\Users\\syedm",
  env_keys: ["OPENAI_API_KEY", "PATH", ...],
  path: "c:\\Users\\syedm\\AppData\\Roaming\\npm;..."
}
[mcp.local.playwright] MCPServerManager#start Connected. { pid: 12345 }
[mcp.local.playwright] MCPClient#initialize Initialize attempt starting {
  framing: "content-length",
  protocolVersion: "2024-11-05",
  timeoutMs: 30000
}
[mcp.local.playwright] MCPClient#initialize Initialize succeeded {
  framing: "content-length",
  protocolVersion: "2024-11-05",
  attemptDurationMs: 450
}
[mcp.local.playwright] MCPServerManager#listTools Listing tools...
[mcp.local.playwright] MCPServerManager#listTools Got tools: browser_close, browser_resize, browser_console_messages, ...
[mcp.local.playwright] MCPServerManager#callTool (browser_navigate) {
  arguments: { url: "https://www.therealglow.in" }
}
[mcp.local.playwright] MCPServerManager#callTool (browser_navigate) result: {
  content: [{ type: "text", text: "### Ran Playwright code..." }]
}
[mcp.local.playwright] MCPClient#onClose MCPClient#onClose {
  code: 0,
  isNormalShutdown: true,
  stderrTail: null
}
[mcp.local.playwright] MCPServerManager#stop Disconnected. { code: 0 }
```

## Files to Modify

1. `src/services/LogService.ts` - Support nested categories
2. `src/mcp/inspector/McpLoggingConstants.ts` - NEW: Method name constants
3. `src/mcp/inspector/McpLoggingHelpers.ts` - NEW: Parameter extraction helpers
4. `src/mcp/inspector/McpInspectorService.ts` - Use server-specific categories, detailed logging
5. `src/mcp/client/McpStdioClient.ts` - Add method names, detailed connection params
6. `src/mcp/client/McpHttpClient.ts` - Add method names, detailed connection params
7. `src/mcp/client/McpRustClient.ts` - Add method names if applicable
8. `src/features/mcp/inspector/McpInspectorPanel.tsx` - Show lifecycle logs from LogService

## Testing Strategy

1. **Unit Tests:** Verify log category generation, parameter extraction
2. **Integration Tests:** Start/stop MCP servers, verify log output
3. **UI Tests:** Verify inspector panel shows correct logs
4. **Error Scenarios:** Test initialization failures, timeouts, crashes

## Backward Compatibility

- All changes are additive (no breaking changes)
- Existing traffic event system remains unchanged
- LogService API remains compatible
- Inspector panel traffic view unchanged
