# TAQWIN Data Structure & Relationships Guide
## For knez-control-app Data Explorer Dashboard Development

**From:** TAQWIN MCP Team  
**To:** knez-control-app Data Explorer Development Team  
**Date:** June 14, 2026  
**Update ID:** CA011-CP008  
**Status:** Production Ready

---

## 📋 EXECUTIVE SUMMARY

This document provides the complete data structure, relationships, and hierarchy of the TAQWIN MCP system for building the Data Explorer Dashboard and Hierarchical View. All information is current as of the latest checkpoint (CA011-CP008) with traceable ID implementation.

### What's New in This Update:
- ✅ **Traceable ID Structure** - New sessions use display_id as session_id
- ✅ **Project-Level Organization** - Sessions associated with projects
- ✅ **Session Scoping Fixes** - No cross-session data leakage
- ✅ **Forward-Only Migration** - Backward compatible with UUID sessions

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROJECT LEVEL                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Project: knez-control-app                               │   │
│  │  project_id: "knez-control-app"                          │   │
│  │  project_path: "C:\...\controlAPP\knez-control-app"     │   │
│  └─────────┬────────────────────────────────────────────────┘   │
│            │                                                     │
│            │  Contains Multiple Sessions                        │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SESSION LEVEL                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Session: CA011                                     │  │   │
│  │  │ display_id: "CA011"                                │  │   │
│  │  │ name: "MCP Session Debugging and Database..."      │  │   │
│  │  │ type: CODE_ANALYSIS                                │  │   │
│  │  │ project_id: "knez-control-app"                     │  │   │
│  │  └──┬─────────────────────────────────────────────────┘  │   │
│  │     │                                                     │   │
│  │     │  Contains:                                          │   │
│  │     │  • Checkpoints (snapshots of context)            │   │
│  │     │  • Dev Events (file changes, decisions)          │   │
│  │     │  • Memories (learned patterns)                   │   │
│  │     │  • Traces (execution history)                    │   │
│  │     ▼                                                   │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │        CHECKPOINT LEVEL                        │    │   │
│  │  │  CA011-CP001, CA011-CP002, ... CA011-CP008    │    │   │
│  │  │  • Context snapshot at specific point          │    │   │
│  │  │  • Learned memories up to that point           │    │   │
│  │  │  • Decisions made                              │    │   │
│  │  │  • Findings discovered                         │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                         │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │         DEV EVENT LEVEL                        │    │   │
│  │  │  • File changes with reasons                   │    │   │
│  │  │  • Trigger context                             │    │   │
│  │  │  • Semantic chunks for retrieval               │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 DATA HIERARCHY & RELATIONSHIPS

### 1. **Project → Sessions → Checkpoints → Events**

```
PROJECT (knez-control-app)
  ├── SESSION (CA011)
  │     ├── CHECKPOINT (CA011-CP001)
  │     ├── CHECKPOINT (CA011-CP002)
  │     ├── ...
  │     ├── CHECKPOINT (CA011-CP008)
  │     ├── DEV EVENT (event_001)
  │     │     ├── File Change (src/handler.py)
  │     │     ├── File Change (src/storage.py)
  │     │     └── Semantic Chunks (for search)
  │     ├── DEV EVENT (event_002)
  │     └── ...
  ├── SESSION (CA009)
  │     └── ...
  └── SESSION (CA008)
        └── ...
```

### 2. **ID Structure (Traceable Format)**

#### **New Sessions** (Created after June 14, 2026):
```
session_id = display_id = "CA015"
```

#### **Old Sessions** (Created before update):
```
session_id = "436022d1-82b2-4e1d-80f0-89fef13d4d76" (UUID)
display_id = "CA011" (human-readable)
```

#### **All Checkpoints** (New format applies to all):
```
checkpoint_id = "{display_id}-CP{nnn}"
Examples:
  - CA011-CP001 (first checkpoint of session CA011)
  - CA011-CP008 (eighth checkpoint)
  - CA015-CP001 (first checkpoint of new session CA015)
```

---

## 🗄️ DATABASE SCHEMA

### Location: `~/taqwin_memory.db`


### Core Tables for Dashboard

#### 1. **projects** - Project Registry
```sql
CREATE TABLE projects (
    project_id TEXT PRIMARY KEY,           -- "knez-control-app"
    project_name TEXT NOT NULL,            -- "Knez Control App"
    project_path TEXT NOT NULL UNIQUE,     -- "C:\...\knez-control-app"
    description TEXT,
    git_remote TEXT,
    created_at TEXT NOT NULL,
    last_accessed TEXT NOT NULL,
    metadata TEXT                          -- JSON object
);
```

