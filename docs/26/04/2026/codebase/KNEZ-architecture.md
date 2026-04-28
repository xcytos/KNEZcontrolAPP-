# KNEZ Architecture Overview

## Overview

KNEZ (Knowledge Neural Execution Zone) is a FastAPI-based Python backend that provides AI model inference, tool execution, cognitive system management, and MCP orchestration. The architecture follows a layered design with clear separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI Application                     │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (Routers)                                            │
│  ├── Completions API (/v1/chat/completions)                    │
│  ├── Health API (/health)                                       │
│  ├── Sessions API (/sessions)                                   │
│  ├── Events API (/events)                                       │
│  ├── Memory API (/memory)                                       │
│  ├── Cognitive API (/state, /audit)                             │
│  ├── MCP API (/mcp)                                             │
│  └── Perception API (/perception)                               │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                   │
│  ├── Router (Backend selection)                                 │
│  ├── Event Emitter (Event routing)                              │
│  ├── Memory Manager (Memory operations)                         │
│  ├── Cognitive Manager (Cognitive state)                        │
│  └── MCP Manager (MCP orchestration)                            │
├─────────────────────────────────────────────────────────────────┤
│  Backend Layer (Model Inference)                                │
│  ├── LocalBackend (Ollama)                                      │
│  ├── CloudBackend (OpenAI)                                      │
│  └── Backend Router (Selection logic)                           │
├─────────────────────────────────────────────────────────────────┤
│  Cognitive Layer                                                 │
│  ├── Influence System (Routing influence)                       │
│  ├── Governance System (Approval workflow)                      │
│  ├── Memory System (Knowledge storage)                          │
│  └── Perception System (System monitoring)                       │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                      │
│  ├── SQLite (Session, event, memory storage)                    │
│  ├── Redis (Caching, checkpointing)                             │
│  └── File System (Logs, static data)                             │
├─────────────────────────────────────────────────────────────────┤
│  External Integrations                                           │
│  ├── Ollama (Local LLM)                                         │
│  ├── OpenAI (Cloud LLM)                                         │
│  ├── MCP Servers (External tools)                               │
│  └── WebSocket Clients (Real-time events)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### FastAPI Application

**Location:** `KNEZ/knez/knez_core/app.py`

**Responsibilities:**
- Main FastAPI application setup
- CORS middleware configuration
- Router inclusion
- Startup/shutdown event handlers
- Supervisor and monitor initialization

**Key Features:**
- Automatic OpenAPI documentation
- Type-safe request/response validation
- Async request handling
- WebSocket support
- Background task management

### API Routers

#### Completions API

**Location:** `KNEZ/knez/knez_core/api/completions.py`

**Responsibilities:**
- Chat completions endpoint
- Streaming token generation
- Tool calling support
- Backend selection
- Checkpointing for tokens

**Key Features:**
- Streaming and non-streaming responses
- Backend selection via Router
- Token checkpointing to Redis/SQLite
- Event emission for observability
- Fallback mechanism on backend failure

**Workflow:**
1. Receive chat completion request
2. Select backend via Router
3. Generate tokens from backend
4. Stream tokens to client
5. Checkpoint tokens to Redis
6. Persist tokens to SQLite
7. Emit events for observability

#### Health API

**Location:** `KNEZ/knez/knez_core/api/health.py`

**Responsibilities:**
- Health check endpoint
- Backend status reporting
- System status reporting

**Key Features:**
- Backend health scoring
- System resource monitoring
- Dependency health checks

#### Sessions API

**Location:** `KNEZ/knez/knez_core/api/sessions.py`

**Responsibilities:**
- Session creation
- Session forking
- Session resuming
- Session lineage tracking

**Key Features:**
- Session ID generation
- Session metadata storage
- Fork from specific message
- Resume from snapshot
- Lineage chain tracking

#### Events API

**Location:** `KNEZ/knez/knez_core/api/events.py`

**Responsibilities:**
- Event listing
- Event streaming via WebSocket
- Event filtering

**Key Features:**
- Event pagination
- Session-based filtering
- Real-time event streaming
- Event type filtering

#### Memory API

**Location:** `KNEZ/knez/knez_core/api/memory.py`

**Responsibilities:**
- Memory listing
- Memory retrieval
- Memory gate checking

**Key Features:**
- Memory pagination
- Session-based filtering
- Time-based filtering
- Memory gate validation

#### Cognitive API

**Location:** `KNEZ/knez/cognitive/api.py`

**Responsibilities:**
- Cognitive state overview
- Governance state
- Influence state
- TAQWIN state
- Audit consistency reports

**Key Features:**
- State aggregation
- Audit execution
- Influence contract management
- Approval queue management

#### MCP API

