use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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

            app.handle().plugin(tauri_plugin_shell::init())?;
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
            close_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
