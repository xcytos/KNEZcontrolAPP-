# KNEZ Core Documentation

## Overview

KNEZ Core provides the foundational services for the KNEZ backend, including the FastAPI application, router, event system, storage, and monitoring. This document covers the core components and their workflows.

## FastAPI Application

**Location:** `KNEZ/knez/knez_core/app.py`

### Responsibilities
Main FastAPI application setup, middleware configuration, router inclusion, and lifecycle management.

### Key Components

#### Application Setup
```python
app = FastAPI(
    title="KNEZ API",
    description="Knowledge Neural Execution Zone",
    version="1.0.0"
)
```

#### Middleware
- **CORS**: Cross-Origin Resource Sharing for frontend access
- **Custom middleware**: Request logging, error handling

#### Router Inclusion
- Completions API
- Health API
- Sessions API
- Events API
- Memory API
- Cognitive API
- MCP API
- Perception API
- WebSocket endpoints

#### Lifecycle Events
- **startup**: Initialize supervisors, monitors, database connections
- **shutdown**: Cleanup resources, close connections

### Startup Workflow
1. Initialize database connections
2. Initialize Redis connection
3. Initialize event emitter
4. Initialize supervisors
5. Initialize monitors
6. Load configuration
7. Start background tasks

### Shutdown Workflow
1. Stop background tasks
2. Close database connections
3. Close Redis connection
4. Cleanup resources
5. Log shutdown

## Router

**Location:** `KNEZ/knez/knez_core/router/router.py`

### Responsibilities
Backend selection for generation requests with health scoring, memory hints, and influence application.

### Key Features

#### Health Score Caching
- Cache health scores for 5 seconds
- Avoid repeated health checks
- Async cache lock for thread safety

#### Graceful Degradation
- Track unhealthy backends
- Recheck unhealthy backends every 10s
- Fallback to all backends if all unhealthy
- Emit degradation events

#### Memory Hint Generation
- Non-blocking with 100ms timeout
- Generate hints for routing decisions
- Emit memory hint events

#### Influence Application
- Apply influence contracts to routing
- Modify backend scores based on influence
- Emit influence execution traces

### Key Methods

#### select(request: GenerationRequest) -> BaseBackend

Selects backend for generation request.

**Workflow:**
1. Classify request
2. Filter out unhealthy backends
3. Generate memory hints (with timeout)
4. Score backends by health (cached)
5. Apply influence contracts
6. Sort by score
7. Select highest-scoring backend
8. Emit routing decision event
9. Return selected backend

**Error Handling:**
- Handle memory hint timeout
- Handle health check failures
- Handle influence application errors
- Fallback to any backend if all fail

### Scoring

#### Health Score
- 0.0: Unhealthy
- 0.5-1.0: Healthy
- Higher score = better backend

#### Influence Application
- Modify scores based on influence contracts
- Respect kill switches
- Apply max weight limits

## Event System

**Location:** `KNEZ/knez/knez_core/events.py`

### Responsibilities
Event emission, routing, persistence, and streaming.

### Event Types

#### EventType Enum
- **INPUT**: User input events
- **ANALYSIS**: Analysis events
- **DECISION**: Decision events
- **ACTION**: Action events
- **ERROR**: Error events

#### EventSource Enum
- **KNEZ_CORE**: Core system events
- **COGNITIVE**: Cognitive system events
- **MCP**: MCP system events
- **BACKEND**: Backend events

#### EventSeverity Enum
- **DEBUG**: Debug information
- **INFO**: General information
- **WARNING**: Warning messages
- **ERROR**: Error messages

### Event Structure

```python
class Event:
    session_id: Optional[str]
    task_id: Optional[str]
    event_type: EventType
    event_name: str
    source: EventSource
    severity: EventSeverity
    payload: Dict[str, Any]
    tags: List[str]
    timestamp: str
```

### Key Methods

#### emit(args)

Emits event to all subscribers.

**Workflow:**
1. Create event from args
2. Add timestamp
3. Persist to storage
4. Stream to WebSocket subscribers
5. Log event
6. Notify subscribers

#### subscribe(callback)

Subscribes to all events.

**Workflow:**
1. Register callback
2. Return unsubscribe function

### Event Persistence

Events are persisted to SQLite for:
- Event history
- Audit trails
- Debugging
- Analysis

### Event Streaming

Events are streamed via WebSocket for:
- Real-time UI updates
- Live monitoring
- Debugging

## Storage Layer

**Location:** `KNEZ/knez/knez_core/storage/`

### Responsibilities
Database operations for sessions, events, memory, and checkpoints.

### Database Schema

#### sessions Table
```python
{
  id: str (primary key)
  name: str
  created_at: str
  updated_at: str
  agent_id: Optional[str]
}
```

#### events Table
```python
{
  id: str (primary key)
  session_id: str (indexed)
  task_id: Optional[str]
  event_type: str
  event_name: str
  source: str
  severity: str
  payload: JSON
  tags: JSON
  timestamp: str (indexed)
}
```

