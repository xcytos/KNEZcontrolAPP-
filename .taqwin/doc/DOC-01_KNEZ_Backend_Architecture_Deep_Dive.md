# DOC-01: KNEZ Backend Architecture Deep Dive

## Executive Summary

KNEZ is a Python-based FastAPI backend that serves as the AI agent runtime for the control application. It provides model abstraction, routing, streaming responses, event tracking, memory management, and MCP (Model Context Protocol) tool execution capabilities. The architecture is designed around modularity, with clear separation between core services, API layers, and infrastructure components.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Core Components](#core-components)
4. [Model Backend Abstraction](#model-backend-abstraction)
5. [Router & Backend Selection](#router--backend-selection)
6. [Streaming & Completions](#streaming--completions)
7. [Event System](#event-system)
8. [Memory System](#memory-system)
9. [Session Management](#session-management)
10. [Checkpoint System](#checkpoint-system)
11. [Failover Mechanism](#failover-mechanism)
12. [Replay System](#replay-system)
13. [Cognitive Layer](#cognitive-layer)
14. [MCP Integration](#mcp-integration)
15. [Telemetry & Metrics](#telemetry--metrics)
16. [API Endpoints](#api-endpoints)
17. [Data Flow](#data-flow)
18. [Configuration & Environment](#configuration--environment)
19. [Performance Optimizations](#performance-optimizations)
20. [Known Issues & Limitations](#known-issues--limitations)

---

## Architecture Overview

KNEZ follows a layered architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Application Layer              │
│  (app.py - CORS, middleware, router inclusion)              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API Router Layer                        │
│  (api/completions.py, api/health.py, api/sessions.py, etc) │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                           │
│  (router/, memory/, events/, sessions/, checkpoints/)       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Model Backend Layer                       │
│  (models/base.py, models/local_backend.py, models/cloud)    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  (events/store.py, sessions/store.py, telemetry/metrics.py) │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Model Agnosticism**: Abstract backend interface allows pluggable model providers
2. **Event-Driven Architecture**: All operations emit events for observability
3. **Streaming-First**: All generation responses are streamed for real-time UX
4. **Persistence**: Checkpoints and session lineage for state recovery
5. **Failover**: Automatic backend switching on failures
6. **Modularity**: Clear separation of concerns with minimal coupling

---

## Directory Structure

```
KNEZ/knez/
├── knez_core/                    # Core backend implementation
│   ├── __init__.py
│   ├── app.py                    # FastAPI application setup
│   ├── agents.py                 # Agent definitions and governance
│   ├── api/                      # API endpoint implementations
│   │   ├── completions.py        # Chat completions endpoint
│   │   ├── health.py             # Health check endpoint
│   │   ├── sessions.py           # Session management endpoint
│   │   ├── events_api.py         # Events query endpoint
│   │   ├── memory_api.py         # Memory management endpoint
│   │   ├── replay_api.py         # Replay functionality endpoint
│   │   ├── taqwin_router.py      # TAQWIN-specific routing
│   │   ├── cognitive_api.py      # Cognitive operations endpoint
│   │   ├── mcp_api.py            # MCP tool operations endpoint
│   │   └── perception_api.py      # Perception data endpoint
│   ├── models/                   # Model backend implementations
│   │   ├── base.py               # Base backend interface
│   │   ├── local_backend.py      # Local Ollama backend
│   │   └── cloud_backend.py      # Cloud backend (skeleton)
│   ├── router/                   # Backend selection and routing
│   │   ├── router.py             # Main router class
│   │   ├── classifier.py         # Request classification
│   │   └── scorer.py             # Backend health scoring
│   ├── events/                   # Event system
│   │   ├── schema.py             # Event schema definitions
│   │   ├── emitter.py            # Event emission interface
│   │   ├── store.py              # Event persistence (log file)
│   │   ├── reader.py             # Event query interface
│   │   └── api.py                # Events API endpoint
│   ├── memory/                   # Memory management
│   │   ├── models.py             # Memory data models
│   │   ├── store.py              # Memory persistence (SQLite)
│   │   ├── api.py                # Memory API endpoint
│   │   ├── knowledge_store.py    # Vector knowledge base
│   │   └── gate.py               # Memory gate/processor
│   ├── sessions/                 # Session management
│   │   └── store.py              # Session persistence (SQLite)
│   ├── checkpoints/              # Streaming checkpoint system
│   │   ├── checkpoint_model.py    # Checkpoint data model
│   │   ├── reader.py             # Checkpoint reader
│   │   ├── redis_stream.py       # Redis streaming buffer
│   │   └── sqlite_writer.py      # SQLite checkpoint writer
│   ├── failover/                 # Failover mechanism
│   │   ├── manager.py            # Failover manager
│   │   ├── health.py             # Health monitoring
│   │   └── continuation.py       # Continuation strategies
│   ├── replay/                   # Replay/reflection system
│   │   ├── engine.py             # Replay engine
│   │   ├── models.py             # Replay data models
│   │   ├── phases.py             # Replay phase definitions
│   │   ├── reflection.py         # Reflection analysis
│   │   ├── insights.py           # Insight generation
│   │   ├── stats.py              # Statistics computation
│   │   ├── summary.py            # Summary generation
│   │   └── api.py                # Replay API endpoint
│   ├── telemetry/                # Metrics and monitoring
│   │   └── metrics.py            # Prometheus metrics
│   └── utils/                    # Utilities
│       ├── exceptions.py         # Custom exceptions
│       └── tokenizer.py          # Token counting utilities
├── cognitive/                    # Cognitive layer
│   ├── api.py                    # Cognitive operations API
│   ├── governance.py             # Governance rules enforcement
│   ├── audit.py                  # Audit trail
│   ├── dashboard.py              # Dashboard data
│   ├── docs.py                   # Documentation generation
│   └── runbook.py                # Runbook management
├── mcp/                          # MCP integration
│   ├── api.py                    # MCP operations API
│   └── servers/                  # MCP server configurations
├── perception/                   # Perception layer
│   └── api.py                    # Perception data API
├── compat/                       # Compatibility layer
│   ├── api.py                    # Compatibility API
│   ├── app.py                    # Compatibility app
│   └── feature_flags.py          # Feature flag management
└── integrations/                 # External integrations
    └── taqwin/                   # TAQWIN integration
```

---

## Core Components

### 1. FastAPI Application (app.py)

**Purpose**: Main application entry point, middleware configuration, router inclusion

**Key Responsibilities**:
- Initialize FastAPI application
- Configure CORS middleware
- Initialize router with backend configurations
- Include all API routers
- Set up event store startup/shutdown

**Key Code Sections**:

```python
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router initialization
router = Router(
    backends=[
        LocalBackend(model_id="llama3.1", endpoint=os.getenv("OLLAMA_ENDPOINT")),
        # Additional backends...
    ]
)
app.state.router = router

# Router inclusion
app.include_router(api_router)
app.include_router(health_router)
app.include_router(sessions_router)
# ... additional routers
```

**Environment Variables**:
- `OLLAMA_ENDPOINT`: Local Ollama instance URL (default: http://localhost:11434)
- `DEFAULT_MODEL`: Default model ID
- `KNEZ_MEMORY_DB_PATH`: Path to memory database
- Redis configuration for checkpoints

---

### 2. Agent System (agents.py)

**Purpose**: Define agent capabilities, enforce governance rules

**Key Classes**:

```python
@dataclass
class AgentDefinition:
    agent_id: str
    domain: str
    description: str
    allowed_proposal_types: List[str]
    risk_ceiling: float
    proposal_cap: int
```

**Key Functions**:
- `list_agents()`: List all available agents
- `get_agent(agent_id)`: Get specific agent definition
- `enforce_governance_rules(agent, proposal)`: Validate proposal against rules

**Governance Rules**:
- Risk ceiling enforcement
- Proposal type validation
- Proposal cap limits
- Event emission for violations

---

## Model Backend Abstraction

### Base Backend Interface (models/base.py)

**Purpose**: Abstract interface for all model backends

**Key Components**:

```python
class BaseBackend(ABC):
    model_id: str
    capabilities: Set[str]
    
    @abstractmethod
    async def generate(
        self, 
        request: GenerationRequest, 
        stream_callback: StreamCallback
    ) -> AsyncGenerator[str, None]:
        """Stream tokens for a request"""
    
    @abstractmethod
    async def health(self) -> BackendHealth:
        """Return backend health snapshot"""
```

**GenerationRequest Structure**:
```python
class GenerationRequest(BaseModel):
    messages: list[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = 1.0
    stream: bool = True
    tools: Optional[list] = None
    tool_choice: Optional[str] = None
    metadata: Optional[dict] = None
```

**BackendHealth Structure**:
```python
class BackendHealth(BaseModel):
    model_id: str
    latency_ms: Optional[float] = None
    failure_rate: Optional[float] = None
    tokens_per_sec: Optional[float] = None
    last_ping: Optional[float] = None
    rolling_score: Optional[float] = None
    status: Literal["healthy", "degraded", "unhealthy"] = "healthy"
```

---

### Local Backend (models/local_backend.py)

**Purpose**: Interface with local Ollama instance

**Key Features**:
- HTTP streaming to Ollama /api/chat endpoint
- Tool call handling (native Ollama tool_calls format)
- Retry logic (2 attempts with 1s backoff)
- Metrics tracking (latency, tokens per second, failures)
- Health monitoring via Ollama /api/tags

**Streaming Implementation**:
```python
async def _stream_tokens(self, messages: list, tools: Optional[list] = None, 
                         tool_choice: Optional[str] = None) -> AsyncGenerator[str, None]:
    url = f"{self.endpoint}/api/chat"
    payload = {
        "model": self.model_id,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "stream": True,
    }
    if tools:
        payload["tools"] = tools
    if tool_choice:
        payload["tool_choice"] = tool_choice
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                data = json.loads(line)
                msg = data.get("message") or {}
                token = msg.get("content", "")
                if token:
                    yield token
                # Handle tool_calls
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    # Convert to {"tool_call":{...}} format
                    yield serialized_tool_call
```

**Health Check**:
- Caches Ollama model availability status (5s TTL)
- Returns "available", "not_loaded", or "unreachable"
- Prevents blocking on first cold check

---

### Cloud Backend (models/cloud_backend.py)

**Purpose**: Skeleton for cloud-based backends (OpenAI, Anthropic, etc.)

**Status**: Currently stub implementation

**Planned Features**:
- HTTP client for cloud API calls
- API key management
- Rate limiting
- Cost tracking

---

## Router & Backend Selection

### Router Class (router/router.py)

**Purpose**: Select optimal backend for each generation request

**Key Components**:

```python
class Router:
    def __init__(self, backends: List[BaseBackend]):
        self.backends = backends
        self._health_cache: Dict[str, Tuple[float, float]] = {}
        self._health_cache_ttl = 5.0
        self._cache_lock = asyncio.Lock()
        self._memory_hints: Optional[MemoryHintGenerator] = None
```

**Selection Algorithm**:
1. Filter backends by capabilities
2. Get cached health scores (or fetch fresh if expired)
3. Apply memory hints if available
4. Apply influence traces if available
5. Select backend with highest score

**Health Score Caching**:
```python
async def _get_cached_health_score(self, backend: BaseBackend) -> float:
    now = time.time()
    async with self._cache_lock:
        cached = self._health_cache.get(backend.model_id)
        if cached and (now - cached[1]) < self._health_cache_ttl:
            return cached[0]
    # Cache miss - fetch fresh
    h = await backend.health()
    s = score_health(h).value
    async with self._cache_lock:
        self._health_cache[backend.model_id] = (s, now)
    return s
```

**Memory Hint Generation** (with timeout):
```python
try:
    hints = await asyncio.wait_for(
        self._memory_hints.generate_hints(
            session_id=session_id,
            decision_context=decision_context,
            max_hints=3,
        ),
        timeout=0.1  # Limit to 100ms to avoid blocking
    )
except asyncio.TimeoutError:
    hints = []
```

**Influence Traces**:
- Applies user influence votes to backend selection
- Supports upvote/downvote on previous generations
- Adjusts scores based on user feedback

---

## Streaming & Completions

### Completions Endpoint (api/completions.py)

**Purpose**: Handle chat completion requests with streaming responses

**Endpoint**: `POST /v1/chat/completions`

**Request Schema**:
```python
class GenerationRequest(BaseModel):
    messages: List[Dict[str, str]]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: bool = True
    tools: Optional[List[Dict]] = None
    tool_choice: Optional[str] = None
```

**Streaming Implementation** (`_sse_stream`):

**Phase 1: Instrument Metrics**
```python
t_submit = time.perf_counter()
t_first_token = None
token_count = 0
fallback_triggered = False
```

**Phase 2: Backend Selection**
```python
backend = await router.select_backend(request, session_id)
```

**Phase 3: Token Streaming**
```python
async for token in backend.generate(request, stream_callback):
    if t_first_token is None:
        t_first_token = time.perf_counter()
    token_count += 1
    yield f"data: {json.dumps(token_chunk)}\n\n"
```

**Phase 4: Fallback Handling**
```python
except BackendFailure as primary_err:
    fallback_triggered = True
    fallback_backend = await router.select_fallback(backend, request)
    async for token in fallback_backend.generate(request, stream_callback):
        yield token
```

**Phase 5: Metrics Emission**
```python
duration = time.perf_counter() - t_submit
ttft = (t_first_token - t_submit) if t_first_token else None
emitter.emit(
    session_id=session_id,
    event_type=EventType.ACTION,
    event_name="stream_complete",
    payload={
        "time_to_first_token_ms": ttft * 1000 if ttft else None,
        "total_tokens": token_count,
        "duration_ms": duration * 1000,
        "tokens_per_sec": token_count / duration if duration > 0 else 0,
        "model_id": backend.model_id,
        "fallback_triggered": fallback_triggered,
    },
    tags=["stream", "metrics"],
)
```

**Checkpoint Worker**:
- Runs in background to persist tokens to SQLite
- Commits checkpoints every N tokens
- Supports resume from checkpoint

---

## Event System

### Event Schema (events/schema.py)

**Event Types**:
```python
class EventType(str, enum.Enum):
    INPUT = "INPUT"           # User input received
    ANALYSIS = "ANALYSIS"     # System analysis
    DECISION = "DECISION"     # System decision
    ACTION = "ACTION"         # Action taken
    REFLECTION = "REFLECTION" # Reflection on outcome
    PERSISTENCE = "PERSISTENCE" # Data persistence
    ERROR = "ERROR"           # Error occurred
```

**Event Severity**:
```python
class EventSeverity(str, enum.Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
```

**Event Sources**:
```python
class EventSource(str, enum.Enum):
    KNEZ_CORE = "knez_core"
    LLFS = "llfs"
    MODEL = "model"
    TAQWIN = "taqwin"
    TOOL = "tool"
    SYSTEM = "system"
```

**Event Structure**:
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

---

### Event Emitter (events/emitter.py)

**Purpose**: Central interface for emitting events

**Usage**:
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

---

### Event Store (events/store.py)

**Purpose**: Persist events to log file for querying

**Implementation**:
- Async queue-based write (max 1000 events)
- Background task flushes to disk
- JSON line format for easy parsing
- Supports tail queries (last N events)
- Supports filtering by type, session_id, task_id

**Query Interface**:
```python
events = store.tail(
    limit=100,
    event_type=EventType.ACTION,
    session_id="abc123",
)
```

---

## Memory System

### Memory Models (memory/models.py)

**MemoryCandidate Structure**:
```python
@dataclass
class MemoryCandidate:
    memory_id: str
    created_at: str
    session_id: str
    memory_type: str  # "fact", "preference", "pattern", etc.
    summary: str
    evidence_event_ids: List[str]
    confidence: float
    retention_policy: str
```

---

### Memory Store (memory/store.py)

**Purpose**: Persist memory candidates to SQLite

**Database Schema**:
```sql
CREATE TABLE memories (
    memory_id TEXT PRIMARY KEY,
    created_at TEXT,
    session_id TEXT,
    memory_type TEXT,
    summary TEXT,
    evidence_event_ids TEXT,
    confidence REAL,
    retention_policy TEXT
)
CREATE INDEX idx_memories_session_type ON memories(session_id, memory_type)
```

**Operations**:
- `add(memory)`: Add new memory candidate
- `query(session_id, memory_type, since, order, limit)`: Query memories
- `get(memory_id)`: Get specific memory

---

### Memory API (memory/api.py)

**Endpoints**:
- `GET /memory`: List memories with filters
- `POST /memory`: Add memory candidate
- `GET /memory/knowledge`: List knowledge base documents
- `POST /memory/knowledge`: Add document to knowledge base
- `POST /memory/gate/check`: Trigger memory gate processing
- `GET /memory/{memory_id}`: Get memory details

---

### Memory Gate (memory/gate.py)

**Purpose**: Process session events to extract memory candidates

**Process**:
1. Collect events for session
2. Analyze patterns and facts
3. Generate memory candidates
4. Score confidence
5. Apply retention policy

---

### Knowledge Store (memory/knowledge_store.py)

**Purpose**: Vector-based knowledge base for semantic search

**Features**:
- Document indexing
- Vector embeddings
- Semantic similarity search
- Tag-based filtering

---

## Session Management

### Session Store (sessions/store.py)

**Purpose**: Persist session lineage and metadata

**Database Schema**:
```sql
CREATE TABLE session_lineage (
    session_id TEXT PRIMARY KEY,
    parent_session_id TEXT,
    resume_snapshot_id TEXT,
    resume_mode TEXT,  -- "fresh", "resumed", "forked"
    resume_reason TEXT,
    created_at REAL
)

CREATE TABLE resume_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    source_session_id TEXT,
    high_level_task_state TEXT,
    accepted_facts TEXT,
    constraints TEXT,
    open_questions TEXT,
    agent_context TEXT,
    created_at REAL
)

CREATE TABLE snapshot_deltas (
    delta_id TEXT PRIMARY KEY,
    session_id TEXT,
    delta_type TEXT,
    content TEXT,
    source_event_id TEXT,
    created_at REAL
)

CREATE TABLE mcp_tool_calls (
    tool_call_id TEXT PRIMARY KEY,
    session_id TEXT,
    trace_id TEXT,
    tool TEXT,
    ok INTEGER,
    duration_ms REAL,
    args_bytes REAL,
    result_bytes REAL,
    error TEXT,
    created_at REAL
)
```

**Operations**:
- `record_session_lineage()`: Record session creation/resume/fork
- `get_session_lineage()`: Get session lineage chain
- `compile_resume_snapshot()`: Compile snapshot from events
- `list_mcp_tool_calls()`: List tool calls for session

---

### Sessions API (api/sessions.py)

**Endpoints**:
- `POST /sessions/{session_id}/resume`: Resume session from snapshot
- `GET /sessions/{session_id}/resume_snapshot`: Get resume snapshot
- `POST /sessions/{session_id}/fork`: Fork session
- `GET /sessions/{session_id}/lineage`: Get session lineage chain
- `GET /sessions/{session_id}/tools`: List tool calls
- `GET /sessions/{session_id}/checkpoints`: List checkpoints

---

## Checkpoint System

### Purpose

Enable resumable streaming by persisting token positions to disk

### Components

**Checkpoint Model** (checkpoint_model.py):
- Token index
- SHA hash of content
- Timestamp

**Redis Stream** (redis_stream.py):
- In-memory buffer for streaming tokens
- Redis-based for performance
- Supports backpressure

**SQLite Writer** (sqlite_writer.py):
- Persists checkpoints to SQLite
- Commits in batches
- Supports resume from last checkpoint

**Reader** (reader.py):
- Reads checkpoints from database
- Reconstructs stream state
- Supports seeking to specific token

**Database Schema**:
```sql
CREATE TABLE checkpoints2 (
    session_id TEXT,
    token_index INTEGER,
    sha TEXT,
    created_at REAL,
    committed INTEGER,
    PRIMARY KEY (session_id, token_index)
)
```

---

## Failover Mechanism

### Purpose

Automatically switch to backup backend on primary failure

### Components

**Failover Manager** (failover/manager.py):
- Monitors backend health
- Triggers failover on failure
- Manages failover state machine

**Health Monitor** (failover/health.py):
- Periodic health checks
- Health score computation
- Degradation detection

**Continuation Strategies** (failover/continuation.py):
- Strategies for continuing after failover
- Context preservation
- State synchronization

**Failover Events**:
```python
emitter.emit(
    session_id=session_id,
    event_type=EventType.ERROR,
    event_name="failover_triggered",
    payload={
        "from_backend": primary.model_id,
        "to_backend": fallback.model_id,
        "reason": str(error),
    },
    tags=["failover", "error"],
)
```

---

## Replay System

### Purpose

Replay past sessions for analysis, reflection, and insight generation

### Components

**Replay Engine** (replay/engine.py):
- Reconstructs session from events
- Executes replay phases
- Tracks replay state

**Replay Phases** (replay/phases.py):
1. **Ingest**: Load events from store
2. **Parse**: Parse and normalize events
3. **Analyze**: Analyze patterns and metrics
4. **Reflect**: Generate reflections
5. **Report**: Generate summary report

**Reflection** (replay/reflection.py):
- Analyzes session outcomes
- Identifies improvement areas
- Generates observations

**Insights** (replay/insights.py):
- Generates actionable insights
- Identifies patterns
- Suggests optimizations

**Statistics** (replay/stats.py):
- Computes session statistics
- Token counts, latency metrics
- Tool call success rates

**Summary** (replay/summary.py):
- Generates human-readable summary
- Highlights key events
- Provides executive overview

---

## Cognitive Layer

### Purpose

Implement cognitive operations: governance, audit, documentation, runbooks

### Components

**Governance** (cognitive/governance.py):
- Enforce governance rules
- Validate agent proposals
- Emit governance events

**Audit** (cognitive/audit.py):
- Generate audit trails
- Track compliance
- Identify violations

**Dashboard** (cognitive/dashboard.py):
- Generate dashboard data
- Aggregate metrics
- Visualize trends

**Documentation** (cognitive/docs.py):
- Auto-generate documentation
- Update knowledge base
- Maintain API docs

**Runbook** (cognitive/runbook.py):
- Generate runbooks from sessions
- Capture operational procedures
- Maintain SOPs

---

## MCP Integration

### Purpose

Integrate with Model Context Protocol for tool execution

### MCP API (mcp/api.py)

**Endpoints**:
- Tool listing
- Tool invocation
- Server management
- Tool call history

**Tool Call Tracking**:
```sql
CREATE TABLE mcp_tool_calls (
    tool_call_id TEXT PRIMARY KEY,
    session_id TEXT,
    trace_id TEXT,
    tool TEXT,
    ok INTEGER,
    duration_ms REAL,
    args_bytes REAL,
    result_bytes REAL,
    error TEXT,
    created_at REAL
)
```

---

## Telemetry & Metrics

### Metrics (telemetry/metrics.py)

**Purpose**: Track performance and health metrics using Prometheus

**Metrics Tracked**:
- `model_failures_total`: Total failures per backend
- `model_latency_ms`: Latency per backend
- `model_tokens_sec`: Tokens per second per backend
- `redis_pressure_events_total`: Redis backpressure events
- `ttft_safeguard_total`: Time to first token safeguard triggers

**Snapshot Structure**:
```python
@dataclass
class Snapshot:
    backend_id: str
    latency_ms: float
    tokens_per_sec: float
    tokens: int
    duration_s: float
```

**Usage**:
```python
metrics.observe_generation(
    backend_id="llama3.1",
    latency_ms=123.45,
    tokens=100,
    duration_s=2.5
)
metrics.inc_failure("llama3.1")
```

---

## API Endpoints

### Core Endpoints

**Completions**:
- `POST /v1/chat/completions` - Chat completion with streaming

**Health**:
- `GET /health` - Health check with backend status
- `GET /identity` - KNEZ instance identity
- `GET /governance/snapshot` - Governance configuration snapshot

**Sessions**:
- `POST /sessions/{session_id}/resume` - Resume session
- `GET /sessions/{session_id}/resume_snapshot` - Get resume snapshot
- `POST /sessions/{session_id}/fork` - Fork session
- `GET /sessions/{session_id}/lineage` - Get session lineage
- `GET /sessions/{session_id}/tools` - List tool calls
- `GET /sessions/{session_id}/checkpoints` - List checkpoints

**Events**:
- `GET /events` - Query events with filters

**Memory**:
- `GET /memory` - List memories
- `POST /memory` - Add memory
- `GET /memory/knowledge` - List knowledge base
- `POST /memory/knowledge` - Add to knowledge base
- `POST /memory/gate/check` - Trigger memory gate

**Replay**:
- `POST /replay/{session_id}` - Start replay
- `GET /replay/{session_id}/status` - Get replay status
- `GET /replay/{session_id}/summary` - Get replay summary

**Cognitive**:
- `GET /cognitive/governance` - Get governance state
- `GET /cognitive/audit` - Get audit trail
- `GET /cognitive/dashboard` - Get dashboard data

**MCP**:
- `GET /mcp/tools` - List available tools
- `POST /mcp/call` - Execute tool call

**Perception**:
- `GET /perception/data` - Get perception data

---

## Data Flow

### Chat Completion Flow

```
User Request
    ↓
FastAPI /v1/chat/completions
    ↓
Router.select_backend()
    ↓
Backend.generate() (streaming)
    ↓
Tokens yielded via SSE
    ↓
CheckpointWorker persists to SQLite
    ↓
Metrics emitted to EventStore
    ↓
Response streamed to client
```

### Tool Call Flow

```
Model outputs tool_call
    ↓
Frontend receives via SSE
    ↓
Frontend invokes MCP tool
    ↓
Tool execution tracked in sessions.store
    ↓
Result returned to model
    ↓
Model generates explanation
    ↓
Response streamed to client
```

### Event Flow

```
Any operation
    ↓
EventEmitter.emit()
    ↓
EventStore queue
    ↓
Background task writes to events.log
    ↓
Queryable via /events endpoint
```

---

## Configuration & Environment

### Environment Variables

**Backend Configuration**:
- `OLLAMA_ENDPOINT`: Ollama instance URL (default: http://localhost:11434)
- `DEFAULT_MODEL`: Default model ID

**Database Configuration**:
- `KNEZ_MEMORY_DB_PATH`: Path to memory database (default: data/memory.db)
- `KNEZ_SESSIONS_DB_PATH`: Path to sessions database (default: data/sessions.db)

**Redis Configuration**:
- `REDIS_URL`: Redis connection URL for checkpoints
- `REDIS_PASSWORD`: Redis password

**Feature Flags**:
- `ENABLE_CLOUD_BACKEND`: Enable cloud backend
- `ENABLE_REPLAY`: Enable replay system
- `ENABLE_COGNITIVE`: Enable cognitive layer

---

## Performance Optimizations

### Implemented Optimizations

1. **Health Score Caching** (router/router.py):
   - Cache health scores for 5 seconds
   - Reduces redundant health checks
   - Estimated savings: 50-100ms per request

2. **Memory Hint Timeout** (router/router.py):
   - 100ms timeout on memory hint generation
   - Prevents blocking on slow generation
   - Estimated savings: 0-100ms per request

3. **Connection Pooling** (local_backend.py):
   - Reuse HTTP connections
   - Prevents CLOSE_WAIT accumulation
   - Estimated savings: 50-200ms per request

4. **Checkpoint Batching** (sqlite_writer.py):
   - Batch checkpoint commits
   - Reduces disk I/O
   - Estimated savings: 10-50ms per checkpoint

5. **Event Queue** (events/store.py):
   - Async queue for event writes
   - Non-blocking event emission
   - Estimated savings: <1ms per event

6. **Removed asyncio.sleep(0)** (completions.py):
   - Removed unnecessary yield in streaming
   - Improves continuous token flow
   - Estimated savings: 1-5ms per token

---

## Known Issues & Limitations

### Current Limitations

1. **Cloud Backend**: Only skeleton implementation, not functional
2. **Redis Dependency**: Checkpoint system requires Redis (no fallback)
3. **Single-Process**: Not designed for horizontal scaling
4. **No Authentication**: No auth/authz layer
5. **Limited Testing**: Minimal test coverage
6. **Memory Gate**: Not fully implemented
7. **Replay System**: Experimental, not production-ready
8. **Cognitive Layer**: Early stage, limited functionality

### Potential Issues

1. **Event Store Growth**: events.log can grow unbounded
2. **Memory Database**: No cleanup mechanism for old memories
3. **Session Database**: No archival for old sessions
4. **Checkpoint Bloat**: Checkpoints can accumulate for long sessions
5. **Router Cache**: Health cache can become stale during rapid degradation

### Recommended Improvements

1. Add event log rotation
2. Implement memory retention policies
3. Add session archival mechanism
4. Implement checkpoint cleanup
5. Add health cache invalidation on degradation events
6. Add authentication/authorization layer
7. Implement horizontal scaling support
8. Add comprehensive test suite
9. Implement cloud backends (OpenAI, Anthropic)
10. Add Redis fallback for checkpoints

---

## Conclusion

KNEZ is a well-structured, modular backend system designed for AI agent operations. It provides:

- **Model Abstraction**: Pluggable backend interface
- **Intelligent Routing**: Health-based backend selection
- **Streaming-First**: Real-time token streaming
- **Event-Driven**: Comprehensive observability
- **Persistence**: Checkpoints and session lineage
- **Failover**: Automatic backend switching
- **Memory**: Long-term memory storage
- **Replay**: Session analysis and reflection

The architecture is solid but still evolving. Key areas for improvement include cloud backend support, scaling, authentication, and cleanup mechanisms.

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-02 (knez-control-app), DOC-03 (Integration Patterns), DOC-04 (Component Analysis)