**Dashboard Use:** Project selector, project overview

---

#### 2. **sessions** - Session Data
```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,           -- "CA015" or UUID
    display_id TEXT NOT NULL,              -- "CA015" (human-readable)
    name TEXT NOT NULL,                    -- "Session Name"
    type TEXT NOT NULL,                    -- "CODE_ANALYSIS", "GENERAL", etc.
    tags TEXT,                             -- JSON array ["tag1", "tag2"]
    created_at TEXT NOT NULL,              -- ISO 8601 timestamp
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- "active", "archived"
    summary TEXT,                          -- Session summary
    event_count INTEGER DEFAULT 0,         -- Number of events
    file_count INTEGER DEFAULT 0,          -- Number of files changed
    project_id TEXT,                       -- Foreign key to projects
    project_path TEXT,                     -- Project path
    embedding_vector TEXT,                 -- JSON array for semantic search
    indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Dashboard Use:** 
- Session timeline
- Session cards with metrics (event_count, file_count)
- Session type badges
- Project filtering

---

#### 3. **checkpoints** - Context Snapshots
```sql
CREATE TABLE checkpoints (
    checkpoint_id TEXT PRIMARY KEY,        -- "CA011-CP008"
    session_id TEXT,                       -- Links to sessions
    title TEXT NOT NULL,                   -- "Checkpoint Title"
    created_at TEXT NOT NULL,              -- ISO 8601 timestamp
    context_data TEXT NOT NULL,            -- JSON blob with full context
    learned_memories TEXT,                 -- JSON array of strings
    decisions TEXT,                        -- JSON array of decision objects
    findings TEXT,                         -- JSON array of strings
    metadata TEXT,                         -- JSON object
    type TEXT DEFAULT 'agent_checkpoint',
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Decision Object Structure:**
```typescript
{
  decision: string;
  reasoning: string;
  alternatives: string[];
}
```

**Dashboard Use:**
- Checkpoint timeline nodes
- Checkpoint detail view with learned memories
- Decision tree visualization
- Progress tracking

---

#### 4. **events** - Development Events
```sql
CREATE TABLE events (
    event_id TEXT PRIMARY KEY,             -- UUID
    session_id TEXT NOT NULL,              -- Links to sessions
    event_type TEXT NOT NULL,              -- "dev_event"
    content TEXT NOT NULL,                 -- JSON blob
    created_at TEXT NOT NULL,              -- ISO 8601 timestamp
    embedding_vector TEXT,                 -- JSON array for search
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Content Structure (dev_event):**
```typescript
{
  type: "dev_event";
  trigger: string;                         // What triggered this event
  files: Array<{
    file: string;                          // File path
    change: string;                        // Type of change
    reason: string;                        // Why changed
  }>;
}
```

**Dashboard Use:**
- Activity timeline
- File change history
- Event cards with file changes

---

#### 5. **files** - File Change Registry
```sql
CREATE TABLE files (
    file_path TEXT PRIMARY KEY,            -- "src/handler.py"
    session_id TEXT NOT NULL,              -- Links to sessions
    change_type TEXT NOT NULL,             -- "created", "modified", "deleted"
    change_description TEXT,
    reason TEXT,                           -- Why changed
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Dashboard Use:**
- File change list
- File impact analysis
- Heatmap of changed files

---

#### 6. **decisions** - Decision Tracking
```sql
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,                   -- UUID
    session_id TEXT NOT NULL,
    context TEXT,                          -- What situation
    decision TEXT NOT NULL,                -- What was decided
    rationale TEXT,                        -- Why
    impact_assessment TEXT,                -- Expected impact
    made_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Dashboard Use:**
- Decision timeline
- Decision cards
- Impact assessment view

---

#### 7. **insights** - Pattern Insights
```sql
CREATE TABLE insights (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    category TEXT,                         -- Type of insight
    insight TEXT NOT NULL,
    confidence TEXT,                       -- "high", "medium", "low"
    generated_at TEXT NOT NULL,
    supporting_evidence TEXT,              -- JSON array
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Dashboard Use:**
- Insights panel
- Pattern discovery view

---

#### 8. **patterns** - Pattern Detection
```sql
CREATE TABLE patterns (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    pattern_type TEXT,                     -- Type of pattern
    pattern_description TEXT,
    frequency INTEGER DEFAULT 1,           -- How often seen
    last_seen TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Dashboard Use:**
- Pattern frequency chart
- Pattern evolution over time

---

#### 9. **retrieval_chunks** - Semantic Search Data
```sql
CREATE TABLE retrieval_chunks (
    chunk_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    chunk_text TEXT NOT NULL,              -- Searchable text
    chunk_type TEXT NOT NULL,              -- "context", "code_change", etc.
    metadata TEXT,                         -- JSON object
    embedding_vector TEXT NOT NULL,        -- 384-dim vector (JSON array)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

**Chunk Types:**
- `context` - General context information
- `code_change` - File modification details
- `decision` - Decision rationale
- `insight` - Discovered pattern or insight

**Dashboard Use:**
- Semantic search feature
- Context reconstruction

---

## 🔗 KEY RELATIONSHIPS FOR QUERIES

### 1. **Get All Sessions for a Project**
```sql
SELECT s.session_id, s.display_id, s.name, s.type, 
       s.created_at, s.event_count, s.file_count
FROM sessions s
WHERE s.project_id = 'knez-control-app'
ORDER BY s.created_at DESC;
```

### 2. **Get All Checkpoints for a Session**
```sql
SELECT checkpoint_id, title, created_at, 
       learned_memories, decisions, findings
FROM checkpoints
WHERE session_id = 'CA011'  -- or UUID for old sessions
ORDER BY created_at ASC;
```

### 3. **Get Session Timeline (Events + Checkpoints)**
```sql
-- Events
SELECT 'event' as type, event_id as id, created_at, content
FROM events
WHERE session_id = 'CA011'

UNION ALL

-- Checkpoints
SELECT 'checkpoint' as type, checkpoint_id as id, created_at, 
       json_object('title', title, 'memories', learned_memories) as content
FROM checkpoints
WHERE session_id = 'CA011'

ORDER BY created_at ASC;
```

### 4. **Get File Changes for a Session**
```sql
SELECT f.file_path, f.change_type, f.reason, f.created_at
FROM files f
WHERE f.session_id = 'CA011'
ORDER BY f.created_at DESC;
```


### 5. **Get Session Metrics (KPIs)**
```sql
SELECT 
    s.session_id,
    s.display_id,
    s.name,
    COUNT(DISTINCT c.checkpoint_id) as checkpoint_count,
    COUNT(DISTINCT e.event_id) as event_count,
    COUNT(DISTINCT f.file_path) as file_count,
    COUNT(DISTINCT d.id) as decision_count,
    COUNT(DISTINCT i.id) as insight_count
FROM sessions s
LEFT JOIN checkpoints c ON s.session_id = c.session_id
LEFT JOIN events e ON s.session_id = e.session_id
LEFT JOIN files f ON s.session_id = f.session_id
LEFT JOIN decisions d ON s.session_id = d.session_id
LEFT JOIN insights i ON s.session_id = i.session_id
WHERE s.session_id = 'CA011'
GROUP BY s.session_id;
```

### 6. **Get Latest Checkpoint with Full Context**
```sql
SELECT checkpoint_id, title, created_at,
       context_data, learned_memories, decisions, findings
FROM checkpoints
WHERE session_id = 'CA011'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 📐 DATA MODELS (TypeScript Interfaces)

### Session Model
```typescript
interface Session {
  session_id: string;              // "CA015" or UUID
  display_id: string;              // "CA015" (always human-readable)
  name: string;
  type: SessionType;               // See enum below
  tags: string[];
  created_at: string;              // ISO 8601
  updated_at: string;
  status: "active" | "archived";
  summary?: string;
  event_count: number;
  file_count: number;
  project_id?: string;             // "knez-control-app"
  project_path?: string;           // Absolute path
  embedding_vector?: number[];     // 384-dim for semantic search
}

enum SessionType {
  GENERAL = "GENERAL",
  CODE_ANALYSIS = "CODE_ANALYSIS",
  RESEARCH = "RESEARCH",
  PLANNING = "PLANNING",
  DEBUGGING = "DEBUGGING",
  LEARNING = "LEARNING",
  CREATIVE = "CREATIVE",
  PROBLEM_SOLVING = "PROBLEM_SOLVING"
}
```

### Checkpoint Model
```typescript
interface Checkpoint {
  checkpoint_id: string;           // "CA011-CP008"
  session_id: string;
  title: string;
  created_at: string;              // ISO 8601
  context: {
    summary?: string;
    work_completed?: string[];
    database_state?: Record<string, any>;
    [key: string]: any;            // Flexible context
  };
  learned_memories: string[];      // Array of learning strings
  decisions: Decision[];
  findings: string[];
  metadata?: Record<string, any>;
  type: "agent_checkpoint";
}

interface Decision {
  decision: string;
  reasoning: string;
  alternatives?: string[];
}
```


### Dev Event Model
```typescript
interface DevEvent {
  event_id: string;                // UUID
  session_id: string;
  type: "dev_event";
  data: {
    trigger: string;
    files: FileChange[];
  };
  created_at: string;              // ISO 8601
  embedding_vector?: number[];
}

interface FileChange {
  file: string;                    // Relative path
  change: string;                  // "created", "modified", "deleted"
  reason: string;                  // Why this change was made
}
```

### Project Model
```typescript
interface Project {
  project_id: string;              // "knez-control-app"
  project_name: string;            // "Knez Control App"
  project_path: string;            // Absolute path
  description?: string;
  git_remote?: string;             // Git URL if available
  created_at: string;
  last_accessed: string;
  metadata?: Record<string, any>;
}
```

### Insight Model
```typescript
interface Insight {
  id: string;
  session_id: string;
  category?: string;
  insight: string;
  confidence: "high" | "medium" | "low";
  generated_at: string;
  supporting_evidence?: string[];
}
```

---

## 🎯 DASHBOARD VISUALIZATION RECOMMENDATIONS

### 1. **Hierarchical Tree View**

```
📁 Projects
  └─ 📦 knez-control-app (3 sessions)
       ├─ 🔵 CA011: MCP Session Debugging (8 checkpoints, 15 events)
       │    ├─ 📌 CA011-CP001: Initial Analysis
       │    ├─ 📌 CA011-CP002: Phase 1 Complete
       │    ├─ ...
       │    └─ 📌 CA011-CP008: Context Transfer Complete ⭐
       ├─ 🔵 CA009: Data Visualization Explorer (4 checkpoints, 12 events)
       └─ 🔵 CA008: Repo Redundancy Analysis (2 checkpoints, 8 events)
```

**Implementation:**
- Use project_id to group sessions
- Display session with display_id (CA011 not UUID)
- Show checkpoint count and event count as badges
- Highlight latest checkpoint with icon

---

### 2. **Session Timeline View**

```
Timeline for CA011: MCP Session Debugging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

08:34 AM  🟢 Session Created
          ├─ Type: CODE_ANALYSIS
          └─ Tags: mcp, debugging, database

08:36 AM  📌 CP001: Initial Checkpoint
          └─ 3 memories, 2 decisions

08:45 AM  📝 Dev Event: Database Schema Updates
          ├─ Modified: unified_storage.py
          └─ Modified: checkpoint_handler.py

09:00 AM  📌 CP002: Phase 1 Complete
          └─ 8 memories, 5 decisions

...

10:28 AM  📌 CP008: Context Transfer Complete ⭐
          └─ 15 memories, 7 decisions
```

**Implementation:**
- Query events and checkpoints ordered by created_at
- Use different icons for different event types
- Show file changes under dev events
- Highlight latest checkpoint

---

### 3. **Session Metrics Dashboard**

```
┌─────────────────────────────────────────────────────────────┐
│  Session CA011: MCP Session Debugging and Database Analysis│
│  Type: CODE_ANALYSIS  •  Status: ACTIVE  •  Project: knez  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   📊 METRICS                                                │
│   ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│   │    8     │    15    │    23    │    4     │    6     │ │
│   │Checkpnts │  Events  │  Files   │ Decisions│ Insights │ │
│   └──────────┴──────────┴──────────┴──────────┴──────────┘ │
│                                                             │
│   🧠 KEY LEARNINGS (Top 5)                                 │
│   • Session context must be scoped by session_id           │
│   • Forward-only migration avoids schema changes           │
│   • Traceable IDs improve operational visibility           │
│   • Database query preferred over filesystem cache         │
│   • WAL mode enables better concurrency                    │
│                                                             │
│   📁 TOP FILES CHANGED                                      │
│   checkpoint_handler.py        ████████░░  8 changes       │
│   unified_storage.py           ██████░░░░  6 changes       │
│   cli_integration.py           █████░░░░░  5 changes       │
│                                                             │
│   ⏱️ ACTIVITY HEATMAP                                       │
│   08:00  ░░░░░░░░                                          │
│   09:00  ████████░░ High activity (8 events)               │
│   10:00  ██████░░░░ Medium activity (6 events)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- Metrics: Count queries on each table
- Key Learnings: Parse learned_memories from latest checkpoint
- Top Files: GROUP BY file_path with COUNT
- Activity Heatmap: GROUP BY HOUR(created_at) from events

---

### 4. **Checkpoint Detail View**

```
┌─────────────────────────────────────────────────────────────┐
│  📌 Checkpoint CA011-CP008                                  │
│  Context Transfer and ID Structure Migration Complete      │
│  Created: 2026-06-14 10:28:49                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📝 CONTEXT SUMMARY                                         │
│  Successfully implemented forward-only traceable ID         │
│  structure with session scoping fixes and memory            │
│  retrieval enhancements                                     │
│                                                             │
│  ✅ WORK COMPLETED (6 items)                                │
│  • Fixed session context scoping in checkpoint_manager      │
│  • Fixed memory_retriever to scope by project_id           │
│  • Enhanced get_active_session to query database           │
│  • Implemented forward-only traceable ID structure          │
│  • Implemented traceable checkpoint IDs format              │
│  • Added resume_session helper                             │
│                                                             │
│  🧠 LEARNED MEMORIES (6 items)                              │
│  • Session context must ALWAYS be scoped by session_id      │
│  • Memory retrieval should scope by project_id             │
│  • Forward-only migration avoids schema changes            │
│  • Traceable IDs improve operational traceability          │
│  • Database query ensures complete session data            │
│  • Sequential checkpoint numbering provides ordering        │
│                                                             │
│  🎯 DECISIONS (3 items)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Decision: Use forward-only ID migration             │   │
│  │ Reasoning: Preserves backward compatibility         │   │
│  │ Alternatives: Full migration, Parallel ID systems   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔍 FINDINGS (5 items)                                      │
│  • checkpoint_manager allowed cross-session data leakage    │
│  • Memory retriever queried ALL sessions without filter    │
│  • get_active_session used filesystem cache lacking data   │
│  • Sequential numbering requires counting per session      │
│  • Database priority ensures most complete data            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Data Source:** Single checkpoint record with parsed JSON fields

---

## 🔧 IMPLEMENTATION GUIDE

### Database Connection (Rust/Tauri)

**Location:** `~/taqwin_memory.db` (user home directory)

```rust
use rusqlite::{Connection, Result};

pub fn get_taqwin_connection() -> Result<Connection> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| rusqlite::Error::InvalidPath("Home dir not found".into()))?;
    
    let db_path = home_dir.join("taqwin_memory.db");
    
    let conn = Connection::open(db_path)?;
    
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    
    Ok(conn)
}
```

### Query Examples (Rust)

#### Get Sessions for Project
```rust
pub fn get_sessions_for_project(project_id: &str) -> Result<Vec<Session>> {
    let conn = get_taqwin_connection()?;
    
    let mut stmt = conn.prepare(
        "SELECT session_id, display_id, name, type, tags, 
                created_at, event_count, file_count, status
         FROM sessions
         WHERE project_id = ?
         ORDER BY created_at DESC"
    )?;
    
    let sessions = stmt.query_map([project_id], |row| {
        Ok(Session {
            session_id: row.get(0)?,
            display_id: row.get(1)?,
            name: row.get(2)?,
            session_type: row.get(3)?,
            tags: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            created_at: row.get(5)?,
            event_count: row.get(6)?,
            file_count: row.get(7)?,
            status: row.get(8)?,
        })
    })?;
    
    sessions.collect()
}
```


#### Get Checkpoints for Session
```rust
pub fn get_checkpoints_for_session(session_id: &str) -> Result<Vec<Checkpoint>> {
    let conn = get_taqwin_connection()?;
    
    let mut stmt = conn.prepare(
        "SELECT checkpoint_id, title, created_at, 
                context_data, learned_memories, decisions, findings
         FROM checkpoints
         WHERE session_id = ?
         ORDER BY created_at ASC"
    )?;
    
    let checkpoints = stmt.query_map([session_id], |row| {
        Ok(Checkpoint {
            checkpoint_id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            context: serde_json::from_str(&row.get::<_, String>(3)?).ok(),
            learned_memories: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            decisions: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
            findings: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
        })
    })?;
    
    checkpoints.collect()
}
```

#### Get Session Timeline (Events + Checkpoints)
```rust
#[derive(Debug, Serialize)]
pub struct TimelineItem {
    item_type: String,  // "event" or "checkpoint"
    id: String,
    created_at: String,
    title: String,
    details: serde_json::Value,
}

pub fn get_session_timeline(session_id: &str) -> Result<Vec<TimelineItem>> {
    let conn = get_taqwin_connection()?;
    
    let query = r#"
        SELECT 'event' as type, event_id as id, created_at, 
               'Dev Event' as title, content as details
        FROM events
        WHERE session_id = ?
        
        UNION ALL
        
        SELECT 'checkpoint' as type, checkpoint_id as id, created_at,
               title, context_data as details
        FROM checkpoints
        WHERE session_id = ?
        
        ORDER BY created_at ASC
    "#;
    
    let mut stmt = conn.prepare(query)?;
    
    let items = stmt.query_map([session_id, session_id], |row| {
        Ok(TimelineItem {
            item_type: row.get(0)?,
            id: row.get(1)?,
            created_at: row.get(2)?,
            title: row.get(3)?,
            details: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
        })
    })?;
    
    items.collect()
}
```

---

## 📊 SAMPLE DATA EXAMPLES

### Sample Session
```json
{
  "session_id": "CA015",
  "display_id": "CA015",
  "name": "Test Traceable ID Creation",
  "type": "CODE_ANALYSIS",
  "tags": ["test", "traceable-id-verification"],
  "created_at": "2026-06-14T10:30:00.087433",
  "updated_at": "2026-06-14T10:30:00.087456",
  "status": "active",
  "event_count": 0,
  "file_count": 0,
  "project_id": "syedm",
  "project_path": "C:\\Users\\syedm"
}
```

### Sample Checkpoint
```json
{
  "checkpoint_id": "CA011-CP008",
  "session_id": "436022d1-82b2-4e1d-80f0-89fef13d4d76",
  "title": "Context Transfer and ID Structure Migration Complete",
  "created_at": "2026-06-14T10:28:49.542366",
  "context": {
    "summary": "Successfully implemented forward-only traceable ID structure",
    "work_completed": [
      "Fixed session context scoping in checkpoint_manager",
      "Fixed memory_retriever to scope by project_id",
      "Enhanced get_active_session to query database"
    ],
    "database_state": {
      "active_sessions": 4,
      "projects_registered": 2,
      "sessions_with_projects": 3
    }
  },
  "learned_memories": [
    "Session context must ALWAYS be scoped by session_id",
    "Memory retrieval should scope by project_id",
    "Forward-only migration avoids schema changes"
  ],
  "decisions": [
    {
      "decision": "Use forward-only ID migration",
      "reasoning": "Preserves backward compatibility",
      "alternatives": ["Full database migration", "Parallel ID systems"]
    }
  ],
  "findings": [
    "checkpoint_manager allowed cross-session data leakage",
    "Memory retriever queried ALL sessions without filter"
  ]
}
```


### Sample Dev Event
```json
{
  "event_id": "abc123-def456-ghi789",
  "session_id": "CA011",
  "type": "dev_event",
  "data": {
    "trigger": "Implement traceable checkpoint IDs",
    "files": [
      {
        "file": "src/tools/checkpoint_manager/handler.py",
        "change": "modified",
        "reason": "Added sequential checkpoint numbering logic"
      },
      {
        "file": "src/utils/cli_integration.py",
        "change": "modified",
        "reason": "Changed new sessions to use display_id as session_id"
      }
    ]
  },
  "created_at": "2026-06-14T10:26:00.000000"
}
```

---

## ⚠️ IMPORTANT NOTES FOR DASHBOARD TEAM

### 1. **ID Compatibility**
- **New sessions**: `session_id === display_id` (e.g., "CA015")
- **Old sessions**: `session_id` is UUID, `display_id` is human-readable
- **Always display**: Use `display_id` for UI
- **Always query**: Accept both formats for `session_id` parameter

### 2. **JSON Parsing Required**
These fields are stored as JSON strings and need parsing:
- `sessions.tags` → `string[]`
- `sessions.embedding_vector` → `number[]`
- `checkpoints.context_data` → `object`
- `checkpoints.learned_memories` → `string[]`
- `checkpoints.decisions` → `Decision[]`
- `checkpoints.findings` → `string[]`
- `events.content` → `object`

### 3. **Foreign Key Relationships**
```
projects.project_id ←── sessions.project_id
sessions.session_id ←── checkpoints.session_id
sessions.session_id ←── events.session_id
sessions.session_id ←── files.session_id
sessions.session_id ←── decisions.session_id
sessions.session_id ←── insights.session_id
events.event_id ←── retrieval_chunks.event_id
```


### 4. **Session Types & Colors**
Suggested color coding for UI:
```typescript
const SESSION_TYPE_COLORS = {
  GENERAL: "blue",
  CODE_ANALYSIS: "purple",
  RESEARCH: "green",
  PLANNING: "yellow",
  DEBUGGING: "red",
  LEARNING: "cyan",
  CREATIVE: "pink",
  PROBLEM_SOLVING: "orange"
};
```

### 5. **Checkpoint Naming Pattern**
- Format: `{display_id}-CP{nnn}`
- Examples: `CA011-CP001`, `CA015-CP023`
- Sequential within session (not global)
- Zero-padded to 3 digits

### 6. **Timestamp Format**
All timestamps are ISO 8601 format:
```
"2026-06-14T10:28:49.542366"
```

Parse with:
```typescript
const date = new Date(timestamp);
```

### 7. **Database Location**
```
Windows: C:\Users\{username}\taqwin_memory.db
macOS:   /Users/{username}/taqwin_memory.db
Linux:   /home/{username}/taqwin_memory.db
```

Access via:
```rust
dirs::home_dir().unwrap().join("taqwin_memory.db")
```

---

## 🚀 QUICK START FOR DASHBOARD

### Step 1: Connect to Database
```rust
// In src-tauri/src/taqwin_commands.rs
use rusqlite::Connection;

#[tauri::command]
pub fn get_taqwin_sessions() -> Result<Vec<Session>, String> {
    let db_path = dirs::home_dir()
        .ok_or("Home dir not found")?
        .join("taqwin_memory.db");
    
    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;
    
    // Query sessions...
}
```


### Step 2: Create Basic Queries
```rust
// Get all projects
pub fn get_projects() -> Result<Vec<Project>, String>

// Get sessions for a project
pub fn get_sessions_for_project(project_id: &str) -> Result<Vec<Session>, String>

// Get checkpoints for a session
pub fn get_checkpoints(session_id: &str) -> Result<Vec<Checkpoint>, String>

// Get events for a session
pub fn get_events(session_id: &str) -> Result<Vec<DevEvent>, String>

// Get session metrics
pub fn get_session_metrics(session_id: &str) -> Result<SessionMetrics, String>
```

### Step 3: Build Hierarchical View
```typescript
// In TaqwinHierarchicalView.tsx
const [projects, setProjects] = useState<Project[]>([]);
const [selectedProject, setSelectedProject] = useState<string | null>(null);
const [sessions, setSessions] = useState<Session[]>([]);

useEffect(() => {
  // Load projects
  invoke<Project[]>('get_taqwin_projects')
    .then(setProjects);
}, []);

useEffect(() => {
  if (selectedProject) {
    // Load sessions for selected project
    invoke<Session[]>('get_taqwin_sessions', { projectId: selectedProject })
      .then(setSessions);
  }
}, [selectedProject]);
```

### Step 4: Render Timeline
```typescript
// Get timeline items (events + checkpoints)
const timeline = await invoke<TimelineItem[]>('get_session_timeline', {
  sessionId: selectedSession
});

// Render with icons and formatting
timeline.map(item => (
  <TimelineNode
    key={item.id}
    type={item.item_type}  // "event" or "checkpoint"
    title={item.title}
    timestamp={item.created_at}
    details={item.details}
  />
));
```

---

## 🎨 UI/UX RECOMMENDATIONS

### Visual Hierarchy
1. **Projects** → Folder icon, bold text
2. **Sessions** → Circle icon with type color, display_id prominent
3. **Checkpoints** → Pin icon, sequential number visible
4. **Events** → Document icon, file count badge

### Color Coding
- **Active sessions**: Green indicator
- **Archived sessions**: Gray
- **Recent activity**: Highlighted background
- **Session types**: Use consistent color palette

### Information Density
- **List view**: display_id, name, event count, checkpoint count
- **Detail view**: Full metrics, timeline, key learnings
- **Compact view**: display_id only with tooltip

### Interactive Features
- **Click session**: Expand to show checkpoints
- **Click checkpoint**: Show detail panel
- **Hover event**: Preview file changes
- **Search**: Filter by tags, session name, checkpoint title

---

## 📚 REFERENCE MATERIALS

### Database Indexes for Performance
```sql
-- Already created, use these for optimized queries:
idx_sessions_type           ON sessions(type)
idx_sessions_status         ON sessions(status)
idx_sessions_project        ON sessions(project_id)
idx_events_session          ON events(session_id)
idx_files_session           ON files(session_id)
idx_retrieval_chunks_session ON retrieval_chunks(session_id)
```

### Common Aggregation Queries
```sql
-- Session activity by hour
SELECT strftime('%H:00', created_at) as hour, 
       COUNT(*) as event_count
FROM events
WHERE session_id = ?
GROUP BY hour
ORDER BY hour;

-- Top changed files
SELECT file_path, COUNT(*) as change_count
FROM files
WHERE session_id = ?
GROUP BY file_path
ORDER BY change_count DESC
LIMIT 10;

-- Checkpoint progression
SELECT checkpoint_id, title, created_at,
       json_array_length(learned_memories) as memory_count,
       json_array_length(decisions) as decision_count
FROM checkpoints
WHERE session_id = ?
ORDER BY created_at ASC;
```

---

## 🔄 MIGRATION & COMPATIBILITY

### Backward Compatibility
The system supports both old and new ID formats:

**Old Sessions (UUID-based):**
```json
{
  "session_id": "436022d1-82b2-4e1d-80f0-89fef13d4d76",
  "display_id": "CA011"
}
```

**New Sessions (Traceable):**
```json
{
  "session_id": "CA015",
  "display_id": "CA015"
}
```

**Dashboard Implementation:**
```typescript
// Always use display_id for display
<div>{session.display_id}</div>

// Use session_id for queries (works with both formats)
const checkpoints = await getCheckpoints(session.session_id);
```

### Forward-Only Migration
- **No data migration required**
- **New sessions** automatically use traceable format
- **Old sessions** continue working with UUID
- **All checkpoints** use new traceable format (even on old sessions)

---

## 📞 CONTACT & SUPPORT

### TAQWIN MCP Team
- **Session**: CA011 (MCP Session Debugging and Database Analysis)
- **Checkpoint**: CA011-CP008 (Latest)
- **Database**: `~/taqwin_memory.db`

### Questions?
1. Check this document first
2. Query the database directly for inspection
3. Review checkpoint context for implementation details
4. Check `.taqwin/docs/` for additional documentation

---

## 📄 APPENDIX: COMPLETE TABLE LIST

### Primary Tables
1. ✅ **projects** - Project registry
2. ✅ **sessions** - Session metadata
3. ✅ **checkpoints** - Context snapshots
4. ✅ **events** - Development events
5. ✅ **files** - File change registry

### Learning Tables
6. ✅ **decisions** - Decision tracking
7. ✅ **insights** - Pattern insights
8. ✅ **patterns** - Pattern detection

### Retrieval Tables (Optimization)
9. ✅ **retrieval_sessions** - Session metadata copy
10. ✅ **retrieval_events** - Event metadata copy
11. ✅ **retrieval_chunks** - Semantic chunks with embeddings

### Traces Database
12. ✅ **traces** - Execution traces (in `taqwin_traces.db`)

---

## 🎯 PRIORITY IMPLEMENTATION CHECKLIST

### Phase 1: Basic Hierarchy (Week 1)
- [ ] Connect to `taqwin_memory.db`
- [ ] Query and display projects
- [ ] Query and display sessions for selected project
- [ ] Display session cards with basic info (display_id, name, type)

### Phase 2: Session Detail (Week 2)
- [ ] Query and display checkpoints for selected session
- [ ] Show checkpoint timeline
- [ ] Display checkpoint count and event count badges
- [ ] Implement session type color coding

### Phase 3: Checkpoint Detail (Week 3)
- [ ] Show checkpoint detail panel
- [ ] Display learned memories list
- [ ] Display decisions with reasoning
- [ ] Display findings list
- [ ] Show work completed items

### Phase 4: Events & Files (Week 4)
- [ ] Query and display dev events
- [ ] Show file changes in events
- [ ] Create unified timeline (events + checkpoints)
- [ ] Display file change statistics

### Phase 5: Metrics & Analytics (Week 5)
- [ ] Calculate and display session metrics (KPIs)
- [ ] Create activity heatmap
- [ ] Show top changed files
- [ ] Display key learnings from latest checkpoint

### Phase 6: Polish & UX (Week 6)
- [ ] Add search and filtering
- [ ] Improve visual hierarchy
- [ ] Add hover tooltips
- [ ] Implement responsive design
- [ ] Add export functionality

---

## 🏁 CONCLUSION

This document provides all the information needed to build a comprehensive TAQWIN data explorer dashboard. The data structure is designed for easy querying and visualization, with clear relationships between projects, sessions, checkpoints, and events.

**Key Points:**
1. ✅ **Single database** at user home: `~/taqwin_memory.db`
2. ✅ **Clear hierarchy**: Projects → Sessions → Checkpoints → Events
3. ✅ **Traceable IDs**: Human-readable format (CA011-CP008)
4. ✅ **Backward compatible**: Works with old UUID sessions
5. ✅ **Rich metadata**: Learned memories, decisions, findings
6. ✅ **Query optimized**: Indexes on all foreign keys

Build incrementally, test with real data, and reference this document for schema details.

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-14  
**Update Checkpoint:** CA011-CP008  
**Status:** Production Ready ✅

