# KNEZ Database Schemas Documentation

## Overview

KNEZ uses SQLite for persistent storage of sessions, events, memory entries, checkpoints, and cognitive system data. This document covers the database schema, relationships, and operations.

## Database: knez.db

**Location:** Configurable (default: `knez.db` in data directory)

**Technology:**
- **SQLite**: Lightweight SQL database
- **aiosqlite**: Async SQLite driver for Python
- **Connection Pooling**: Async connection pool for concurrent access

## Schema Overview

### Tables

1. **sessions**: Session metadata
2. **events**: Event log
3. **memory**: Memory entries
4. **checkpoints**: Token checkpoints
5. **influence_contracts**: Influence contracts
6. **approvals**: Approval queue
7. **perception_snapshots**: Perception snapshots

## Table Schemas

### sessions Table

Stores session metadata and lifecycle information.

**Schema:**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  agent_id TEXT
);
```

**Indexes:**
- Primary: `id`
- Optional: `created_at`, `updated_at`

**Columns:**
- `id`: Session UUID (primary key)
- `name`: Human-readable session name
- `created_at`: ISO timestamp of session creation
- `updated_at`: ISO timestamp of last update
- `agent_id`: Optional agent identifier

**Purpose:**
- Session identification
- Session lifecycle tracking
- Session naming for user reference

**Example Record:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Code Review Session",
  "created_at": "2026-04-27T10:30:00.000Z",
  "updated_at": "2026-04-27T11:45:00.000Z",
  "agent_id": null
}
```

### events Table

Stores system events for observability and audit trails.

**Schema:**
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
CREATE INDEX idx_events_type ON events(event_type);
```

**Columns:**
- `id`: Event UUID (primary key)
- `session_id`: Session UUID (foreign key to sessions.id)
- `task_id`: Optional task identifier
- `event_type`: Event type (INPUT, ANALYSIS, DECISION, ACTION, ERROR)
- `event_name`: Specific event name
- `source`: Event source (KNEZ_CORE, COGNITIVE, MCP, BACKEND)
- `severity`: Event severity (DEBUG, INFO, WARNING, ERROR)
- `payload`: JSON payload (event-specific data)
- `tags`: JSON array of tags
- `timestamp`: ISO timestamp

**Purpose:**
- Event history
- Audit trails
- Debugging
- Analysis

**Example Record:**
```json
{
  "id": "evt-001",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_id": "task-001",
  "event_type": "DECISION",
  "event_name": "router_route_decision",
  "source": "KNEZ_CORE",
  "severity": "INFO",
  "payload": "{\"selected_backend\": \"ollama\", \"score\": 0.95}",
  "tags": "[\"router\", \"decision\"]",
  "timestamp": "2026-04-27T10:31:00.000Z"
}
```

### memory Table

Stores memory entries for knowledge retention and retrieval.

**Schema:**
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
CREATE INDEX idx_memory_type ON memory(memory_type);
CREATE INDEX idx_memory_created_at ON memory(created_at);
```

**Columns:**
- `memory_id`: Memory UUID (primary key)
- `session_id`: Session UUID (foreign key to sessions.id)
- `memory_type`: Memory type (fact, preference, context, pattern)
- `summary`: Memory summary
- `evidence_event_ids`: JSON array of event IDs providing evidence
- `confidence`: Confidence score (0.0-1.0)
- `retention_policy`: Retention policy (short, medium, long)
- `created_at`: ISO timestamp

**Purpose:**
- Knowledge storage
- Context retention
- Preference tracking
- Pattern recognition

**Example Record:**
```json
{
  "memory_id": "mem-001",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "memory_type": "preference",
  "summary": "User prefers concise responses",
  "evidence_event_ids": "[\"evt-001\", \"evt-002\"]",
  "confidence": 0.85,
  "retention_policy": "long",
  "created_at": "2026-04-27T10:32:00.000Z"
}
```

### checkpoints Table

Stores token checkpoints for resume capability.

**Schema:**
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

