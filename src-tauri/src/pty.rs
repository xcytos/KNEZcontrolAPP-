use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::io::{self, Write, BufRead, BufReader};
use std::thread;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};
use futures::{SinkExt, StreamExt};
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
        use std::os::windows::process::CommandExt;
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
        let mut hpc = std::ptr::null_mut();
        let mut hr = unsafe { CreatePseudoConsole(
            self.config.cols.into(),
            self.config.rows.into(),
            &mut hpc as *mut _,
        ) };

        if hr != 0 {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("Failed to create ConPTY: HRESULT 0x{:08X}", hr),
            ));
        }

        // Configure console for virtual terminal processing
        let h_stdout = unsafe { GetStdHandle(STD_OUTPUT_HANDLE) };
        let h_stderr = unsafe { GetStdHandle(STD_ERROR_HANDLE) };
        
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
                Ok(())
            }
            Err(e) => {
                self.is_active = false;
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
                use std::os::windows::process::CommandExt;
                if let Some(sig) = signal {
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
    websocket_clients: Arc<Mutex<HashMap<String, WebSocketStream<TcpStream>>>>,
}

impl PTYService {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
            websocket_clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn create_pty(&self, config: PTYConfig) -> Result<String, String> {
        let pty_id = Uuid::new_v4().to_string();
        let mut process = PTYProcess::new(pty_id.clone(), config);

        match process.spawn() {
            Ok(()) => {
                let mut processes = self.processes.lock().unwrap();
                processes.insert(pty_id.clone(), process);
                
                // Start monitoring this PTY
                self.start_pty_monitoring(pty_id.clone()).await;
                
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
            
            // Send resize message to WebSocket client
            self.broadcast_message(PTYMessage {
                pty_id: pty_id.to_string(),
                r#type: "resize".to_string(),
                cols: Some(cols),
                rows: Some(rows),
                ..Default::default()
            }).await;
            
            Ok(())
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    pub async fn kill_pty(&self, pty_id: &str, signal: Option<i32>) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        if let Some(mut process) = processes.remove(pty_id) {
            process.kill(signal).map_err(|e| format!("Kill failed: {}", e))?;
            
            // Send exit message to WebSocket client
            self.broadcast_message(PTYMessage {
                pty_id: pty_id.to_string(),
                r#type: "exit".to_string(),
                exit_code: Some(0),
                ..Default::default()
            }).await;
            
            Ok(())
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    async fn start_pty_monitoring(&self, pty_id: String) {
        let processes = Arc::clone(&self.processes);
        let websocket_clients = Arc::clone(&self.websocket_clients);
        
        tokio::spawn(async move {
            let mut output_data = String::new();
            
            loop {
                let process_clone = {
                    let processes = processes.lock().unwrap();
                    processes.get(&pty_id).cloned()
                };
                
                if let Some(process) = process_clone {
                    if !process.is_active {
                        break;
                    }
                    
                    // Read from stdout and stderr
                    if let Some(ref child) = process.child {
                        if let Some(ref mut stdout) = child.stdout {
                            let mut reader = BufReader::new(stdout);
                            let mut buffer = String::new();
                            
                            match reader.read_line(&mut buffer) {
                                Ok(0) => break, // EOF
                                Ok(_) => {
                                    let message = PTYMessage {
                                        pty_id: pty_id.clone(),
                                        r#type: "data".to_string(),
                                        data: Some(buffer.clone()),
                                        stream: Some("stdout".to_string()),
                                        ..Default::default()
                                    };
                                    
                                    // Broadcast to WebSocket clients
                                    let clients = websocket_clients.lock().unwrap();
                                    for (_, ws_stream) in clients.iter() {
                                        let mut ws = ws_stream.clone();
                                        if let Ok(msg) = serde_json::to_string(&message) {
                                            let _ = ws.send(Message::Text(msg)).await;
                                        }
                                    }
                                    
                                    buffer.clear();
                                }
                                Err(e) => {
                                    eprintln!("Error reading PTY output: {}", e);
                                    break;
                                }
                            }
                        }
                    }
                    
                    tokio::time::sleep(Duration::from_millis(10)).await;
                } else {
                    break;
                }
            }
        });
    }

    async fn broadcast_message(&self, message: PTYMessage) {
        let clients = self.websocket_clients.lock().unwrap();
        for (_, ws_stream) in clients.iter() {
            let mut ws = ws_stream.clone();
            if let Ok(msg) = serde_json::to_string(&message) {
                let _ = ws.send(Message::Text(msg)).await;
            }
        }
    }

    pub async fn start_websocket_server(&self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind("127.0.0.1:8080").await?;
        println!("PTY WebSocket server listening on ws://127.0.0.1:8080");
        
        let websocket_clients = Arc::clone(&self.websocket_clients);
        
        while let Ok((stream, addr)) = listener.accept().await {
            println!("New WebSocket connection from: {}", addr);
            
            let ws_stream = tokio_tungstenite::accept_async(stream)
                .await
                .map_err(|e| -> Box<dyn std::error::Error> { Box::new(e) })?;
            
            let pty_id = Uuid::new_v4().to_string();
            let mut clients = websocket_clients.lock().unwrap();
            clients.insert(pty_id.clone(), ws_stream);
            
            // Handle this WebSocket connection
            self.handle_websocket_connection(pty_id, websocket_clients.clone()).await;
        }
        
        Ok(())
    }

    async fn handle_websocket_connection(
        &self,
        pty_id: String,
        websocket_clients: Arc<Mutex<HashMap<String, WebSocketStream<TcpStream>>>>,
    ) {
        // Handle WebSocket messages for this connection
        // This would process resize, write, kill commands from frontend
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
async fn pty_create(config: PTYConfig) -> Result<String, String> {
    let service = PTYService::new();
    service.create_pty(config).await
}

#[tauri::command]
async fn pty_write(pty_id: String, data: String) -> Result<(), String> {
    let service = PTYService::new();
    service.write_to_pty(&pty_id, &data).await
}

#[tauri::command]
async fn pty_resize(pty_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let service = PTYService::new();
    service.resize_pty(&pty_id, cols, rows).await
}

#[tauri::command]
async fn pty_kill(pty_id: String, signal: Option<i32>) -> Result<(), String> {
    let service = PTYService::new();
    service.kill_pty(&pty_id, signal).await
}

#[tauri::command]
async fn pty_destroy(pty_id: String) -> Result<(), String> {
    let service = PTYService::new();
    service.kill_pty(&pty_id, Some(9)).await // SIGKILL
}