**Location:** `KNEZ/knez/knez_core/api/mcp.py`

**Responsibilities:**
- MCP server registry
- MCP runtime reporting

**Key Features:**
- Server discovery
- Server status reporting
- Runtime metrics

#### Perception API

**Location:** `KNEZ/knez/knez_core/api/perception.py`

**Responsibilities:**
- Perception snapshot
- Active window detection

**Key Features:**
- Screenshot capture
- Window information
- System state monitoring

## Service Layer Architecture

### Router

**Location:** `KNEZ/knez/knez_core/router/router.py`

**Responsibilities:**
- Backend selection for generation requests
- Health scoring and caching
- Memory hint generation
- Influence application
- Graceful degradation

**Key Features:**
- Health score caching (5s TTL)
- Unhealthy backend tracking
- Memory hint generation (non-blocking)
- Influence contract application
- Graceful degradation on all backends unhealthy

**Selection Logic:**
1. Classify request
2. Filter out unhealthy backends
3. Generate memory hints (with timeout)
4. Score backends by health
5. Apply influence contracts
6. Select highest-scoring backend
7. Emit routing decision event

### Event Emitter

**Location:** `KNEZ/knez/knez_core/events.py`

**Responsibilities:**
- Event emission and routing
- Event persistence
- Event streaming

**Event Types:**
- INPUT: User input events
- ANALYSIS: Analysis events
- DECISION: Decision events
- ACTION: Action events
- ERROR: Error events

**Event Sources:**
- KNEZ_CORE: Core system events
- COGNITIVE: Cognitive system events
- MCP: MCP system events

**Event Severity:**
- DEBUG: Debug information
- INFO: General information
- WARNING: Warning messages
- ERROR: Error messages

### Memory Manager

**Location:** `KNEZ/knez/memory/`

**Responsibilities:**
- Memory storage and retrieval
- Memory hint generation
- Memory gate validation

**Key Components:**
- **MemoryStorage**: Database operations
- **MemoryHintGenerator**: Hint generation for routing
- **MemoryGate**: Memory access control

### Cognitive Manager

**Location:** `KNEZ/knez/cognitive/`

**Responsibilities:**
- Cognitive state management
- Influence system
- Governance system
- Perception system

**Key Components:**
- **Influence System**: Routing influence contracts
- **Governance System**: Approval workflow
- **Perception System**: System monitoring
- **Dashboard**: State aggregation

### MCP Manager

**Location:** `KNEZ/knez/mcp/`

**Responsibilities:**
- MCP server lifecycle
- Tool registration
- Tool execution

**Key Components:**
- **McpServer**: MCP server implementation
- **McpClient**: MCP client for external servers
- **ToolRegistry**: Tool catalog

## Backend Layer Architecture

### BaseBackend Interface

**Location:** `KNEZ/knez/knez_core/models/base.py`

**Responsibilities:**
- Abstract interface for backend implementations
- Common backend operations

**Methods:**
- `health()`: Health check
- `generate()`: Token generation
- `stream()`: Streaming generation

### LocalBackend

**Location:** `KNEZ/knez/knez_core/models/local.py`

**Responsibilities:**
- Ollama integration for local LLM inference
- Token generation
- Streaming support

**Key Features:**
- Ollama HTTP client
- Model loading
- Token streaming
- Error handling

### CloudBackend

**Location:** `KNEZ/knez/knez_core/models/cloud.py`

**Responsibilities:**
- OpenAI integration for cloud LLM inference
- Token generation
- Streaming support

**Key Features:**
- OpenAI API client
- Token streaming
- Error handling
- Fallback support

## Cognitive Layer Architecture

### Influence System

**Location:** `KNEZ/knez/cognitive/influence/`

**Responsibilities:**
- Influence contract management
- Routing influence application
- Runtime switches

**Key Components:**
- **Contracts**: Influence contract storage
- **RoutingInfluenceAdapter**: Apply influence to routing
- **RuntimeSwitches**: Global/domain/influence toggles

**Influence Types:**
- Routing influence
- Tool selection influence
- Parameter influence

### Governance System

**Location:** `KNEZ/knez/cognitive/governance/`

**Responsibilities:**
- Approval workflow
- Policy enforcement
- Audit trails

**Key Components:**
- **ApprovalQueue**: Pending approvals
- **PolicyEngine**: Policy evaluation
- **AuditLogger**: Audit logging

### Memory System

**Location:** `KNEZ/knez/memory/`

**Responsibilities:**
- Knowledge storage
- Memory retrieval
- Memory hints

**Key Components:**
- **MemoryStorage**: Database operations
- **MemoryHintGenerator**: Hint generation
- **MemoryGate**: Access control

### Perception System

