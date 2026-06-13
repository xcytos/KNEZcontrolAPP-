use tauri::State;
use std::sync::Mutex;
use std::path::PathBuf;
use std::process::Command;
use sqlx::postgres::PgPool;
use serde::{Deserialize, Serialize};

use crate::database::*;

// Global state for database connections
pub struct DatabaseState {
    pub postgres_pool: Mutex<Option<PgPool>>,
}

// Configuration for PostgreSQL
#[derive(Debug, Deserialize)]
pub struct PostgresConnectionConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
}

// Response types
#[derive(Debug, Serialize)]
pub struct DatabaseResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> DatabaseResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

// PostgreSQL Commands
#[tauri::command]
pub async fn connect_to_postgres(
    config: PostgresConnectionConfig,
    state: State<'_, DatabaseState>,
) -> Result<DatabaseResponse<String>, String> {
    let pg_config = PostgresConfig {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
    };

    match connect_postgres(pg_config).await {
        Ok(pool) => {
            let mut pool_guard = state.postgres_pool.lock().unwrap();
            *pool_guard = Some(pool);
            Ok(DatabaseResponse::success("Connected to PostgreSQL".to_string()))
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn list_pg_documents(
    limit: i64,
    state: State<'_, DatabaseState>,
) -> Result<DatabaseResponse<Vec<PgDocument>>, String> {
    let pool = {
        let pool_guard = state.postgres_pool.lock().unwrap();
        pool_guard.as_ref().cloned()
    };
    
    if let Some(pool) = pool {
        match list_postgres_documents(&pool, limit).await {
            Ok(documents) => Ok(DatabaseResponse::success(documents)),
            Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
        }
    } else {
        Ok(DatabaseResponse::error("Not connected to PostgreSQL".to_string()))
    }
}

#[tauri::command]
pub async fn get_pg_document(
    document_id: String,
    state: State<'_, DatabaseState>,
) -> Result<DatabaseResponse<Option<PgDocument>>, String> {
    let pool = {
        let pool_guard = state.postgres_pool.lock().unwrap();
        pool_guard.as_ref().cloned()
    };
    
    if let Some(pool) = pool {
        match get_postgres_document(&pool, &document_id).await {
            Ok(document) => Ok(DatabaseResponse::success(document)),
            Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
        }
    } else {
        Ok(DatabaseResponse::error("Not connected to PostgreSQL".to_string()))
    }
}

#[tauri::command]
pub async fn search_pg_documents(
    query: String,
    limit: i64,
    state: State<'_, DatabaseState>,
) -> Result<DatabaseResponse<Vec<PgDocument>>, String> {
    let pool = {
        let pool_guard = state.postgres_pool.lock().unwrap();
        pool_guard.as_ref().cloned()
    };
    
    if let Some(pool) = pool {
        match search_postgres_documents(&pool, &query, limit).await {
            Ok(documents) => Ok(DatabaseResponse::success(documents)),
            Err(e) => Ok(DatabaseResponse::error(format!("Search failed: {}", e))),
        }
    } else {
        Ok(DatabaseResponse::error("Not connected to PostgreSQL".to_string()))
    }
}

#[tauri::command]
pub async fn list_pg_checkpoints(
    limit: i64,
    state: State<'_, DatabaseState>,
) -> Result<DatabaseResponse<Vec<PgCheckpoint>>, String> {
    let pool = {
        let pool_guard = state.postgres_pool.lock().unwrap();
        pool_guard.as_ref().cloned()
    };
    
    if let Some(pool) = pool {
        match list_postgres_checkpoints(&pool, limit).await {
            Ok(checkpoints) => Ok(DatabaseResponse::success(checkpoints)),
            Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
        }
    } else {
        Ok(DatabaseResponse::error("Not connected to PostgreSQL".to_string()))
    }
}

// Session Hierarchy - fetch all related data for a session
#[derive(Debug, Serialize)]
pub struct SessionHierarchy {
    pub session: serde_json::Value,
    pub checkpoints: Vec<serde_json::Value>,
    pub events: Vec<serde_json::Value>,
    pub decisions: Vec<serde_json::Value>,
    pub insights: Vec<serde_json::Value>,
    pub patterns: Vec<serde_json::Value>,
    pub files: Vec<serde_json::Value>,
    pub memories: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn sqlite_get_session_hierarchy(
    db_path: String,
    session_id: String,
) -> Result<DatabaseResponse<SessionHierarchy>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            // Fetch session - try different column combinations
            let session = {
                // First try with session_id column
                let result = conn.query_row(
                    "SELECT * FROM sessions WHERE session_id = ?1 LIMIT 1",
                    [&session_id],
                    |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, Option<String>>(0).ok().flatten(),
                            "session_id": row.get::<_, Option<String>>(1).ok().flatten(),
                            "display_id": row.get::<_, Option<String>>(2).ok().flatten(),
                            "name": row.get::<_, Option<String>>(3).ok().flatten(),
                            "session_type": row.get::<_, Option<String>>(4).ok().flatten(),
                            "tags": row.get::<_, Option<String>>(5).ok().flatten(),
                            "status": row.get::<_, Option<String>>(6).ok().flatten(),
                            "created_at": row.get::<_, Option<String>>(7).ok().flatten(),
                            "updated_at": row.get::<_, Option<String>>(8).ok().flatten(),
                        }))
                    }
                );
                
                // If that fails, try with id column
                match result {
                    Ok(s) => s,
                    Err(_) => {
                        match conn.query_row(
                            "SELECT * FROM sessions WHERE id = ?1 LIMIT 1",
                            [&session_id],
                            |row| {
                                Ok(serde_json::json!({
                                    "id": row.get::<_, Option<String>>(0).ok().flatten(),
                                    "display_id": row.get::<_, Option<String>>(1).ok().flatten(),
                                    "name": row.get::<_, Option<String>>(2).ok().flatten(),
                                    "session_type": row.get::<_, Option<String>>(3).ok().flatten(),
                                    "tags": row.get::<_, Option<String>>(4).ok().flatten(),
                                    "status": row.get::<_, Option<String>>(5).ok().flatten(),
                                    "created_at": row.get::<_, Option<String>>(6).ok().flatten(),
                                    "updated_at": row.get::<_, Option<String>>(7).ok().flatten(),
                                }))
                            }
                        ) {
                            Ok(s) => s,
                            Err(_) => serde_json::json!({}),
                        }
                    }
                }
            };

            // Helper function to fetch related records with ALL columns
            let fetch_table = |table_name: &str| -> Vec<serde_json::Value> {
                // First, get column info for this table
                let pragma_query = format!("PRAGMA table_info({})", table_name);
                let col_info: Vec<String> = conn.prepare(&pragma_query)
                    .ok()
                    .and_then(|mut stmt| {
                        stmt.query_map([], |row| row.get::<_, String>(1))
                            .ok()
                            .map(|rows| rows.collect::<Result<Vec<_>, _>>().unwrap_or_default())
                    })
                    .unwrap_or_default();

                // Now query the table
                let query = format!(
                    "SELECT * FROM {} WHERE session_id = ?1 ORDER BY created_at DESC LIMIT 100",
                    table_name
                );
                
                match conn.prepare(&query) {
                    Ok(mut stmt) => {
                        match stmt.query_map([&session_id], |row| {
                            let mut obj = serde_json::Map::new();
                            
                            // Extract all available columns
                            for (idx, col_name) in col_info.iter().enumerate() {
                                let value = if let Ok(v) = row.get::<_, String>(idx) {
                                    serde_json::Value::String(v)
                                } else if let Ok(v) = row.get::<_, i64>(idx) {
                                    serde_json::Value::Number(v.into())
                                } else if let Ok(v) = row.get::<_, f64>(idx) {
                                    serde_json::json!(v)
                                } else {
                                    serde_json::Value::Null
                                };
                                obj.insert(col_name.clone(), value);
                            }
                            
                            Ok(serde_json::Value::Object(obj))
                        }) {
                            Ok(iter) => iter.collect::<Result<Vec<_>, _>>().unwrap_or_default(),
                            Err(_) => vec![],
                        }
                    }
                    Err(_) => vec![],
                }
            };

            Ok(DatabaseResponse::success(SessionHierarchy {
                session,
                checkpoints: fetch_table("checkpoints"),
                events: fetch_table("events"),
                decisions: fetch_table("decisions"),
                insights: fetch_table("insights"),
                patterns: fetch_table("patterns"),
                files: fetch_table("files"),
                memories: fetch_table("memories"),
            }))
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

