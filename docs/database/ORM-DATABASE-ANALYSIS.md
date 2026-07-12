# Database & ORM Analysis

> Document managed in TAQWIN session CA025. Last updated: 2026-07-12.

## Status

| Area | Status | Priority |
|------|--------|----------|
| SQLite indexes on FK | 🟡 Pending | High |
| SQLite ON DELETE CASCADE | 🟡 Pending | High |
| Remove information_schema checks | 🟡 Pending | Medium |
| SeaORM adoption | 🟡 Pending | Medium |

---

## Databases

### SQLite (`taqwin_memory.db`)

**Path:** `C:\Users\syedm\taqwin_memory.db`
**Data:** 54 sessions, 335 checkpoints, 154 events, 208 files

| Table | Count | Indexes | Issues |
|-------|-------|---------|--------|
| `sessions` | 54 | None (PK only) | — |
| `checkpoints` | 335 | None | **No session_id index** |
| `events` | 154 | None | **No session_id index** |
| `decisions` | 0 | None | **No session_id index** |
| `insights` | 0 | None | **No session_id index** |
| `files` | 208 | None | **No session_id index** |
| `patterns` | ? | None | **No session_id index** |
| `projects` | ? | None | — |
| `session_status_history` | ? | None | **No session_id index** |

**Missing indexes:**
```sql
-- Critical: all child tables query by session_id
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_session ON insights(session_id);
CREATE INDEX IF NOT EXISTS idx_files_session ON files(session_id);
CREATE INDEX IF NOT EXISTS idx_patterns_session ON patterns(session_id);
CREATE INDEX IF NOT EXISTS idx_session_status_history_session ON session_status_history(session_id);
```

**Missing CASCADE:**
```sql
-- Currently: FK with no cascade = orphaned children when session deleted
-- Add ON DELETE CASCADE to all child tables:
PRAGMA foreign_keys = ON;
-- Then recreate tables with: ON DELETE CASCADE
```

**Schema (from sqlite_master):**
```sql
sessions (
  session_id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT,
  event_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  embedding_vector TEXT,
  indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  project_id TEXT,
  project_path TEXT,
  last_heartbeat_at TEXT,
  heartbeat_timeout_seconds INTEGER DEFAULT 120,
  client_metadata TEXT,
  session_state TEXT
)

checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  session_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  context_data TEXT NOT NULL,
  learned_memories TEXT,
  decisions TEXT,
  findings TEXT,
  metadata TEXT,
  type TEXT DEFAULT 'agent_checkpoint',
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)  -- NO CASCADE
)
```

### PostgreSQL (Supabase)

**Host:** `db.sspsljqdhesqezrmspcj.supabase.co`
**Database:** `postgres`
**Connection:** SSL required, pool max 5 connections

| Table | Count | Issues |
|-------|-------|--------|
| `documents` | ~335 | 11 indexes (good), but code does 3x `information_schema` query per op |
| `document_versions` | 1 | — |
| `document_checkpoint_links` | 1 | — |

**PostgreSQL indexes (well-covered):**
- `documents`: session_id ✅, project_id ✅, checkpoint_id ✅, category, slug (partial unique), tags (GIN), created_at
- `document_versions`: document_id ✅, (document_id, version_number) composite ✅
- `document_checkpoint_links`: (document_id, checkpoint_id) composite unique ✅

**Relevant PostgreSQL columns (documents table):**
```
document_id   uuid PK
title        text NOT NULL
doc_type     text NOT NULL
content      text
file_path    text
session_id   text NOT NULL  -- NOTE: not UUID FK to sessions table
project_name text
checkpoint_id text
created_at   timestamptz DEFAULT now()
updated_at   timestamptz DEFAULT now()
is_large     boolean DEFAULT false
embedding    text
version_number integer DEFAULT 1
parent_version_id uuid
created_by   text
updated_by   text
content_size integer
slug         text (unique partial on canonical)
tags         text[] (GIN index)
category     text DEFAULT 'session'
project_id   text
purpose      text
latest_changes text
business_id  integer
```

---

## Critical Issues

### Issue 1: SQLite FK indexes missing
- **Severity:** High
- **Impact:** Every query that joins sessions to child tables does a full table scan
- **Fix:** Add indexes on all `session_id` FK columns

### Issue 2: SQLite no CASCADE delete
- **Severity:** Medium
- **Impact:** Deleting a session leaves orphaned checkpoints/events/etc in DB
- **Fix:** Recreate child tables with `ON DELETE CASCADE`

