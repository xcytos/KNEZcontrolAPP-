# DOC-04: Component Analysis & Function Mapping

## Executive Summary

This document provides a comprehensive analysis of components in both the KNEZ backend and knez-control-app frontend, mapping functions across the system. It identifies duplicated functionality, compatibility issues, and opportunities for consolidation.

## Table of Contents

1. [Component Inventory](#component-inventory)
2. [Function Mapping Matrix](#function-mapping-matrix)
3. [Backend Component Analysis](#backend-component-analysis)
4. [Frontend Component Analysis](#frontend-component-analysis)
5. [Duplicated Functionality](#duplicated-functionality)
6. [Cross-System Dependencies](#cross-system-dependencies)
7. [Data Flow Mapping](#data-flow-mapping)
8. [Service Layer Mapping](#service-layer-mapping)
9. [UI Component Mapping](#ui-component-mapping)
10. [Integration Points](#integration-points)
11. [Compatibility Matrix](#compatibility-matrix)
12. [Consolidation Opportunities](#consolidation-opportunities)
13. [Refactoring Recommendations](#refactoring-recommendations)

---

## Component Inventory

### Backend Components (KNEZ)

| Component | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| FastAPI App | app.py | Main application | Router, all routers |
| Router | router/router.py | Backend selection | BaseBackend, health scorer |
| Local Backend | models/local_backend.py | Ollama interface | httpx, Ollama API |
| Cloud Backend | models/cloud_backend.py | Cloud interface (stub) | None |
| Completions API | api/completions.py | Chat completions | Router, BaseBackend |
| Health API | api/health.py | Health checks | Router, Ollama |
| Sessions API | api/sessions.py | Session management | Session store |
| Events API | api/events_api.py | Events query | Event store |
| Memory API | memory/api.py | Memory operations | Memory store |
| Event Emitter | events/emitter.py | Event emission | Event store |
| Event Store | events/store.py | Event persistence | aiosqlite |
| Memory Store | memory/store.py | Memory persistence | aiosqlite |
| Session Store | sessions/store.py | Session persistence | aiosqlite |
| Checkpoint System | checkpoints/ | Streaming checkpoints | Redis, SQLite |
| Failover Manager | failover/manager.py | Failover logic | Health monitor |
| Replay Engine | replay/engine.py | Session replay | Event store |
| Telemetry | telemetry/metrics.py | Prometheus metrics | prometheus_client |
| Cognitive Layer | cognitive/ | Governance, audit | Event store |

### Frontend Components (knez-control-app)

| Component | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| App.tsx | App.tsx | Main app component | All features |
| ChatPane | features/chat/ChatPane.tsx | Chat UI | ChatService, MessageItem |
| MessageItem | features/chat/MessageItem.tsx | Message rendering | DataContracts |
| DebugPanel | features/chat/DebugPanel.tsx | Debug UI | ChatService |
| ChatService | services/ChatService.ts | Chat state | KnezClient, SessionDatabase |
| KnezClient | services/KnezClient.ts | Backend client | Tauri HTTP |
| SessionDatabase | services/SessionDatabase.ts | IndexedDB storage | Dexie |
| SessionController | services/SessionController.ts | Session lifecycle | SessionDatabase |
| McpOrchestrator | mcp/McpOrchestrator.ts | MCP orchestration | McpInspectorService |
| ToolExecutionService | services/ToolExecutionService.ts | Tool execution | McpOrchestrator |
| ToolExposureService | services/ToolExposureService.ts | Tool catalog | McpOrchestrator |
| GovernanceService | services/GovernanceService.ts | Governance rules | None |
| PresenceEngine | presence/PresenceEngine.ts | Presence state | None |
| Memory Services | services/Memory*.ts | Memory operations | KnezClient |
| AnalyticsService | services/AnalyticsService.ts | Analytics | Event store |
| DiagnosticsService | services/DiagnosticsService.ts | Diagnostics | System APIs |

---

## Function Mapping Matrix

### Chat Completion

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Send message | api/completions.py | ChatService.sendMessage() | SSE streaming |
| Stream tokens | api/completions.py _sse_stream() | KnezClient.chatCompletion() | Async generator |
| Tool call handling | api/completions.py | ChatService.runPromptToolLoop() | Via SSE events |
| Metrics tracking | api/completions.py | ChatService metrics | Backend emits, frontend receives |

### Tool Execution

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Tool catalog | N/A (MCP servers) | ToolExposureService.getCatalog() | Frontend manages |
| Tool execution | N/A (MCP servers) | ToolExecutionService.executeNamespacedTool() | Via MCP |
| Governance | cognitive/governance.py | GovernanceService.decideTool() | Duplicated logic |
| Tool tracking | sessions/store.py mcp_tool_calls table | ChatService.persistToolTrace() | Dual persistence |

### Session Management

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Create session | api/sessions.py record_session_lineage() | SessionController.createSession() | Backend tracks lineage |
| Resume session | api/sessions.py resume_session() | KnezClient.sessionResume() | Backend creates new session |
| Fork session | api/sessions.py fork_session() | KnezClient.sessionFork() | Backend creates new session |
| Session storage | sessions/store.py | SessionDatabase | Dual persistence (SQLite + IndexedDB) |
| Session lineage | sessions/store.py | LineagePanel.tsx | Backend provides, frontend displays |

### Memory Management

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Memory query | memory/api.py | KnezClient.memory() | Backend SQLite |
| Memory add | memory/api.py | KnezClient.addMemory() | Backend SQLite |
| Memory gate | memory/gate.py | KnezClient.checkMemoryGate() | Backend processing |
| Memory backup | N/A | MemoryBackupService | Frontend only |
| Memory compression | N/A | MemoryCompressionService | Frontend only |
| Memory CRDT | N/A | MemoryCRDTService | Frontend only |

### Event Tracking

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Event emission | events/emitter.py | N/A | Backend only |
| Event query | events/store.py | KnezClient.events() | Backend log file |
| Event display | N/A | DebugPanel.tsx, events feature | Frontend display |

### Health Monitoring

| Function | Backend Location | Frontend Location | Notes |
|----------|------------------|-------------------|-------|
| Health check | api/health.py | KnezClient.health() | Backend provides |
| Health monitoring | failover/health.py | StatusProvider.tsx | Backend monitors, frontend polls |
| Backend selection | router/router.py | N/A | Backend only |

---

## Backend Component Analysis

### Router Component

**File**: `router/router.py`

**Responsibilities**:
- Backend health scoring
- Backend selection based on health
- Memory hint generation
- Influence trace application
- Failover coordination

**Key Methods**:
- `select_backend(request, session_id)`: Select optimal backend
- `select_fallback(backend, request)`: Select fallback backend
- `_get_cached_health_score(backend)`: Get cached health score

**Dependencies**:
- BaseBackend implementations
- Health scorer
- Memory hint generator
- Event emitter

**Analysis**: Well-designed component with clear responsibilities. Health score caching is good optimization.

---

### Completions API Component

**File**: `api/completions.py`

**Responsibilities**:
- Chat completion endpoint
- SSE streaming
- Tool call handling
- Metrics tracking
- Checkpoint persistence

**Key Methods**:
- `chat_completion()`: Main endpoint handler
- `_sse_stream()`: Streaming implementation
- `_process_tool_call()`: Tool call processing

**Dependencies**:
- Router
- BaseBackend
- Event emitter
- Checkpoint worker
- Session store

**Analysis**: Complex component handling streaming, tool calls, and metrics. Could be split into smaller components.

---

### Event System Components

**Files**: `events/emitter.py`, `events/store.py`, `events/schema.py`

**Responsibilities**:
- Event emission
- Event persistence
- Event querying
- Event schema definition

**Key Methods**:
- `emit()`: Emit event
- `tail()`: Query events
- `flush_now()`: Force flush

**Dependencies**:
- aiosqlite (store)
- asyncio (queue)

**Analysis**: Clean separation of concerns. Async queue is good for performance.

---

### Memory System Components

**Files**: `memory/api.py`, `memory/store.py`, `memory/gate.py`

**Responsibilities**:
- Memory CRUD operations
- Memory gate processing
- Knowledge base management

**Key Methods**:
- `add(memory)`: Add memory
- `query(filters)`: Query memory
- `check_memory_gate(session_id)`: Process events to extract memory

**Dependencies**:
- aiosqlite
- Event store (gate)

**Analysis**: Well-structured. Memory gate is separate component for processing.

---

### Session Store Component

**File**: `sessions/store.py`

**Responsibilities**:
- Session lineage tracking
- Resume snapshot management
- MCP tool call tracking
- Failover event logging

**Key Methods**:
- `record_session_lineage()`: Record session creation/resume/fork
- `compile_resume_snapshot()`: Compile snapshot from events
- `list_mcp_tool_calls()`: List tool calls

**Dependencies**:
- aiosqlite
- Event emitter

**Analysis**: Comprehensive session tracking. Good for resume/fork functionality.

---

## Frontend Component Analysis

### ChatService Component

**File**: `services/ChatService.ts`

**Responsibilities**:
- Chat state management
- Message handling
- Tool execution coordination
- Phase management
- SSE stream processing

**Key Methods**:
- `sendMessage(text)`: Send user message
- `runPromptToolLoop()`: Main chat completion loop
- `persistToolTrace(toolCall)`: Persist tool execution
- `updateToolTrace(messageId, updates)`: Update tool trace
- `executeToolDeterministic(tool, args)`: Execute tool

**Dependencies**:
- KnezClient
- SessionDatabase
- ToolExecutionService
- GovernanceService

**Analysis**: Large component (800+ lines). Could be split into smaller components:
- StreamProcessor: Handle SSE parsing
- ToolCoordinator: Handle tool execution flow
- PhaseManager: Handle phase transitions

---

### KnezClient Component

**File**: `services/KnezClient.ts`

**Responsibilities**:
- HTTP client for backend
- Connection profile management
- SSE streaming
- Shell command fallback

**Key Methods**:
- `health()`: Health check
- `chatCompletion(request)`: Chat completion with streaming
- `sessionResume(sessionId, options)`: Resume session
- `events(filters)`: Query events
- `memory(filters)`: Query memory

**Dependencies**:
- @tauri-apps/api/http
- Tauri shell (fallback)

**Analysis**: Well-designed HTTP client. Good fallback to shell. Could add retry logic.

---

### McpOrchestrator Component

**File**: `mcp/McpOrchestrator.ts`

**Responsibilities**:
- MCP server lifecycle
- Tool catalog management
- Tool execution coordination
- Crash tracking and recovery

**Key Methods**:
- `startServer(serverId)`: Start MCP server
- `stopServer(serverId)`: Stop MCP server
- `callTool(serverId, name, args)`: Execute tool
- `recordCrash(serverId, reason)`: Record crash

**Dependencies**:
- McpInspectorService
- Authority management

**Analysis**: Well-designed orchestration. Auto-start and crash recovery are good features.

---

### ToolExecutionService Component

**File**: `services/ToolExecutionService.ts`

**Responsibilities**:
- Tool execution with governance
- Error classification
- Namespaced name resolution

**Key Methods**:
- `executeNamespacedTool(namespacedName, args)`: Execute tool
- `resolveNamespacedName(serverId, originalName)`: Resolve name

**Dependencies**:
- McpOrchestrator
- GovernanceService
- McpErrorTaxonomy

**Analysis**: Clean separation of concerns. Good error classification.

---

### Memory Services Components

**Files**: `services/Memory*.ts`

**Services**:
- MemoryEventSourcingService
- MemoryBackupService
- MemoryCompressionService
- MemoryCRDTService
- MemoryBloomFilterService
- MemoryBinarySerializationService

**Responsibilities**:
- Event sourcing
- Backup/restore
- Compression
- CRDT operations
- Deduplication
- Binary serialization

**Analysis**: Over-engineered for current needs. Many services are not actively used. Could consolidate.

---

## Duplicated Functionality

### 1. Session Persistence

**Backend**: `sessions/store.py` (SQLite)
**Frontend**: `services/SessionDatabase.ts` (IndexedDB)

**Duplication**: Both systems persist session messages

**Issue**:
- Data inconsistency risk
- Storage overhead (dual storage)
- Sync complexity

**Recommendation**:
- Keep backend as source of truth
- Frontend cache only for offline support
- Implement sync on reconnection

---

### 2. Tool Call Tracking

**Backend**: `sessions/store.py` mcp_tool_calls table
**Frontend**: `ChatService.persistToolTrace()` → SessionDatabase

**Duplication**: Both systems track tool calls

**Issue**:
- Dual persistence
- Data drift risk

**Recommendation**:
- Keep backend as primary
- Frontend display only (no persistence)
- Query backend for tool history

---

### 3. Governance Logic

**Backend**: `cognitive/governance.py`
**Frontend**: `services/GovernanceService.ts`

**Duplication**: Both systems enforce governance rules

**Issue**:
- Logic divergence risk
- Maintenance overhead

**Recommendation**:
- Move all governance to backend
- Frontend only enforces UI-level restrictions
- Backend returns governance decision

---

### 4. Memory Operations

**Backend**: `memory/api.py`, `memory/store.py`
**Frontend**: `services/Memory*.ts`

**Duplication**: Multiple memory services with overlapping functionality

**Issue**:
- Over-engineering
- Unused services
- Complexity

**Recommendation**:
- Keep only essential services
- Remove unused services (CRDT, BloomFilter, etc.)
- Consolidate backup/compression into single service

---

### 5. Health Monitoring

**Backend**: `api/health.py`, `failover/health.py`
**Frontend**: `contexts/StatusProvider.tsx`

**Partial Duplication**: Both monitor health but at different levels

**Issue**:
- Polling overhead
- Potential inconsistency

**Recommendation**:
- Backend push health updates via SSE
- Frontend subscribe instead of poll
- Single source of truth

---

## Cross-System Dependencies

### Backend → Frontend Dependencies

| Backend Component | Frontend Component | Dependency Type |
|-------------------|-------------------|-----------------|
| Completions API | ChatService | HTTP/SSE |
| Health API | KnezClient | HTTP |
| Sessions API | SessionController | HTTP |
| Events API | DebugPanel | HTTP |
| Memory API | Memory Services | HTTP |
| MCP (via Rust) | McpOrchestrator | Tauri IPC |

### Frontend → Backend Dependencies

| Frontend Component | Backend Component | Dependency Type |
|-------------------|-------------------|-----------------|
| ChatService | Completions API | HTTP/SSE |
| KnezClient | All APIs | HTTP |
| McpOrchestrator | MCP servers | Tauri IPC |
| ToolExecutionService | N/A (MCP direct) | MCP protocol |

### Circular Dependencies

**None detected** - Architecture is clean with unidirectional dependencies.

---

## Data Flow Mapping

### Chat Completion Data Flow

```
User Input
  ↓
ChatPane (UI)
  ↓
ChatService.sendMessage()
  ↓
KnezClient.chatCompletion()
  ↓
Backend: api/completions.py
  ↓
Backend: router/router.py (backend selection)
  ↓
Backend: models/local_backend.py (generation)
  ↓
Backend: SSE stream
  ↓
KnezClient (SSE parsing)
  ↓
ChatService (state updates)
  ↓
ChatPane (UI updates)
```

### Tool Execution Data Flow

```
Model Tool Call (SSE)
  ↓
ChatService.persistToolTrace()
  ↓
ToolExecutionService.executeNamespacedTool()
  ↓
GovernanceService.decideTool()
  ↓
McpOrchestrator.callTool()
  ↓
McpInspectorService.callTool()
  ↓
Tauri Rust Bridge
  ↓
MCP Server
  ↓
Tool Result
  ↓
ChatService.updateToolTrace()
  ↓
Model receives result (SSE)
```

### Session Resume Data Flow

```
User clicks Resume
  ↓
ChatPane
  ↓
SessionController.resumeSession()
  ↓
KnezClient.sessionResume()
  ↓
Backend: api/sessions.py
  ↓
Backend: sessions/store.py (compile snapshot)
  ↓
Backend: sessions/store.py (new session)
  ↓
Frontend: SessionController.switchSession()
  ↓
Frontend: ChatService (load context)
```

---

## Service Layer Mapping

### Backend Services

| Service | File | Purpose | Frontend Equivalent |
|---------|------|---------|-------------------|
| Router Service | router/router.py | Backend selection | None |
| Event Service | events/ | Event management | AnalyticsService |
| Memory Service | memory/ | Memory operations | Memory Services |
| Session Service | sessions/store.py | Session persistence | SessionDatabase |
| Checkpoint Service | checkpoints/ | Streaming checkpoints | None |
| Failover Service | failover/ | Failover logic | None |
| Replay Service | replay/ | Session replay | None |
| Cognitive Service | cognitive/ | Governance, audit | GovernanceService |

### Frontend Services

| Service | File | Purpose | Backend Equivalent |
|---------|------|---------|-------------------|
| ChatService | services/ChatService.ts | Chat state | None (orchestrates) |
| KnezClient | services/KnezClient.ts | Backend client | None (client) |
| SessionController | services/SessionController.ts | Session lifecycle | sessions API |
| SessionDatabase | services/SessionDatabase.ts | Session storage | sessions store |
| McpOrchestrator | mcp/McpOrchestrator.ts | MCP orchestration | None (MCP layer) |
| ToolExecutionService | services/ToolExecutionService.ts | Tool execution | None (MCP layer) |
| ToolExposureService | services/ToolExposureService.ts | Tool catalog | None (MCP layer) |
| GovernanceService | services/GovernanceService.ts | Governance | cognitive/governance |
| PresenceEngine | presence/PresenceEngine.ts | Presence state | None |

---

## UI Component Mapping

### Chat UI Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| ChatPane | features/chat/ChatPane.tsx | Main chat interface | ChatService |
| MessageItem | features/chat/MessageItem.tsx | Message rendering | ChatMessage |
| DebugPanel | features/chat/DebugPanel.tsx | Debug UI | KnezClient.events() |
| ChatInput | features/chat/components/ChatInput.tsx | Input field | Local state |
| MessageAnalytics | features/chat/components/MessageAnalytics.tsx | Message metrics | ChatMessage.metrics |

### Modal Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| HistoryModal | features/chat/modals/HistoryModal.tsx | Session history | SessionDatabase |
| ForkModal | features/chat/modals/ForkModal.tsx | Fork session | KnezClient.sessionFork() |
| RenameModal | features/chat/modals/RenameModal.tsx | Rename session | SessionDatabase |
| AuditModal | features/chat/modals/AuditModal.tsx | Audit trail | KnezClient.events() |
| MemoryModal | features/chat/MemoryModal.tsx | Memory UI | KnezClient.memory() |
| LineagePanel | features/chat/LineagePanel.tsx | Session lineage | KnezClient.sessionLineage() |

### Block Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| TextBlock | features/chat/blocks/TextBlock.tsx | Text rendering | Block.content |
| MCPBlock | features/chat/blocks/MCPBlock.tsx | Tool call UI | ToolCallMessage |
| ApprovalBlock | features/chat/blocks/ApprovalBlock.tsx | Approval UI | Block.approval |
| FinalBlock | features/chat/blocks/FinalBlock.tsx | Final response | Block.content |

---

## Integration Points

### HTTP API Integration Points

| Frontend | Backend | Endpoint | Purpose |
|----------|---------|----------|---------|
| KnezClient | api/completions.py | POST /v1/chat/completions | Chat completion |
| KnezClient | api/health.py | GET /health | Health check |
| KnezClient | api/sessions.py | POST /sessions/{id}/resume | Resume session |
| KnezClient | api/sessions.py | POST /sessions/{id}/fork | Fork session |
| KnezClient | api/sessions.py | GET /sessions/{id}/lineage | Get lineage |
| KnezClient | api/events_api.py | GET /events | Query events |
| KnezClient | memory/api.py | GET /memory | Query memory |
| KnezClient | memory/api.py | POST /memory | Add memory |

### SSE Integration Points

| Frontend | Backend | Purpose |
|----------|---------|---------|
| KnezClient.chatCompletion() | api/completions.py _sse_stream() | Token streaming |
| ChatService | Backend SSE events | Tool call notifications |

### Tauri IPC Integration Points

| Frontend | Rust Component | Purpose |
|----------|----------------|---------|
| McpOrchestrator | MCP Inspector | MCP server management |
| ChatTerminalPane | Shell plugin | Terminal execution |

---

## Compatibility Matrix

### Data Contract Compatibility

| Data Contract | Backend Type | Frontend Type | Compatible |
|---------------|--------------|---------------|------------|
| ChatMessage | ChatMessage (base.py) | ChatMessage (DataContracts.ts) | Partial |
| ToolCall | N/A | ToolCallMessage | N/A |
| GenerationRequest | GenerationRequest | ChatCompletionRequest | Partial |
| BackendHealth | BackendHealth | N/A in frontend | N/A |
| Event | Event (schema.py) | N/A in frontend | N/A |

**Issues**:
- ChatMessage fields differ (backend: role/content, frontend: from/text)
- No shared TypeScript types for backend contracts
- Tool call format differs (backend: tool_calls array, frontend: toolCall object)

**Recommendation**:
- Generate TypeScript types from Pydantic models
- Share data contracts via code generation
- Align field names between systems

### Message Type Compatibility

| Message Type | Backend | Frontend | Status |
|--------------|---------|----------|--------|
| user | Role.user | from: "user" | ✅ Compatible |
| assistant | Role.assistant | from: "assistant" | ✅ Compatible |
| knez | N/A | from: "knez" | ⚠️ Legacy |
| tool_execution | N/A | from: "tool_execution" | ⚠️ Frontend only |
| tool_result | N/A | from: "tool_result" | ⚠️ Frontend only |
| system | Role.system | from: "system" | ✅ Compatible |

**Issues**:
- "knez" is legacy frontend-only type
- "tool_execution" and "tool_result" are frontend-only
- Backend doesn't distinguish tool execution messages

**Recommendation**:
- Deprecate "knez" type
- Add tool execution message types to backend
- Align message type enums

---

## Consolidation Opportunities

### 1. Memory Services Consolidation

**Current**: 7 separate memory services
**Proposed**: 3 services

- MemoryService: Core CRUD operations
- MemoryBackupService: Backup/restore
- MemoryCompressionService: Compression (optional)

**Impact**: Reduced complexity, easier maintenance

---

### 2. Session Persistence Consolidation

**Current**: Dual persistence (backend SQLite + frontend IndexedDB)
**Proposed**: Backend-only with frontend cache

**Impact**:
- Eliminated data inconsistency
- Reduced storage overhead
- Simpler sync logic

---

### 3. Governance Logic Consolidation

**Current**: Backend + frontend governance
**Proposed**: Backend-only governance

**Impact**:
- Single source of truth
- Eliminated logic divergence
- Easier maintenance

---

### 4. Health Monitoring Consolidation

**Current**: Backend monitoring + frontend polling
**Proposed**: Backend push via SSE

**Impact**:
- Reduced polling overhead
- Real-time updates
- Single source of truth

---

### 5. Tool Call Tracking Consolidation

**Current**: Dual tracking (backend + frontend)
**Proposed**: Backend-only tracking

**Impact**:
- Eliminated duplication
- Query backend for history
- Simplified logic

---

## Refactoring Recommendations

### 1. Split ChatService

**Current**: 800+ lines, multiple responsibilities
**Proposed**: Split into 3 services

- StreamProcessor: Handle SSE parsing and token building
- ToolCoordinator: Handle tool execution flow
- PhaseManager: Handle phase transitions

**Impact**: Improved testability, reduced complexity

---

### 2. Generate TypeScript Types from Pydantic

**Current**: Manual type definitions, risk of drift
**Proposed**: Use code generation tool

```bash
# Generate types from Pydantic models
pydantic-to-typescript knez_core/models/base.py > src/domain/BackendTypes.ts
```

**Impact**: Type safety, reduced drift

---

### 3. Add Retry Logic to KnezClient

**Current**: No retry on HTTP failures
**Proposed**: Exponential backoff retry

```typescript
async requestWithRetry<T>(
  request: () => Promise<T>,
  maxRetries: number = 3
): Promise<T>
```

**Impact**: Improved reliability

---

### 4. Implement SSE Reconnection

**Current**: No reconnection logic
**Proposed**: Auto-reconnect with exponential backoff

**Impact**: Improved resilience

---

### 5. Remove Unused Memory Services

**Current**: 7 memory services, many unused
**Proposed**: Keep 3 essential services

**Impact**: Reduced complexity

---

### 6. Consolidate Tool Call Tracking

**Current**: Dual persistence
**Proposed**: Backend-only, frontend display

**Impact**: Eliminated duplication

---

### 7. Move Governance to Backend

**Current**: Frontend + backend governance
**Proposed**: Backend-only

**Impact**: Single source of truth

---

### 8. Add Health Push via SSE

**Current**: Frontend polling
**Proposed**: Backend push

**Impact**: Real-time updates, reduced overhead

---

## Conclusion

### Key Findings

1. **Duplicated Functionality**: Session persistence, tool call tracking, governance logic
2. **Over-Engineered Components**: Memory services (7 services, many unused)
3. **Large Components**: ChatService (800+ lines) needs splitting
4. **Type Drift**: Manual type definitions risk inconsistency
5. **Missing Features**: SSE reconnection, retry logic

### Priority Recommendations

**High Priority**:
1. Split ChatService into smaller components
2. Consolidate memory services
3. Generate TypeScript types from Pydantic
4. Consolidate session persistence

**Medium Priority**:
5. Add retry logic to KnezClient
6. Implement SSE reconnection
7. Move governance to backend
8. Add health push via SSE

**Low Priority**:
9. Consolidate tool call tracking
10. Add health push via SSE

### Expected Impact

- **Reduced Complexity**: 30-40% reduction in service count
- **Improved Reliability**: Retry and reconnection logic
- **Type Safety**: Generated types from Pydantic
- **Maintainability**: Smaller, focused components
- **Performance**: Reduced polling overhead

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-02 (knez-control-app), DOC-03 (Integration Patterns)
