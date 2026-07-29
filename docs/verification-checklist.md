# SeaORM Migration — Verification Checklist

**Session CA025 | Phase: database-orm | CP016**

---

## 1. Frontend Services

- [ ] `SqliteService.listSessions()` returns typed `OrmSession[]`
- [ ] `SqliteService.listCheckpoints()` returns `OrmCheckpoint[]`
- [ ] `SqliteService.listSessionEvents(sessionId)` returns `OrmEvent[]`
- [ ] `SqliteService.updateSessionStatus()` updates status + `updated_at`
- [ ] `TaqwinDataService.listSessions()` enriches with `connection_state`/`idle_duration`
- [ ] `PostgresService.listDocuments(limit)` returns `OrmDocument[]`
- [ ] `PostgresService.searchDocuments(query, limit)` returns filtered `OrmDocument[]`
- [ ] `GenericSqliteService.queryTable()` still works (Data Explorer)

## 2. Tauri IPC Commands

- [ ] `orm_list_sessions` returns typed session data
- [ ] `orm_find_session` returns single session or null
- [ ] `orm_list_checkpoints` returns typed checkpoint data
- [ ] `orm_list_session_events` returns events by session_id
- [ ] `orm_get_session_hierarchy` returns all 7 entity types (session, checkpoints, events, decisions, insights, patterns, files)
- [ ] `orm_update_session_status` updates via SeaORM ActiveModel
- [ ] `orm_list_documents` returns typed document data
- [ ] `orm_search_documents` returns filtered documents

## 3. Build Verification

- [ ] `cargo check` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vite build` — successful
- [ ] `npm run tauri build` — MSI + NSIS generated

## 4. Code Cleanup

- [ ] No `PgDocumentRow`/`parse_pg_tags` in `database.rs`
- [ ] No legacy TAQWIN structs in `database.rs`
- [ ] No references to removed commands in frontend
- [ ] `lib.rs` `invoke_handler` has 34 entries (not 44)
- [ ] `database.rs` is ~25 lines (not 420)

## 5. Connection Management

- [ ] `SeaOrmState` initialized in `setup()`
- [ ] ORM commands reuse cached connection when available
- [ ] Fallback to direct connect on cache miss
- [ ] No `MutexGuard` held across `.await` (Send-safe)

## 6. Data Integrity

- [ ] All 16 CA025 checkpoints still in SQLite
- [ ] Session list shows same count as before migration
- [ ] Status updates persist correctly