### Issue 3: information_schema queries (3x per PostgreSQL op)
- **Severity:** Critical
- **Location:** `src-tauri/src/database.rs` lines 125, 251, 348
- **Impact:** 3 extra DB round-trips before every documents query
- **Fix:** Remove schema discovery — schema is known at compile time. Use `sqlx` typed `FromRow` derive

### Issue 4: Pool size 5
- **Severity:** Medium
- **Impact:** Under concurrent load, pool exhaustion
- **Fix:** Increase to 20 in `PgPoolOptions::new().max_connections(5)`

### Issue 5: Session selection race condition
- **Severity:** Critical
- **Location:** `src/features/data/TaqwinHierarchicalView.tsx:139`
- **Impact:** `onActivityContextChange({})` clears session context immediately after setting it
- **Fix:** Added `prevViewLevelRef` — only clear when actually leaving session-detail
- **Status:** ✅ Fixed in CP010

### Issue 6: SessionEvolutionFullView 4x reload
- **Severity:** High
- **Location:** `src/features/data/components/SessionEvolutionFullView.tsx`
- **Impact:** 4x duplicate loads on session selection
- **Fix:** Added `loadRef` guard + sessionId-only dependency
- **Status:** ✅ Fixed in CP010

---

## ORM Decision

**Decision: SeaORM** (single ORM for both SQLite and PostgreSQL)

| ORM | SQLite | PostgreSQL | Verdict |
|-----|--------|-----------|---------|
| SeaORM | ✅ | ✅ | **Adopted** — async-first, migration CLI, compile-time SQL |
| Diesel | ✅ | ✅ | ❌ Sync-only (blocking in Tauri async context) |
| sqlx only | ✅ | ✅ | Partial — no ORM benefits |

**Why SeaORM:**
- Built on `sqlx` (already in Cargo.toml) — minimal dependency addition
- Async-first — correct for Tauri async command handlers
- Single `sea-orm-cli` manages migrations for both databases
- `sea-orm-cli generate` reverse-engineers entities from existing schema
- Active Record pattern for CRUD + Query Builder for complex queries
- Entity relationships replace string column names in JOINs

**Migration path:**
1. Add `sea-orm` to Cargo.toml
2. `sea-orm-cli generate` from PostgreSQL schema → entity files in `src-tauri/src/entities/`
3. `sea-orm-cli generate` from SQLite schema → separate entity files
4. Replace `format!` string queries with typed `Entity::find().filter(...)`
5. Add `migrations/` directory

---

## Implementation Log

| Date | Change | Files |
|------|--------|-------|
| 2026-07-12 | Phase 1a: Fixed TaqwinHierarchicalView session context race | `src/features/data/TaqwinHierarchicalView.tsx` |
| 2026-07-12 | Phase 1b: Fixed SessionEvolutionFullView 4x reload | `src/features/data/components/SessionEvolutionFullView.tsx` |
| 2026-07-12 | Phase 2: ORM analysis complete, SeaORM adopted | — |
| 2026-07-12 | SQLite indexes pending | `docs/ORM-DATABASE-ANALYSIS.md` ← this doc |
| 2026-07-12 | CASCADE pending | `docs/ORM-DATABASE-ANALYSIS.md` |
| 2026-07-12 | information_schema removal pending | `docs/ORM-DATABASE-ANALYSIS.md` |
| 2026-07-12 | SeaORM pending | `docs/ORM-DATABASE-ANALYSIS.md` |

---

## Quick Win: SQLite Indexes

**Status:** ✅ Script created at `docs/database/sqlite-indexes.sql`

Run with PowerShell:
```powershell
sqlite3 "C:\Users\syedm\taqwin_memory.db" "CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id); CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id); CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id); CREATE INDEX IF NOT EXISTS idx_insights_session ON insights(session_id); CREATE INDEX IF NOT EXISTS idx_files_session ON files(session_id); CREATE INDEX IF NOT EXISTS idx_patterns_session ON patterns(session_id); CREATE INDEX IF NOT EXISTS idx_session_status_history_session ON session_status_history(session_id); CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);"
```

## Quick Win: Pool Size

```rust
// src-tauri/src/database.rs line ~113
.max_connections(20)  // was 5
```

## Quick Win: Remove information_schema

Replace `sqlx::query("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'")` 
with compile-time known `FromRow` derive on `PgDocument` struct. Schema is fixed — no discovery needed.