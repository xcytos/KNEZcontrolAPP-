# KNEZ Integrations Documentation

## Overview

KNEZ integrates with various external systems including local LLM providers (Ollama), cloud LLM providers (OpenAI), MCP servers, and monitoring systems. This document covers these integrations and their implementation details.

## Ollama Integration

**Location:** `KNEZ/knez/knez_core/models/local.py`

### Responsibilities
Local LLM inference via Ollama HTTP API.

### Connection

**Endpoint:** `http://localhost:11434`

**API Endpoints Used:**
- `POST /api/generate`: Token generation
- `POST /api/chat`: Chat completions
- `GET /api/tags`: List available models
- `POST /api/pull`: Pull model
- `POST /api/delete`: Delete model

### Key Features

#### Model Loading
```python
async def load_model(model: str) -> bool:
    # Pull model if not available
    # Wait for download completion
    # Return success status
```

#### Token Generation
```python
async def generate(request: GenerationRequest) -> GenerationResponse:
    # Build Ollama request
    # Send to /api/generate or /api/chat
    # Stream tokens
    # Return response
```

#### Streaming Support
```python
async def stream(request: GenerationRequest) -> AsyncIterator[str]:
    # Send streaming request
    # Yield tokens as they arrive
    # Handle connection errors
```

### Health Monitoring

**Health Check:**
```python
async def health() -> HealthResponse:
    # Check Ollama API availability
    # Check model availability
    # Return health status
```

**Health Metrics:**
- API availability
- Model loaded status
- Response time
- Error rate

### Error Handling

**Common Errors:**
- Connection refused (Ollama not running)
- Model not found
- Generation timeout
- Out of memory

**Recovery:**
- Retry with exponential backoff
- Fallback to cloud backend
- Emit error events

## OpenAI Integration

**Location:** `KNEZ/knez/knez_core/models/cloud.py`

### Responsibilities
Cloud LLM inference via OpenAI API.

### Connection

**API Base URL:** `https://api.openai.com/v1`

**Authentication:** API key via environment variable or configuration

### Key Features

#### Chat Completions
```python
async def generate(request: GenerationRequest) -> GenerationResponse:
    # Build OpenAI request
    # Send to /chat/completions
    # Parse response
    # Return response
```

#### Streaming Support
```python
async def stream(request: GenerationRequest) -> AsyncIterator[str]:
    # Send streaming request
    # Yield tokens from SSE stream
    # Handle rate limits
```

### Configuration

**Environment Variables:**
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: Default model (e.g., gpt-4)
- `OPENAI_BASE_URL`: Custom base URL (for proxies)

**Models Supported:**
- GPT-4
- GPT-3.5-turbo
- GPT-4-turbo
- Custom fine-tuned models

### Health Monitoring

**Health Check:**
```python
async def health() -> HealthResponse:
    # Check API key validity
    # Check API availability
    # Check rate limits
    # Return health status
```

**Health Metrics:**
- API availability
- Rate limit status
- Token usage
- Cost tracking

### Error Handling

**Common Errors:**
- Invalid API key
- Rate limit exceeded
- Insufficient quota
- Model not available

**Recovery:**
- Retry with exponential backoff
- Fallback to local backend
- Emit rate limit events

## MCP Integration

**Location:** `KNEZ/knez/mcp/`

### Responsibilities
MCP (Model Control Plane) server and client implementation for tool orchestration.

### MCP Server

**Location:** `KNEZ/knez/mcp/server.py`

**Responsibilities:**
- Tool registration
- Tool execution
- Server lifecycle
- JSON-RPC 2.0 protocol

**Tool Registration:**
```python
def register_tool(tool: McpTool):
    # Add tool to registry
    # Validate tool schema
    # Emit tool registered event
```

**Tool Execution:**
```python
async def execute_tool(tool_name: str, arguments: Dict) -> ToolResult:
    # Find tool in registry
    # Validate arguments
    # Execute tool
    # Return result
```

### MCP Client

**Location:** `KNEZ/knez/mcp/client.py`

**Responsibilities:**
- External MCP server discovery
- Tool invocation
- Status monitoring

