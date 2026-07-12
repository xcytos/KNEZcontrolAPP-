use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPool, Row};
use std::path::PathBuf;
use rusqlite::{Connection, Result as SqliteResult};

// PostgreSQL Configuration
#[derive(Debug, Clone)]
pub struct PostgresConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
}

impl PostgresConfig {
    pub fn connection_string(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}/{}?sslmode=require",
            self.user, self.password, self.host, self.port, self.database
        )
    }
}

// Document from PostgreSQL — used for JSON serialization to frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PgDocument {
    pub document_id: String,
    pub title: String,
    pub doc_type: String,
    pub content: Option<String>,
    pub session_id: String,
    pub project_name: Option<String>,
    pub project_id: Option<String>,
    pub checkpoint_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub created_at: String,
    pub updated_at: String,
    pub is_large: bool,
    pub file_path: Option<String>,
    pub version_number: Option<i32>,
    pub parent_version_id: Option<String>,
    pub created_by: Option<String>,
    pub updated_by: Option<String>,
    pub content_size: Option<i32>,
    pub slug: Option<String>,
    pub category: Option<String>,
}

// Raw row struct for type-safe sqlx mapping (tags stored as text[] — mapped as Option<String>)
#[derive(Debug, sqlx::FromRow)]
struct PgDocumentRow {
    document_id: String,
    title: String,
    doc_type: String,
    content: Option<String>,
    session_id: String,
    project_name: Option<String>,
    project_id: Option<String>,
    checkpoint_id: Option<String>,
    tags: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    is_large: bool,
    file_path: Option<String>,
    version_number: Option<i32>,
    parent_version_id: Option<uuid::Uuid>,
    created_by: Option<String>,
    updated_by: Option<String>,
    content_size: Option<i32>,
    slug: Option<String>,
    category: Option<String>,
}