**Columns:**
- `session_id`: Session UUID (foreign key to sessions.id)
- `token_index`: Token index in sequence
- `sha`: SHA hash of token
- `created_at`: Unix timestamp (float)

**Purpose:**
- Token checkpointing
- Resume capability
- Token integrity verification

**Example Record:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "token_index": 150,
  "sha": "a1b2c3d4e5f6...",
  "created_at": 1714217860.123
}
```

### influence_contracts Table

Stores influence contracts for behavior modification.

**Schema:**
```sql
CREATE TABLE influence_contracts (
  influence_id TEXT PRIMARY KEY,
  iri_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  influence_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  max_weight REAL NOT NULL,
  no_override INTEGER NOT NULL,
  reversible INTEGER NOT NULL,
  approved_by TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_influence_domain ON influence_contracts(domain);
CREATE INDEX idx_influence_iri ON influence_contracts(iri_id);
```

**Columns:**
- `influence_id`: Influence UUID (primary key)
- `iri_id`: IRI identifier
- `domain`: Domain (routing, tool_selection, parameters)
- `influence_type`: Type of influence
- `scope`: Scope of influence
- `max_weight`: Maximum weight (0.0-1.0)
- `no_override`: Boolean (0/1) for override prevention
- `reversible`: Boolean (0/1) for reversibility
- `approved_by`: Approver identifier
- `timestamp`: ISO timestamp

**Purpose:**
- Behavior modification
- Routing influence
- Tool selection influence
- Parameter influence

**Example Record:**
```json
{
  "influence_id": "inf-001",
  "iri_id": "iri-001",
  "domain": "routing",
  "influence_type": "backend_preference",
  "scope": "global",
  "max_weight": 0.8,
  "no_override": 0,
  "reversible": 1,
  "approved_by": "admin",
  "timestamp": "2026-04-27T10:33:00.000Z"
}
```

### approvals Table

Stores approval queue items for governance workflow.

**Schema:**
```sql
CREATE TABLE approvals (
  approval_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  payload TEXT,
  decided_at TEXT,
  decided_by TEXT,
  decision_reason TEXT
);

CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_requested_at ON approvals(requested_at);
```

**Columns:**
- `approval_id`: Approval UUID (primary key)
- `kind`: Approval kind (tool_execution, sensitive_operation, system_change)
- `status`: Status (pending, approved, denied)
- `requested_at`: ISO timestamp of request
- `requested_by`: Requester identifier
- `payload`: JSON payload (approval-specific data)
- `decided_at`: ISO timestamp of decision
- `decided_by`: Decider identifier
- `decision_reason`: Reason for decision

**Purpose:**
- Approval workflow
- Governance enforcement
- Audit trail

**Example Record:**
```json
{
  "approval_id": "appr-001",
  "kind": "tool_execution",
  "status": "approved",
  "requested_at": "2026-04-27T10:34:00.000Z",
  "requested_by": "system",
  "payload": "{\"tool\": \"file_delete\", \"path\": \"/tmp/file\"}",
  "decided_at": "2026-04-27T10:34:05.000Z",
  "decided_by": "admin",
  "decision_reason": "Safe operation"
}
```

### perception_snapshots Table

Stores perception snapshots for system monitoring.

**Schema:**
```sql
CREATE TABLE perception_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  active_window_title TEXT,
  active_window_process TEXT,
  system_state TEXT
);

