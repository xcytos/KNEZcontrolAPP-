# KNEZ Tech Stack Documentation

## Overview

KNEZ (Knowledge Neural Execution Zone) is a FastAPI-based Python backend that provides AI model inference, tool execution, cognitive system management, and MCP (Model Control Plane) orchestration. This document covers the technology stack used in the KNEZ backend.

## Core Technologies

### Web Framework
- **FastAPI**: Modern, fast web framework for building APIs with Python
  - Automatic OpenAPI documentation
  - Type hints for validation
  - Async support
  - Dependency injection

### ASGI Server
- **Uvicorn**: Lightning-fast ASGI server
  - Async I/O support
  - Production-ready
  - WebSocket support

### Data Validation
- **Pydantic**: Data validation using Python type annotations
  - Automatic validation
  - Serialization/deserialization
  - Schema generation

### HTTP Client
- **httpx**: Modern HTTP client for Python
  - Async support
  - HTTP/2 support
  - Connection pooling

- **aiohttp**: Async HTTP client/server
  - WebSocket support
  - Async I/O

### Caching
- **Redis**: In-memory data structure store
  - Token checkpointing
  - Session caching
  - Event streaming

### Database
- **SQLite**: Lightweight SQL database
  - Session persistence
  - Event storage
  - Memory storage

- **aiosqlite**: Async SQLite driver
  - Async database operations
  - Connection pooling

### Async Runtime
- **asyncio**: Python async I/O library
  - Concurrent execution
  - Event loop management
  - Coroutine support

## Additional Libraries

### Monitoring
- **prometheus_client**: Prometheus metrics exporter
  - Metrics collection
  - HTTP endpoint for metrics
  - Custom metrics support

### Testing
- **pytest**: Python testing framework
  - Test discovery
  - Fixtures
  - Assertions

- **pytest-asyncio**: Async pytest support
  - Async test cases
  - Event loop management

- **respx**: HTTP mocking for httpx
  - Request/response mocking
  - Pattern matching
  - Async support

- **pytest-timeout**: Test timeout support
  - Timeout enforcement
  - Hanging test detection

### WebSockets
- **websockets**: WebSocket library for Python
  - WebSocket client/server
  - Async support
  - Protocol compliance

## Backend Models

### Local Backend
- **Ollama Integration**: Local LLM inference
  - Model loading
  - Token generation
  - Streaming support

### Cloud Backend
- **OpenAI Integration**: Cloud LLM inference
  - API client
  - Token generation
  - Streaming support

## Cognitive System Libraries

### Influence System
- **knez.cognitive.influence**: Influence contracts and routing
  - Contract management
  - Runtime switches
  - Routing adaptation

### Governance System
- **knez.cognitive.governance**: Governance and approval
  - Approval queue
  - Policy enforcement
  - Audit trails

### Memory System
- **knez.memory**: Memory management
  - Memory storage
  - Memory retrieval
  - Memory hints

### Perception System
- **knez.perception**: Perception and monitoring
  - Active window detection
  - Screenshot capture
  - System state monitoring

## MCP Integration

### MCP Server
- **knez.mcp**: MCP server implementation
  - Tool registration
  - Tool execution
  - Server lifecycle

### MCP Client
- **knez.mcp.client**: MCP client for external servers
  - Server discovery
  - Tool invocation
  - Status monitoring

## Event System

### Event Emitter
- **knez.knez_core.events**: Event emission and routing
  - Event types
  - Event sources
  - Event severity
  - Event streaming

### Event Storage
- **knez.knez_core.storage**: Event persistence
  - SQLite storage
  - Event querying
  - Event filtering

## Router System

### Backend Router
- **knez.knez_core.router**: Backend selection and routing
  - Health scoring
  - Memory hints
  - Influence application
  - Graceful degradation

### Backend Models
- **knez.knez_core.models**: Backend model interfaces
  - BaseBackend interface
  - LocalBackend implementation
  - CloudBackend implementation

## API Endpoints

### Completions API
- **/v1/chat/completions**: Chat completions endpoint
  - Streaming support
  - Tool calling
  - Backend selection

### Health API
- **/health**: Health check endpoint
  - Backend status
  - System status

### Sessions API
- **/sessions/create**: Create new session
- **/sessions/{id}/fork**: Fork session
- **/sessions/{id}/resume**: Resume session
- **/sessions/{id}/lineage**: Get session lineage

### Events API
- **/events**: Event listing
- **/events/stream**: Event streaming (WebSocket)

### Memory API
- **/memory**: Memory listing
- **/memory/{id}**: Memory detail
- **/memory/gate/check**: Memory gate check

### Cognitive API
- **/state/overview**: Cognitive state overview
- **/state/governance**: Governance state
- **/state/influence**: Influence state
- **/state/taqwin**: TAQWIN state
- **/audit/consistency**: Audit consistency reports

### MCP API
- **/mcp/registry**: MCP server registry
- **/mcp/registry/report**: MCP runtime reporting

### Perception API
- **/perception/snapshot**: Take perception snapshot
- **/perception/active_window**: Get active window

## Configuration

### Environment Variables
- Database paths
- Redis connection
- Ollama endpoint
- OpenAI API key
- Logging configuration

### Configuration Files
- **config.yaml**: Application configuration
- **logging.yaml**: Logging configuration

## Development Tools

### Code Quality
- **Black**: Code formatter
- **isort**: Import sorter
- **mypy**: Type checker
- **flake8**: Linter

### Documentation
- **Sphinx**: Documentation generator
- **mkdocs**: Static site generator

## Deployment

### Containerization
- **Docker**: Container platform
- **Docker Compose**: Multi-container orchestration

### Process Management
- **systemd**: Linux service manager
- **supervisor**: Process control system

## Performance

### Async I/O
- All I/O operations are async
- Non-blocking database operations
- Concurrent HTTP requests

### Caching
- Redis for hot data
- In-memory caching for frequently accessed data
- Token checkpointing for streaming

### Connection Pooling
- Database connection pooling
- HTTP connection pooling
- Redis connection pooling

## Security

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

## Monitoring

### Metrics
- Prometheus metrics
- Custom metrics for:
  - Request latency
  - Token generation rate
  - Tool execution time
  - Backend health

### Logging
- Structured logging
- Log levels (DEBUG, INFO, WARNING, ERROR)
- Log rotation
- Log aggregation

### Health Checks
- Backend health monitoring
- System resource monitoring
- Dependency health checks

## Summary

KNEZ uses a modern Python async stack:
- **FastAPI** for web framework
- **Uvicorn** for ASGI server
- **Pydantic** for validation
- **Redis** for caching
- **SQLite** for persistence
- **httpx/aiohttp** for HTTP clients
- **asyncio** for async runtime

Additional libraries provide:
- Cognitive system management
- MCP orchestration
- Event streaming
- Monitoring and metrics
- Testing support
