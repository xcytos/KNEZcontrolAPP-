use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::{self, Write, Read};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tauri::{AppHandle, Emitter};
use portable_pty::{CommandBuilder, native_pty_system, PtySize, MasterPty};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYConfig {
    pub cols: u16,
    pub rows: u16,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
}

pub struct PTYProcess {
    pub id: String,
    pub master: Option<Box<dyn MasterPty + Send>>,
    pub writer: Option<Box<dyn Write + Send>>,
    pub config: PTYConfig,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutputEvent {
    pub pty_id: String,
    pub data: String,
}

impl PTYProcess {
    pub fn new(id: String, config: PTYConfig) -> Self {
        Self {
            id,
            master: None,
            writer: None,
            config,
            is_active: false,
        }
    }

    pub fn spawn(&mut self) -> io::Result<()> {
        let pty_system = native_pty_system();
        
        let size = PtySize {
            rows: self.config.rows,
            cols: self.config.cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system.openpty(size)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let shell = self.config.shell.clone().unwrap_or_else(|| {
            if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else if cfg!(target_os = "macos") {
                "/bin/zsh".to_string()
            } else {
                "/bin/bash".to_string()
            }
        });

        let mut cmd = CommandBuilder::new(&shell);
        
        if let Some(ref cwd) = self.config.cwd {
            cmd.cwd(cwd);
        }

        if let Some(ref env_vars) = self.config.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        if let Some(ref args) = self.config.args {
            cmd.args(args);
        }

        pair.slave.spawn_command(cmd)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        self.writer = Some(pair.master.take_writer().map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?);
        self.master = Some(pair.master);
        self.is_active = true;

        println!("[SHELL_SPAWNED] Process {} spawned at {:?}", self.id, std::time::Instant::now());
        Ok(())
    }

    pub fn write(&mut self, data: &str) -> io::Result<()> {
        if let Some(ref mut writer) = self.writer {
            writer.write_all(data.as_bytes())?;
            writer.flush()?;
        }
        Ok(())
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.config.cols = cols;
        self.config.rows = rows;

        if let Some(ref master) = self.master {
            master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        }

        Ok(())
    }

    pub fn kill(&mut self, _signal: Option<i32>) -> io::Result<()> {
        // Drop the master and writer which sends EOF and closes the PTY
        self.writer.take();
        self.master.take();
        self.is_active = false;
        Ok(())
    }

    pub fn start_stdout_reader(&mut self, app_handle: AppHandle) -> io::Result<()> {
        if let Some(ref master) = self.master {
            let mut reader = master.try_clone_reader().map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
            let pty_id = self.id.clone();
            let app_handle = app_handle.clone();

            tokio::task::spawn_blocking(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                            let event = PtyOutputEvent {
                                pty_id: pty_id.clone(),
                                data,
                            };
                            if let Err(e) = app_handle.emit("pty-output", &event) {
                                eprintln!("[PTY_ERROR] Failed to emit output event: {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("[PTY_ERROR] Failed to read stdout chunk: {}", e);
                            break;
                        }
                    }
                }
                println!("[PTY_EXIT] Reader thread exiting for {}", pty_id);
            });
        }
        Ok(())
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
                let _ = process.start_stdout_reader(app_handle);
                
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