// Generic SQLite query commands
#[tauri::command]
pub async fn sqlite_list_tables(
    db_path: String,
) -> Result<DatabaseResponse<Vec<String>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            match conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") {
                Ok(mut stmt) => {
                    let tables: Result<Vec<String>, _> = stmt
                        .query_map([], |row| row.get(0))
                        .unwrap()
                        .collect();
                    
                    match tables {
                        Ok(table_list) => Ok(DatabaseResponse::success(table_list)),
                        Err(e) => Ok(DatabaseResponse::error(format!("Failed to list tables: {}", e))),
                    }
                }
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to prepare query: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn sqlite_get_table_info(
    db_path: String,
    table_name: String,
) -> Result<DatabaseResponse<Vec<serde_json::Value>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            let query = format!("PRAGMA table_info({})", table_name);
            match conn.prepare(&query) {
                Ok(mut stmt) => {
                    let columns: Result<Vec<serde_json::Value>, _> = stmt
                        .query_map([], |row| {
                            Ok(serde_json::json!({
                                "cid": row.get::<_, i32>(0)?,
                                "name": row.get::<_, String>(1)?,
                                "type": row.get::<_, String>(2)?,
                                "notnull": row.get::<_, i32>(3)?,
                                "dflt_value": row.get::<_, Option<String>>(4)?,
                                "pk": row.get::<_, i32>(5)?,
                            }))
                        })
                        .unwrap()
                        .collect();
                    
                    match columns {
                        Ok(col_list) => Ok(DatabaseResponse::success(col_list)),
                        Err(e) => Ok(DatabaseResponse::error(format!("Failed to get table info: {}", e))),
                    }
                }
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to prepare query: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn sqlite_query_table(
    db_path: String,
    table_name: String,
    limit: i64,
) -> Result<DatabaseResponse<Vec<serde_json::Value>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            // First get column names
            let query = format!("PRAGMA table_info({})", table_name);
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            
            // Check if created_at column exists for ordering
            let has_created_at = columns.contains(&"created_at".to_string());
            
            // Now query the table with ORDER BY if possible
            let query = if has_created_at {
                format!("SELECT * FROM {} ORDER BY created_at DESC LIMIT {}", table_name, limit)
            } else {
                format!("SELECT * FROM {} LIMIT {}", table_name, limit)
            };
            
            match conn.prepare(&query) {
                Ok(mut stmt) => {
                    let rows: Result<Vec<serde_json::Value>, _> = stmt
                        .query_map([], |row| {
                            let mut record = serde_json::Map::new();
                            for (idx, col_name) in columns.iter().enumerate() {
                                // Try to get value as different types
                                let value = if let Ok(v) = row.get::<_, String>(idx) {
                                    serde_json::Value::String(v)
                                } else if let Ok(v) = row.get::<_, i64>(idx) {
                                    serde_json::Value::Number(v.into())
                                } else if let Ok(v) = row.get::<_, f64>(idx) {
                                    serde_json::json!(v)
                                } else if let Ok(_) = row.get::<_, Option<String>>(idx) {
                                    serde_json::Value::Null
                                } else {
                                    serde_json::Value::Null
                                };
                                record.insert(col_name.clone(), value);
                            }
                            Ok(serde_json::Value::Object(record))
                        })
                        .unwrap()
                        .collect();
                    
                    match rows {
                        Ok(row_list) => Ok(DatabaseResponse::success(row_list)),
                        Err(e) => Ok(DatabaseResponse::error(format!("Failed to query table: {}", e))),
                    }
                }
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to prepare query: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn sqlite_get_row_count(
    db_path: String,
    table_name: String,
) -> Result<DatabaseResponse<i64>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            let query = format!("SELECT COUNT(*) FROM {}", table_name);
            match conn.query_row(&query, [], |row| row.get(0)) {
                Ok(count) => Ok(DatabaseResponse::success(count)),
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to count rows: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

// SQLite Commands (legacy TAQWIN-specific)
#[tauri::command]
pub async fn list_sqlite_sessions(
    db_path: String,
    limit: i64,
) -> Result<DatabaseResponse<Vec<TaqwinSession>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            match list_taqwin_sessions(&conn, limit) {
                Ok(sessions) => Ok(DatabaseResponse::success(sessions)),
                Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn list_sqlite_memories(
    db_path: String,
    limit: i64,
) -> Result<DatabaseResponse<Vec<TaqwinMemory>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            match list_taqwin_memories(&conn, limit) {
                Ok(memories) => Ok(DatabaseResponse::success(memories)),
                Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn list_sqlite_checkpoints(
    db_path: String,
    limit: i64,
) -> Result<DatabaseResponse<Vec<TaqwinCheckpoint>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            match list_taqwin_checkpoints(&conn, limit) {
                Ok(checkpoints) => Ok(DatabaseResponse::success(checkpoints)),
                Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}


// Git Statistics
#[derive(Debug, Serialize)]
pub struct GitFileChange {
    pub file: String,
    pub insertions: u32,
    pub deletions: u32,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub message: String,
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
    pub files: Vec<GitFileChange>,
}

#[derive(Debug, Serialize)]
pub struct GitStats {
    pub total_commits: u32,
    pub total_files_changed: u32,
    pub total_insertions: u32,
    pub total_deletions: u32,
    pub branch: String,
}

#[derive(Debug, Serialize)]
pub struct GitStatsResponse {
    pub commits: Vec<GitCommit>,
    pub stats: GitStats,
}

#[tauri::command]
pub async fn get_git_stats(
    repo_path: String,
    limit: u32,
) -> Result<GitStatsResponse, String> {
    // Get current branch
    let branch_output = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to get branch: {}", e))?;
    
    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();

    // Get commit log with stats
    let log_output = Command::new("git")
        .arg("log")
        .arg(format!("-{}", limit))
        .arg("--pretty=format:%H|%h|%an|%ae|%ai|%s")
        .arg("--numstat")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to get git log: {}", e))?;
    
    let log_str = String::from_utf8_lossy(&log_output.stdout);
    
    let mut commits = Vec::new();
    let mut total_files_changed = 0;
    let mut total_insertions = 0;
    let mut total_deletions = 0;
    
    // Parse git log output
    let mut current_commit: Option<GitCommit> = None;
    
    for line in log_str.lines() {
        if line.is_empty() {
            continue;
        }
        
        // Check if this is a commit line (contains |)
        if line.contains('|') && line.split('|').count() == 6 {
            // Save previous commit if exists
            if let Some(commit) = current_commit.take() {
                total_files_changed += commit.files_changed;
                total_insertions += commit.insertions;
                total_deletions += commit.deletions;
                commits.push(commit);
            }
            
            // Parse new commit
            let parts: Vec<&str> = line.split('|').collect();
            current_commit = Some(GitCommit {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                email: parts[3].to_string(),
                date: parts[4].to_string(),
                message: parts[5].to_string(),
                files_changed: 0,
                insertions: 0,
                deletions: 0,
                files: Vec::new(),
            });
        } else if let Some(ref mut commit) = current_commit {
            // Parse file change line (numstat format: insertions deletions filename)
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let insertions = parts[0].parse::<u32>().unwrap_or(0);
                let deletions = parts[1].parse::<u32>().unwrap_or(0);
                let filename = parts[2..].join(" ");
                
                // Determine status
                let status = if insertions > 0 && deletions == 0 {
                    "A" // Added
                } else if insertions == 0 && deletions > 0 {
                    "D" // Deleted
                } else {
                    "M" // Modified
                };
                
                commit.files.push(GitFileChange {
                    file: filename,
                    insertions,
                    deletions,
                    status: status.to_string(),
                });
                
                commit.files_changed += 1;
                commit.insertions += insertions;
                commit.deletions += deletions;
            }
        }
    }
    
    // Don't forget the last commit
    if let Some(commit) = current_commit {
        total_files_changed += commit.files_changed;
        total_insertions += commit.insertions;
        total_deletions += commit.deletions;
        commits.push(commit);
    }
    
    // Calculate total commits before moving the vector
    let total_commits = commits.len() as u32;
    
    Ok(GitStatsResponse {
        commits,
        stats: GitStats {
            total_commits,
            total_files_changed,
            total_insertions,
            total_deletions,
            branch,
        },
    })
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .arg("push")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;
    
    if output.status.success() {
        Ok("Push successful".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git push failed: {}", stderr))
    }
}
