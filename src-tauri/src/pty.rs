use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::io::{self, Write, BufReader, BufRead};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYConfig {
    pub cols: u16,
    pub rows: u16,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub shell: Option<String>,
}

#[derive(Debug)]
pub struct PTYProcess {
    pub id: String,
    pub child: Option<std::process::Child>,
    pub config: PTYConfig,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutputEvent {
    pub ptyId: String,
    pub data: String,
}

impl PTYProcess {
    pub fn new(id: String, config: PTYConfig) -> Self {
        Self {
            id,
            child: None,
            config,
            is_active: false,
        }
    }

    #[cfg(target_os = "windows")]
    pub fn spawn(&mut self) -> io::Result<()> {
        let shell = self.config.shell.clone()
            .unwrap_or_else(|| "powershell.exe".to_string());

        let mut cmd = Command::new(&shell);
        
        if let Some(ref cwd) = self.config.cwd {
            cmd.current_dir(cwd);
        }

        if let Some(ref env_vars) = self.config.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        // Configure for terminal I/O
        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(child) => {
                self.child = Some(child);
                self.is_active = true;
                println!("[SHELL_SPAWNED] Process {} spawned at {:?}", self.id, std::time::Instant::now());
                Ok(())
            }
            Err(e) => {
                self.is_active = false;
                println!("[SHELL_SPAWN_FAILED] Failed to spawn process {}: {:?}", self.id, e);
                Err(e)
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn spawn(&mut self) -> io::Result<()> {
        let shell = self.config.shell.clone()
            .unwrap_or_else(|| {
                if cfg!(target_os = "macos") {
                    "/bin/zsh".to_string()
                } else {
                    "/bin/bash".to_string()
                }
            });

        let mut cmd = Command::new(&shell);
        
        if let Some(ref cwd) = self.config.cwd {
            cmd.current_dir(cwd);
        }

        if let Some(ref env_vars) = self.config.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(child) => {
                self.child = Some(child);
                self.is_active = true;
                Ok(())
            }
            Err(e) => {
                self.is_active = false;
                Err(e)
            }
        }
    }

    pub fn write(&mut self, data: &str) -> io::Result<()> {
        if let Some(ref mut child) = self.child {
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(data.as_bytes())?;
                stdin.flush()?;
            }
        }
        Ok(())
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.config.cols = cols;
        self.config.rows = rows;

        #[cfg(target_os = "windows")]
        {
            // Windows ConPTY resize would be implemented here
            // For now, just update the stored dimensions
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Unix PTY resize using SIGWINCH
            if let Some(ref child) = self.child {
                // Send resize signal to child process
                // Implementation depends on PTY library used
            }
        }

        Ok(())
    }

    pub fn kill(&mut self, signal: Option<i32>) -> io::Result<()> {
        if let Some(ref mut child) = self.child {
            #[cfg(target_os = "windows")]
            {
                if let Some(_sig) = signal {
                    // Windows-specific signal handling
                    child.kill()?;
                } else {
                    child.kill()?;
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                use nix::sys::signal::{self, Signal};
                use nix::unistd::Pid;
                
                if let Some(ref child) = self.child {
                    if let Some(pid) = child.id() {
                        let sig = if let Some(sig_num) = signal {
                            match sig_num {
                                2 => Signal::SIGINT,
                                9 => Signal::SIGKILL,
                                15 => Signal::SIGTERM,
                                _ => Signal::SIGTERM,
                            }
                        } else {
                            Signal::SIGTERM
                        };
                        
                        signal::kill(Pid::from_raw(pid as pid_t), sig)?;
                    }
                }
            }
        }
        self.is_active = false;
        Ok(())
    }

    pub fn start_stdout_reader(&mut self, app_handle: AppHandle) {
        if let Some(ref mut child) = self.child {
            if let Some(stdout) = child.stdout.take() {
                let pty_id = self.id.clone();
                let app_handle = app_handle.clone();
                
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stdout);
                    let mut buffer = String::new();
                    
                    loop {
                        match reader.read_line(&mut buffer) {
                            Ok(0) => break, // EOF
                            Ok(_) => {
                                let data = buffer.clone();
                                buffer.clear();
                                
                                // Emit PTY output event
                                let event = PtyOutputEvent {
                                    ptyId: pty_id.clone(),
                                    data,
                                };
                                
                                if let Err(e) = app_handle.emit("pty-output", &event) {
                                    eprintln!("[PTY_ERROR] Failed to emit output event: {}", e);
                                    break;
                                }
                            }
                            Err(e) => {
                                eprintln!("[PTY_ERROR] Failed to read stdout: {}", e);
                                break;
                            }
                        }
                    }
                });
            }
        }
    }
}

pub struct PTYService {
    processes: Arc<Mutex<HashMap<String, PTYProcess>>>,
}

impl PTYService {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    // Get or create the global PTYService instance
    pub fn global() -> &'static Self {
        use std::sync::OnceLock;
        static INSTANCE: OnceLock<PTYService> = OnceLock::new();
        INSTANCE.get_or_init(|| PTYService::new())
    }

    pub async fn create_pty(&self, config: PTYConfig, app_handle: AppHandle) -> Result<String, String> {
        let pty_id = Uuid::new_v4().to_string();
        let mut process = PTYProcess::new(pty_id.clone(), config);

        match process.spawn() {
            Ok(()) => {
                // Start stdout reader task
                process.start_stdout_reader(app_handle);
                
                let mut processes = self.processes.lock().unwrap();
                processes.insert(pty_id.clone(), process);
                Ok(pty_id)
            }
            Err(e) => Err(format!("Failed to spawn PTY: {}", e)),
        }
    }

    pub async fn write_to_pty(&self, pty_id: &str, data: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        if let Some(process) = processes.get_mut(pty_id) {
            process.write(data).map_err(|e| format!("Write failed: {}", e))
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    pub async fn resize_pty(&self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        if let Some(process) = processes.get_mut(pty_id) {
            process.resize(cols, rows).map_err(|e| format!("Resize failed: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    pub async fn kill_pty(&self, pty_id: &str, signal: Option<i32>) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        if let Some(mut process) = processes.remove(pty_id) {
            process.kill(signal).map_err(|e| format!("Kill failed: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn pty_create(config: PTYConfig, app_handle: AppHandle) -> Result<String, String> {
    let service = PTYService::global();
    service.create_pty(config, app_handle).await
}

#[tauri::command]
pub async fn pty_write(pty_id: String, data: String) -> Result<(), String> {
    let service = PTYService::global();
    service.write_to_pty(&pty_id, &data).await
}

#[tauri::command]
pub async fn pty_resize(pty_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let service = PTYService::global();
    service.resize_pty(&pty_id, cols, rows).await
}

#[tauri::command]
pub async fn pty_kill(pty_id: String, signal: Option<i32>) -> Result<(), String> {
    let service = PTYService::global();
    service.kill_pty(&pty_id, signal).await
}

#[tauri::command]
pub async fn pty_destroy(pty_id: String) -> Result<(), String> {
    let service = PTYService::global();
    service.kill_pty(&pty_id, Some(9)).await // SIGKILL
}