fn parse_pg_tags(raw: Option<String>) -> Option<Vec<String>> {
    raw.and_then(|s| {
        let s = s.trim();
        if s.is_empty() || s.eq_ignore_ascii_case("null") {
            return None;
        }
        // PostgreSQL array literal: {item1,item2,item3} or {item1}
        let content = s.strip_prefix('{').and_then(|s| s.strip_suffix('}'));
        content.map(|inner| {
            inner.split(',')
                .map(|s| s.trim().trim_matches('"').to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
    })
}

impl From<PgDocumentRow> for PgDocument {
    fn from(row: PgDocumentRow) -> Self {
        PgDocument {
            document_id: row.document_id,
            title: row.title,
            doc_type: row.doc_type,
            content: row.content,
            session_id: row.session_id,
            project_name: row.project_name,
            project_id: row.project_id,
            checkpoint_id: row.checkpoint_id,
            tags: parse_pg_tags(row.tags),
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
            is_large: row.is_large,
            file_path: row.file_path,
            version_number: row.version_number,
            parent_version_id: row.parent_version_id.map(|u| u.to_string()),
            created_by: row.created_by,
            updated_by: row.updated_by,
            content_size: row.content_size,
            slug: row.slug,
            category: row.category,
        }
    }
}

// Checkpoint from PostgreSQL (TAQWIN checkpoints table)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PgCheckpoint {
    pub checkpoint_id: String,
    pub session_id: Option<String>,
    pub title: String,
    pub created_at: String,
    pub context_data: String,
    pub learned_memories: Option<String>,
    pub decisions: Option<String>,
    pub findings: Option<String>,
    pub metadata: Option<String>,
    pub checkpoint_type: String,
}

// SQLite Session from TAQWIN
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaqwinSession {
    pub id: String,
    pub display_id: String,
    pub name: String,
    pub session_type: String,
    pub tags: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

// SQLite Memory
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaqwinMemory {
    pub id: String,
    pub session_id: String,
    pub memory_type: String,
    pub domain: String,
    pub content: String,
    pub importance: i32,
    pub created_at: String,
}

// SQLite Checkpoint
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaqwinCheckpoint {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub context: String,
    pub learned_memories: String,
    pub decisions: String,
    pub findings: String,
    pub created_at: String,
}

// PostgreSQL Operations
pub async fn connect_postgres(config: PostgresConfig) -> Result<PgPool, sqlx::Error> {
    use sqlx::postgres::PgPoolOptions;
    use std::time::Duration;
    
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .connect(&config.connection_string())
        .await?;
    
    Ok(pool)
}

pub async fn list_postgres_documents(pool: &PgPool, limit: i64) -> Result<Vec<PgDocument>, sqlx::Error> {
    let rows = sqlx::query_as::<_, PgDocumentRow>(
        r#"
        SELECT
            document_id::text,
            title,
            doc_type,
            content,
            session_id,
            project_name,
            project_id,
            checkpoint_id,
            tags::text,
            created_at,
            updated_at,
            is_large,
            file_path,
            version_number,
            parent_version_id,
            created_by,
            updated_by,
            content_size,
            slug,
            category
        FROM documents
        ORDER BY created_at DESC
        LIMIT $1
        "#
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(PgDocument::from).collect())
}

pub async fn get_postgres_document(pool: &PgPool, document_id: &str) -> Result<Option<PgDocument>, sqlx::Error> {
    let row = sqlx::query_as::<_, PgDocumentRow>(
        r#"
        SELECT
            document_id::text,
            title,
            doc_type,
            content,
            session_id,
            project_name,
            project_id,
            checkpoint_id,
            tags::text,
            created_at,
            updated_at,
            is_large,
            file_path,
            version_number,
            parent_version_id,
            created_by,
            updated_by,
            content_size,
            slug,
            category
        FROM documents
        WHERE document_id::text = $1
        "#
    )
    .bind(document_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(PgDocument::from))
}

pub async fn search_postgres_documents(pool: &PgPool, search: &str, limit: i64) -> Result<Vec<PgDocument>, sqlx::Error> {
    let pattern = format!("%{}%", search);
    let rows = sqlx::query_as::<_, PgDocumentRow>(
        r#"
        SELECT
            document_id::text,
            title,
            doc_type,
            content,
            session_id,
            project_name,
            project_id,
            checkpoint_id,
            tags::text,
            created_at,
            updated_at,
            is_large,
            file_path,
            version_number,
            parent_version_id,
            created_by,
            updated_by,
            content_size,
            slug,
            category
        FROM documents
        WHERE title ILIKE $1 OR content ILIKE $1 OR project_name ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2
        "#
    )
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(PgDocument::from).collect())
}

pub async fn list_postgres_checkpoints(pool: &PgPool, limit: i64) -> Result<Vec<PgCheckpoint>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            checkpoint_id,
            session_id,
            title,
            created_at::text,
            context_data,
            learned_memories,
            decisions,
            findings,
            metadata,
            type as checkpoint_type
        FROM checkpoints
        ORDER BY created_at DESC
        LIMIT $1
        "#
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let checkpoints = rows.iter().map(|row| {
        PgCheckpoint {
            checkpoint_id: row.get(0),
            session_id: row.get(1),
            title: row.get(2),
            created_at: row.get(3),
            context_data: row.get(4),
            learned_memories: row.get(5),
            decisions: row.get(6),
            findings: row.get(7),
            metadata: row.get(8),
            checkpoint_type: row.get(9),
        }
    }).collect();

    Ok(checkpoints)
}

// SQLite Operations
pub fn connect_sqlite(db_path: PathBuf) -> SqliteResult<Connection> {
    Connection::open(db_path)
}

pub fn list_taqwin_sessions(conn: &Connection, limit: i64) -> SqliteResult<Vec<TaqwinSession>> {
    // First check what columns exist
    let mut check_stmt = conn.prepare("PRAGMA table_info(sessions)")?;
    let columns: Vec<String> = check_stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    // Build query based on available columns
    let has_id = columns.contains(&"id".to_string());
    let has_session_id = columns.contains(&"session_id".to_string());
    let has_display_id = columns.contains(&"display_id".to_string());
    let has_name = columns.contains(&"name".to_string());
    let has_type = columns.contains(&"type".to_string());
    let has_session_type = columns.contains(&"session_type".to_string());
    let has_tags = columns.contains(&"tags".to_string());
    let has_status = columns.contains(&"status".to_string());
    let has_created_at = columns.contains(&"created_at".to_string());
    let has_updated_at = columns.contains(&"updated_at".to_string());

    let id_col = if has_id { "id" } else if has_session_id { "session_id" } else { "'unknown'" };
    let display_id_col = if has_display_id { "display_id" } else { "'N/A'" };
    let name_col = if has_name { "name" } else { "'Unnamed'" };
    let type_col = if has_type { "type" } else if has_session_type { "session_type" } else { "'GENERAL'" };
    let tags_col = if has_tags { "tags" } else { "NULL" };
    let status_col = if has_status { "status" } else { "'active'" };
    let created_col = if has_created_at { "created_at" } else { "''" };
    let updated_col = if has_updated_at { "updated_at" } else { "''" };

    let query_str = format!(
        "SELECT {}, {}, {}, {}, {}, {}, {}, {} 
         FROM sessions 
         ORDER BY {} DESC 
         LIMIT ?1",
        id_col, display_id_col, name_col, type_col, tags_col, status_col, created_col, updated_col,
        if has_created_at { "created_at" } else { "rowid" }
    );

    let mut stmt = conn.prepare(&query_str)?;

    let sessions = stmt.query_map([limit], |row| {
        Ok(TaqwinSession {
            id: row.get(0)?,
            display_id: row.get(1)?,
            name: row.get(2)?,
            session_type: row.get(3)?,
            tags: row.get(4)?,
            status: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(sessions)
}

pub fn update_taqwin_session_status(conn: &Connection, session_id: &str, new_status: &str) -> SqliteResult<bool> {
    let mut check_stmt = conn.prepare("PRAGMA table_info(sessions)")?;
    let columns: Vec<String> = check_stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    let has_session_id = columns.contains(&"session_id".to_string());
    let has_status = columns.contains(&"status".to_string());

    if !has_status {
        return Ok(false);
    }

    let id_col = if has_session_id { "session_id" } else { "id" };

    let updated = conn.execute(
        &format!("UPDATE sessions SET status = ?1, updated_at = datetime('now') WHERE {} = ?2", id_col),
        rusqlite::params![new_status, session_id],
    )?;

    Ok(updated > 0)
}

pub fn list_taqwin_memories(conn: &Connection, limit: i64) -> SqliteResult<Vec<TaqwinMemory>> {
    // Check what columns exist
    let mut check_stmt = conn.prepare("PRAGMA table_info(memories)")?;
    let columns: Vec<String> = check_stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    let has_id = columns.contains(&"id".to_string());
    let has_memory_id = columns.contains(&"memory_id".to_string());
    let has_session_id = columns.contains(&"session_id".to_string());
    let has_type = columns.contains(&"type".to_string());
    let has_memory_type = columns.contains(&"memory_type".to_string());
    let has_domain = columns.contains(&"domain".to_string());
    let has_content = columns.contains(&"content".to_string());
    let has_importance = columns.contains(&"importance".to_string());
    let has_created_at = columns.contains(&"created_at".to_string());

    let id_col = if has_id { "id" } else if has_memory_id { "memory_id" } else { "'unknown'" };
    let session_id_col = if has_session_id { "session_id" } else { "''" };
    let type_col = if has_type { "type" } else if has_memory_type { "memory_type" } else { "'general'" };
    let domain_col = if has_domain { "domain" } else { "''" };
    let content_col = if has_content { "content" } else { "''" };
    let importance_col = if has_importance { "importance" } else { "5" };
    let created_col = if has_created_at { "created_at" } else { "''" };

    let query_str = format!(
        "SELECT {}, {}, {}, {}, {}, {}, {} 
         FROM memories 
         ORDER BY {} DESC 
         LIMIT ?1",
        id_col, session_id_col, type_col, domain_col, content_col, importance_col, created_col,
        if has_created_at { "created_at" } else { "rowid" }
    );

    let mut stmt = conn.prepare(&query_str)?;

    let memories = stmt.query_map([limit], |row| {
        Ok(TaqwinMemory {
            id: row.get(0)?,
            session_id: row.get(1)?,
            memory_type: row.get(2)?,
            domain: row.get(3)?,
            content: row.get(4)?,
            importance: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(memories)
}

pub fn list_taqwin_checkpoints(conn: &Connection, limit: i64) -> SqliteResult<Vec<TaqwinCheckpoint>> {
    // Check what columns exist
    let mut check_stmt = conn.prepare("PRAGMA table_info(checkpoints)")?;
    let columns: Vec<String> = check_stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;

    let has_id = columns.contains(&"id".to_string());
    let has_checkpoint_id = columns.contains(&"checkpoint_id".to_string());
    let has_session_id = columns.contains(&"session_id".to_string());
    let has_title = columns.contains(&"title".to_string());
    let has_context = columns.contains(&"context".to_string());
    let has_learned_memories = columns.contains(&"learned_memories".to_string());
    let has_decisions = columns.contains(&"decisions".to_string());
    let has_findings = columns.contains(&"findings".to_string());
    let has_created_at = columns.contains(&"created_at".to_string());

    let id_col = if has_id { "id" } else if has_checkpoint_id { "checkpoint_id" } else { "'unknown'" };
    let session_id_col = if has_session_id { "session_id" } else { "''" };
    let title_col = if has_title { "title" } else { "'Checkpoint'" };
    let context_col = if has_context { "context" } else { "'{}'" };
    let learned_col = if has_learned_memories { "learned_memories" } else { "'[]'" };
    let decisions_col = if has_decisions { "decisions" } else { "'[]'" };
    let findings_col = if has_findings { "findings" } else { "'[]'" };
    let created_col = if has_created_at { "created_at" } else { "''" };

    let query_str = format!(
        "SELECT {}, {}, {}, {}, {}, {}, {}, {} 
         FROM checkpoints 
         ORDER BY {} DESC 
         LIMIT ?1",
        id_col, session_id_col, title_col, context_col, learned_col, decisions_col, findings_col, created_col,
        if has_created_at { "created_at" } else { "rowid" }
    );

    let mut stmt = conn.prepare(&query_str)?;

    let checkpoints = stmt.query_map([limit], |row| {
        Ok(TaqwinCheckpoint {
            id: row.get(0)?,
            session_id: row.get(1)?,
            title: row.get(2)?,
            context: row.get(3)?,
            learned_memories: row.get(4)?,
            decisions: row.get(5)?,
            findings: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(checkpoints)
}
