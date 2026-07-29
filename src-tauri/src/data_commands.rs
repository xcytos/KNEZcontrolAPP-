use tauri::State;
use std::sync::Mutex;
use std::path::PathBuf;
use std::process::Command;
use sqlx::postgres::PgPool;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

use crate::database::*;
use crate::repositories;

// Global state for database connections
pub struct DatabaseState {
    pub postgres_pool: Mutex<Option<PgPool>>,
}

// SeaORM-based database connection state
pub struct SeaOrmState {
    pub sqlite: Mutex<Option<DatabaseConnection>>,
    pub postgres: Mutex<Option<DatabaseConnection>>,
}

impl SeaOrmState {
    pub fn new() -> Self {
        Self {
            sqlite: Mutex::new(None),
            postgres: Mutex::new(None),
        }
    }
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

#[tauri::command]
pub async fn sqlite_delete_row(
    db_path: String,
    table_name: String,
    primary_key_column: String,
    primary_key_value: String,
) -> Result<DatabaseResponse<String>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            let query = format!("DELETE FROM {} WHERE {} = ?1", table_name, primary_key_column);
            match conn.execute(&query, [&primary_key_value]) {
                Ok(rows_affected) => Ok(DatabaseResponse::success(format!("Deleted {} row(s)", rows_affected))),
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to delete: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn sqlite_update_row(
    db_path: String,
    table_name: String,
    primary_key_column: String,
    primary_key_value: String,
    column_name: String,
    new_value: String,
) -> Result<DatabaseResponse<String>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            let query = format!("UPDATE {} SET {} = ?1 WHERE {} = ?2", table_name, column_name, primary_key_column);
            match conn.execute(&query, [&new_value, &primary_key_value]) {
                Ok(rows_affected) => Ok(DatabaseResponse::success(format!("Updated {} row(s)", rows_affected))),
                Err(e) => Ok(DatabaseResponse::error(format!("Failed to update: {}", e))),
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn sqlite_execute_query(
    db_path: String,
    query: String,
) -> Result<DatabaseResponse<Vec<serde_json::Value>>, String> {
    let path = PathBuf::from(db_path);
    
    match connect_sqlite(path) {
        Ok(conn) => {
            // Check if it's a SELECT query
            let query_upper = query.trim().to_uppercase();
            if query_upper.starts_with("SELECT") {
                match conn.prepare(&query) {
                    Ok(mut stmt) => {
                        // Get column count
                        let column_count = stmt.column_count();
                        let column_names: Vec<String> = (0..column_count)
                            .map(|i| stmt.column_name(i).unwrap_or("unknown").to_string())
                            .collect();

                        match stmt.query_map([], |row| {
                            let mut obj = serde_json::Map::new();
                            for (idx, col_name) in column_names.iter().enumerate() {
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
                            Ok(iter) => {
                                let results: Result<Vec<_>, _> = iter.collect();
                                match results {
                                    Ok(rows) => Ok(DatabaseResponse::success(rows)),
                                    Err(e) => Ok(DatabaseResponse::error(format!("Query error: {}", e))),
                                }
                            }
                            Err(e) => Ok(DatabaseResponse::error(format!("Query mapping error: {}", e))),
                        }
                    }
                    Err(e) => Ok(DatabaseResponse::error(format!("Failed to prepare query: {}", e))),
                }
            } else {
                // For non-SELECT queries (INSERT, UPDATE, DELETE)
                match conn.execute(&query, []) {
                    Ok(rows_affected) => {
                        Ok(DatabaseResponse::success(vec![serde_json::json!({
                            "rows_affected": rows_affected,
                            "message": format!("Query executed successfully. {} row(s) affected.", rows_affected)
                        })]))
                    }
                    Err(e) => Ok(DatabaseResponse::error(format!("Execute error: {}", e))),
                }
            }
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

// === SeaORM-based Commands ===

fn get_managed_sqlite(state: &SeaOrmState) -> Option<DatabaseConnection> {
    state.sqlite.lock().ok()?.clone()
}

async fn connect_sqlite_or_managed(state: &SeaOrmState, db_path: &str) -> Result<DatabaseConnection, String> {
    if let Some(conn) = get_managed_sqlite(state) {
        return Ok(conn);
    }
    repositories::sqlite::connect(db_path).await.map_err(|e| e.to_string())
}

async fn connect_postgres_or_managed(
    state: &SeaOrmState,
    host: &str, port: u16, database: &str, user: &str, password: &str,
) -> Result<DatabaseConnection, String> {
    if let Some(conn) = state.postgres.lock().map_err(|e| e.to_string())?.clone() {
        return Ok(conn);
    }
    let conn_string = format!(
        "postgresql://{}:{}@{}:{}/{}?sslmode=require",
        user, password, host, port, database
    );
    repositories::postgres::connect(&conn_string).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn orm_connect_sqlite(
    db_path: String,
    state: State<'_, SeaOrmState>,
) -> Result<DatabaseResponse<String>, String> {
    match repositories::sqlite::connect(&db_path).await {
        Ok(conn) => {
            let mut guard = state.sqlite.lock().unwrap();
            *guard = Some(conn);
            Ok(DatabaseResponse::success("Connected to SQLite via SeaORM".to_string()))
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_list_sessions(
    state: State<'_, SeaOrmState>,
    db_path: String,
    limit: u64,
) -> Result<DatabaseResponse<Vec<crate::entities::sqlite::sessions::Model>>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;
    match repositories::session_repo::list_all(&db, limit).await {
        Ok(sessions) => Ok(DatabaseResponse::success(sessions)),
        Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_find_session(
    state: State<'_, SeaOrmState>,
    db_path: String,
    session_id: String,
) -> Result<DatabaseResponse<Option<crate::entities::sqlite::sessions::Model>>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;
    match repositories::session_repo::find_by_session_id(&db, &session_id).await {
        Ok(session) => Ok(DatabaseResponse::success(session)),
        Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_list_checkpoints(
    state: State<'_, SeaOrmState>,
    db_path: String,
    limit: u64,
) -> Result<DatabaseResponse<Vec<crate::entities::sqlite::checkpoints::Model>>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;
    match repositories::checkpoint_repo::sqlite::list_all(&db, limit).await {
        Ok(checkpoints) => Ok(DatabaseResponse::success(checkpoints)),
        Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_list_session_events(
    state: State<'_, SeaOrmState>,
    db_path: String,
    session_id: String,
    limit: u64,
) -> Result<DatabaseResponse<Vec<crate::entities::sqlite::events::Model>>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;
    match repositories::event_repo::list_by_session(&db, &session_id, limit).await {
        Ok(events) => Ok(DatabaseResponse::success(events)),
        Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
    }
}

#[derive(Debug, Serialize)]
pub struct SessionHierarchy {
    pub session: Option<crate::entities::sqlite::sessions::Model>,
    pub checkpoints: Vec<crate::entities::sqlite::checkpoints::Model>,
    pub events: Vec<crate::entities::sqlite::events::Model>,
    pub decisions: Vec<crate::entities::sqlite::decisions::Model>,
    pub insights: Vec<crate::entities::sqlite::insights::Model>,
    pub patterns: Vec<crate::entities::sqlite::patterns::Model>,
    pub files: Vec<crate::entities::sqlite::files::Model>,
    pub memories: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn orm_get_session_hierarchy(
    state: State<'_, SeaOrmState>,
    db_path: String,
    session_id: String,
) -> Result<DatabaseResponse<SessionHierarchy>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;

    let session = repositories::session_repo::find_by_session_id(&db, &session_id).await
        .map_err(|e| format!("Session query failed: {}", e))?;

    if session.is_none() {
        return Ok(DatabaseResponse::error(format!("Session not found: {}", session_id)));
    }

    use sea_orm::*;
    use crate::entities::sqlite::*;

    let cp = checkpoints::Entity::find()
        .filter(checkpoints::Column::SessionId.eq(&session_id))
        .order_by(checkpoints::Column::CreatedAt, Order::Desc)
        .all(&db).await
        .map_err(|e| format!("Checkpoints query failed: {}", e))?;

    let events = repositories::event_repo::list_by_session(&db, &session_id, 100).await
        .map_err(|e| format!("Events query failed: {}", e))?;

    let dec = decisions::Entity::find()
        .filter(decisions::Column::SessionId.eq(&session_id))
        .order_by(decisions::Column::MadeAt, Order::Desc)
        .all(&db).await
        .map_err(|e| format!("Decisions query failed: {}", e))?;

    let ins = insights::Entity::find()
        .filter(insights::Column::SessionId.eq(&session_id))
        .order_by(insights::Column::GeneratedAt, Order::Desc)
        .all(&db).await
        .map_err(|e| format!("Insights query failed: {}", e))?;

    let pat = patterns::Entity::find()
        .filter(patterns::Column::SessionId.eq(&session_id))
        .order_by(patterns::Column::LastSeen, Order::Desc)
        .all(&db).await
        .map_err(|e| format!("Patterns query failed: {}", e))?;

    let fil = files::Entity::find()
        .filter(files::Column::SessionId.eq(&session_id))
        .order_by(files::Column::CreatedAt, Order::Desc)
        .all(&db).await
        .map_err(|e| format!("Files query failed: {}", e))?;

    Ok(DatabaseResponse::success(SessionHierarchy {
        session,
        checkpoints: cp,
        events,
        decisions: dec,
        insights: ins,
        patterns: pat,
        files: fil,
        memories: vec![],
    }))
}

#[tauri::command]
pub async fn orm_update_session_status(
    state: State<'_, SeaOrmState>,
    db_path: String,
    session_id: String,
    new_status: String,
) -> Result<DatabaseResponse<bool>, String> {
    let db = connect_sqlite_or_managed(&state, &db_path).await?;
    match repositories::session_repo::update_status(&db, &session_id, &new_status).await {
        Ok(updated) => Ok(DatabaseResponse::success(updated)),
        Err(e) => Ok(DatabaseResponse::error(format!("Update failed: {}", e))),
    }
}

// === SeaORM-based PostgreSQL Commands ===

#[tauri::command]
pub async fn orm_connect_postgres(
    host: String,
    port: u16,
    database: String,
    user: String,
    password: String,
    state: State<'_, SeaOrmState>,
) -> Result<DatabaseResponse<String>, String> {
    let conn_string = format!(
        "postgresql://{}:{}@{}:{}/{}?sslmode=require",
        user, password, host, port, database
    );
    match repositories::postgres::connect(&conn_string).await {
        Ok(conn) => {
            let mut guard = state.postgres.lock().unwrap();
            *guard = Some(conn);
            Ok(DatabaseResponse::success("Connected to PostgreSQL via SeaORM".to_string()))
        }
        Err(e) => Ok(DatabaseResponse::error(format!("Failed to connect: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_list_documents(
    state: State<'_, SeaOrmState>,
    host: String,
    port: u16,
    database: String,
    user: String,
    password: String,
    limit: u64,
) -> Result<DatabaseResponse<Vec<crate::entities::postgres::documents::Model>>, String> {
    let db = connect_postgres_or_managed(&state, &host, port, &database, &user, &password).await?;
    match repositories::document_repo::list_all(&db, limit).await {
        Ok(docs) => Ok(DatabaseResponse::success(docs)),
        Err(e) => Ok(DatabaseResponse::error(format!("Query failed: {}", e))),
    }
}

#[tauri::command]
pub async fn orm_search_documents(
    state: State<'_, SeaOrmState>,
    host: String,
    port: u16,
    database: String,
    user: String,
    password: String,
    query: String,
    limit: u64,
) -> Result<DatabaseResponse<Vec<crate::entities::postgres::documents::Model>>, String> {
    let db = connect_postgres_or_managed(&state, &host, port, &database, &user, &password).await?;
    match repositories::document_repo::search(&db, &query, limit).await {
        Ok(docs) => Ok(DatabaseResponse::success(docs)),
        Err(e) => Ok(DatabaseResponse::error(format!("Search failed: {}", e))),
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