CREATE INDEX idx_perception_session_id ON perception_snapshots(session_id);
CREATE INDEX idx_perception_timestamp ON perception_snapshots(timestamp);
```

**Columns:**
- `snapshot_id`: Snapshot UUID (primary key)
- `session_id`: Session UUID (foreign key to sessions.id)
- `timestamp`: ISO timestamp
- `active_window_title`: Active window title
- `active_window_process`: Active window process name
- `system_state`: JSON system state

**Purpose:**
- System monitoring
- Context awareness
- Activity tracking

**Example Record:**
```json
{
  "snapshot_id": "snap-001",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-04-27T10:35:00.000Z",
  "active_window_title": "Visual Studio Code",
  "active_window_process": "Code.exe",
  "system_state": "{\"cpu\": 45, \"memory\": 60}"
}
```

## Data Relationships

### Session to Events
One-to-many relationship:
- One session can have many events
- Each event belongs to exactly one session
- Foreign key: `events.session_id` → `sessions.id`

### Session to Memory
One-to-many relationship:
- One session can have many memory entries
- Each memory entry belongs to exactly one session
- Foreign key: `memory.session_id` → `sessions.id`

### Session to Checkpoints
One-to-many relationship:
- One session can have many checkpoints
- Each checkpoint belongs to exactly one session
- Foreign key: `checkpoints.session_id` → `sessions.id`

### Session to Perception Snapshots
One-to-many relationship:
- One session can have many snapshots
- Each snapshot belongs to exactly one session
- Foreign key: `perception_snapshots.session_id` → `sessions.id`

## Database Operations

### Session Operations

#### create_session(session: Session) -> str
Creates new session record.

**Workflow:**
1. Generate session UUID
2. Set created_at and updated_at timestamps
3. Insert into sessions table
4. Return session ID

#### get_session(session_id: str) -> Optional[Session]
Retrieves session by ID.

**Workflow:**
1. Query sessions table by ID
2. Return session or None

#### update_session(session_id: str, updates: Dict)
Updates session record.

**Workflow:**
1. Build update query
2. Update updated_at timestamp
3. Execute update
4. Return success

### Event Operations

#### insert_event(event: Event) -> str
Inserts event record.

**Workflow:**
1. Generate event UUID
2. Serialize payload and tags to JSON
3. Insert into events table
4. Return event ID

#### query_events(session_id: str, filters: Dict) -> List[Event]
Queries events with filters.

**Filters:**
- `event_type`: Filter by event type
- `source`: Filter by source
- `severity`: Filter by severity
- `since`: Filter by timestamp (ISO)
- `until`: Filter by timestamp (ISO)
- `limit`: Limit results

**Workflow:**
1. Build WHERE clause from filters
2. Query events table
3. Deserialize payload and tags from JSON
4. Return events

#### count_events(session_id: str) -> int
Counts events for session.

**Workflow:**
1. Count events by session_id
2. Return count

### Memory Operations

#### insert_memory(memory: MemoryEntry) -> str
Inserts memory record.

**Workflow:**
1. Generate memory UUID
2. Serialize evidence_event_ids to JSON
3. Insert into memory table
4. Return memory ID

#### query_memory(session_id: str, filters: Dict) -> List[MemoryEntry]
Queries memory with filters.

**Filters:**
- `memory_type`: Filter by type
- `since`: Filter by timestamp
- `limit`: Limit results

**Workflow:**
1. Build WHERE clause from filters
2. Query memory table
3. Deserialize evidence_event_ids from JSON
4. Return memories

### Checkpoint Operations

#### insert_checkpoint(session_id: str, token_index: int, sha: str)
Inserts checkpoint record.

**Workflow:**
1. Calculate created_at (Unix timestamp)
2. Insert into checkpoints table
3. Return success

#### query_checkpoints(session_id: str) -> List[Checkpoint]
Queries checkpoints for session.

**Workflow:**
1. Query checkpoints by session_id
2. Order by token_index
3. Return checkpoints

### Influence Contract Operations

#### insert_contract(contract: InfluenceContract) -> str
Inserts influence contract.

**Workflow:**
1. Generate influence UUID
2. Convert booleans to integers
3. Insert into influence_contracts table
4. Return influence ID

#### query_contracts(domain: str) -> List[InfluenceContract]
Queries contracts by domain.

**Workflow:**
1. Query influence_contracts by domain
2. Convert integers to booleans
3. Return contracts

### Approval Operations

#### insert_approval(approval: ApprovalItem) -> str
Inserts approval item.

**Workflow:**
1. Generate approval UUID
2. Serialize payload to JSON
3. Insert into approvals table
4. Return approval ID

#### query_approvals(status: str) -> List[ApprovalItem]
Queries approvals by status.

**Workflow:**
1. Query approvals by status
2. Deserialize payload from JSON
3. Return approvals

#### update_approval(approval_id: str, decision: str, actor: str, reason: str)
Updates approval decision.

**Workflow:**
1. Update status, decided_at, decided_by, decision_reason
2. Return success

## Transaction Support

### Transaction Workflow

```python
async def transaction(operations: List[Callable]):
    async with aiosqlite.connect(db_path) as db:
        await db.execute("BEGIN")
        try:
            for op in operations:
                await op(db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise e
```

### Use Cases
- Session creation with initial events
- Batch event insertion
- Memory insertion with evidence links

## Indexing Strategy

### Primary Indexes
- `sessions.id`: Primary key for sessions
- `events.id`: Primary key for events
- `memory.memory_id`: Primary key for memory
- `checkpoints.(session_id, token_index)`: Composite primary key
- `influence_contracts.influence_id`: Primary key for contracts
- `approvals.approval_id`: Primary key for approvals
- `perception_snapshots.snapshot_id`: Primary key for snapshots

### Foreign Indexes
- `events.session_id`: For session-based event queries
- `memory.session_id`: For session-based memory queries
- `checkpoints.session_id`: For session-based checkpoint queries
- `perception_snapshots.session_id`: For session-based snapshot queries

### Query Indexes
- `events.timestamp`: For time-based event queries
- `events.event_type`: For type-based event queries
- `memory.memory_type`: For type-based memory queries
- `memory.created_at`: For time-based memory queries
- `approvals.status`: For status-based approval queries
- `approvals.requested_at`: For time-based approval queries
- `influence_contracts.domain`: For domain-based contract queries
- `perception_snapshots.timestamp`: For time-based snapshot queries

## Data Integrity

### Constraints
- **Primary Key**: Unique ID required for each record
- **Foreign Key**: session_id must reference valid session
- **Required Fields**: Non-null constraints on required columns
- **Check Constraints**: Boolean fields as integers (0/1)

### Validation
- UUID format validation
- ISO timestamp format validation
- Confidence score range (0.0-1.0)
- Weight range (0.0-1.0)
- Status enum validation

## Performance Considerations

### SQLite Advantages
- Zero configuration
- Single file storage
- ACID compliance
- Efficient for read-heavy workloads

### aiosqlite Advantages
- Async I/O support
- Non-blocking database operations
- Connection pooling
- Context manager support

### Optimization Strategies
- Use indexes for frequently queried columns
- Batch operations for multiple inserts
- Use transactions for atomic operations
- Limit result sets with pagination
- Archive old events periodically

## Backup and Recovery

### Backup
```python
# Full database backup
import shutil
shutil.copyfile('knez.db', 'knez_backup.db')
```

### Recovery
```python
# Restore from backup
import shutil
shutil.copyfile('knez_backup.db', 'knez.db')
```

### Export
```python
# Export to SQL
import sqlite3
conn = sqlite3.connect('knez.db')
with open('knez_dump.sql', 'w') as f:
    for line in conn.iterdump():
        f.write('%s\n' % line)
```

## Migration Strategy

### Schema Versioning
- Store schema version in metadata table
- Version-specific migration scripts
- Rollback support

### Migration Workflow
1. Check current schema version
2. Apply migration scripts sequentially
3. Update schema version
4. Verify migration success

## Security Considerations

### Access Control
- File system permissions on database file
- Application-level access control
- Session-based authentication

### Data Security
- File encryption (optional)
- Backup encryption
- Secure backup storage

### SQL Injection Prevention
- Parameterized queries
- Input validation
- ORM-like abstractions

## Summary

KNEZ database schema includes:
- **sessions**: Session metadata
- **events**: Event log
- **memory**: Knowledge storage
- **checkpoints**: Token checkpoints
- **influence_contracts**: Influence contracts
- **approvals**: Approval queue
- **perception_snapshots**: System monitoring

Key features:
- **Relationships**: Session-centric design
- **Indexes**: Optimized for common queries
- **Transactions**: ACID compliance
- **Performance**: Indexed queries, batch operations
- **Security**: File permissions, parameterized queries
