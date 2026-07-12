-- SQLite Performance Indexes
-- Run once against: C:\Users\syedm\taqwin_memory.db
-- These indexes eliminate full table scans when joining child tables to sessions.
-- Run with: sqlite3 "C:\Users\syedm\taqwin_memory.db" < docs/database/sqlite-indexes.sql

ATTACH DATABASE 'C:\Users\syedm\taqwin_memory.db' AS main;

CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_session ON insights(session_id);
CREATE INDEX IF NOT EXISTS idx_files_session ON files(session_id);
CREATE INDEX IF NOT EXISTS idx_patterns_session ON patterns(session_id);
CREATE INDEX IF NOT EXISTS idx_session_status_history_session ON session_status_history(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);