#### memory Table
```python
{
  memory_id: str (primary key)
  session_id: str (indexed)
  memory_type: str
  summary: str
  evidence_event_ids: JSON
  confidence: float
  retention_policy: str
  created_at: str (indexed)
}
```

#### checkpoints Table
```python
{
  session_id: str (indexed)
  token_index: int
  sha: str
  created_at: float
}
```

### Key Operations

#### Session Operations
- Create session
- Get session
- Update session
- Delete session

#### Event Operations
- Insert event
- Query events (by session, type, time range)
- Count events

#### Memory Operations
- Insert memory
- Query memory (by session, type)
- Delete memory

#### Checkpoint Operations
- Insert checkpoint
- Query checkpoints (by session)
- Delete checkpoints

## Backend Models

**Location:** `KNEZ/knez/knez_core/models/`

### BaseBackend Interface

**Location:** `base.py`

Abstract interface for backend implementations.

```python
class BaseBackend(ABC):
    model_id: str
    
    @abstractmethod
    async def health() -> HealthResponse:
        pass
    
    @abstractmethod
    async def generate(request: GenerationRequest) -> GenerationResponse:
        pass
    
    @abstractmethod
    async def stream(request: GenerationRequest) -> AsyncIterator[str]:
        pass
```

### LocalBackend

**Location:** `local.py`

Ollama integration for local LLM inference.

**Key Features:**
- Ollama HTTP client
- Model loading
- Token generation
- Streaming support
- Health monitoring

**Methods:**
- `health()`: Check Ollama health
- `generate()`: Generate tokens
- `stream()`: Stream tokens

### CloudBackend

**Location:** `cloud.py`

OpenAI integration for cloud LLM inference.

**Key Features:**
- OpenAI API client
- Token generation
- Streaming support
- Error handling
- Fallback support

**Methods:**
- `health()`: Check OpenAI API health
- `generate()`: Generate tokens
- `stream()`: Stream tokens

## Completions API

**Location:** `KNEZ/knez/knez_core/api/completions.py`

### Responsibilities
Chat completions endpoint with streaming, backend selection, and checkpointing.

### Key Features

#### Streaming Support
- Server-Sent Events (SSE) for streaming
- Token-by-token streaming
- Real-time updates

#### Backend Selection
- Router selects backend
- Fallback on failure
- Health-based selection

#### Checkpointing
- Token checkpointing to Redis
- Token persistence to SQLite
- Resume capability

#### Event Emission
- Token stream start event
- Token stream end event
- Tool call events
- Error events

### Workflow

1. Receive chat completion request
2. Validate request
3. Select backend via Router
4. Start streaming response
5. Emit token stream start event
6. Stream tokens from backend
7. Checkpoint tokens to Redis
8. Persist tokens to SQLite
9. Handle tool calls
10. Emit token stream end event
11. Return final response

## WebSocket Handler

**Location:** `KNEZ/knez/knez_core/websocket/`

### Responsibilities
WebSocket connection management and event streaming.

### Key Features

#### Connection Management
- Session-based authentication
- Connection tracking
- Reconnection handling

#### Event Streaming
- Real-time event streaming
- Event filtering by session
- Event filtering by type

#### Connection Health
- Ping/pong for health check
- Timeout detection
- Automatic disconnect

### Workflow

1. Accept WebSocket connection
2. Authenticate session
3. Subscribe to event emitter
4. Stream events to client
5. Handle disconnection
6. Cleanup resources

## Monitoring

**Location:** `KNEZ/knez/knez_core/monitoring/`

### Health Monitor

**Location:** `health_monitor.py`

Backend health monitoring with periodic checks.

**Key Features:**
- Periodic health checks
- Health scoring
- Alert generation
- Metrics collection

**Workflow:**
1. Check backend health
2. Calculate health score
3. Update health cache
4. Emit health event
5. Check for alerts
6. Collect metrics

### Metrics

**Location:** `metrics.py`

Prometheus metrics for monitoring.

**Metrics:**
- Request latency
- Token generation rate
- Tool execution time
- Backend health
- Error rates

**Endpoint:**
- `/metrics`: Prometheus metrics endpoint

## Error Handling

**Location:** `KNEZ/knez/knez_core/utils/exceptions.py`

### Error Types

#### BackendFailure
Backend inference failure.

#### ValidationError
Request validation failure.

#### StorageError
Storage operation failure.

#### MCPError
MCP operation failure.

### Error Handling Strategy

1. **Validation Layer**: Pydantic validates requests
2. **Service Layer**: Services catch and log errors
3. **API Layer**: API returns appropriate HTTP status codes
4. **Event Layer**: Errors emitted as events
5. **Monitoring Layer**: Errors tracked in metrics

## Summary

KNEZ Core provides:
- **FastAPI Application**: Main application setup
- **Router**: Backend selection with health scoring
- **Event System**: Event emission and routing
- **Storage Layer**: Database operations
- **Backend Models**: Local and cloud backends
- **Completions API**: Chat completions with streaming
- **WebSocket Handler**: Real-time event streaming
- **Monitoring**: Health checks and metrics
