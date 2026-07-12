use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct FsEntry {
    pub is_dir: bool,
    pub size: u64,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct DatabaseResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> DatabaseResponse<T> {
    pub fn success(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    pub fn error(message: String) -> Self {
        Self { success: false, data: None, error: Some(message) }
    }
}

const MAX_WALK_FILES: usize = 5000;

fn walk_dir_recursive(dir: &Path, base: &Path, entries: &mut Vec<FsEntry>, depth: u32) -> Result<(), String> {
    if depth > 10 {
        return Ok(());
    }
    if entries.len() >= MAX_WALK_FILES {
        return Ok(());
    }
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();
        if name_str.starts_with('.') || name_str == "node_modules" || name_str == "target" {
            continue;
        }
        let full_path = entry.path();
        let relative = full_path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name_str.to_string());
        let file_type = entry.file_type().map_err(|e| format!("Failed to get file type: {}", e))?;
        if file_type.is_dir() {
            entries.push(FsEntry { is_dir: true, size: 0, path: relative });
            walk_dir_recursive(&full_path, base, entries, depth + 1)?;
        } else {
            let metadata = entry.metadata().map_err(|e| format!("Failed to get metadata: {}", e))?;
            entries.push(FsEntry {
                is_dir: false,
                size: metadata.len(),
                path: relative,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn fs_walk(root_path: String) -> Result<DatabaseResponse<Vec<FsEntry>>, String> {
    let root = Path::new(&root_path);
    if !root.exists() {
        return Ok(DatabaseResponse::error(format!("Path does not exist: {}", root_path)));
    }
    if !root.is_dir() {
        return Ok(DatabaseResponse::error(format!("Path is not a directory: {}", root_path)));
    }
    let mut entries = Vec::new();
    walk_dir_recursive(root, root, &mut entries, 0)?;
    Ok(DatabaseResponse::success(entries))
}

#[tauri::command]
pub fn git_is_repo(repo_path: String) -> Result<DatabaseResponse<bool>, String> {
    let path = Path::new(&repo_path);
    if !path.exists() || !path.is_dir() {
        return Ok(DatabaseResponse::success(false));
    }
    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--git-dir")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;
    let is_repo = output.status.success();
    Ok(DatabaseResponse::success(is_repo))
}

#[derive(Debug, Serialize)]
pub struct GitTreeEntry {
    pub mode: String,
    pub r#type: String,
    pub sha: String,
    pub size: i64,
    pub path: String,
}

#[tauri::command]
pub fn git_ls_tree(repo_path: String) -> Result<DatabaseResponse<Vec<GitTreeEntry>>, String> {
    let output = Command::new("git")
        .arg("ls-tree")
        .arg("-r")
        .arg("HEAD")
        .arg("--long")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git ls-tree: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(DatabaseResponse::error(format!("git ls-tree failed: {}", stderr)));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries: Vec<GitTreeEntry> = stdout.lines().filter_map(|line| {
        let line = line.trim();
        if line.is_empty() { return None; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 { return None; }
        let mode = parts[0].to_string();
        let obj_type = parts[1].to_string();
        let sha = parts[2].to_string();
        let size = parts[3].parse::<i64>().unwrap_or(0);
        let path = parts[4..].join(" ");
        Some(GitTreeEntry { mode, r#type: obj_type, sha, size, path })
    }).collect();
    Ok(DatabaseResponse::success(entries))
}

#[derive(Debug, Serialize)]
pub struct GitStatusEntry {
    pub status: String,
    pub path: String,
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<DatabaseResponse<Vec<GitStatusEntry>>, String> {
    let output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git status: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(DatabaseResponse::error(format!("git status failed: {}", stderr)));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries: Vec<GitStatusEntry> = stdout.lines().filter_map(|line| {
        let line = line.trim();
        if line.is_empty() { return None; }
        if line.len() < 4 { return None; }
        let status = line[..2].trim().to_string();
        let path = line[3..].trim().to_string();
        Some(GitStatusEntry { status, path })
    }).collect();
    Ok(DatabaseResponse::success(entries))
}

#[derive(Debug, Serialize)]
pub struct GitFileLogEntry {
    pub hash: String,
    pub date: String,
    pub message: String,
}

#[tauri::command]
pub fn git_file_log(repo_path: String, file_path: String) -> Result<DatabaseResponse<Vec<GitFileLogEntry>>, String> {
    let output = Command::new("git")
        .arg("log")
        .arg("--oneline")
        .arg("--follow")
        .arg("--format=%H|%ai|%s")
        .arg(&file_path)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(DatabaseResponse::error(format!("git log failed: {}", stderr)));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries: Vec<GitFileLogEntry> = stdout.lines().filter_map(|line| {
        let line = line.trim();
        if line.is_empty() { return None; }
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() < 3 { return None; }
        Some(GitFileLogEntry {
            hash: parts[0].to_string(),
            date: parts[1].to_string(),
            message: parts[2].to_string(),
        })
    }).collect();
    Ok(DatabaseResponse::success(entries))
}