**Location:** `KNEZ/knez/perception/`

**Responsibilities:**
- System monitoring
- Active window detection
- Screenshot capture

**Key Components:**
- **SnapshotManager**: Screenshot capture
- **WindowDetector**: Active window detection
- **StateMonitor**: System state monitoring

## Data Layer Architecture

### SQLite Database

**Location:** `KNEZ/knez/knez_core/storage/`

**Responsibilities:**
- Session storage
- Event storage
- Memory storage
- Checkpoint storage

**Tables:**
- **sessions**: Session metadata
- **events**: Event log
- **memory**: Memory entries
- **checkpoints**: Token checkpoints

### Redis Cache

**Responsibilities:**
- Token checkpointing
- Session caching
- Event streaming
- Hot data caching

**Use Cases:**
- Token streaming checkpoint
- Session state cache
- Event queue
- Memory cache

## External Integrations

### Ollama Integration

**Location:** `KNEZ/knez/knez_core/models/local.py`

**Responsibilities:**
- Local LLM inference
- Model management
- Token generation

**Features:**
- HTTP client for Ollama API
- Model loading/unloading
- Token streaming
- Health monitoring

### OpenAI Integration

**Location:** `KNEZ/knez/knez_core/models/cloud.py`

**Responsibilities:**
- Cloud LLM inference
- Token generation
- API key management

**Features:**
- OpenAI API client
- Token streaming
- Error handling
- Rate limiting

### MCP Integration

**Location:** `KNEZ/knez/mcp/`

**Responsibilities:**
- MCP server implementation
- External MCP client
- Tool execution

**Features:**
- JSON-RPC 2.0 protocol
- Tool registration
- Tool execution
- Status monitoring

## WebSocket Architecture

### WebSocket Handler

**Location:** `KNEZ/knez/knez_core/websocket/`

**Responsibilities:**
- WebSocket connection management
- Event streaming
- Connection authentication

**Features:**
- Session-based authentication
- Event filtering
- Reconnection handling
- Connection health monitoring

## Monitoring Architecture

### Health Monitor

**Location:** `KNEZ/knez/knez_core/monitoring/health_monitor.py`

**Responsibilities:**
- Backend health monitoring
- System resource monitoring
- Dependency health checks

**Features:**
- Periodic health checks
- Health scoring
- Alert generation
- Metrics collection

### Metrics

**Location:** `KNEZ/knez/knez_core/monitoring/`

**Responsibilities:**
- Prometheus metrics
- Custom metrics
- Metrics endpoint

**Metrics:**
- Request latency
- Token generation rate
- Tool execution time
- Backend health
- Error rates

## Error Handling Architecture

### Error Types

**Location:** `KNEZ/knez/knez_core/utils/exceptions.py`

**Error Categories:**
- **BackendFailure**: Backend inference failure
- **ValidationError**: Request validation failure
- **StorageError**: Storage operation failure
- **MCPError**: MCP operation failure

### Error Handling Strategy

1. **Validation Layer**: Pydantic validates requests
2. **Service Layer**: Services catch and log errors
3. **API Layer**: API returns appropriate HTTP status codes
4. **Event Layer**: Errors emitted as events
5. **Monitoring Layer**: Errors tracked in metrics

## Security Architecture

### Authentication
- Session-based authentication
- WebSocket authentication
- API key validation (for cloud backends)

### Authorization
- Role-based access control
- Policy enforcement
- Approval workflow

### Data Security
- Encryption at rest (SQLite)
- Encryption in transit (TLS)
- Input validation (Pydantic)
- SQL injection prevention (parameterized queries)

## Performance Architecture

### Async I/O
- All I/O operations are async
- Non-blocking database operations
- Concurrent HTTP requests
- Async WebSocket handling

### Caching
- Redis for hot data
- In-memory caching
- Health score caching
- Memory hint caching

### Connection Pooling
- Database connection pooling
- HTTP connection pooling
- Redis connection pooling

### Streaming
- Token streaming for real-time responses
- Event streaming for real-time updates
- Checkpointing for resume capability

## Summary

KNEZ architecture follows a layered design:
- **API Layer**: FastAPI routers for HTTP endpoints
- **Service Layer**: Business logic and orchestration
- **Backend Layer**: Model inference (local/cloud)
- **Cognitive Layer**: Influence, governance, memory, perception
- **Data Layer**: SQLite and Redis for persistence
- **External Integrations**: Ollama, OpenAI, MCP servers

Key architectural patterns:
- **Async-first**: All I/O is async
- **Event-driven**: Event emission for observability
- **Layered**: Clear separation of concerns
- **Extensible**: Plugin-based backends and cognitive modules
- **Observable**: Metrics, events, and health checks
