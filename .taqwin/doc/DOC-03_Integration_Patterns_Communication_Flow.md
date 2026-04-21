# DOC-03: Integration Patterns & Communication Flow

## Executive Summary

This document describes the integration patterns and communication flow between the KNEZ backend (Python/FastAPI) and the knez-control-app frontend (React/Tauri). It covers HTTP API communication, Server-Sent Events (SSE) streaming, event-driven architecture, MCP tool execution, session management, memory synchronization, and error handling patterns.

## Table of Contents

1. [Communication Architecture](#communication-architecture)
2. [HTTP API Integration](#http-api-integration)
3. [Server-Sent Events (SSE) Streaming](#server-sent-events-sse-streaming)
4. [Event-Driven Communication](#event-driven-communication)
5. [MCP Tool Execution Flow](#mcp-tool-execution-flow)
6. [Session Management Flow](#session-management-flow)
7. [Memory Synchronization](#memory-synchronization)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Connection Management](#connection-management)
10. [Authentication & Authorization](#authentication--authorization)
11. [Data Serialization](#data-serialization)
12. [State Synchronization](#state-synchronization)
13. [Performance Optimization Patterns](#performance-optimization-patterns)
14. [Retry & Fallback Patterns](#retry--fallback-patterns)
15. [Tauri Integration](#tauri-integration)
16. [Sequence Diagrams](#sequence-diagrams)
17. [Communication Protocols](#communication-protocols)
18. [Integration Issues & Solutions](#integration-issues--solutions)

---

## Communication Architecture

### Overview

The KNEZ system uses a multi-protocol communication architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                  knez-control-app (Frontend)              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  React UI    │  │ ChatService  │  │ KnezClient   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                  │                  │           │
│         └──────────────────┴──────────────────┘           │
│                            │                              │
│                    ┌───────▼────────┐                   │
│                    │  Tauri Bridge  │                   │
│                    └───────┬────────┘                   │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  HTTP / SSE     │
                    └────────┬────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                    ┌────────▼────────┐                   │
│                  KNEZ Backend (Python)                  │
│                    ┌────────────────┐                   │
│                    │ FastAPI App    │                   │
│                    └────────┬───────┘                   │
│                             │                              │
│                    ┌────────▼────────┐                   │
│                    │  API Router     │                   │
│                    └────────┬───────┘                   │
│                             │                              │
│                    ┌────────▼────────┐                   │
│                    │  Service Layer  │                   │
│                    └────────┬───────┘                   │
│                             │                              │
│                    ┌────────▼────────┐                   │
│                    │  Model Backend  │                   │
│                    └─────────────────┘                   │
└────────────────────────────────────────────────────────────┘
```

### Communication Protocols

1. **HTTP REST API**: Request/response for non-streaming operations
2. **Server-Sent Events (SSE)**: Streaming chat completions
3. **Tauri IPC**: Native bridge for desktop capabilities
4. **WebSocket (planned)**: Real-time bidirectional communication

---

## HTTP API Integration

### Base URL Configuration

**KnezClient.ts**:
```typescript
const DEFAULT_PROFILE: ConnectionProfile = {
  id: "default",
  name: "Local KNEZ",
  endpoint: "http://127.0.0.1:8000",
  enabled: true,
};

const PROFILE_STORAGE_KEY = "knez_connection_profile";
```

**Profile Management**:
- Profiles stored in LocalStorage
- Active profile selected via UI
- Multiple profiles supported (local, cloud A, cloud B, cloud C)

### HTTP Client Implementation

**KnezClient.ts** uses two HTTP clients:

**Primary: @tauri-apps/api/http**
```typescript
import { fetch as tauriFetch } from "@tauri-apps/api/http";

async health(): Promise<HealthResponse> {
  const profile = this.getCurrentProfile();
  const response = await tauriFetch(`${profile.endpoint}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}
```

**Fallback: Native Fetch**
```typescript
async health(): Promise<HealthResponse> {
  const profile = this.getCurrentProfile();
  const response = await fetch(`${profile.endpoint}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}
```

### API Endpoints

| Endpoint | Method | Purpose | Frontend Method |
|----------|--------|---------|----------------|
| `/health` | GET | Health check | `KnezClient.health()` |
| `/identity` | GET | Instance identity | `KnezClient.identity()` |
| `/governance/snapshot` | GET | Governance config | `KnezClient.governanceSnapshot()` |
| `/v1/chat/completions` | POST | Chat completion (streaming) | `KnezClient.chatCompletion()` |
| `/sessions/{id}/resume` | POST | Resume session | `KnezClient.sessionResume()` |
| `/sessions/{id}/fork` | POST | Fork session | `KnezClient.sessionFork()` |
| `/sessions/{id}/lineage` | GET | Session lineage | `KnezClient.sessionLineage()` |
| `/sessions/{id}/tools` | GET | Tool calls | `KnezClient.sessionTools()` |
| `/sessions/{id}/checkpoints` | GET | Checkpoints | `KnezClient.sessionCheckpoints()` |
| `/events` | GET | Query events | `KnezClient.events()` |
| `/memory` | GET | Query memory | `KnezClient.memory()` |
| `/memory` | POST | Add memory | `KnezClient.addMemory()` |
| `/memory/knowledge` | GET | List knowledge | `KnezClient.listKnowledge()` |
| `/memory/knowledge` | POST | Add knowledge | `KnezClient.addKnowledge()` |
| `/memory/gate/check` | POST | Trigger memory gate | `KnezClient.checkMemoryGate()` |

### Request/Response Patterns

**Standard Request Pattern**:
```typescript
async callEndpoint<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const profile = this.getCurrentProfile();
  const url = `${profile.endpoint}${endpoint}`;
  
  try {
    const response = await tauriFetch(url, {
      method: options?.method || "GET",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.data}`);
    }
    
    return response.data as T;
  } catch (error) {
    // Fallback to shell command if fetch fails
    return this.fallbackToShell(endpoint, options);
  }
}
```

**Error Handling Pattern**:
```typescript
try {
  const result = await knezClient.health();
  // Handle success
} catch (error) {
  if (error.message.includes("ECONNREFUSED")) {
    // Backend not running
    showToast("KNEZ backend not available", "error");
  } else if (error.message.includes("timeout")) {
    // Request timeout
    showToast("Request timed out", "warning");
  } else {
    // Unknown error
    showToast("Communication error", "error");
  }
}
```

---

## Server-Sent Events (SSE) Streaming

### SSE Implementation

**KnezClient.chatCompletion()**:
```typescript
async *chatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamEvent, void> {
  const profile = this.getCurrentProfile();
  const url = `${profile.endpoint}/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          return; // Stream complete
        }
        
        try {
          const event = JSON.parse(data);
          yield event;
        } catch (e) {
          console.error("Failed to parse SSE event:", data);
        }
      }
    }
  }
}
```

### Stream Event Types

**Backend Event Types** (completions.py):
```python
# Token event
{
  "type": "token",
  "content": "Hello",
  "index": 0
}

# Tool call event
{
  "type": "tool_call",
  "tool": "puppeteer_navigate",
  "args": {"url": "https://example.com"},
  "call_id": "tc_123"
}

# Tool call completed event
{
  "type": "tool_call_completed",
  "call_id": "tc_123",
  "ok": true,
  "result": {...},
  "execution_time_ms": 1234
}

# Done event
{
  "type": "done",
  "finish_reason": "stop",
  "total_tokens": 100
}
```

### Frontend Stream Processing

**ChatService.runPromptToolLoop()**:
```typescript
async runPromptToolLoop(sessionId: string, messages: ChatMessage[]) {
  this.setPhase("sending");
  
  const stream = knezClient.chatCompletion({
    messages: messages.map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
    stream: true,
  });
  
  let currentMessage: ChatMessage | null = null;
  let toolCallId: string | null = null;
  
  for await (const event of stream) {
    switch (event.type) {
      case "token":
        this.setPhase("streaming");
        if (!currentMessage) {
          currentMessage = this.createAssistantMessage();
        }
        currentMessage.text += event.content;
        this.appendToMessage(currentMessage);
        break;
        
      case "tool_call":
        this.setPhase("tool_running");
        toolCallId = event.call_id;
        const toolMessage = this.persistToolTrace({
          tool: event.tool,
          args: event.args,
          status: "pending",
        });
        break;
        
      case "tool_call_completed":
        this.updateToolTrace(toolCallId!, {
          status: event.ok ? "succeeded" : "failed",
          result: event.result,
          executionTimeMs: event.execution_time_ms,
        });
        break;
        
      case "done":
        this.setPhase("done");
        if (currentMessage) {
          currentMessage.metrics = {
            totalTokens: event.total_tokens,
            finishReason: event.finish_reason,
          };
          this.finalizeMessage(currentMessage);
        }
        break;
    }
  }
}
```

### SSE Reconnection Logic

**Not Currently Implemented** - Future Enhancement:
```typescript
class SSEStream {
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  
  async connect(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      this.retryCount = 0;
      return response.body!.getReader();
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryCount));
        return this.connect(url);
      }
      throw error;
    }
  }
}
```

---

## Event-Driven Communication

### Backend Event System

**Event Schema** (events/schema.py):
```python
@dataclass(frozen=True)
class Event:
    event_id: str
    timestamp: str
    session_id: Optional[str]
    task_id: Optional[str]
    event_type: EventType
    event_name: str
    source: EventSource
    severity: EventSeverity
    payload: Dict[str, Any]
    tags: List[str]
```

**Event Types**:
- `INPUT`: User input received
- `ANALYSIS`: System analysis
- `DECISION`: System decision
- `ACTION`: Action taken
- `REFLECTION`: Reflection on outcome
- `PERSISTENCE`: Data persistence
- `ERROR`: Error occurred

### Event Emission

**Backend**:
```python
emitter = get_emitter()
emitter.emit(
    session_id="abc123",
    task_id=None,
    event_type=EventType.ACTION,
    event_name="tool_call_completed",
    source=EventSource.TOOL,
    severity=EventSeverity.INFO,
    payload={
        "tool": "puppeteer_navigate",
        "ok": True,
        "duration_ms": 1234,
    },
    tags=["tool", "mcp"],
)
```

### Event Querying

**Frontend**:
```typescript
async function queryEvents(filters: EventFilters): Promise<Event[]> {
  return await knezClient.events({
    session_id: filters.sessionId,
    event_type: filters.eventType,
    since: filters.since,
    limit: filters.limit || 100,
  });
}
```

### Event Store

**Backend** (events/store.py):
- Async queue-based write (max 1000 events)
- Background task flushes to events.log
- JSON line format for easy parsing
- Supports tail queries with filters

**Frontend Usage**:
- Debug panel queries events for session
- Timeline visualization uses events
- Replay system reconstructs from events

---

## MCP Tool Execution Flow

### Tool Execution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (knez-control-app)              │
│                                                              │
│  Model outputs tool_call via SSE                            │
│           │                                                  │
│           ▼                                                  │
│  ChatService.persistToolTrace()                              │
│           │                                                  │
│           ▼                                                  │
│  ToolExecutionService.executeNamespacedTool()               │
│           │                                                  │
│           ├─► GovernanceService.decideTool()                │
│           │       │                                          │
│           │       └─► Allowed?                              │
│           │                                                  │
│           ▼                                                  │
│  McpOrchestrator.callTool()                                 │
│           │                                                  │
│           ▼                                                  │
│  McpInspectorService.callTool()                             │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Tauri Rust Bridge                       │  │
│  └──────────────────────────────────────────────────────┘  │
│           │                                                  │
│           ▼                                                  │
│  MCP Server (stdio/http)                                   │
│           │                                                  │
│           ▼                                                  │
│  Tool Execution                                              │
│           │                                                  │
│           ▼                                                  │
│  Result returned                                            │
│           │                                                  │
│           ▼                                                  │
│  ChatService.updateToolTrace()                              │
│           │                                                  │
│           ▼                                                  │
│  Model receives result via SSE                              │
└─────────────────────────────────────────────────────────────┘
```

### Tool Execution Sequence

**1. Model Outputs Tool Call** (SSE):
```json
{
  "type": "tool_call",
  "tool": "puppeteer_navigate",
  "args": {"url": "https://example.com"},
  "call_id": "tc_123"
}
```

**2. Frontend Creates Tool Trace**:
```typescript
const toolMessage = await chatService.persistToolTrace({
  tool: "puppeteer_navigate",
  args: {"url": "https://example.com"},
  status: "pending",
  startedAt: new Date().toISOString(),
});
```

**3. Governance Check**:
```typescript
const decision = await governanceService.decideTool(toolMeta, serverRuntime);
if (!decision.allowed) {
  return {
    ok: false,
    kind: "denied",
    error: { code: "mcp_permission_denied", message: decision.reason },
  };
}
```

**4. Tool Execution**:
```typescript
const result = await mcpOrchestrator.callTool(
  serverId,
  "puppeteer_navigate",
  {"url": "https://example.com"},
  { timeoutMs: 180000, toolCallId: "tc_123" }
);
```

**5. Result Returned**:
```typescript
return {
  ok: true,
  kind: "succeeded",
  tool: { namespacedName, serverId, originalName },
  durationMs: result.durationMs,
  result: result.result,
};
```

**6. Tool Trace Updated**:
```typescript
await chatService.updateToolTrace(toolMessage.id, {
  status: "succeeded",
  result: result.result,
  executionTimeMs: result.durationMs,
  finishedAt: new Date().toISOString(),
});
```

**7. Model Receives Result** (SSE):
```json
{
  "type": "tool_call_completed",
  "call_id": "tc_123",
  "ok": true,
  "result": {...},
  "execution_time_ms": 1234
}
```

### Tool Naming Convention

**Namespaced Format**: `serverId__toolName`

**Examples**:
- `puppeteer__navigate`
- `filesystem__read_file`
- `search__web_search`

**Resolution**:
```typescript
function resolveNamespacedName(namespacedName: string): { serverId: string; originalName: string } {
  const parts = namespacedName.split("__");
  if (parts.length !== 2) {
    throw new Error("Invalid namespaced name format");
  }
  return { serverId: parts[0], originalName: parts[1] };
}
```

---

## Session Management Flow

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. Create Session                                          │
│     └─► POST /sessions/{id}/resume (fresh mode)            │
│          └─► Returns session_id, lineage                   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  2. Chat Completion                                         │
│     └─► POST /v1/chat/completions (with session_id)        │
│          └─► SSE stream of tokens and tool calls           │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  3. Resume Session                                          │
│     └─► POST /sessions/{id}/resume (resume mode)           │
│          └─► Returns new session_id, resume_snapshot        │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  4. Fork Session                                            │
│     └─► POST /sessions/{id}/fork                           │
│          └─► Returns new session_id, parent_session_id      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  5. Query Lineage                                           │
│     └─► GET /sessions/{id}/lineage                        │
│          └─► Returns chain of parent sessions               │
└─────────────────────────────────────────────────────────────┘
```

### Session Resume

**Frontend**:
```typescript
async resumeSession(sessionId: string, options: ResumeOptions) {
  const result = await knezClient.sessionResume(sessionId, {
    resume_reason: options.reason,
    agent_id: options.agentId,
    perspective_notes: options.notes,
    emphasis: options.emphasis,
  });
  
  // Switch to new session
  await sessionController.switchSession(result.new_session_id);
  
  // Load resume snapshot into context
  await this.loadResumeSnapshot(result.snapshot);
  
  return result;
}
```

**Backend** (sessions.py):
```python
@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str, body: ResumeRequest):
    # Compile resume snapshot from events
    snapshot = await compile_resume_snapshot_for_session(session_id)
    
    # Create new session
    new_session_id = uuid.uuid4().hex
    
    # Record lineage
    lineage = await record_session_lineage(
        session_id=new_session_id,
        parent_session_id=session_id,
        resume_snapshot_id=snapshot.snapshot_id,
        resume_mode="resumed",
        resume_reason=body.resume_reason,
    )
    
    return {
        "parent_session_id": session_id,
        "new_session_id": new_session_id,
        "resume_snapshot_id": snapshot.snapshot_id,
        "snapshot": snapshot,
    }
```

### Resume Snapshot Structure

```python
@dataclass
class ResumeSnapshot:
    snapshot_id: str
    source_session_id: str
    high_level_task_state: Optional[str]
    accepted_facts: List[Dict[str, Any]]
    constraints: List[Dict[str, Any]]
    open_questions: List[Dict[str, Any]]
    agent_context: Optional[Dict[str, Any]]
    created_at: float
```

### Session Fork

**Frontend**:
```typescript
async forkSession(sessionId: string, reason?: string) {
  const result = await knezClient.sessionFork(sessionId, {
    resume_reason: reason,
  });
  
  // Switch to forked session
  await sessionController.switchSession(result.new_session_id);
  
  return result;
}
```

**Backend**:
```python
@router.post("/sessions/{session_id}/fork")
async def fork_session(session_id: str, body: ForkRequest):
    new_session_id = uuid.uuid4().hex
    
    lineage = await record_session_lineage(
        session_id=new_session_id,
        parent_session_id=session_id,
        resume_snapshot_id=None,
        resume_mode="forked",
        resume_reason=body.resume_reason,
    )
    
    return {
        "parent_session_id": session_id,
        "new_session_id": new_session_id,
        "resume_mode": "forked",
    }
```

---

## Memory Synchronization

### Memory API Integration

**Frontend**:
```typescript
// Query memory
const memories = await knezClient.memory({
  session_id: sessionId,
  memory_type: "fact",
  limit: 100,
});

// Add memory
await knezClient.addMemory({
  summary: "User prefers dark mode",
  confidence: 0.9,
  evidence_event_ids: ["evt_123"],
  session_id: sessionId,
  memory_type: "preference",
});

// Trigger memory gate
const candidates = await knezClient.checkMemoryGate({
  session_id: sessionId,
});
```

**Backend** (memory/api.py):
```python
@router.get("/memory")
async def list_memory(
    session_id: Optional[str] = None,
    memory_type: Optional[str] = None,
    limit: int = 100,
):
    store = get_memory_store()
    records = await store.query(
        session_id=session_id,
        memory_type=memory_type,
        limit=limit,
    )
    return [_candidate_to_dict(m) for m in records]

@router.post("/memory")
async def add_memory(payload: Dict[str, Any]):
    store = get_memory_store()
    memory = MemoryCandidate(
        memory_id=payload.get("memory_id"),
        summary=payload.get("summary"),
        confidence=float(payload.get("confidence", 0.5)),
        evidence_event_ids=payload.get("evidence_event_ids", []),
        session_id=payload.get("session_id", "unknown"),
        memory_type=payload.get("memory_type", "fact"),
    )
    await store.add(memory)
    return _candidate_to_dict(memory)
```

### Memory Gate Processing

**Purpose**: Process session events to extract memory candidates

**Flow**:
1. Collect events for session
2. Analyze patterns and facts
3. Generate memory candidates
4. Score confidence
5. Apply retention policy
6. Persist to memory store

**Frontend Trigger**:
```typescript
// After chat completion
await knezClient.checkMemoryGate({ session_id: currentSessionId });
```

### Knowledge Base Integration

**Frontend**:
```typescript
// Add document to knowledge base
await knezClient.addKnowledge({
  title: "Project Documentation",
  content: "...",
  tags: ["docs", "project"],
});

// List knowledge base
const knowledge = await knezClient.listKnowledge();
```

**Backend**:
```python
@router.post("/memory/knowledge")
async def add_knowledge(document: Dict[str, Any]):
    store = get_knowledge_store()
    doc = {
        "id": f"doc-{uuid4().hex[:8]}",
        "title": document.get("title", "Untitled"),
        "content": document.get("content", ""),
        "tags": document.get("tags", []),
        "status": "indexed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return await store.add(doc)
```

---

## Error Handling Patterns

### Error Classification

**Backend**:
```python
class BackendFailure(Exception):
    """Raised when backend generation fails"""
    pass

class RouterFailure(Exception):
    """Raised when router selection fails"""
    pass
```

**Frontend** (Errors.ts):
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

### Error Propagation

**Backend → Frontend**:
```python
# Backend raises HTTP exception
raise HTTPException(status_code=500, detail="Backend failure")

# Frontend catches and classifies
try {
  await knezClient.chatCompletion(request);
} catch (error) {
  const classified = errorClassifier.classify(error);
  if (classified.canRetry) {
    // Retry logic
  } else {
    // Show error to user
    showToast(classified.userMessage, "error");
  }
}
```

### MCP Error Taxonomy

**Frontend** (McpErrorTaxonomy.ts):
```typescript
function classifyMcpError(message: string): McpErrorClassification {
  if (message.includes("tool not found")) {
    return { code: "mcp_tool_not_found", message: "Tool not found" };
  }
  if (message.includes("not started")) {
    return { code: "mcp_not_started", message: "MCP server not started" };
  }
  if (message.includes("timeout")) {
    return { code: "mcp_timeout", message: "Tool execution timeout" };
  }
  return { code: "mcp_unknown", message: "Unknown MCP error" };
}
```

---

## Connection Management

### Connection Profiles

**Profile Structure**:
```typescript
interface ConnectionProfile {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  createdAt: string;
}
```

**Default Profiles**:
```typescript
const DEFAULT_PROFILES: ConnectionProfile[] = [
  {
    id: "local",
    name: "Local KNEZ",
    endpoint: "http://127.0.0.1:8000",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cloud-a",
    name: "Cloud A",
    endpoint: "http://localhost:8001",
    enabled: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cloud-b",
    name: "Cloud B",
    endpoint: "http://localhost:8002",
    enabled: false,
    createdAt: new Date().toISOString(),
  },
];
```

### Health Monitoring

**Frontend** (StatusProvider.tsx):
```typescript
useEffect(() => {
  const checkHealth = async () => {
    try {
      const health = await knezClient.health();
      setOnline(true);
      setHealth(health);
    } catch (error) {
      setOnline(false);
      setHealth(null);
    }
  };
  
  checkHealth();
  const interval = setInterval(checkHealth, 5000); // Check every 5s
  
  return () => clearInterval(interval);
}, []);
```

**Backend Health Response**:
```json
{
  "status": "ok",
  "model": "available",
  "backends": [
    {
      "model_id": "llama3.1",
      "latency_ms": 123.45,
      "tokens_per_sec": 45.6,
      "status": "healthy"
    }
  ]
}
```

### Connection Failover

**Not Currently Implemented** - Future Enhancement:
```typescript
class ConnectionManager {
  private profiles: ConnectionProfile[];
  private currentProfile: ConnectionProfile;
  private retryCount = 0;
  
  async requestWithFailover<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      if (this.retryCount < this.profiles.length) {
        this.retryCount++;
        this.currentProfile = this.profiles[this.retryCount - 1];
        return this.requestWithFailover(request);
      }
      throw error;
    }
  }
}
```

---

## Authentication & Authorization

### Current State

**No Authentication Implemented**

### Future Authentication Design

**JWT Token Pattern**:
```typescript
interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

class AuthClient {
  private token: AuthToken | null = null;
  
  async login(username: string, password: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    this.token = await response.json();
    localStorage.setItem("auth_token", JSON.stringify(this.token));
  }
  
  getAuthHeaders(): HeadersInit {
    if (!this.token) return {};
    
    if (this.isExpired()) {
      await this.refreshToken();
    }
    
    return { Authorization: `Bearer ${this.token.access_token}` };
  }
  
  private isExpired(): boolean {
    return Date.now() > this.token!.expires_in * 1000;
  }
  
  private async refreshToken(): Promise<void> {
    const response = await fetch(`${this.endpoint}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token!.refresh_token}` },
    });
    
    this.token = await response.json();
  }
}
```

---

## Data Serialization

### JSON Serialization

**Backend**: Pydantic models for validation
```python
class GenerationRequest(BaseModel):
    messages: list[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: bool = True
    tools: Optional[list] = None
```

**Frontend**: TypeScript interfaces
```typescript
interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: any[];
}
```

### Binary Serialization (Future)

**Memory Binary Serialization Service**:
```typescript
class MemoryBinarySerializationService {
  serialize(memory: MemoryCandidate): Uint8Array {
    // Compact binary format
    const encoder = new TextEncoder();
    const json = JSON.stringify(memory);
    return encoder.encode(json);
  }
  
  deserialize(bytes: Uint8Array): MemoryCandidate {
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    return JSON.parse(json);
  }
}
```

---

## State Synchronization

### Service State Pattern

**ChatService**:
```typescript
class ChatService {
  private state: ChatState;
  private subscribers = new Set<(state: ChatState) => void>();
  
  subscribe(fn: (state: ChatState) => void): () => void {
    this.subscribers.add(fn);
    fn(this.state); // Initial call
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

### UI Subscription

**ChatPane**:
```typescript
useEffect(() => {
  const unsub = chatService.subscribe((state) => {
    setMessages(state.messages);
    setAssistantMessages(state.assistantMessages);
    setPhase(state.phase);
    setActiveTools(state.activeTools);
    setSearchProvider(state.searchProvider);
  });
  
  return unsub;
}, [sessionId]);
```

### MCP State Synchronization

**McpOrchestrator**:
```typescript
class McpOrchestrator {
  private snapshot: McpOrchestratorSnapshot;
  private subscribers = new Set<() => void>();
  
  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    fn(); // Initial call
    return () => this.subscribers.delete(fn);
  }
  
  private emit() {
    for (const fn of this.subscribers) {
      try {
        fn();
      } catch {}
    }
  }
  
  private rebuildFromInspector() {
    const authority = getMcpAuthority();
    const statusById = mcpInspectorService.getStatusById();
    // Rebuild snapshot
    this.snapshot = { servers: /* ... */ };
    this.emit();
  }
}
```

---

## Performance Optimization Patterns

### UI Update Throttling

**ChatService.notify()**:
```typescript
private notify() {
  const now = Date.now();
  if (this.phase === "streaming") {
    // Throttle to 33ms during streaming
    if (now - this.lastNotifyTime < 33) {
      return;
    }
  }
  
  this.lastNotifyTime = now;
  for (const fn of this.subscribers) {
    fn(this.state);
  }
}
```

### Message Pagination

**ChatPane**:
```typescript
const [visibleCount, setVisibleCount] = useState(50);

const hiddenCount = Math.max(0, messages.length - visibleCount);
const visibleMessages = messages.slice(-visibleCount);

// Load more button
const handleLoadMore = () => {
  setVisibleCount(prev => prev + 50);
};
```

### Connection Pooling

**KnezClient** (via Tauri):
- Tauri HTTP client automatically pools connections
- Reduces TCP handshake overhead
- Prevents CLOSE_WAIT accumulation

### Event Queue

**Backend Event Store**:
```python
class EventStore:
    def __init__(self, max_queue_size: int = 1000):
        self._queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=max_queue_size)
    
    def emit(self, event: Event) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            self._dropped += 1  # Drop if queue full
```

---

## Retry & Fallback Patterns

### HTTP Retry Pattern

**KnezClient**:
```typescript
async requestWithRetry<T>(
  request: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

### Shell Command Fallback

**KnezClient**:
```typescript
async health(): Promise<HealthResponse> {
  try {
    return await this.httpHealth();
  } catch (error) {
    // Fallback to shell command
    return await this.shellHealth();
  }
}

private async shellHealth(): Promise<HealthResponse> {
  const command = new Command("curl", [
    `${this.getCurrentProfile().endpoint}/health`
  ]);
  
  const output = await command.execute();
  return JSON.parse(output.stdout);
}
```

### Backend Failover

**Backend Router**:
```python
async def select_backend(self, request: GenerationRequest):
    try:
        # Try primary backend
        return await self._select_best_backend(request)
    except BackendFailure as primary_err:
        # Fallback to backup
        fallback = await self._select_fallback_backend(request)
        emitter.emit(
            event_name="failover_triggered",
            payload={
                "from_backend": primary.backend_id,
                "to_backend": fallback.model_id,
                "reason": str(primary_err),
            }
        )
        return fallback
```

---

## Tauri Integration

### Tauri HTTP Client

**Usage**:
```typescript
import { fetch } from "@tauri-apps/api/http";

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

**Advantages**:
- Native HTTP client
- Better performance on desktop
- System proxy support
- Certificate validation

### Tauri Shell Integration

**Terminal Execution**:
```typescript
import { Command } from "@tauri-apps/plugin-shell";

const command = new Command("powershell", ["Get-Location"]);
const output = await command.execute();
console.log(output.stdout);
```

### Tauri Event Bridge

**Rust → TypeScript**:
```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<string>("mcp-event", (event) => {
  console.log("MCP event:", event.payload);
});
```

**TypeScript → Rust**:
```typescript
import { emit } from "@tauri-apps/api/event";

await emit("frontend-event", { data: "hello" });
```

---

## Sequence Diagrams

### Chat Completion Flow

```
User                    ChatService       KnezClient         Backend
 │                         │                  │              │
 │ sendMessage()          │                  │              │
 ├────────────────────────►│                  │              │
 │                         │ setPhase("sending")│              │
 │                         ├───────────────────►│              │
 │                         │                  │ POST /v1/chat/completions
 │                         │                  ├─────────────►│
 │                         │                  │              │
 │                         │                  │ SSE: token   │
 │                         │                  │◄─────────────┤
 │                         │ appendToMessage()│              │
 │                         │ setPhase("streaming")            │
 │                         │                  │              │
 │                         │                  │ SSE: tool_call
 │                         │                  │◄─────────────┤
 │                         │ persistToolTrace()│             │
 │                         │ setPhase("tool_running")         │
 │                         │                  │              │
 │                         │ executeTool()    │              │
 │                         │                  │ MCP server   │
 │                         │                  │              │
 │                         │ updateToolTrace()│              │
 │                         │                  │              │
 │                         │                  │ SSE: done    │
 │                         │                  │◄─────────────┤
 │                         │ setPhase("done")  │              │
 │                         │                  │              │
 │◄────────────────────────┤                  │              │
```

### Tool Execution Flow

```
Model (SSE)         ChatService     ToolExecutionService   McpOrchestrator    MCP Server
 │                      │                   │                    │              │
 │ tool_call            │                   │                    │              │
 ├─────────────────────►│                   │                    │              │
 │                      │ persistToolTrace() │                    │              │
 │                      ├──────────────────►│                    │              │
 │                      │                   │ executeNamespacedTool()            │
 │                      │                   ├────────────────────►│              │
 │                      │                   │                    │ callTool()    │
 │                      │                   │                    ├────────────►│
 │                      │                   │                    │              │
 │                      │                   │                    │ execute      │
 │                      │                   │                    │◄────────────┤
 │                      │                   │                    │              │
 │                      │                   │◄────────────────────┤              │
 │                      │ updateToolTrace()  │                    │              │
 │                      │                   │                    │              │
 │ tool_call_completed  │                   │                    │              │
 ├─────────────────────►│                   │                    │              │
 │                      │                   │                    │              │
```

---

## Communication Protocols

### HTTP/1.1

**Used For**:
- REST API calls
- Health checks
- Session management
- Memory operations

**Headers**:
```
Content-Type: application/json
Accept: application/json
```

### Server-Sent Events (SSE)

**Used For**:
- Chat completion streaming
- Real-time token delivery
- Tool call notifications

**Format**:
```
data: {"type": "token", "content": "Hello"}

data: {"type": "tool_call", "tool": "navigate", ...}

data: [DONE]
```

### Tauri IPC

**Used For**:
- Shell command execution
- File system operations
- Native event bridging

**Protocol**:
- Binary IPC via Rust
- Type-safe via Tauri API

---

## Integration Issues & Solutions

### Issue 1: SSE Connection Drop

**Problem**: SSE connection drops on network interruption

**Solution**: Implement reconnection logic with exponential backoff

```typescript
class SSEStream {
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000;
  
  async connect(url: string): Promise<ReadableStream> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.retryCount = 0;
      return response.body!;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.baseDelay * Math.pow(2, this.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(url);
      }
      throw error;
    }
  }
}
```

### Issue 2: Tool Call Result Size

**Problem**: Large tool results exceed SSE payload limits

**Solution**: Stream tool results in chunks or use reference IDs

```typescript
// Backend streams large results
{
  "type": "tool_call_chunk",
  "call_id": "tc_123",
  "chunk_index": 0,
  "chunk": "...",
  "total_chunks": 10
}

// Or use reference ID
{
  "type": "tool_call_completed",
  "call_id": "tc_123",
  "result_ref": "res_abc123", // Fetch via separate endpoint
  "result_size": 1024000
}
```

### Issue 3: Session State Desync

**Problem**: Frontend and backend session state diverge

**Solution**: Implement periodic state synchronization

```typescript
class SessionSync {
  private syncInterval: number = 30000; // 30s
  
  async syncSession(sessionId: string) {
    const backendMessages = await knezClient.sessionTools(sessionId);
    const frontendMessages = await sessionDatabase.getSession(sessionId);
    
    // Reconcile differences
    const missing = backendMessages.filter(
      bm => !frontendMessages.messages.some(fm => fm.id === bm.tool_call_id)
    );
    
    for (const msg of missing) {
      await sessionDatabase.addMessage(sessionId, msg);
    }
  }
}
```

### Issue 4: Memory Bloat

**Problem**: Event log and session database grow unbounded

**Solution**: Implement cleanup and archival

```typescript
class DataCleanup {
  async cleanupOldEvents(olderThanDays: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    // Archive old events
    const oldEvents = await knezClient.events({
      since: cutoff.toISOString(),
    });
    
    await this.archiveToDisk(oldEvents);
    
    // Delete from backend
    await knezClient.deleteEvents({ before: cutoff.toISOString() });
  }
  
  async cleanupOldSessions(olderThanDays: number = 90) {
    const sessions = await sessionDatabase.listSessions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    for (const session of sessions) {
      if (new Date(session.updatedAt) < cutoff) {
        await sessionDatabase.deleteSession(session.id);
      }
    }
  }
}
```

---

## Conclusion

The integration between KNEZ backend and knez-control-app frontend uses:

- **HTTP REST API**: For request/response operations
- **Server-Sent Events**: For streaming chat completions
- **Event-Driven Architecture**: For observability and debugging
- **MCP Protocol**: For tool execution
- **Tauri IPC**: For native desktop capabilities

The communication patterns are well-designed but could benefit from:
- SSE reconnection logic
- Tool result streaming for large payloads
- Periodic session state synchronization
- Data cleanup and archival
- Authentication and authorization layer

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-02 (knez-control-app), DOC-04 (Component Analysis)
