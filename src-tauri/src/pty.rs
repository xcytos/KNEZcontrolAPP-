use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::io::{self, Write};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYConfig {
    pub cols: u16,
    pub rows: u16,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub shell: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYResize {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYCommand {
    pub pty_id: String,
    pub command: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PTYMessage {
    pub pty_id: String,
    pub r#type: String,
    pub data: Option<String>,
    pub stream: Option<String>,
    pub exit_code: Option<i32>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Debug)]
pub struct PTYProcess {
    pub id: String,
    pub child: Option<std::process::Child>,
    pub config: PTYConfig,
    pub created_at: Instant,
    pub is_active: bool,
}

impl PTYProcess {
    pub fn new(id: String, config: PTYConfig) -> Self {
        Self {
            id,
            child: None,
            config,
            created_at: Instant::now(),
            is_active: false,
        }
    }

    #[cfg(target_os = "windows")]
    pub fn spawn(&mut self) -> io::Result<()> {
        use windows_sys::Win32::System::Console::{
            CreatePseudoConsole, GetStdHandle, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE,
            CONSOLE_MODE, ENABLE_VIRTUAL_TERMINAL_PROCESSING,
        };

        let shell = self.config.shell.clone()
            .unwrap_or_else(|| "cmd.exe".to_string());

        let mut cmd = Command::new(&shell);
        
        if let Some(ref cwd) = self.config.cwd {
            cmd.current_dir(cwd);
        }

        if let Some(ref env_vars) = self.config.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        // Set up ConPTY for Windows
        let hpc = std::ptr::null_mut();
        let coord = windows_sys::Win32::System::Console::COORD {
            X: self.config.cols as i16,
            Y: self.config.rows as i16,
        };
        let hr = unsafe { CreatePseudoConsole(
            coord,
            0,
            0,
            0,
            hpc,
        ) };

        if hr != 0 {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("Failed to create ConPTY: HRESULT 0x{:08X}", hr),
            ));
        }

        // Configure console for virtual terminal processing
        let h_stdout = unsafe { GetStdHandle(STD_OUTPUT_HANDLE) };
        let _h_stderr = unsafe { GetStdHandle(STD_ERROR_HANDLE) };
        
        let mut mode: CONSOLE_MODE = 0;
        unsafe {
            windows_sys::Win32::System::Console::GetConsoleMode(h_stdout, &mut mode);
            windows_sys::Win32::System::Console::SetConsoleMode(
                h_stdout,
                mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING,
            );
        }

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

    pub fn wait(&mut self) -> io::Result<std::process::ExitStatus> {
        if let Some(ref mut child) = self.child {
            child.wait()
        } else {
            Err(io::Error::new(
                io::ErrorKind::Other,
                "No child process to wait for",
            ))
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

    pub async fn create_pty(&self, config: PTYConfig) -> Result<String, String> {
        let pty_id = Uuid::new_v4().to_string();
        let mut process = PTYProcess::new(pty_id.clone(), config);

        match process.spawn() {
            Ok(()) => {
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

impl Default for PTYMessage {
    fn default() -> Self {
        Self {
            pty_id: String::new(),
            r#type: String::new(),
            data: None,
            stream: None,
            exit_code: None,
            cols: None,
            rows: None,
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn pty_spawn_command(
    pty_id: String,
    command: String,
    _args: Vec<String>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>
) -> Result<serde_json::Value, String> {
    println!("[RUST_COMMAND_ENTERED] pty_spawn_command: {} with command: {}", pty_id, command);
    
    let config = PTYConfig {
        cols,
        rows,
        cwd,
        env,
        shell: Some(command),
    };
    
    let service = PTYService::new();
    match service.create_pty(config).await {
        Ok(created_pty_id) => {
            println!("[PTY_CREATED] PTY created with ID: {}", created_pty_id);
            
            // Get process ID from the spawned process
            let processes = service.processes.lock().unwrap();
            if let Some(process) = processes.get(&created_pty_id) {
                if let Some(ref child) = process.child {
                    let pid = child.id();
                    println!("[SHELL_SPAWNED] Process spawned with PID: {:?}", pid);
                    println!("[PID_ASSIGNED] PID: {}", pid);
                    
                    return Ok(serde_json::json!({
                        "processId": pid,
                        "ptyId": created_pty_id
                    }));
                }
            }
            
            Ok(serde_json::json!({
                "processId": 0,
                "ptyId": created_pty_id
            }))
        }
        Err(e) => {
            println!("[PTY_ERROR] Failed to create PTY: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn pty_create(config: PTYConfig) -> Result<String, String> {
    let service = PTYService::new();
    service.create_pty(config).await
}

#[tauri::command]
pub async fn pty_write(pty_id: String, data: String) -> Result<(), String> {
    let service = PTYService::new();
    service.write_to_pty(&pty_id, &data).await
}

#[tauri::command]
pub async fn pty_resize(pty_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let service = PTYService::new();
    service.resize_pty(&pty_id, cols, rows).await
}

#[tauri::command]
pub async fn pty_kill(pty_id: String, signal: Option<i32>) -> Result<(), String> {
    let service = PTYService::new();
    service.kill_pty(&pty_id, signal).await
}

#[tauri::command]
pub async fn pty_destroy(pty_id: String) -> Result<(), String> {
    let service = PTYService::new();
    service.kill_pty(&pty_id, Some(9)).await // SIGKILL
}
