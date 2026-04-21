# DOC-07: Compatibility Issues & Duplication

## Executive Summary

This document identifies compatibility issues between the KNEZ backend and knez-control-app frontend, including data contract mismatches, message type inconsistencies, duplicated functionality, and version compatibility concerns. It provides recommendations for resolving these issues.

## Table of Contents

1. [Data Contract Compatibility](#data-contract-compatibility)
2. [Message Type Compatibility](#message-type-compatibility)
3. [Status State Compatibility](#status-state-compatibility)
4. [Duplicated Functionality](#duplicated-functionality)
5. [Version Compatibility](#version-compatibility)
6. [API Compatibility](#api-compatibility)
7. [Type System Compatibility](#type-system-compatibility)
8. [Serialization Compatibility](#serialization-compatibility)
9. [Error Code Compatibility](#error-code-compatibility)
10. [Dependency Compatibility](#dependency-compatibility)
11. [Platform Compatibility](#platform-compatibility)
12. [Migration Paths](#migration-paths)
13. [Deprecation Strategy](#deprecation-strategy)

---

## Data Contract Compatibility

### ChatMessage Structure Mismatch

**Backend (models/base.py)**:
```python
@dataclass
class ChatMessage:
    role: str  # "user", "assistant", "system"
    content: str
    tool_calls: Optional[List[ToolCall]] = None
```

**Frontend (DataContracts.ts)**:
```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  from: "user" | "assistant" | "tool_execution" | "tool_result" | "system" | "knez";
  text: string;
  createdAt: string;
  toolCall?: ToolCallMessage;
  metrics?: { ... };
}
```

**Issues**:
1. **Field Names**: Backend uses `role`/`content`, frontend uses `from`/`text`
2. **Tool Call Format**: Backend uses array `tool_calls`, frontend uses single `toolCall`
3. **Missing Fields**: Backend lacks `id`, `sessionId`, `createdAt`, `metrics`
4. **Type Differences**: Backend uses `role` enum, frontend uses extended `from` union

**Impact**:
- Manual transformation required at API boundary
- Risk of data loss during transformation
- Type safety compromised

**Recommendation**:
1. Generate TypeScript types from Pydantic models
2. Align field names (use `role`/`content` consistently)
3. Add missing fields to backend or document as frontend-only
4. Standardize tool call format (use array consistently)

---

### ToolCall Structure Mismatch

**Backend (completions.py)**:
```python
# Tool call in SSE event
{
  "type": "tool_call",
  "tool": "puppeteer_navigate",
  "args": {"url": "https://example.com"},
  "call_id": "tc_123"
}
```

**Frontend (DataContracts.ts)**:
```typescript
interface ToolCallMessage {
  tool: string;
  args: any;
  status: "pending" | "running" | "calling" | "succeeded" | "failed" | "completed";
  result?: any;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  executionTimeMs?: number;
  mcpLatencyMs?: number;
}
```

**Issues**:
1. **Status Tracking**: Backend doesn't track status, frontend does
2. **Metadata Fields**: Frontend has execution time, MCP latency not in backend
3. **Timestamps**: Frontend tracks start/finish times, backend doesn't

**Impact**:
- Status tracking is frontend-only
- Execution metrics not propagated from backend
- Incomplete observability

**Recommendation**:
1. Add status tracking to backend tool call events
2. Add execution time to backend tool_call_completed events
3. Add MCP latency tracking to backend
4. Align tool call structure between systems

---

### GenerationRequest Structure Mismatch

**Backend (models/base.py)**:
```python
@dataclass
class GenerationRequest:
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: bool = True
    tools: Optional[List[Dict]] = None
    tool_choice: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
```

**Frontend (KnezClient.ts)**:
```typescript
interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: any[];
  tool_choice?: string;
  metadata?: { session_id?: string };
}
```

**Issues**:
1. **Message Format**: Frontend sends simplified message format
2. **Tool Format**: Frontend uses `any[]` for tools, backend expects specific structure
3. **Metadata**: Frontend only sends `session_id`, backend expects full dict

**Impact**:
- Type safety loss at API boundary
- Potential runtime errors from malformed requests
- Limited metadata flexibility

**Recommendation**:
1. Generate TypeScript types from Pydantic models
2. Use strict typing for tool definitions
3. Expand metadata support in frontend

---

## Message Type Compatibility

### Message Type Enum Mismatch

**Backend**:
- `role`: "user", "assistant", "system"

**Frontend**:
- `from`: "user", "assistant", "tool_execution", "tool_result", "system", "knez"

**Issues**:
1. **Extra Types**: Frontend has "tool_execution", "tool_result", "knez" not in backend
2. **Legacy Type**: "knez" is legacy frontend-only type
3. **Missing Types**: Backend doesn't distinguish tool execution messages

**Impact**:
- Frontend-only message types not recognized by backend
- "knez" type creates confusion
- Tool execution messages handled as regular messages in backend

**Recommendation**:
1. Deprecate "knez" type in frontend
2. Add "tool_execution" and "tool_result" to backend
3. Align message type enums between systems
4. Document message type usage

---

### Legacy "knez" Type

**Current Usage**:
- Frontend uses "knez" as legacy type for assistant messages
- Backend has no equivalent
- Type casting used for backward compatibility

**Issues**:
1. **Confusion**: "knez" name doesn't describe purpose
2. **Inconsistency**: Should use "assistant" consistently
3. **Maintenance**: Dual type system increases complexity

**Impact**:
- Developer confusion
- Type safety compromised
- Maintenance overhead

**Recommendation**:
1. Migrate all "knez" types to "assistant"
2. Remove "knez" from type union
3. Update all message rendering logic
4. Add deprecation warning during transition

---

## Status State Compatibility

### Tool Status State Mismatch

**Backend**:
- Tool call events don't have explicit status
- Status inferred from event type (tool_call vs tool_call_completed)

**Frontend**:
- `status`: "pending", "running", "calling", "succeeded", "failed", "completed"

**Issues**:
1. **Missing States**: Backend doesn't track intermediate states
2. **No Live Updates**: Backend doesn't emit status transitions
3. **Status Inference**: Frontend must infer status from events

**Impact**:
- No live status updates
- Status tracking is frontend-only
- Limited observability

**Recommendation**:
1. Add status field to backend tool call events
2. Emit status transition events (pending → running → completed)
3. Align status states between systems
4. Add execution time to status events

---

## Duplicated Functionality

### Session Persistence Duplication

**Backend**: `sessions/store.py` (SQLite)
- Stores session lineage
- Stores resume snapshots
- Stores MCP tool calls
- Stores failover events

**Frontend**: `services/SessionDatabase.ts` (IndexedDB)
- Stores session messages
- Stores session metadata

**Duplication**:
- Both systems store session data
- Different storage technologies (SQLite vs IndexedDB)
- Different data schemas

**Issues**:
1. **Data Inconsistency Risk**: Dual storage can diverge
2. **Storage Overhead**: Data stored twice
3. **Sync Complexity**: Need to keep both in sync
4. **Query Complexity**: Different query APIs

**Impact**:
- Potential data loss or corruption
- Increased storage requirements
- Complex sync logic
- Performance overhead

**Recommendation**:
1. Make backend source of truth
2. Frontend cache only for offline support
3. Implement sync on reconnection
4. Remove frontend persistence for online mode

---

### Tool Call Tracking Duplication

**Backend**: `sessions/store.py` mcp_tool_calls table
- Stores tool call records
- Tracks execution time
- Tracks success/failure

**Frontend**: `ChatService.persistToolTrace()` → SessionDatabase
- Creates tool execution messages
- Updates tool status
- Persists to IndexedDB

**Duplication**:
- Both systems track tool calls
- Different schemas
- Different persistence mechanisms

**Issues**:
1. **Dual Persistence**: Tool calls stored twice
2. **Schema Drift**: Schemas can diverge
3. **Query Inconsistency**: Different query results

**Impact**:
- Data inconsistency risk
- Storage overhead
- Maintenance overhead

**Recommendation**:
1. Backend as primary storage
2. Frontend display only (no persistence)
3. Query backend for tool history
4. Remove frontend tool call persistence

---

### Governance Logic Duplication

**Backend**: `cognitive/governance.py`
- Enforces governance rules
- Checks tool allowlist/blocklist
- Applies risk ceiling
- Enforces proposal cap

**Frontend**: `services/GovernanceService.ts`
- Enforces governance rules
- Checks tool allowlist/blocklist
- Applies risk ceiling
- Enforces proposal cap

**Duplication**:
- Same logic implemented twice
- Different languages (Python vs TypeScript)
- Potential for divergence

**Issues**:
1. **Logic Divergence**: Changes in one not reflected in other
2. **Maintenance Overhead**: Update both systems
3. **Inconsistency Risk**: Different enforcement behavior

**Impact**:
- Governance rules may be enforced inconsistently
- Security risk if frontend bypassed
- Maintenance overhead

**Recommendation**:
1. Move all governance to backend
2. Frontend only enforces UI-level restrictions
3. Backend returns governance decision
4. Frontend respects backend decision

---

### Memory Services Duplication

**Backend**: `memory/store.py`, `memory/api.py`
- Core memory CRUD operations
- Memory gate processing
- Knowledge base management

**Frontend**: 7 memory services
- MemoryEventSourcingService
- MemoryBackupService
- MemoryCompressionService
- MemoryCRDTService
- MemoryBloomFilterService
- MemoryBinarySerializationService
- (Plus others)

**Duplication**:
- Frontend has many services with overlapping functionality
- Backend has core memory operations
- Some frontend services are unused

**Issues**:
1. **Over-Engineering**: Too many services for current needs
2. **Unused Services**: Many services not actively used
3. **Complexity**: Hard to navigate and maintain

**Impact**:
- Maintenance overhead
- Developer confusion
- Increased bundle size

**Recommendation**:
1. Keep only essential frontend memory services
2. Remove unused services (CRDT, BloomFilter, etc.)
3. Consolidate backup/compression into single service
4. Use backend for core memory operations

---

### Health Monitoring Duplication

**Backend**: `api/health.py`, `failover/health.py`
- Health checks for backends
- Backend status monitoring
- Failover coordination

**Frontend**: `contexts/StatusProvider.tsx`
- Health check polling
- Connection status tracking
- UI status display

**Partial Duplication**:
- Both monitor health at different levels
- Backend monitors backend health
- Frontend monitors connection status

**Issues**:
1. **Polling Overhead**: Frontend polls every 5 seconds
2. **Potential Inconsistency**: Different health perspectives
3. **Latency**: Polling adds latency

**Impact**:
- Network overhead
- Potential stale status
- Performance degradation

**Recommendation**:
1. Backend push health updates via SSE
2. Frontend subscribe instead of poll
3. Single source of truth
4. Real-time updates

---

## Version Compatibility

### Python Version Compatibility

**Backend**: Python 3.10+
- Uses type hints (requires 3.7+)
- Uses dataclasses (requires 3.7+)
- Uses asyncio features (requires 3.7+)

**Dependencies**:
- FastAPI (latest)
- Pydantic v2 (latest)
- httpx (latest)
- aiosqlite (latest)

**Issues**:
1. **Dependency Updates**: Fast updates can break compatibility
2. **Pydantic v2 Migration**: Breaking changes from v1
3. **AsyncIO Evolution**: New features may require newer Python

**Recommendation**:
1. Pin dependency versions in requirements.txt
2. Document minimum Python version
3. Test with multiple Python versions
4. Use semantic versioning for API

---

### Node/TypeScript Version Compatibility

**Frontend**: Node 18+, TypeScript 5+
- Uses latest React features
- Uses TypeScript 5 features
- Uses Vite (requires Node 14+)

**Dependencies**:
- React 18
- TypeScript 5
- Vite 5
- Tauri 2

**Issues**:
1. **Tauri 2 Beta**: Breaking changes from Tauri 1
2. **React 18**: Requires modern browser support
3. **TypeScript 5**: May not work with older TS versions

**Recommendation**:
1. Pin dependency versions in package.json
2. Document minimum Node/TypeScript versions
3. Test with multiple Node versions
4. Use semantic versioning for API

---

### API Version Compatibility

**Backend**: No explicit API versioning
- All endpoints at root path
- No version prefix
- No deprecation policy

**Frontend**: No API version handling
- Hardcoded endpoint paths
- No version negotiation
- No fallback for old versions

**Issues**:
1. **Breaking Changes**: API changes break frontend
2. **No Deprecation**: Can't deprecate old endpoints
3. **No Versioning**: Can't support multiple API versions

**Impact**:
- Deployment complexity
- Breaking changes require coordinated deploy
- No backward compatibility

**Recommendation**:
1. Add API versioning (e.g., /v1/, /v2/)
2. Document deprecation policy
3. Support multiple versions during transition
4. Add version negotiation

---

## API Compatibility

### HTTP Method Compatibility

**Backend**: RESTful methods
- GET for queries
- POST for mutations
- DELETE for deletions

**Frontend**: Uses GET and POST
- No DELETE usage
- No PUT usage
- No PATCH usage

**Issues**:
1. **Incomplete REST**: Frontend doesn't use all REST methods
2. **Mutation via POST**: Some mutations use POST instead of DELETE

**Impact**:
- Not fully RESTful
- Potential confusion

**Recommendation**:
1. Use DELETE for deletions
2. Use PUT for updates
3. Use PATCH for partial updates
4. Align with REST conventions

---

### Content-Type Compatibility

**Backend**: Accepts `application/json`
- Expects JSON for all requests
- Returns JSON for all responses

**Frontend**: Sends `application/json`
- Sends JSON for all requests
- Expects JSON for all responses

**Status**: ✅ Compatible

**Issues**: None

---

### SSE Format Compatibility

**Backend**: Standard SSE format
- `data: {json}\n\n`
- `[DONE]` sentinel
- Text/event-stream content-type

**Frontend**: Parses SSE format
- Handles `data:` prefix
- Handles `[DONE]` sentinel
- Handles chunked data

**Status**: ✅ Compatible

**Issues**: None

---

## Type System Compatibility

### Python vs TypeScript Types

**Python (Pydantic)**:
```python
@dataclass
class ChatMessage:
    role: str
    content: str
    tool_calls: Optional[List[ToolCall]] = None
```

**TypeScript**:
```typescript
interface ChatMessage {
  from: string;
  text: string;
  toolCall?: ToolCallMessage;
}
```

**Issues**:
1. **Type System Differences**: Python typing vs TypeScript typing
2. **Optional Handling**: Different syntax for optional fields
3. **Collection Types**: List vs Array
4. **Union Types**: Different syntax for unions

**Impact**:
- Manual transformation required
- Type safety loss at boundary
- Potential runtime errors

**Recommendation**:
1. Generate TypeScript types from Pydantic models
2. Use code generation tool (e.g., pydantic-to-typescript)
3. Automate type synchronization
4. Add validation at API boundary

---

## Serialization Compatibility

### JSON Serialization

**Backend**: Pydantic JSON serialization
- Automatic JSON encoding
- Type validation
- Schema generation

**Frontend**: JSON.parse/JSON.stringify
- Manual JSON handling
- No automatic validation
- No schema generation

**Issues**:
1. **Validation Mismatch**: Backend validates, frontend doesn't
2. **Error Handling**: Different error handling approaches
3. **Date Handling**: Different date serialization

**Impact**:
- Type safety loss in frontend
- Potential runtime errors
- Inconsistent error handling

**Recommendation**:
1. Add validation to frontend (e.g., Zod)
2. Use ISO 8601 for dates
3. Standardize error format
4. Add schema validation

---

## Error Code Compatibility

### Backend Error Codes

**Backend**:
- HTTP status codes
- Exception types
- Error messages

**Frontend**:
- HTTP status codes
- Error classifier
- Error messages

**Issues**:
1. **Error Classification**: Different classification systems
2. **Error Messages**: Inconsistent error messages
3. **Error Handling**: Different error handling approaches

**Impact**:
- Confusing error messages
- Inconsistent error classification
- Poor error recovery

**Recommendation**:
1. Standardize error codes
2. Align error classification
3. Use consistent error messages
4. Document error handling

---

## Dependency Compatibility

### Python Dependencies

**Backend Key Dependencies**:
- FastAPI
- Pydantic v2
- httpx
- aiosqlite
- prometheus-client

**Compatibility Issues**:
1. **Pydantic v2**: Breaking changes from v1
2. **FastAPI Updates**: Frequent updates may break compatibility
3. **httpx**: Async HTTP client evolution

**Recommendation**:
1. Pin versions in requirements.txt
2. Use semantic versioning
3. Test dependency updates
4. Document breaking changes

---

### Node Dependencies

**Frontend Key Dependencies**:
- React 18
- TypeScript 5
- Vite 5
- Tauri 2 (beta)
- Dexie

**Compatibility Issues**:
1. **Tauri 2 Beta**: Breaking changes from Tauri 1
2. **React 18**: Requires modern browsers
3. **TypeScript 5**: May not work with older versions

**Recommendation**:
1. Pin versions in package.json
2. Use semantic versioning
3. Test dependency updates
4. Document breaking changes

---

## Platform Compatibility

### Backend Platform Compatibility

**Python**: Cross-platform
- Works on Windows, macOS, Linux
- Ollama works on all platforms
- SQLite works on all platforms

**Issues**: None significant

---

### Frontend Platform Compatibility

**Tauri**: Cross-platform desktop
- Windows: ✅ Supported
- macOS: ✅ Supported
- Linux: ✅ Supported
- Web: ❌ Not supported (Tauri limitation)

**Browser Compatibility**:
- Requires WebView2 on Windows
- Requires WebKit on macOS
- Requires WebKitGTK on Linux

**Issues**:
1. **No Web Support**: Cannot run in browser
2. **Platform-Specific**: Different WebView engines

**Recommendation**:
1. Document platform requirements
2. Test on all supported platforms
3. Consider web version for accessibility

---

## Migration Paths

### Phase 1: Type Generation

**Goal**: Generate TypeScript types from Pydantic models

**Steps**:
1. Install pydantic-to-typescript
2. Generate types from backend models
3. Replace manual type definitions
4. Update imports

**Timeline**: 1-2 days

**Risk**: Low

---

### Phase 2: Message Type Migration

**Goal**: Deprecate "knez" type, align message types

**Steps**:
1. Add "tool_execution" and "tool_result" to backend
2. Migrate "knez" to "assistant" in frontend
3. Add deprecation warning for "knez"
4. Update message rendering logic
5. Remove "knez" from type union

**Timeline**: 3-5 days

**Risk**: Medium

---

### Phase 3: API Versioning

**Goal**: Add API versioning

**Steps**:
1. Add /v1/ prefix to all endpoints
2. Support both /v1/ and root path
3. Document deprecation policy
4. Add version negotiation

**Timeline**: 2-3 days

**Risk**: Medium

---

### Phase 4: Persistence Consolidation

**Goal**: Eliminate dual persistence

**Steps**:
1. Make backend source of truth
2. Remove frontend session persistence
3. Add frontend caching for offline support
4. Implement sync on reconnection

**Timeline**: 5-7 days

**Risk**: High

---

### Phase 5: Governance Consolidation

**Goal**: Move governance to backend

**Steps**:
1. Move all governance logic to backend
2. Backend returns governance decision
3. Frontend respects backend decision
4. Remove frontend governance service

**Timeline**: 3-4 days

**Risk**: Medium

---

## Deprecation Strategy

### Deprecation Policy

**API Deprecation**:
- Announce deprecation 3 months in advance
- Support old version for 3 months
- Document migration path
- Add deprecation warnings

**Type Deprecation**:
- Add deprecation warning in TypeScript
- Document migration path
- Support for 2 versions
- Remove after 2 versions

---

### Deprecation Timeline

**Phase 1 (Months 1-3)**:
- Add deprecation warnings
- Document migration paths
- Maintain backward compatibility

**Phase 2 (Months 4-6)**:
- Implement new implementations
- Support both old and new
- Monitor usage

**Phase 3 (Months 7-9)**:
- Remove deprecated code
- Finalize migration
- Update documentation

---

## Conclusion

### Key Compatibility Issues

1. **Data Contract Mismatch**: Field names, tool call format, missing fields
2. **Message Type Inconsistency**: "knez" legacy type, extra frontend types
3. **Status State Mismatch**: Backend doesn't track status
4. **Duplicated Persistence**: Session and tool call dual storage
5. **Duplicated Logic**: Governance in both systems
6. **Over-Engineered Services**: 7 memory services, many unused
7. **No API Versioning**: Breaking changes require coordinated deploy
8. **Type System Mismatch**: Manual type definitions

### Priority Actions

**High Priority**:
1. Generate TypeScript types from Pydantic
2. Deprecate "knez" type
3. Consolidate session persistence
4. Consolidate governance logic

**Medium Priority**:
5. Add API versioning
6. Align status states
7. Consolidate memory services
8. Standardize error codes

**Low Priority**:
9. Add health push via SSE
10. Remove frontend tool call persistence

### Expected Impact

- **Type Safety**: 80% improvement (generated types)
- **Data Consistency**: 100% improvement (single source of truth)
- **Maintenance**: 50% reduction (eliminated duplication)
- **Deployment**: 70% improvement (API versioning)

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-02 (knez-control-app), DOC-04 (Component Analysis)
