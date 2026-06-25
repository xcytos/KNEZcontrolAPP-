-- SQLite Schema Inspector for TAQWIN Session MCP
-- Database: C:\Users\syedm\taqwin_memory.db

-- ========================================
-- SCHEMA INSPECTION
-- ========================================

-- List all tables
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Sessions table schema (with DA003 heartbeat fields)
SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions';

-- Checkpoints table schema
SELECT sql FROM sqlite_master WHERE type='table' AND name='checkpoints';

-- Events table schema
SELECT sql FROM sqlite_master WHERE type='table' AND name='events';

-- Projects table schema
SELECT sql FROM sqlite_master WHERE type='table' AND name='projects';

-- Memories table schema
SELECT sql FROM sqlite_master WHERE type='table' AND name='memories';

-- ========================================
-- DATA STATISTICS
-- ========================================

-- Total session count
SELECT COUNT(*) as total_sessions FROM sessions;

-- Sessions by type
SELECT 
    type as session_type,
    COUNT(*) as count
FROM sessions 
GROUP BY type 
ORDER BY count DESC;

-- Sessions by status
SELECT 
    status,
    COUNT(*) as count
FROM sessions 
GROUP BY status;

-- Sessions by project
SELECT 
    project_id,
    project_path,
    COUNT(*) as session_count
FROM sessions 
WHERE project_id IS NOT NULL
GROUP BY project_id, project_path 
ORDER BY session_count DESC;

-- Total checkpoint count
SELECT COUNT(*) as total_checkpoints FROM checkpoints;

-- Checkpoints by session
SELECT 
    session_id,
    COUNT(*) as checkpoint_count
FROM checkpoints 
GROUP BY session_id 
ORDER BY checkpoint_count DESC 
LIMIT 20;

-- Total event count
SELECT COUNT(*) as total_events FROM events;

-- Events by session
SELECT 
    session_id,
    COUNT(*) as event_count
FROM events 
GROUP BY session_id 
ORDER BY event_count DESC 
LIMIT 20;

-- ========================================
-- HEARTBEAT & CONNECTION STATE (DA003)
-- ========================================

-- Sessions with heartbeat data
SELECT 
    session_id,
    display_id,
    name,
    last_heartbeat_at,
    heartbeat_timeout_seconds,
    CASE 
        WHEN last_heartbeat_at IS NULL THEN 'never_active'
        WHEN (julianday('now') - julianday(last_heartbeat_at)) * 24 * 60 < 1 THEN 'active'
        WHEN (julianday('now') - julianday(last_heartbeat_at)) * 24 * 60 < COALESCE(heartbeat_timeout_seconds, 120) / 60.0 THEN 'idle'
        ELSE 'disconnected'
    END as connection_state,
    CAST((julianday('now') - julianday(last_heartbeat_at)) * 24 * 60 AS INTEGER) as idle_minutes
FROM sessions 
WHERE last_heartbeat_at IS NOT NULL
ORDER BY last_heartbeat_at DESC 
LIMIT 20;

-- Sessions with client metadata
SELECT 
    session_id,
    display_id,
    name,
    client_metadata
FROM sessions 
WHERE client_metadata IS NOT NULL;

-- ========================================
-- SPECIFIC SESSION QUERIES
-- ========================================

-- CA009 session details
SELECT * FROM sessions WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410';

-- CA009 checkpoints
SELECT 
    checkpoint_id,
    title,
    created_at,
    type
FROM checkpoints 
WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410'
ORDER BY created_at DESC;

-- DA003 session details
SELECT * FROM sessions WHERE display_id = 'DA003';

-- DA003 checkpoints
SELECT 
    checkpoint_id,
    title,
    created_at,
    type
FROM checkpoints 
WHERE session_id = 'DA003'
ORDER BY created_at DESC;

-- ========================================
-- PROJECT HIERARCHY
-- ========================================

-- Projects with parent-child relationships
SELECT 
    project_id,
    project_name,
    parent_project_id,
    type,
    created_at
FROM projects 
ORDER BY parent_project_id NULLS FIRST, project_id;

-- Root projects (no parent)
SELECT 
    project_id,
    project_name,
    project_path,
    description
FROM projects 
WHERE parent_project_id IS NULL 
ORDER BY project_name;

-- Child projects
SELECT 
    p.project_id,
    p.project_name,
    p.parent_project_id,
    parent.project_name as parent_name
FROM projects p
LEFT JOIN projects parent ON p.parent_project_id = parent.project_id
WHERE p.parent_project_id IS NOT NULL
ORDER BY p.parent_project_id, p.project_name;

-- ========================================
-- DATA QUALITY CHECKS
-- ========================================

-- Sessions without project_id (should be 0 after DA003 REQ-1)
SELECT COUNT(*) as sessions_without_project 
FROM sessions 
WHERE project_id IS NULL OR project_id = '';

-- Checkpoints without sessions (orphans)
SELECT COUNT(*) as orphan_checkpoints 
FROM checkpoints c
WHERE NOT EXISTS (
    SELECT 1 FROM sessions s WHERE s.session_id = c.session_id
);

-- Events without sessions (orphans)
SELECT COUNT(*) as orphan_events 
FROM events e
WHERE NOT EXISTS (
    SELECT 1 FROM sessions s WHERE s.session_id = e.session_id
);

-- ========================================
-- RECENT ACTIVITY
-- ========================================

-- Recent sessions (last 7 days)
SELECT 
    session_id,
    display_id,
    name,
    type,
    created_at,
    updated_at
FROM sessions 
WHERE created_at >= date('now', '-7 days')
ORDER BY created_at DESC;

-- Recent checkpoints (last 7 days)
SELECT 
    c.checkpoint_id,
    c.title,
    c.created_at,
    s.display_id as session_display_id,
    s.name as session_name
FROM checkpoints c
JOIN sessions s ON c.session_id = s.session_id
WHERE c.created_at >= date('now', '-7 days')
ORDER BY c.created_at DESC;

-- ========================================
-- SESSION TIMELINE
-- ========================================

-- CA009 timeline (checkpoints + events)
SELECT 
    'checkpoint' as type,
    checkpoint_id as id,
    title as description,
    created_at
FROM checkpoints 
WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410'
UNION ALL
SELECT 
    'event' as type,
    event_id as id,
    trigger as description,
    created_at
FROM events 
WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410'
ORDER BY created_at DESC;
