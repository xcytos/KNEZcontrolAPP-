# KNEZ Control App - Connection Guide

**Generated:** 2026-04-22  
**Purpose:** Comprehensive guide to component connections and data flow

---

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Component Connection Diagram](#component-connection-diagram)
3. [Frontend to Backend Connections](#frontend-to-backend-connections)
4. [Backend to Model Connections](#backend-to-model-connections)
5. [MCP Integration](#mcp-integration)
6. [Data Storage Connections](#data-storage-connections)
7. [Event Streaming Connections](#event-streaming-connections)
8. [Service-to-Service Connections](#service-to-service-connections)
9. [Configuration & Environment](#configuration--environment)
10. [Troubleshooting Connections](#troubleshooting-connections)

---

## System Architecture Overview

The KNEZ Control App consists of three main components:

1. **knez-control-app** - React/Tauri desktop application (Frontend)
2. **KNEZ** - FastAPI Python server (Backend)
3. **TAQWIN_V1** - MCP server with AI capabilities (Optional AI Layer)

### Component Roles

| Component | Role | Technology | Default Port |
|-----------|------|------------|--------------|
| knez-control-app | UI & Control | React + Tauri | 5173 (dev) |
| KNEZ | Model Router & Orchestrator | FastAPI | 8000 |
| TAQWIN_V1 | MCP Server & AI Tools | Python MCP | Variable (stdio) |

---

## Component Connection Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     knez-control-app                                │
│                  (React + Tauri Desktop)                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  UI Layer: ChatPane, MemoryExplorer, etc.                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  ChatService (137KB)                                   │  │  │
│  │  │  ├─ MessageStore                                      │  │  │
│  │  │  ├─ PhaseManager                                      │  │  │
│  │  │  ├─ RequestController                                  │  │  │
│  │  │  ├─ StreamController                                  │  │  │
│  │  │  ├─ ToolExecutionBridge                               │  │  │
│  │  │  └─ ResponseAssembler                                 │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  KnezClient                                            │  │  │
│  │  │  └─ HTTP Client (httpx)                                │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  McpOrchestrator                                       │  │  │
│  │  │  ├─ ToolExecutionService                               │  │  │
│  │  │  ├─ ToolExposureService                                │  │  │
│  │  │  └─ ToolResultValidator                                │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  SessionController                                     │  │  │
│  │  │  └─ SessionDatabase (IndexedDB)                       │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST
                                    │ SSE (Server-Sent Events)
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                           KNEZ Backend                               │
│                        (FastAPI on Port 8000)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Layer                                                   │  │
│  │  ├─ /v1/chat/completions (SSE streaming)                   │  │
│  │  ├─ /health (Backend health)                                │  │
│  │  ├─ /sessions (Session management)                         │  │
│  │  ├─ /events (Event streaming)                              │  │
│  │  ├─ /memory (Memory operations)                            │  │
│  │  ├─ /replay (Session replay)                               │  │
│  │  ├─ /taqwin (TAQWIN integration)                           │  │
│  │  ├─ /cognitive (Cognitive features)                        │  │
│  │  ├─ /mcp (MCP server management)                          │  │
│  │  └─ /perception (Perception features)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Router System                                               │  │
│  │  ├─ Health scoring (5s cache)                               │  │
│  │  ├─ Memory hint generation (100ms timeout)                 │  │
│  │  ├─ Influence contract application                          │  │
│  │  └─ Backend selection                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Checkpoint System                                           │  │
│  │  ├─ RedisStream (ephemeral buffer)                          │  │
│  │  ├─ SQLiteWriter (persistent storage)                       │  │
│  │  └─ CheckpointWorker (async token persistence)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Memory System                                               │  │
│  │  ├─ Knowledge Store                                         │  │
│  │  ├─ Consumption Gate                                        │  │
│  │  └─ Memory Hint Generator                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cognitive System                                            │  │
│  │  ├─ Influence Contracts                                      │  │
│  │  ├─ Governance Dashboard                                     │  │
│  │  ├─ Audit System                                            │  │
│  │  └─ Shadow Mode                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Event System                                                │  │
│  │  ├─ Event Store                                             │  │
│  │  ├─ Event Emitter                                          │  │
│  │  └─ Tag-based filtering                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Model Protocol
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   Local Backend      │  │   Cloud Backend A    │  │   Cloud Backend B    │
│   (Ollama)           │  │   (vLLM)             │  │   (vLLM)             │
│                      │  │                      │  │                      │
│  Port: 11434         │  │  Port: 8001          │  │  Port: 8002          │
│  Models:             │  │  Models:             │  │  Models:             │
│  - qwen2.5:7b        │  │  - 32B+ models       │  │  - 32B+ models       │
│  - llama3.1:8b       │  │                      │  │                      │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      TAQWIN_V1 MCP Server                             │
│                   (Optional AI Layer)                                 │
│                                                                      │
│  Tools:                                                              │
│  ├─ Consciousness (AI consciousness activation)                     │
│  ├─ Council (Agent council for decisions)                            │
│  ├─ Database (Database scanning & analysis)                         │
│  ├─ Sessions (Advanced session management v6.0.0)                   │
│  └─ Web Intelligence (Web search & content analysis)                │
│                                                                      │
│  Connection: stdio (MCP protocol)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend to Backend Connections

### Primary Connection: KnezClient

**File:** `knez-control-app/src/services/knez/KnezClient.ts`

**Connection Type:** HTTP/REST with SSE streaming

**Default Endpoint:** `http://localhost:8000`

**Key Methods:**

| Method | Endpoint | Purpose | Return Type |
|--------|----------|---------|-------------|
| `chatCompletions()` | `POST /v1/chat/completions` | Send chat request | AsyncGenerator (SSE) |
| `getHealth()` | `GET /health` | Check backend health | KnezHealthResponse |
| `tryGetMcpRegistry()` | `GET /mcp/registry` | Get MCP server list | McpRegistrySnapshot |
| `getSessionLineage()` | `GET /sessions/lineage` | Get session lineage | SessionLineage |
| `getEvents()` | `GET /events` | Get event stream | KnezEvent[] |

### Connection Flow

```
User types message in ChatPane
  ↓
ChatService.sendMessage()
  ↓
RequestController.acquireRequestLock()
  ↓
KnezClient.chatCompletions()
  ↓
HTTP POST to http://localhost:8000/v1/chat/completions
  ↓
KNEZ Backend processes request
  ↓
Router selects backend (local/cloud)
  ↓
Backend generates tokens
  ↓
SSE stream returns to frontend
  ↓
ChatService processes stream
  ↓
StreamController validates stream
  ↓
MessageStore appends messages
  ↓
UI updates (throttled to 33ms)
```

### Connection Configuration

**Environment Variables:**
- `KNEZ_ENDPOINT` - Backend URL (default: http://localhost:8000)
- `KNEZ_HOST` - Backend host (default: localhost)
- `KNEZ_PORT` - Backend port (default: 8000)

**Tauri Configuration:**
- Stored in Tauri preferences
- Accessible via Settings modal
- Supports multiple connection profiles

### Connection States

| State | Description | UI Indicator |
|-------|-------------|--------------|
| `starting` | KNEZ process starting | Spinner |
| `running` | KNEZ running and connected | Green dot |
| `degraded` | Connected but with issues | Yellow dot |
| `down` | KNEZ not running | Red dot |
| `error` | Connection failed | Error icon |

### Auto-Launch Mechanism

**File:** `knez-control-app/src/App.tsx` (lines 134-157)

**Conditions for Auto-Launch:**
- Endpoint is localhost (8000 or 8001)
- Running in Tauri desktop app
- Keep-alive enabled in settings
- Not already starting/running
- Under max attempt limit (3 attempts)

**Process:**
1. Check if KNEZ is running via health check
2. If not running, launch KNEZ process
3. Monitor process output
4. Update connection status

---

## Backend to Model Connections

### Local Backend (Ollama)

**File:** `KNEZ/knez/knez_core/models/local_backend.py`

**Connection Type:** HTTP REST API

**Default Endpoint:** `http://localhost:11434`

**Supported Models:**
- qwen2.5:7b-instruct-q4_K_M (quantized)
- qwen2.5:32b-instruct
- llama3.1:8b
- llama3.1:70b
- deepseek-coder:33b
- phi-3-mini

**Connection Configuration:**
```python
# Environment variables
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "localhost")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")
```

**Special Handling:**
- Extended first-token timeout (30s) for quantized models
- Automatic fallback to cloud if local fails
- Health monitoring with latency tracking

### Cloud Backends (vLLM)

**File:** `KNEZ/knez/knez_core/models/cloud_backend.py`

**Connection Type:** HTTP REST API

**Default Endpoints:**
- Cloud A: `http://localhost:8001`
- Cloud B: `http://localhost:8002`
- Cloud C: `http://localhost:8003`

**Configuration:**
```python
# Environment variables
KNEZ_CLOUD_A_URL = os.getenv("KNEZ_CLOUD_A_URL", "http://localhost:8001")
KNEZ_CLOUD_B_URL = os.getenv("KNEZ_CLOUD_B_URL", "http://localhost:8002")
KNEZ_CLOUD_C_URL = os.getenv("KNEZ_CLOUD_C_URL", "http://localhost:8003")
```

**Health Monitoring:**
- Ping endpoint every 5 seconds
- Track latency, tokens/sec, failure rate
- Rolling score calculation
- Automatic health-based routing

### Router Selection Logic

**File:** `KNEZ/knez/knez_core/router/router.py`

**Selection Process:**

```
Request received
  ↓
Classify request (simple vs complex)
  ↓
Generate memory hints (100ms timeout)
  ↓
Fetch health scores (cached 5s)
  ↓
Score backends (health + memory hints)
  ↓
Apply influence contracts (if any)
  ↓
Select highest-scored backend
  ↓
Emit decision event
  ↓
Return selected backend
```

**Scoring Factors:**
- Health score (0-100)
- Memory hint relevance
- Influence contract weight
- Historical performance

**Fallback Chain:**
1. Primary backend (selected by router)
2. If primary fails → fallback to next best
3. If all cloud fail → fallback to local
4. If all fail → return error

---

## MCP Integration

### MCP Server Types

#### 1. TAQWIN_V1 (Internal MCP Server)

**Location:** `TAQWIN_V1/`

**Connection:** stdio (MCP protocol)

**Tools:**
- `consciousness` - AI consciousness activation
- `council` - Agent council for decisions
- `database` - Database scanning and analysis
- `sessions` - Advanced session management (v6.0.0)
- `web_intelligence` - Web search and content analysis
- `status` - Server status
- `test` - Connection testing

**Activation:**
```typescript
// From knez-control-app
await taqwinActivationService.activate({
  sessionId: sid,
  knezEndpoint: endpoint,
  checkpoint: "CP01_MCP_REGISTRY"
});
```

#### 2. External MCP Servers

**Discovery:** Via KNEZ `/mcp/registry` endpoint

**Configuration:** Manual registration in MCP registry

**Integration:** Via McpOrchestrator

### MCP Orchestrator

**File:** `knez-control-app/src/mcp/McpOrchestrator.ts`

**Purpose:** Coordinate MCP tool execution across multiple servers

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `callTool()` | Execute tool on MCP server |
| `listTools()` | Discover available tools |
| `registerServer()` | Register new MCP server |
| `unregisterServer()` | Remove MCP server |

### Tool Execution Flow

```
Model outputs tool_call
  ↓
ChatService detects tool_call
  ↓
ToolExecutionBridge.executeToolAndInterpret()
  ↓
McpOrchestrator.callTool()
  ↓
Select MCP server (TAQWIN_V1 or external)
  ↓
Send tool request via MCP protocol
  ↓
Tool execution with status updates:
  - pending → running → completed/failed
  ↓
Tool result returned
  ↓
ToolResultValidator.validate()
  ↓
Result interpretation
  ↓
ToolCallMessage update
  ↓
Debug panel update
  ↓
Continue generation with tool result
```

### Tool Status Tracking

**File:** `knez-control-app/src/domain/DataContracts.ts`

**Status States:**
- `pending` - Tool queued for execution
- `running` - Tool currently executing
- `calling` - Tool call initiated
- `succeeded` - Tool completed successfully
- `failed` - Tool execution failed
- `completed` - Tool fully processed

**Metrics Tracked:**
- `executionTimeMs` - Tool execution duration
- `mcpLatencyMs` - MCP protocol latency
- `phase` - Execution phase (intent, planning, execution, etc.)
- `pattern` - Execution pattern (direct, plan_execute_respond, etc.)

---

## Data Storage Connections

### Frontend Storage (IndexedDB)

**Database:** `knez-control-app` (via Dexie)

**Tables:**

| Table | Purpose | Schema |
|-------|---------|--------|
| `sessions` | Session metadata | id, title, createdAt, messageCount |
| `messages` | Chat messages | id, sessionId, from, text, createdAt, sequenceNumber |
| `memories` | Memory entries | id, sessionId, summary, details, importance |
| `lineage` | Session lineage | sessionId, parentSessionId, resumeSnapshotId |

**Service:** `knez-control-app/src/services/session/SessionDatabase.ts`

**Operations:**
- `persist()` - Save session/message
- `load()` - Load session/messages
- `listSessions()` - List all sessions
- `deleteSession()` - Delete session

### Backend Storage (SQLite)

**Database:** `KNEZ/data/sessions.db`

**Tables:**

| Table | Purpose |
|-------|---------|
| `sessions` | Session metadata |
| `checkpoints` | Token checkpoints |
| `lineage` | Session lineage |
| `events` | Event log |

**API Endpoints:**
- `GET /sessions/{id}` - Get session
- `POST /sessions` - Create session
- `GET /sessions/lineage/{id}` - Get lineage
- `GET /checkpoints/{id}` - Get checkpoints

### Checkpoint Storage (Redis + SQLite)

**Redis (Ephemeral):**
- **Purpose:** Fast streaming buffer
- **TTL:** Short-lived (cleared after flush)
- **Key Pattern:** `checkpoint:{session_id}:{token_index}`

**SQLite (Persistent):**
- **Purpose:** Long-term checkpoint storage
- **Flush Interval:** 500ms OR 20 tokens
- **Table:** `checkpoints`

**Worker:** `CheckpointWorker` in `completions.py`

### TAQWIN_V1 Storage

**Databases:**

| Database | Path | Purpose |
|----------|------|---------|
| `sessions.db` | `data/sessions/` | Session storage |
| `agents.db` | `data/agents/` | Agent learning |
| `enhanced_memory.db` | `data/consciousness/` | Consciousness memory |
| `episodic.db` | `data/superintelligence/memory/` | Episodic memory |
| `procedural.db` | `data/superintelligence/memory/` | Procedural memory |
| `semantic.db` | `data/superintelligence/memory/` | Semantic memory |
| `cache.db` | `data/web_intelligence/cache/` | Web cache |

**Storage Strategy:** Hybrid (JSON + SQLite)

---

## Event Streaming Connections

### Event System Architecture

**File:** `KNEZ/knez/knez_core/events/store.py`

**Event Types:**

| Type | Description | Severity |
|------|-------------|----------|
| `ACTION` | System actions (token_stream_start, token_stream_end) | INFO, DEBUG |
| `ANALYSIS` | Analysis operations (memory_hint_considered) | INFO |
| `DECISION` | Decision points (router_route_decision) | INFO |
| `ERROR` | Error events (backend_stream_interrupted) | WARN, ERROR |
| `INPUT` | Input events (session_start) | INFO |

**Event Tags:**
- `stream` - Streaming-related events
- `router` - Routing decisions
- `memory_hint` - Memory system events
- `influence_execution` - Influence application
- `error` - Error events

### Event Flow

```
Event occurs in system
  ↓
Emitter.emit(session_id, event_type, event_name, source, severity, payload, tags)
  ↓
Event store buffers event
  ↓
Frontend subscribes via /events endpoint
  ↓
Events streamed to frontend
  ↓
KnezEventsPanel displays events
  ↓
Filtered by session_id and tags
```

### Frontend Event Subscription

**File:** `knez-control-app/src/features/events/KnezEventsPanel.ts`

**Subscription:**
```typescript
knezClient.getEvents(sessionId)
  .then(events => {
    // Display events
  });
```

**Filtering:**
- By session ID
- By event type
- By tag
- By severity

---

## Service-to-Service Connections

### ChatService → KnezClient

**Connection Type:** Direct method calls

**Purpose:** Send chat requests to backend

**Flow:**
```
ChatService.sendMessage()
  ↓
KnezClient.chatCompletions()
  ↓
HTTP POST to /v1/chat/completions
  ↓
SSE stream returned
  ↓
ChatService processes stream
```

### ChatService → SessionController

**Connection Type:** Direct method calls

**Purpose:** Session lifecycle management

**Flow:**
```
ChatService.sendMessage()
  ↓
SessionController.ensureLocalSession()
  ↓
SessionDatabase.persist()
  ↓
IndexedDB storage
```

### ChatService → McpOrchestrator

**Connection Type:** Direct method calls

**Purpose:** MCP tool execution

**Flow:**
```
ChatService detects tool_call
  ↓
McpOrchestrator.callTool()
  ↓
ToolExecutionService.execute()
  ↓
MCP server (TAQWIN_V1 or external)
  ↓
Tool result returned
```

### ChatService → MemoryInjectionService

**Connection Type:** Direct method calls

**Purpose:** Inject static memories

**Flow:**
```
App startup
  ↓
StaticMemoryLoader.loadMemories()
  ↓
MemoryInjectionService.inject()
  ↓
Memory store populated
```

### ChatService → GovernanceService

**Connection Type:** Direct method calls

**Purpose:** Apply governance rules

**Flow:**
```
ChatService.sendMessage()
  ↓
GovernanceService.check()
  ↓
Influence contract evaluation
  ↓
Decision modified or allowed
```

### Router → Memory System

**Connection Type:** Async method calls

**Purpose:** Generate memory hints for routing

**Flow:**
```
Router.select()
  ↓
MemoryHintGenerator.generate_hints()
  ↓
Memory store queried
  ↓
Hints returned (100ms timeout)
  ↓
Applied to routing decision
```

### Router → Influence System

**Connection Type:** Direct method calls

**Purpose:** Apply influence contracts

**Flow:**
```
Router.select()
  ↓
RoutingInfluenceAdapter.apply()
  ↓
Influence contracts evaluated
  ↓
Backend scores modified
  ↓
Final selection made
```

### CheckpointWorker → Redis + SQLite

**Connection Type:** Async writes

**Purpose:** Persist tokens during streaming

**Flow:**
```
Token generated
  ↓
CheckpointWorker.submit(index, token)
  ↓
RedisStream.append() (fast, ephemeral)
  ↓
Buffer accumulates (500ms OR 20 tokens)
  ↓
SQLiteWriter.persist() (slow, persistent)
  ↓
Checkpoint saved
```

---

## Configuration & Environment

### KNEZ Backend Configuration

**File:** `KNEZ/knez/knez_core/app.py`

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `KNEZ_HOST` | `0.0.0.0` | Server host |
| `KNEZ_PORT` | `8000` | Server port |
| `KNEZ_CLOUD_A_URL` | `http://localhost:8001` | Cloud backend A |
| `KNEZ_CLOUD_B_URL` | `http://localhost:8002` | Cloud backend B |
| `KNEZ_CLOUD_C_URL` | `http://localhost:8003` | Cloud backend C |
| `OLLAMA_HOST` | `localhost` | Ollama host |
| `OLLAMA_PORT` | `11434` | Ollama port |

**CORS Configuration:**
```python
allow_origins=[
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "null",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
```

### Frontend Configuration

**File:** `knez-control-app/src/config/features.ts`

**Feature Flags:**
- `floatingConsole` - Enable floating console
- `taqwinTools` - Enable TAQWIN tools
- `keepAlive` - Enable KNEZ auto-launch

**Connection Profiles:**
- Stored in Tauri preferences
- Accessible via Settings modal
- Support for multiple profiles

### TAQWIN_V1 Configuration

**File:** `TAQWIN_V1/config.py`

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `TAQWIN_LOG_LEVEL` | `INFO` | Logging level |
| `SERPER_API_KEY` | - | Search API key |
| `TAQWIN_ENV` | `development` | Environment |
| `ENABLE_WEB_INTELLIGENCE` | `true` | Enable web features |
| `DATABASE_OPTIMIZATION` | `true` | DB optimization |

**Storage Configuration:**
- `STORAGE_TYPE` - `json`, `sqlite`, or `hybrid`
- `DATA_DIR` - `data/`
- `SESSION_DB_PATH` - `data/sessions/sessions.db`

---

## Troubleshooting Connections

### Common Issues

#### 1. Frontend Cannot Connect to Backend

**Symptoms:**
- Connection status shows "down"
- Health check fails
- Chat requests timeout

**Troubleshooting Steps:**

1. **Check if KNEZ is running:**
   ```bash
   # Check if process is running
   ps aux | grep python
   # Or on Windows
   tasklist | findstr python
   ```

2. **Check if port is accessible:**
   ```bash
   # Test connection
   curl http://localhost:8000/health
   # Or on Windows
   Invoke-WebRequest -Uri http://localhost:8000/health
   ```

3. **Check environment variables:**
   ```bash
   # Verify KNEZ_PORT
   echo $KNEZ_PORT  # Linux/Mac
   echo %KNEZ_PORT%  # Windows
   ```

4. **Check CORS configuration:**
   - Ensure frontend origin is in `allow_origins`
   - Check browser console for CORS errors

5. **Restart KNEZ:**
   ```bash
   cd KNEZ
   python run.py
   ```

#### 2. Ollama Connection Failed

**Symptoms:**
- Local backend shows as unhealthy
- Health check shows Ollama unreachable
- Fallback to cloud occurs

**Troubleshooting Steps:**

1. **Check if Ollama is running:**
   ```bash
   ollama list
   ```

2. **Check Ollama port:**
   ```bash
   # Default is 11434
   curl http://localhost:11434/api/tags
   ```

3. **Check Ollama host/port in environment:**
   ```bash
   echo $OLLAMA_HOST
   echo $OLLAMA_PORT
   ```

4. **Start Ollama if not running:**
   ```bash
   ollama serve
   ```

#### 3. MCP Server Not Responding

**Symptoms:**
- Tool execution fails
- MCP registry shows server as unhealthy
- Debug panel shows tool errors

**Troubleshooting Steps:**

1. **Check if TAQWIN_V1 is running:**
   ```bash
   cd TAQWIN_V1
   python main.py
   ```

2. **Check MCP configuration:**
   - Verify MCP server is registered in KNEZ
   - Check MCP registry via `/mcp/registry` endpoint

3. **Test MCP server directly:**
   ```bash
   # Test TAQWIN_V1
   cd TAQWIN_V1
   python main.py
   # Then use MCP client to test tools
   ```

4. **Check MCP logs:**
   - TAQWIN_V1 logs in `data/logs/taqwin_v1.log`
   - KNEZ MCP logs in backend console

#### 4. Streaming Connection Interrupted

**Symptoms:**
- Stream stops mid-generation
- Error: "backend_stream_interrupted"
- Partial response received

**Troubleshooting Steps:**

1. **Check backend logs:**
   - Look for errors in KNEZ console
   - Check for timeout errors

2. **Check network connection:**
   - Verify network stability
   - Check for packet loss

3. **Increase timeout:**
   - For local backends, first-token timeout is 30s
   - For cloud backends, check vLLM timeout settings

4. **Check checkpoint system:**
   - Verify Redis is running (if used)
   - Check SQLite checkpoint table

#### 5. Session Not Persisting

**Symptoms:**
- Session lost on refresh
- Messages not saved
- IndexedDB empty

**Troubleshooting Steps:**

1. **Check IndexedDB:**
   - Open browser DevTools
   - Go to Application → IndexedDB
   - Check `knez-control-app` database

2. **Check SessionController:**
   - Verify `ensureLocalSession()` is called
   - Check session ID generation

3. **Check persistence service:**
   - Verify `PersistenceService` is working
   - Check for errors in console

4. **Clear and retry:**
   - Clear IndexedDB
   - Refresh application
   - Create new session

#### 6. Event Streaming Not Working

**Symptoms:**
- KnezEventsPanel empty
- No events displayed
- Event subscription fails

**Troubleshooting Steps:**

1. **Check event endpoint:**
   ```bash
   curl http://localhost:8000/events?session_id=<id>
   ```

2. **Check event store:**
   - Verify event store is started
   - Check for event emission in backend logs

3. **Check subscription:**
   - Verify session ID is correct
   - Check for subscription errors in frontend console

4. **Check event filtering:**
   - Verify tags are correct
   - Check severity filters

### Debug Mode

#### Enable Debug Logging

**KNEZ Backend:**
```bash
export KNEZ_LOG_LEVEL=DEBUG
python run.py
```

**Frontend:**
- Open browser DevTools
- Go to Console
- Set log level to Debug

**TAQWIN_V1:**
```bash
export TAQWIN_LOG_LEVEL=DEBUG
python main.py
```

#### Monitor Events

**KNEZ Events:**
```bash
curl http://localhost:8000/events
```

**Frontend Events:**
- Open KnezEventsPanel
- Filter by session ID
- Monitor real-time events

#### Health Check

**KNEZ Health:**
```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "model": "selected-model",
  "backends": [
    {
      "model_id": "local",
      "status": "healthy",
      "latency_ms": 150,
      "tokens_per_sec": 45.2
    }
  ]
}
```

---

## Connection Summary

### Critical Connections

| Connection | Protocol | Port | Purpose | Criticality |
|------------|----------|------|---------|-------------|
| Frontend → KNEZ | HTTP/SSE | 8000 | Chat requests | HIGH |
| KNEZ → Ollama | HTTP | 11434 | Local model access | HIGH |
| KNEZ → Cloud A | HTTP | 8001 | Cloud model access | MEDIUM |
| KNEZ → Cloud B | HTTP | 8002 | Cloud model access | MEDIUM |
| KNEZ → Redis | TCP | 6379 | Checkpoint buffer | MEDIUM |
| Frontend → TAQWIN_V1 | stdio | - | MCP tools | MEDIUM |

### Connection Dependencies

```
Frontend depends on:
  ├─ KNEZ Backend (required)
  └─ TAQWIN_V1 (optional, for advanced features)

KNEZ Backend depends on:
  ├─ Ollama (required for local models)
  ├─ Cloud backends (optional, for cloud models)
  ├─ Redis (optional, for checkpoint buffer)
  └─ SQLite (required, for persistent storage)

TAQWIN_V1 depends on:
  ├─ SQLite (required, for storage)
  └─ Search API (optional, for web intelligence)
```

### Startup Order

**Recommended Startup Order:**

1. **Start Ollama** (if using local models)
   ```bash
   ollama serve
   ```

2. **Start Redis** (if using checkpoint buffer)
   ```bash
   redis-server
   ```

3. **Start Cloud Backends** (if using cloud models)
   ```bash
   # Start vLLM instances on ports 8001, 8002, etc.
   ```

4. **Start KNEZ Backend**
   ```bash
   cd KNEZ
   python run.py
   ```

5. **Start TAQWIN_V1** (if using MCP tools)
   ```bash
   cd TAQWIN_V1
   python main.py
   ```

6. **Start Frontend**
   ```bash
   cd knez-control-app
   npm run dev
   ```

### Connection Health Monitoring

**Frontend Monitoring:**
- StatusProvider checks KNEZ health every 30s
- Connection status displayed in header
- Auto-retry on connection failure

**Backend Monitoring:**
- Router checks backend health every 5s
- Health scores cached for 5s
- Event emission for all health changes

**Manual Health Check:**
```bash
# KNEZ health
curl http://localhost:8000/health

# Ollama health
curl http://localhost:11434/api/tags

# Cloud backend health
curl http://localhost:8001/health
```

---

## Quick Reference

### Key Files

| Component | File | Purpose |
|-----------|------|---------|
| Frontend Connection | `knez-control-app/src/services/knez/KnezClient.ts` | HTTP client |
| Backend API | `KNEZ/knez/knez_core/api/completions.py` | Chat completions |
| Router | `KNEZ/knez/knez_core/router/router.py` | Backend selection |
| MCP Orchestrator | `knez-control-app/src/mcp/McpOrchestrator.ts` | Tool execution |
| Session Storage | `knez-control-app/src/services/session/SessionDatabase.ts` | IndexedDB |
| Checkpoint System | `KNEZ/knez/knez_core/checkpoints/` | Token persistence |

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/chat/completions` | POST | Chat with streaming |
| `/health` | GET | Backend health |
| `/sessions` | GET/POST | Session management |
| `/events` | GET | Event stream |
| `/mcp/registry` | GET | MCP server list |
| `/memory` | GET/POST | Memory operations |

### Environment Variables

| Variable | Component | Default |
|----------|-----------|---------|
| `KNEZ_HOST` | Backend | `0.0.0.0` |
| `KNEZ_PORT` | Backend | `8000` |
| `OLLAMA_HOST` | Ollama | `localhost` |
| `OLLAMA_PORT` | Ollama | `11434` |
| `TAQWIN_LOG_LEVEL` | TAQWIN_V1 | `INFO` |

---

## Conclusion

This connection guide provides a comprehensive overview of how all components in the KNEZ Control App connect and interact. The system is designed with:

- **Modular architecture** - Clear separation of concerns
- **Redundant connections** - Multiple backend options
- **Robust fallback** - Automatic failover mechanisms
- **Comprehensive monitoring** - Health checks and event streaming
- **Flexible configuration** - Environment-based configuration

For specific troubleshooting, refer to the [Troubleshooting Connections](#troubleshooting-connections) section. For architecture details, refer to [SYSTEM_STATE_DOCUMENTATION.md](SYSTEM_STATE_DOCUMENTATION.md).
