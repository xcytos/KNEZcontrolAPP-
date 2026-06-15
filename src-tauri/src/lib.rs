use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use std::sync::Mutex;

mod mcp_host;
mod pty;
mod database;
mod data_commands;

use data_commands::DatabaseState;

#[tauri::command]
fn test_tauri_connection() -> String {
    "TAURI_OK".to_string()
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct UiPreferences {
    theme: Option<String>,
    layout_density: Option<String>,
}

fn prefs_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("ui_prefs.json"))
}

#[tauri::command]
fn get_ui_preferences(app: tauri::AppHandle) -> UiPreferences {
    if let Some(path) = prefs_path(&app) {
        if let Ok(data) = fs::read_to_string(path) {
            if let Ok(prefs) = serde_json::from_str::<UiPreferences>(&data) {
                return prefs;
            }
        }
    }
    UiPreferences::default()
}

#[tauri::command]
fn set_ui_preferences(app: tauri::AppHandle, prefs: UiPreferences) -> Result<(), String> {
    let Some(path) = prefs_path(&app) else {
        return Err("missing app data directory".into());
    };
    let parent = path.parent().ok_or("invalid prefs path")?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content =
        serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_test_window(app: tauri::AppHandle) -> Result<String, String> {
    let label = format!("test-{}", uuid::Uuid::new_v4());
    let use_dev_url = std::env::var("TAURI_E2E")
        .ok()
        .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false)
        || cfg!(debug_assertions);
    let url = if use_dev_url {
        tauri::WebviewUrl::External(
            tauri::Url::parse(&format!("http://127.0.0.1:5173/?label={}", label))
                .map_err(|e| e.to_string())?,
        )
    } else {
        tauri::WebviewUrl::App(format!("index.html?label={}", label).into())
    };
    tauri::WebviewWindowBuilder::new(
        &app,
        label.clone(),
        url,
    )
    .title("knez-control-app (Test)")
    .inner_size(1280.0, 800.0)
    .min_inner_size(1024.0, 640.0)
    .resizable(true)
    .decorations(true)
    .visible(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(label)
}

#[tauri::command]
fn close_window(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    if let Some(w) = app.get_webview_window(&label) {
        w.close().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn close_all_test_windows(app: tauri::AppHandle) -> Result<u32, String> {
    let mut closed = 0u32;
    for (label, w) in app.webview_windows() {
        if label.starts_with("test-") || label.starts_with("e2e-") {
            let _ = w.close();
            closed += 1;
        }
    }
    Ok(closed)
}

#[tauri::command]
fn close_main_window(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(w) = app.get_webview_window("main") {
        w.close().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn ui_action(
    window: tauri::WebviewWindow,
    action: String,
    selector: Option<String>,
    value: Option<String>,
    script: Option<String>,
) -> Result<String, String> {
    let sel = selector.as_deref().unwrap_or("").replace('\'', "\\'");
    let val = value.as_deref().unwrap_or("").replace('\'', "\\'").replace('\n', "\\n");
    let js = match action.as_str() {
        "click" => format!(
            "(function(){{var el=document.querySelector('{}');if(!el)return 'not_found';el.click();return 'ok';}})()",
            sel
        ),
        "fill" => format!(
            "(function(){{var el=document.querySelector('{}');if(!el)return 'not_found';el.value='{}';el.dispatchEvent(new Event('input',{{bubbles:true}}));el.dispatchEvent(new Event('change',{{bubbles:true}}));return 'ok';}})()",
            sel, val
        ),
        "hover" => format!(
            "(function(){{var el=document.querySelector('{}');if(!el)return 'not_found';el.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true}}));el.dispatchEvent(new MouseEvent('mouseenter',{{bubbles:true}}));return 'ok';}})()",
            sel
        ),
        "select" => format!(
            "(function(){{var el=document.querySelector('{}');if(!el)return 'not_found';el.value='{}';el.dispatchEvent(new Event('change',{{bubbles:true}}));return 'ok';}})()",
            sel, val
        ),
        "focus" => format!(
            "(function(){{var el=document.querySelector('{}');if(!el)return 'not_found';el.focus();return 'ok';}})()",
            sel
        ),
        "evaluate" => script.unwrap_or_default(),
        _ => return Err(format!("unknown_action:{}", action)),
    };
    window.eval(&js).map_err(|e| e.to_string())?;
    Ok("ok".to_string())
}

#[tauri::command]
fn mcp_status(state: tauri::State<mcp_host::McpHostRuntime>) -> mcp_host::McpRuntimeStatus {
    state.status()
}

#[tauri::command]
fn mcp_start(state: tauri::State<mcp_host::McpHostRuntime>, cfg: mcp_host::McpStdioServerConfig) -> Result<mcp_host::McpRuntimeStatus, String> {
    state.start(cfg)
}

#[tauri::command]
fn mcp_stop(state: tauri::State<mcp_host::McpHostRuntime>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn mcp_list_tools(state: tauri::State<mcp_host::McpHostRuntime>) -> Result<Vec<serde_json::Value>, String> {
    state.list_tools()
}

#[tauri::command]
fn mcp_get_traffic(state: tauri::State<mcp_host::McpHostRuntime>) -> Vec<mcp_host::McpTrafficEvent> {
    state.get_traffic()
}

#[tauri::command]
async fn mcp_request(
    state: tauri::State<'_, mcp_host::McpHostRuntime>,
    method: String,
    params: Option<serde_json::Value>,
    timeout_ms: Option<u64>,
) -> Result<serde_json::Value, String> {
    let rt = state.inner().clone();
    let timeout = timeout_ms.unwrap_or(30000);
    tauri::async_runtime::spawn_blocking(move || rt.request(method, params, timeout))
        .await
        .map_err(|e| e.to_string())?
}

// Extraction Pipeline Integration Commands
#[derive(Debug, Serialize, Deserialize)]
struct ExtractionSession {
    session_id: String,
    name: String,
    status: String,
    created_at: String,
    event_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct PipelineStatus {
    extractor_running: bool,
    mcp_server_running: bool,
    api_server_port: u16,
    last_pipeline_run: Option<String>,
    total_sessions: u32,
}

#[tauri::command]
async fn extractor_get_sessions() -> Result<Vec<ExtractionSession>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://127.0.0.1:8000/sessions")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to extractor API: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let sessions = data["sessions"]
        .as_array()
        .ok_or("Invalid sessions format")?
        .iter()
        .map(|s| ExtractionSession {
            session_id: s["session_id"].as_str().unwrap_or("unknown").to_string(),
            name: s["summary"].as_str().unwrap_or("No summary").to_string(),
            status: "completed".to_string(),
            created_at: s["start_time"].as_str().unwrap_or("").to_string(),
            event_count: s["event_count"].as_u64().unwrap_or(0) as u32,
        })
        .collect();
    
    Ok(sessions)
}

#[tauri::command]
async fn extractor_get_session_details(session_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://127.0.0.1:8000/sessions/{}", session_id))
        .send()
        .await
        .map_err(|e| format!("Failed to get session details: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse session details: {}", e))?;
    
    Ok(data)
}

#[tauri::command]
async fn extractor_search_vector(query: String, top_k: Option<u32>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:8000/search/vector")
        .json(&serde_json::json!({
            "query": query,
            "top_k": top_k.unwrap_or(5)
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to search vectors: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse search results: {}", e))?;
    
    Ok(data)
}

#[tauri::command]
async fn extractor_get_graph(session_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://127.0.0.1:8000/graph/{}", session_id))
        .send()
        .await
        .map_err(|e| format!("Failed to get graph data: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse graph data: {}", e))?;
    
    Ok(data)
}

#[tauri::command]
async fn extractor_hybrid_query(query: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:8000/query")
        .json(&serde_json::json!({
            "query": query
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to execute hybrid query: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse hybrid query results: {}", e))?;
    
    Ok(data)
}

#[tauri::command]
async fn extractor_scan_projects() -> Result<Vec<TaqwinProject>, String> {
    let mut projects = Vec::new();
    
    // Check specific known .taqwin directories
    let known_projects = vec![
        ("C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\knez-control-app", "knez-control-app"),
        ("C:\\Users\\syedm\\Downloads\\ASSETS\\ENFLENZ", "ENFLENZ"),
    ];
    
    for (project_path, project_name) in known_projects {
        let taqwin_path = format!("{}\\.taqwin", project_path);
        
        if std::path::Path::new(&taqwin_path).exists() {
            // Count sessions in this .taqwin directory
            let taqwin_path_obj = std::path::Path::new(&taqwin_path);
            let session_count = count_sessions_in_taqwin(&taqwin_path_obj).unwrap_or(0);
            
            // Get last modified time
            let last_modified = std::fs::metadata(&taqwin_path)
                .and_then(|m| m.modified())
                .map(|t| format!("{:?}", t))
                .unwrap_or_else(|_| "Unknown".to_string());
            
            projects.push(TaqwinProject {
                path: project_path.to_string(),
                name: project_name.to_string(),
                session_count,
                last_modified,
            });
        }
    }
    
    Ok(projects)
}
fn count_sessions_in_taqwin(taqwin_path: &std::path::Path) -> Result<u32, std::io::Error> {
    let mut session_count = 0u32;
    
    // Check logs directory
    let logs_path = taqwin_path.join("logs");
    if logs_path.exists() {
        if let Ok(entries) = std::fs::read_dir(&logs_path) {
            for entry in entries.flatten() {
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();
                if file_name_str.ends_with(".log") {
                    session_count += 1;
                }
            }
        }
    }   // Check memory/sessions directory
    let memory_sessions_path = taqwin_path.join("memory").join("sessions");
    if memory_sessions_path.exists() {
        if let Ok(entries) = std::fs::read_dir(&memory_sessions_path) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        session_count += 1;
                    }
                }
            }
        }
    }
    
    Ok(session_count)
}

#[derive(Debug, Serialize, Deserialize)]
struct TaqwinProject {
    path: String,
    name: String,
    session_count: u32,
    last_modified: String,
}

#[tauri::command]
async fn extractor_set_taqwin_path(path: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:8000/set_taqwin_path")
        .json(&serde_json::json!({
            "path": path
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to set TAQWIN path: {}", e))?;
    
    if response.status().is_success() {
        Ok(true)
    } else {
        Err(format!("Failed to set TAQWIN path: {}", response.status()))
    }
}

#[tauri::command]
async fn extractor_pipeline_status() -> Result<PipelineStatus, String> {
    // Check extractor API
    let extractor_running = match reqwest::get("http://127.0.0.1:8000/sessions").await {
        Ok(_) => true,
        Err(_) => false,
    };
    
    // Check MCP server
    let mcp_server_running = match std::path::Path::new("../../../TAQWIN_V1/TAQWIN-MCP-SERVER/src/server.py").exists() {
        true => true,
        false => false,
    };
    
    Ok(PipelineStatus {
        extractor_running,
        mcp_server_running,
        api_server_port: 8000,
        last_pipeline_run: None,
        total_sessions: if extractor_running { 
            extractor_get_sessions().await.ok().map(|s| s.len() as u32).unwrap_or(0)
        } else { 
            0 
        },
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init());
    
    #[cfg(feature = "e2e-testing")]
    {
        builder = builder.plugin(tauri_plugin_playwright::init());
    }
    
    builder
        .setup(|app| {
            let automation = std::env::var("TAURI_E2E")
                .ok()
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false);

            #[cfg(desktop)]
            {
                use tauri::Manager;
                if !automation {
                    app.handle().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                        let _ = app
                            .get_webview_window("main")
                            .expect("no main window")
                            .set_focus();
                    }))?;
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_fullscreen(false);
                let _ = window.unmaximize();
                let _ = window.center();
                let _ = window.set_skip_taskbar(false);
                let _ = window.show();
            }

            app.manage(mcp_host::McpHostRuntime::new(app.handle().clone()));
            app.manage(DatabaseState {
                postgres_pool: Mutex::new(None),
            });
            app.handle().plugin(tauri_plugin_fs::init())?;
            app.handle().plugin(tauri_plugin_http::init())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_ui_preferences,
            set_ui_preferences,
            open_test_window,
            close_window,
            close_all_test_windows,
            close_main_window,
            ui_action,
            mcp_status,
            mcp_start,
            mcp_stop,
            mcp_list_tools,
            mcp_get_traffic,
            mcp_request,
            extractor_scan_projects,
            extractor_set_taqwin_path,
            extractor_get_sessions,
            extractor_get_session_details,
            extractor_search_vector,
            extractor_get_graph,
            extractor_hybrid_query,
            extractor_pipeline_status,
            test_tauri_connection,
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_destroy,
            data_commands::connect_to_postgres,
            data_commands::list_pg_documents,
            data_commands::get_pg_document,
            data_commands::search_pg_documents,
            data_commands::list_pg_checkpoints,
            data_commands::sqlite_list_tables,
            data_commands::sqlite_get_table_info,
            data_commands::sqlite_query_table,
            data_commands::sqlite_get_row_count,
            data_commands::sqlite_delete_row,
            data_commands::sqlite_update_row,
            data_commands::sqlite_execute_query,
            data_commands::list_sqlite_sessions,
            data_commands::list_sqlite_memories,
            data_commands::list_sqlite_checkpoints,
            data_commands::sqlite_get_session_hierarchy,
            data_commands::get_git_stats,
            data_commands::git_push
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
