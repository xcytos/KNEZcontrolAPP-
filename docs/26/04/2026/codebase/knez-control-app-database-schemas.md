# knez-control-app Database Schemas Documentation

## Overview

knez-control-app uses Dexie (IndexedDB wrapper) for client-side data persistence. The database stores sessions, messages, and related data for offline capability and local caching.

## Database: SessionDatabase

**Location:** `src/services/session/SessionDatabase.ts`

### Technology Stack
- **Dexie 4.0.8**: IndexedDB wrapper for efficient local storage
- **IndexedDB**: Browser-based NoSQL database
- **IndexedDB API**: Native browser storage API

### Database Schema

#### sessions Table

Stores session metadata.

**Schema:**
```typescript
{
  id: string;              // Primary key, session UUID
  name: string;            // Session name
  created_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp
}
```

**Indexes:**
- Primary: `id`
- Optional: `created_at`, `updated_at`

**Purpose:**
- Session identification
- Session naming for user reference
- Session lifecycle tracking
- Session sorting and filtering

**Example Record:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Code Review Session",
  "created_at": "2026-04-27T10:30:00.000Z",
  "updated_at": "2026-04-27T11:45:00.000Z"
}
```

#### messages Table

Stores chat messages with tool calls and metrics.

**Schema:**
```typescript
{
  id: string;              // Primary key, message UUID
  sessionId: string;       // Foreign key to sessions.id
  from: string;            // Message sender (user, assistant, tool_execution, tool_result, system)
  text: string;            // Message content
  timestamp: string;       // ISO timestamp
  toolCall?: {             // Optional tool call data
    id: string;
    tool: string;
    arguments: any;
    status: "calling" | "succeeded" | "failed" | "pending" | "running" | "completed";
    result?: any;
    executionTimeMs?: number;
    mcpLatencyMs?: number;
  };
  metrics?: {              // Optional response metrics
    timeToFirstTokenMs?: number;
    totalTokens?: number;
    finishReason?: string;
    modelId?: string;
    backendStatus?: string;
    responseTimeMs?: number;
    toolExecutionTime?: number;
    fallbackTriggered?: boolean;
  };
}
```

**Indexes:**
- Primary: `id`
- Foreign: `sessionId` (links to sessions table)
- Optional: `timestamp`, `from`

**Purpose:**
- Message history persistence
- Tool execution tracking
- Response metrics storage
- Session-based message retrieval

**Example Record (User Message):**
```json
{
  "id": "msg-001",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "from": "user",
  "text": "Explain React hooks",
  "timestamp": "2026-04-27T10:31:00.000Z"
}
```

**Example Record (Assistant Message with Metrics):**
```json
{
  "id": "msg-002",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "from": "assistant",
  "text": "React hooks are functions that let you...",
  "timestamp": "2026-04-27T10:31:05.000Z",
  "metrics": {
    "timeToFirstTokenMs": 150,
    "totalTokens": 245,
    "finishReason": "stop",
    "modelId": "llama3.2",
    "backendStatus": "healthy",
    "responseTimeMs": 1200
  }
}
```

**Example Record (Tool Execution Message):**
```json
{
  "id": "msg-003",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "from": "tool_execution",
  "text": "Executing search tool",
  "timestamp": "2026-04-27T10:31:10.000Z",
  "toolCall": {
    "id": "call-001",
    "tool": "search__web_search",
    "arguments": {
      "query": "React hooks documentation"
    },
    "status": "succeeded",
    "result": {
      "results": [...]
    },
    "executionTimeMs": 850,
    "mcpLatencyMs": 120
  }
}
```

## Database Operations

### Session Operations

#### saveSession(session: Session)

Saves session metadata to sessions table.

**Workflow:**
1. Open transaction on sessions table
2. Put session record (upsert)
3. Commit transaction
4. Handle errors

**Usage:**
```typescript
await sessionDatabase.saveSession({
  id: "session-uuid",
  name: "My Session",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
```

#### getSession(sessionId: string)

Retrieves session by ID.

**Workflow:**
1. Query sessions table by ID
2. Return session or null if not found
3. Handle errors

**Usage:**
```typescript
const session = await sessionDatabase.getSession("session-uuid");
```

#### updateSessionName(sessionId: string, name: string)

Updates session name.

**Workflow:**
1. Open transaction on sessions table
2. Update session record
3. Update updated_at timestamp
4. Commit transaction
5. Handle errors

**Usage:**
```typescript
await sessionDatabase.updateSessionName("session-uuid", "New Name");
```

### Message Operations

#### saveMessages(sessionId: string, messages: Message[])

Saves messages for a session.

**Workflow:**
1. Open transaction on messages table
2. Bulk put message records
3. Commit transaction
4. Handle errors

**Usage:**
```typescript
await sessionDatabase.saveMessages("session-uuid", [
  { id: "msg-1", sessionId: "session-uuid", from: "user", text: "Hello", timestamp: "..." }
]);
```

#### loadMessages(sessionId: string)

Loads all messages for a session.

**Workflow:**
1. Query messages table by sessionId
2. Order by timestamp ascending
3. Return messages array
4. Handle errors

**Usage:**
```typescript
const messages = await sessionDatabase.loadMessages("session-uuid");
```

#### updateMessage(messageId: string, updates: Partial<Message>)

Updates a specific message.

**Workflow:**
1. Open transaction on messages table
2. Update message record
3. Commit transaction
4. Handle errors

**Usage:**
```typescript
await sessionDatabase.updateMessage("msg-1", { text: "Updated text" });
```

### Bulk Operations

#### deleteSession(sessionId: string)

Deletes a session and all its messages.

**Workflow:**
1. Open transaction on sessions and messages tables
2. Delete session record
3. Delete all messages with matching sessionId
4. Commit transaction
5. Handle errors

**Usage:**
```typescript
await sessionDatabase.deleteSession("session-uuid");
```

## Data Relationships

### Session to Messages

One-to-many relationship:
- One session can have many messages
- Each message belongs to exactly one session
- Foreign key: `messages.sessionId` → `sessions.id`

### Message Types

**from field values:**
- `user`: User-sent message
- `assistant`: AI-generated response
- `tool_execution`: Tool execution trace
- `tool_result`: Tool result
- `system`: System message

## Indexing Strategy

### Primary Indexes
- `sessions.id`: Primary key for sessions
- `messages.id`: Primary key for messages

### Foreign Indexes
- `messages.sessionId`: For session-based message retrieval

### Optional Indexes
- `sessions.created_at`: For sorting by creation time
- `sessions.updated_at`: For sorting by update time
- `messages.timestamp`: For chronological ordering
- `messages.from`: For filtering by message type

## Data Integrity

### Constraints
- **Primary Key**: Unique ID required for each record
- **Foreign Key**: sessionId must reference valid session
- **Required Fields**: id, sessionId, from, text, timestamp

### Validation
- Session ID format validation (UUID)
- Timestamp format validation (ISO 8601)
- Message type validation (enum values)

## Performance Considerations

### IndexedDB Advantages
- Asynchronous operations (non-blocking)
- Large storage capacity (typically 50MB+)
- Efficient indexing
- Transaction support

### Dexie Advantages
- Type-safe API
- Promise-based operations
- Bulk operations support
- Query builder

### Optimization Strategies
- Use bulk operations for multiple inserts
- Index frequently queried fields
- Limit result sets with pagination
- Use transactions for atomic operations

## Storage Limits

### Browser Limits
- Chrome/Edge: ~60% of disk space
- Firefox: ~50% of disk space
- Safari: ~1GB limit

### Quota Management
- Dexie handles quota exceeded errors
- Implement cleanup for old sessions
- Implement pagination for large message sets

## Backup and Export

### Session Export

Export session data to JSON:

```typescript
const session = await sessionDatabase.getSession(sessionId);
const messages = await sessionDatabase.loadMessages(sessionId);
const exportData = { session, messages, exportedAt: new Date().toISOString() };
```

### Session Import

Import session data from JSON:

```typescript
const { session, messages } = JSON.parse(importData);
await sessionDatabase.saveSession(session);
await sessionDatabase.saveMessages(session.id, messages);
```

## Error Handling

### Common Errors
- **QuotaExceededError**: Storage limit reached
- **TransactionError**: Transaction failed
- **NotFoundError**: Record not found

### Error Recovery
- Implement cleanup on quota exceeded
- Retry failed transactions
- Handle missing records gracefully

## Security Considerations

### Data Privacy
- All data stored locally (client-side only)
- No sensitive data in localStorage
- Session IDs are UUIDs (not predictable)

### Access Control
- IndexedDB same-origin policy
- No cross-origin access
- Tauri sandbox for desktop app

## Summary

knez-control-app uses Dexie/IndexedDB for local persistence:
- **sessions table**: Session metadata
- **messages table**: Chat messages with tool calls and metrics
- **Relationships**: One-to-many (session → messages)
- **Operations**: CRUD with transaction support
- **Performance**: Indexed queries, bulk operations
- **Security**: Local-only, same-origin policy
