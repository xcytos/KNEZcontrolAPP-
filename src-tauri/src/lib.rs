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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                app.handle().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                    let _ = app.get_webview_window("main").expect("no main window").set_focus();
                }))?;
            }
            app.handle().plugin(tauri_plugin_shell::init())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_ui_preferences,
            set_ui_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
