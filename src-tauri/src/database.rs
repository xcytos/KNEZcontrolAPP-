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
            "postgresql://{}:{}@{}:{}/{}",
            self.user, self.password, self.host, self.port, self.database
        )
    }
}

// Document from PostgreSQL
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PgDocument {
    pub document_id: String,
    pub title: String,
    pub doc_type: String,
    pub content: Option<String>,
    pub domain: Option<String>,
    pub project_name: Option<String>,
    pub session_id: Option<String>,
    pub checkpoint_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub created_at: String,
    pub updated_at: String,
    pub is_large: bool,
    pub file_path: Option<String>,
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
    let pool = PgPool::connect(&config.connection_string()).await?;
    Ok(pool)
}

pub async fn list_postgres_documents(pool: &PgPool, limit: i64) -> Result<Vec<PgDocument>, sqlx::Error> {
    // First, check what columns actually exist
    let schema_check = sqlx::query(
        r#"
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'documents'
        ORDER BY ordinal_position
        "#
    )
    .fetch_all(pool)
    .await?;

    let columns: Vec<String> = schema_check.iter()
        .map(|row| row.get::<String, _>(0))
        .collect();

    // Build dynamic query based on available columns
    let has_tags = columns.contains(&"tags".to_string());
    let has_is_large = columns.contains(&"is_large".to_string());
    let has_file_path = columns.contains(&"file_path".to_string());

    let tags_col = if has_tags { "tags" } else { "NULL as tags" };
    let is_large_col = if has_is_large { "is_large" } else { "false as is_large" };
    let file_path_col = if has_file_path { "file_path" } else { "NULL as file_path" };

    let query_str = format!(
        r#"
        SELECT 
            document_id::text,
            title,
            doc_type,
            content,
            project_name,
            session_id,
            checkpoint_id,
            {},
            created_at::text,
            updated_at::text,
            {},
            {}
        FROM documents
        ORDER BY created_at DESC
        LIMIT $1
        "#,
        tags_col, is_large_col, file_path_col
    );

    let rows = sqlx::query(&query_str)
        .bind(limit)
        .fetch_all(pool)
        .await?;

    let documents = rows.iter().map(|row| {
        let tags = if has_tags {
            let tags_json: Option<serde_json::Value> = row.get(7);
            tags_json.and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(String::from))
                        .collect()
                })
            })
        } else {
            None
        };

        PgDocument {
            document_id: row.get(0),
            title: row.get(1),
            doc_type: row.get(2),
            content: row.get(3),
            domain: None,
            project_name: row.get(4),
            session_id: row.get(5),
            checkpoint_id: row.get(6),
            tags,
            created_at: row.get(8),
            updated_at: row.get(9),
            is_large: row.get(10),
            file_path: row.get(11),
        }
    }).collect();

    Ok(documents)
}

pub async fn get_postgres_document(pool: &PgPool, document_id: &str) -> Result<Option<PgDocument>, sqlx::Error> {
    // Check schema first
    let schema_check = sqlx::query(
        r#"
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'documents'
        "#
    )
    .fetch_all(pool)
    .await?;

    let columns: Vec<String> = schema_check.iter()
        .map(|row| row.get::<String, _>(0))
        .collect();

    let has_tags = columns.contains(&"tags".to_string());
    let has_is_large = columns.contains(&"is_large".to_string());
    let has_file_path = columns.contains(&"file_path".to_string());

    let tags_col = if has_tags { "tags" } else { "NULL as tags" };
    let is_large_col = if has_is_large { "is_large" } else { "false as is_large" };
    let file_path_col = if has_file_path { "file_path" } else { "NULL as file_path" };

    let query_str = format!(
        r#"
        SELECT 
            document_id::text,
            title,
            doc_type,
            content,
            project_name,
            session_id,
            checkpoint_id,
            {},
            created_at::text,
            updated_at::text,
            {},
            {}
        FROM documents
        WHERE document_id::text = $1
        "#,
        tags_col, is_large_col, file_path_col
    );

    let row = sqlx::query(&query_str)
        .bind(document_id)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|row| {
        let tags = if has_tags {
            let tags_json: Option<serde_json::Value> = row.get(7);
            tags_json.and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(String::from))
                        .collect()
                })
            })
        } else {
            None
        };

        PgDocument {
            document_id: row.get(0),
            title: row.get(1),
            doc_type: row.get(2),
            content: row.get(3),
            domain: None,
            project_name: row.get(4),
            session_id: row.get(5),
            checkpoint_id: row.get(6),
            tags,
            created_at: row.get(8),
            updated_at: row.get(9),
            is_large: row.get(10),
            file_path: row.get(11),
        }
    }))
}

pub async fn search_postgres_documents(pool: &PgPool, query: &str, limit: i64) -> Result<Vec<PgDocument>, sqlx::Error> {
    // Check schema first
    let schema_check = sqlx::query(
        r#"
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'documents'
        "#
    )
    .fetch_all(pool)
    .await?;

    let columns: Vec<String> = schema_check.iter()
        .map(|row| row.get::<String, _>(0))
        .collect();

    let has_tags = columns.contains(&"tags".to_string());
    let has_is_large = columns.contains(&"is_large".to_string());
    let has_file_path = columns.contains(&"file_path".to_string());

    let tags_col = if has_tags { "tags" } else { "NULL as tags" };
    let is_large_col = if has_is_large { "is_large" } else { "false as is_large" };
    let file_path_col = if has_file_path { "file_path" } else { "NULL as file_path" };

    let query_str = format!(
        r#"
        SELECT 
            document_id::text,
            title,
            doc_type,
            content,
            project_name,
            session_id,
            checkpoint_id,
            {},
            created_at::text,
            updated_at::text,
            {},
            {}
        FROM documents
        WHERE 
            title ILIKE $1 OR
            content ILIKE $1 OR
            project_name ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
        tags_col, is_large_col, file_path_col
    );

    let rows = sqlx::query(&query_str)
        .bind(format!("%{}%", query))
        .bind(limit)
        .fetch_all(pool)
        .await?;

    let documents = rows.iter().map(|row| {
        let tags = if has_tags {
            let tags_json: Option<serde_json::Value> = row.get(7);
            tags_json.and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(String::from))
                        .collect()
                })
            })
        } else {
            None
        };

        PgDocument {
            document_id: row.get(0),
            title: row.get(1),
            doc_type: row.get(2),
            content: row.get(3),
            domain: None,
            project_name: row.get(4),
            session_id: row.get(5),
            checkpoint_id: row.get(6),
            tags,
            created_at: row.get(8),
            updated_at: row.get(9),
            is_large: row.get(10),
            file_path: row.get(11),
        }
    }).collect();

    Ok(documents)
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