**Server Discovery:**
```python
async def discover_servers() -> List[McpServer]:
    # Scan for MCP servers
    # Query server capabilities
    # Return server list
```

**Tool Invocation:**
```python
async def invoke_tool(server_id: str, tool_name: str, arguments: Dict) -> ToolResult:
    # Connect to server
    # Send JSON-RPC request
    # Parse response
    # Return result
```

### MCP Registry

**Location:** `KNEZ/knez/knez_core/api/mcp.py`

**Responsibilities:**
- MCP server registry API
- Runtime reporting

**Registry API:**
- `GET /mcp/registry`: Get server registry
- `POST /mcp/registry/report`: Report server runtime

**Registry Item:**
```python
class McpRegistryItem:
    id: str
    provider: str
    status: str
    capabilities: List[str]
```

### JSON-RPC 2.0 Protocol

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "string",
  "method": "string",
  "params": {}
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "string",
  "result": {}
}
```

**Error Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "string",
  "error": {
    "code": number,
    "message": "string",
    "data": {}
  }
}
```

## Redis Integration

**Location:** `KNEZ/knez/knez_core/storage/redis.py`

### Responsibilities
Caching, token checkpointing, and event streaming.

### Connection

**Default:** `redis://localhost:6379`

**Configuration:**
- Host
- Port
- Password
- Database number

### Key Uses

#### Token Checkpointing
```python
async def checkpoint_token(session_id: str, token_index: int, token: str):
    # Store token in Redis
    # Set expiry (24h)
    # For resume capability
```

#### Session Caching
```python
async def cache_session(session_id: str, session_data: Dict):
    # Cache session data
    # Set expiry (1h)
    # For fast access
```

#### Event Queue
```python
async def publish_event(event: Event):
    # Publish to Redis channel
    # For WebSocket streaming
    # For event distribution
```

### Data Structures

**Token Checkpoint:**
- Key: `checkpoint:{session_id}:{token_index}`
- Value: Token string
- TTL: 24 hours

**Session Cache:**
- Key: `session:{session_id}`
- Value: JSON session data
- TTL: 1 hour

**Event Queue:**
- Channel: `events:{session_id}`
- Message: JSON event data

### Error Handling

**Common Errors:**
- Connection refused
- Authentication failed
- Out of memory
- Timeout

**Recovery:**
- Reconnect with backoff
- Fallback to SQLite
- Emit error events

## SQLite Integration

**Location:** `KNEZ/knez/knez_core/storage/sqlite.py`

### Responsibilities
Persistent storage for sessions, events, memory, and checkpoints.

### Connection

**Database File:** `knez.db` (configurable)

**Connection Pool:**
- Async connection pool via aiosqlite
- Connection reuse
- Automatic reconnection

### Schema

#### sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  agent_id TEXT
);
```

#### events Table
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  payload TEXT,
  tags TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

#### memory Table
```sql
CREATE TABLE memory (
  memory_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_event_ids TEXT,
  confidence REAL,
  retention_policy TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_memory_session_id ON memory(session_id);
CREATE INDEX idx_memory_created_at ON memory(created_at);
```

#### checkpoints Table
```sql
CREATE TABLE checkpoints (
  session_id TEXT NOT NULL,
  token_index INTEGER NOT NULL,
  sha TEXT NOT NULL,
  created_at REAL NOT NULL,
  PRIMARY KEY (session_id, token_index)
);

CREATE INDEX idx_checkpoints_session_id ON checkpoints(session_id);
```

### Operations

#### Session Operations
```python
async def create_session(session: Session) -> str:
    # Insert session
    # Return session ID

async def get_session(session_id: str) -> Optional[Session]:
    # Query session by ID
    # Return session or None

async def update_session(session_id: str, updates: Dict):
    # Update session
    # Update updated_at timestamp
```

#### Event Operations
```python
async def insert_event(event: Event) -> str:
    # Insert event
    # Return event ID

async def query_events(session_id: str, filters: Dict) -> List[Event]:
    # Query events with filters
    # Return events

async def count_events(session_id: str) -> int:
    # Count events for session
    # Return count
```

#### Memory Operations
```python
async def insert_memory(memory: MemoryEntry) -> str:
    # Insert memory
    # Return memory ID

async def query_memory(session_id: str, filters: Dict) -> List[MemoryEntry]:
    # Query memory with filters
    # Return memories
```

#### Checkpoint Operations
```python
async def insert_checkpoint(session_id: str, token_index: int, sha: str):
    # Insert checkpoint
    # For resume capability

async def query_checkpoints(session_id: str) -> List[Checkpoint]:
    # Query checkpoints for session
    # Return checkpoints
```

### Transactions

**Transaction Support:**
```python
async def transaction(operations: List[Callable]):
    # Begin transaction
    # Execute operations
    # Commit on success
    # Rollback on failure
```

### Error Handling

**Common Errors:**
- Database locked
- Constraint violation
- Disk full
- Corrupted database

**Recovery:**
- Retry with backoff
- Rollback transaction
- Emit error events
- Fallback to in-memory storage

## WebSocket Integration

**Location:** `KNEZ/knez/knez_core/websocket/`

### Responsibilities
Real-time event streaming to clients.

### Connection

**Endpoint:** `/ws/events/{session_id}`

**Authentication:** Session ID in URL path

### Event Streaming

**Server-Sent Events:**
```python
async def stream_events(websocket: WebSocket, session_id: str):
    # Subscribe to event emitter
    # Stream events as JSON
    # Handle disconnection
```

**Event Format:**
```json
{
  "id": "string",
  "session_id": "string",
  "event_type": "string",
  "event_name": "string",
  "source": "string",
  "severity": "string",
  "payload": {},
  "tags": [],
  "timestamp": "string"
}
```

### Connection Management

**Connection Tracking:**
```python
class ConnectionManager:
    active_connections: Dict[str, WebSocket]
    
    async def connect(session_id: str, websocket: WebSocket):
        # Register connection
        # Send initial state
        
    async def disconnect(session_id: str):
        # Unregister connection
        # Cleanup resources
```

**Broadcasting:**
```python
async def broadcast_event(event: Event):
    # Send event to all connections for session
    # Handle disconnected clients
```

### Error Handling

**Common Errors:**
- Connection timeout
- Invalid session ID
- WebSocket protocol error

**Recovery:**
- Close connection gracefully
- Emit error events
- Allow reconnection

## Prometheus Integration

**Location:** `KNEZ/knez/knez_core/monitoring/metrics.py`

### Responsibilities
Metrics collection and Prometheus endpoint.

### Metrics Endpoint

**Endpoint:** `/metrics`

**Format:** Prometheus text format

### Metrics Collected

#### Request Metrics
- `knez_request_duration_seconds`: Request latency histogram
- `knez_request_total`: Request count counter
- `knez_request_errors_total`: Error count counter

#### Token Metrics
- `knez_tokens_generated_total`: Token generation counter
- `knez_tokens_per_second`: Token generation rate gauge

#### Backend Metrics
- `knez_backend_health_score`: Backend health gauge
- `knez_backend_requests_total`: Backend request counter

#### Tool Metrics
- `knez_tool_execution_duration_seconds`: Tool execution histogram
- `knez_tool_execution_total`: Tool execution counter
- `knez_tool_errors_total`: Tool error counter

### Custom Metrics

**Creating Metrics:**
```python
from prometheus_client import Counter, Histogram, Gauge

request_counter = Counter('knez_request_total', 'Total requests', ['endpoint'])
request_duration = Histogram('knez_request_duration_seconds', 'Request duration')
backend_health = Gauge('knez_backend_health_score', 'Backend health', ['backend_id'])
```

**Recording Metrics:**
```python
request_counter.labels(endpoint='/completions').inc()
request_duration.observe(duration)
backend_health.labels(backend_id='ollama').set(score)
```

## Summary

KNEZ integrations include:
- **Ollama**: Local LLM inference
- **OpenAI**: Cloud LLM inference
- **MCP**: Tool orchestration
- **Redis**: Caching and checkpointing
- **SQLite**: Persistent storage
- **WebSocket**: Real-time events
- **Prometheus**: Metrics collection
