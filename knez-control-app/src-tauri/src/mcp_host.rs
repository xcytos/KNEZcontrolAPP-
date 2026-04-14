use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStdioServerConfig {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub framing: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpRuntimeStatus {
    pub running: bool,
    pub state: String,
    pub pid: Option<u32>,
    pub framing: Option<String>,
    pub protocol_version: Option<String>,
    pub tools_cached: usize,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum McpTrafficEvent {
    #[serde(rename = "raw_stdout")]
    RawStdout { at: u64, server_id: String, pid: Option<u32>, generation: u64, text: String },
    #[serde(rename = "raw_stderr")]
    RawStderr { at: u64, server_id: String, pid: Option<u32>, generation: u64, text: String },
    #[serde(rename = "parse_error")]
    ParseError { at: u64, server_id: String, pid: Option<u32>, generation: u64, framing: String, detail: String, preview: String },
    #[serde(rename = "request")]
    Request { at: u64, server_id: String, pid: Option<u32>, generation: u64, id: String, method: String, json: Value },
    #[serde(rename = "response")]
    Response { at: u64, server_id: String, pid: Option<u32>, generation: u64, id: String, ok: bool, method: String, json: Value },
    #[serde(rename = "unsolicited")]
    Unsolicited { at: u64, server_id: String, pid: Option<u32>, generation: u64, id: Option<String>, ok: bool, json: Value },
    #[serde(rename = "process_closed")]
    ProcessClosed { at: u64, server_id: String, pid: Option<u32>, generation: u64, code: Option<i32> },
    #[serde(rename = "spawn_error")]
    SpawnError { at: u64, server_id: String, pid: Option<u32>, generation: u64, message: String },
    #[serde(rename = "state")]
    State { at: u64, server_id: String, pid: Option<u32>, generation: u64, state: String, detail: Option<String> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Framing {
    Line,
    ContentLength,
}

impl Framing {
    fn from_opt(s: Option<&str>) -> Self {
        match s.unwrap_or("").trim().to_lowercase().as_str() {
            "content-length" | "content_length" => Self::ContentLength,
            "line" => Self::Line,
            _ => Self::ContentLength,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Line => "line",
            Self::ContentLength => "content-length",
        }
    }
}

struct RunningProcess {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    framing: Framing,
    pending: Arc<Mutex<HashMap<String, PendingSlot>>>,
    #[allow(dead_code)]
    generation: u64,
}

struct PendingSlot {
    tx: mpsc::Sender<Result<Value, String>>,
    method: String,
    #[allow(dead_code)]
    created_at: u64,
    #[allow(dead_code)]
    generation: u64,
    #[allow(dead_code)]
    pid: Option<u32>,
}

struct RuntimeInner {
    proc: Option<RunningProcess>,
    state: String,
    server_id: String,
    generation: u64,
    pid: Option<u32>,
    protocol_version: Option<String>,
    tools: Vec<Value>,
    traffic: Vec<McpTrafficEvent>,
    traffic_limit: usize,
    initialized_notified: bool,
}

#[derive(Clone)]
pub struct McpHostRuntime {
    app: AppHandle,
    inner: Arc<Mutex<RuntimeInner>>,
    next_id: Arc<AtomicU64>,
    last_error: Arc<Mutex<Option<String>>>,
}

impl McpHostRuntime {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            inner: Arc::new(Mutex::new(RuntimeInner {
                proc: None,
                state: "IDLE".to_string(),
                server_id: "".to_string(),
                generation: 0,
                pid: None,
                protocol_version: None,
                tools: Vec::new(),
                traffic: Vec::new(),
                traffic_limit: 1200,
                initialized_notified: false,
            })),
            next_id: Arc::new(AtomicU64::new(1)),
            last_error: Arc::new(Mutex::new(None)),
        }
    }

    fn now_ms() -> u64 {
        match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
            Ok(d) => d.as_millis() as u64,
            Err(_) => 0,
        }
    }

    fn default_cwd() -> Option<PathBuf> {
        std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
            .or_else(|| std::env::current_dir().ok())
    }

    fn can_transition(from: &str, to: &str) -> bool {
        if from == to {
            return true;
        }
        if to == "ERROR" || to == "STOPPING" || to == "STOPPED" {
            return true;
        }
        match (from, to) {
            ("IDLE", "STARTING") => true,
            ("STOPPED", "STARTING") => true,
            ("STARTING", "SPAWNING") => true,
            ("SPAWNING", "INITIALIZING") => true,
            ("INITIALIZING", "INITIALIZED") => true,
            ("INITIALIZED", "DISCOVERING") => true,
            ("DISCOVERING", "READY") => true,
            _ => false,
        }
    }

    fn push_traffic(inner: &mut RuntimeInner, evt: McpTrafficEvent) {
        inner.traffic.push(evt);
        if inner.traffic.len() > inner.traffic_limit {
            let drop_n = inner.traffic.len() - inner.traffic_limit;
            inner.traffic.drain(0..drop_n);
        }
    }

    fn set_state(&self, next: &str, detail: Option<String>) {
        let mut inner = self.inner.lock().unwrap();
        let from = inner.state.clone();
        if !Self::can_transition(&from, next) {
            inner.state = "ERROR".to_string();
            *self.last_error.lock().unwrap() =
                Some(format!("mcp_invalid_state_transition:{}->{}", from, next));
        } else {
            inner.state = next.to_string();
        }
        let server_id = inner.server_id.clone();
        let pid = inner.pid;
        let generation = inner.generation;
        let state = inner.state.clone();
        Self::push_traffic(
            &mut inner,
            McpTrafficEvent::State {
                at: Self::now_ms(),
                server_id: server_id.clone(),
                pid,
                generation,
                state: state.clone(),
                detail: detail.clone(),
            },
        );
        let payload = serde_json::json!({
            "kind": "state",
            "serverId": server_id,
            "pid": pid,
            "generation": generation,
            "state": state,
            "detail": detail
        });
        self.app.emit("mcp://state", payload).ok();
    }

    pub fn status(&self) -> McpRuntimeStatus {
        let guard = self.inner.lock().unwrap();
        if let Some(p) = guard.proc.as_ref() {
            McpRuntimeStatus {
                running: true,
                state: guard.state.clone(),
                pid: guard.pid.or_else(|| Some(p.child.id())),
                framing: Some(p.framing.as_str().to_string()),
                protocol_version: guard.protocol_version.clone(),
                tools_cached: guard.tools.len(),
                last_error: self.last_error.lock().unwrap().clone(),
            }
        } else {
            McpRuntimeStatus {
                running: false,
                state: guard.state.clone(),
                pid: None,
                framing: None,
                protocol_version: guard.protocol_version.clone(),
                tools_cached: guard.tools.len(),
                last_error: self.last_error.lock().unwrap().clone(),
            }
        }
    }

    pub fn stop(&self) -> Result<(), String> {
        self.set_state("STOPPING", None);
        let _ = self.request_internal("shutdown", serde_json::json!({}), 1200, "mcp_timeout_shutdown");
        let _ = self.write_notification("exit", serde_json::json!({}));

        let mut guard = self.inner.lock().unwrap();
        if let Some(mut p) = guard.proc.take() {
            let leaked = {
                let mut map = p.pending.lock().unwrap();
                let leaked = map.len();
                for (_id, slot) in map.drain() {
                    let _ = slot.tx.send(Err("mcp_stopped".to_string()));
                }
                leaked
            };
            let _ = p.child.kill();
            if leaked > 0 {
                *self.last_error.lock().unwrap() = Some(format!("mcp_pending_leak_detected:{}", leaked));
            }
            let server_id = guard.server_id.clone();
            let pid = guard.pid;
            let generation = guard.generation;
            Self::push_traffic(
                &mut guard,
                McpTrafficEvent::ProcessClosed { at: Self::now_ms(), server_id, pid, generation, code: None },
            );
        }
        guard.tools.clear();
        guard.protocol_version = None;
        guard.initialized_notified = false;
        guard.pid = None;
        guard.state = "STOPPED".to_string();
        Ok(())
    }

    pub fn list_tools(&self) -> Result<Vec<Value>, String> {
        let guard = self.inner.lock().unwrap();
        if guard.state != "READY" {
            return Err("mcp_not_ready".to_string());
        }
        Ok(guard.tools.clone())
    }

    pub fn get_traffic(&self) -> Vec<McpTrafficEvent> {
        let guard = self.inner.lock().unwrap();
        guard.traffic.clone()
    }

    fn start_process(&self, cfg: &McpStdioServerConfig, framing: Framing) -> Result<(), String> {
        self.set_state("SPAWNING", Some(cfg.id.clone()));
        let is_npx = is_npx_command(&cfg.command);

        let mut cmd = if cfg!(windows) && is_npx {
            let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string());
            let mut c = Command::new(comspec);
            c.args(["/d", "/s", "/c", &cfg.command]);
            c.args(&cfg.args);
            c
        } else {
            let mut c = Command::new(&cfg.command);
            c.args(&cfg.args);
            c
        };

        cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(cwd) = cfg.cwd.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
            cmd.current_dir(cwd);
        } else if let Some(home) = Self::default_cwd() {
            cmd.current_dir(home);
        }
        if let Some(env) = cfg.env.as_ref() {
            cmd.envs(env);
        }
        if is_npx {
            let has_registry = cfg
                .env
                .as_ref()
                .map(|m| m.contains_key("NPM_CONFIG_REGISTRY"))
                .unwrap_or(false);
            if !has_registry {
                cmd.env("NPM_CONFIG_REGISTRY", "https://registry.npmjs.org");
            }
            if cfg!(windows) {
                let has_system_root = cfg
                    .env
                    .as_ref()
                    .map(|m| m.contains_key("SystemRoot"))
                    .unwrap_or(false);
                if !has_system_root {
                    if let Ok(v) = std::env::var("SystemRoot") {
                        if !v.trim().is_empty() {
                            cmd.env("SystemRoot", v);
                        }
                    }
                }
                let has_comspec = cfg
                    .env
                    .as_ref()
                    .map(|m| m.contains_key("ComSpec"))
                    .unwrap_or(false);
                if !has_comspec {
                    if let Ok(v) = std::env::var("ComSpec") {
                        if !v.trim().is_empty() {
                            cmd.env("ComSpec", v);
                        }
                    }
                }
            }
        }

        let (spawn_server_id, spawn_generation) = {
            let inner = self.inner.lock().unwrap();
            (inner.server_id.clone(), inner.generation)
        };
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let msg = e.to_string();
                {
                    let mut inner = self.inner.lock().unwrap();
                    McpHostRuntime::push_traffic(
                        &mut inner,
                        McpTrafficEvent::SpawnError {
                            at: Self::now_ms(),
                            server_id: spawn_server_id.clone(),
                            pid: None,
                            generation: spawn_generation,
                            message: msg.clone(),
                        },
                    );
                }
                let _ = self.app.emit(
                    "mcp://state",
                    serde_json::json!({
                        "kind": "spawn_error",
                        "serverId": spawn_server_id,
                        "generation": spawn_generation,
                        "error": msg
                    }),
                );
                return Err(format!("mcp_spawn_failed:{}", msg));
            }
        };
        let stdin = child.stdin.take().ok_or("mcp_missing_stdin")?;
        let stdout = child.stdout.take().ok_or("mcp_missing_stdout")?;
        let stderr = child.stderr.take().ok_or("mcp_missing_stderr")?;
        let pid = Some(child.id());

        let (server_id, generation) = {
            let mut inner = self.inner.lock().unwrap();
            inner.pid = pid;
            (inner.server_id.clone(), inner.generation)
        };

        let pending: Arc<Mutex<HashMap<String, PendingSlot>>> = Arc::new(Mutex::new(HashMap::new()));

        {
            let mut inner = self.inner.lock().unwrap();
            inner.proc = Some(RunningProcess {
                child,
                stdin: Arc::new(Mutex::new(stdin)),
                framing,
                pending: pending.clone(),
                generation,
            });
            inner.state = "SPAWNING".to_string();
            inner.tools.clear();
            inner.protocol_version = None;
            inner.initialized_notified = false;
            Self::push_traffic(
                &mut inner,
                McpTrafficEvent::State {
                    at: Self::now_ms(),
                    server_id: server_id.clone(),
                    pid,
                    generation,
                    state: "SPAWNING".to_string(),
                    detail: Some(cfg.id.clone()),
                },
            );
        }

        self.app
            .emit(
                "mcp://state",
                serde_json::json!({ "kind": "started", "id": cfg.id, "pid": pid, "framing": framing.as_str(), "generation": generation }),
            )
            .ok();

        {
            let app = self.app.clone();
            let inner_arc = self.inner.clone();
            let last_error = self.last_error.clone();
            let pending = pending.clone();
            let server_id = server_id.clone();
            let gen = generation;
            let proc_pid = pid;
            thread::spawn(move || {
                let mut reader = BufReader::new(stdout);
                let mut buf: Vec<u8> = Vec::new();
                loop {
                    let mut tmp = [0u8; 8192];
                    match reader.read(&mut tmp) {
                        Ok(0) => break,
                        Ok(n) => {
                            buf.extend_from_slice(&tmp[..n]);
                            loop {
                                if let Some((msg, consumed, raw_text)) = try_parse_message(&buf) {
                                    buf.drain(0..consumed);
                                    if let Some(raw) = raw_text {
                                        app.emit(
                                            "mcp://raw_stdout",
                                            serde_json::json!({ "serverId": server_id.clone(), "pid": proc_pid, "generation": gen, "text": raw.clone() }),
                                        )
                                        .ok();
                                        let mut inner = inner_arc.lock().unwrap();
                                        McpHostRuntime::push_traffic(
                                            &mut inner,
                                            McpTrafficEvent::RawStdout { at: McpHostRuntime::now_ms(), server_id: server_id.clone(), pid: proc_pid, generation: gen, text: raw.clone() },
                                        );
                                        if msg.is_none() {
                                            let trimmed = raw.trim_start();
                                            if trimmed.starts_with('{') || trimmed.starts_with('[') || trimmed.contains("\"jsonrpc\"") {
                                                McpHostRuntime::push_traffic(
                                                    &mut inner,
                                                    McpTrafficEvent::ParseError {
                                                        at: McpHostRuntime::now_ms(),
                                                        server_id: server_id.clone(),
                                                        pid: proc_pid,
                                                        generation: gen,
                                                        framing: "unknown".to_string(),
                                                        detail: "invalid_json".to_string(),
                                                        preview: trimmed.chars().take(800).collect(),
                                                    },
                                                );
                                            }
                                        }
                                    }
                                    if let Some(json) = msg {
                                        let id_key = match json.get("id") {
                                            Some(Value::String(s)) => Some(s.clone()),
                                            Some(Value::Number(n)) => Some(n.to_string()),
                                            _ => None,
                                        };

                                        let mut delivered = false;
                                        let mut delivered_method: Option<String> = None;
                                        if let Some(id) = id_key.as_ref() {
                                            let slot_opt = pending.lock().unwrap().remove(id);
                                            if let Some(slot) = slot_opt {
                                                delivered = true;
                                                delivered_method = Some(slot.method.clone());
                                                if let Some(err) = json.get("error") {
                                                    let benign_shutdown = slot.method == "shutdown"
                                                        && err
                                                            .get("code")
                                                            .and_then(|v| v.as_i64())
                                                            .map(|c| c == -32601)
                                                            .unwrap_or(false);
                                                    if benign_shutdown {
                                                        let _ = slot.tx.send(Ok(serde_json::json!({})));
                                                    } else {
                                                        let _ = slot.tx.send(Err(err.to_string()));
                                                    }
                                                } else if let Some(result) = json.get("result") {
                                                    let _ = slot.tx.send(Ok(result.clone()));
                                                } else {
                                                    let _ = slot.tx.send(Err("mcp_invalid_response".to_string()));
                                                }
                                            }
                                        }

                                        let mut inner = inner_arc.lock().unwrap();
                                        if let Some(id) = id_key.clone() {
                                            if delivered {
                                                let id_for_emit = json.get("id").cloned().unwrap_or(Value::Null);
                                                let benign_shutdown = delivered_method.as_deref() == Some("shutdown")
                                                    && json
                                                        .get("error")
                                                        .and_then(|e| e.get("code"))
                                                        .and_then(|v| v.as_i64())
                                                        .map(|c| c == -32601)
                                                        .unwrap_or(false);
                                                let ok_for_emit = json.get("error").is_none() || benign_shutdown;
                                                let method_for_emit = delivered_method.unwrap_or_else(|| "unknown".to_string());
                                                let json_for_emit = if benign_shutdown {
                                                    serde_json::json!({ "jsonrpc": "2.0", "id": id_for_emit.clone(), "result": {} })
                                                } else {
                                                    json.clone()
                                                };
                                                McpHostRuntime::push_traffic(
                                                    &mut inner,
                                                    McpTrafficEvent::Response {
                                                        at: McpHostRuntime::now_ms(),
                                                        server_id: server_id.clone(),
                                                        pid: proc_pid,
                                                        generation: gen,
                                                        id,
                                                        ok: ok_for_emit,
                                                        method: method_for_emit.clone(),
                                                        json: json_for_emit.clone(),
                                                    },
                                                );
                                                app.emit(
                                                    "mcp://response",
                                                    serde_json::json!({
                                                        "serverId": server_id.clone(),
                                                        "pid": proc_pid,
                                                        "generation": gen,
                                                        "id": id_for_emit,
                                                        "ok": ok_for_emit,
                                                        "method": method_for_emit
                                                    }),
                                                )
                                                .ok();
                                            } else {
                                                McpHostRuntime::push_traffic(
                                                    &mut inner,
                                                    McpTrafficEvent::Unsolicited {
                                                        at: McpHostRuntime::now_ms(),
                                                        server_id: server_id.clone(),
                                                        pid: proc_pid,
                                                        generation: gen,
                                                        id: Some(id),
                                                        ok: json.get("error").is_none(),
                                                        json: json.clone(),
                                                    },
                                                );
                                            }
                                        } else {
                                            McpHostRuntime::push_traffic(
                                                &mut inner,
                                                McpTrafficEvent::Unsolicited {
                                                    at: McpHostRuntime::now_ms(),
                                                    server_id: server_id.clone(),
                                                    pid: proc_pid,
                                                    generation: gen,
                                                    id: None,
                                                    ok: json.get("error").is_none(),
                                                    json: json.clone(),
                                                },
                                            );
                                        }
                                    }
                                    continue;
                                }
                                break;
                            }
                        }
                        Err(e) => {
                            *last_error.lock().unwrap() = Some(e.to_string());
                            app.emit("mcp://state", serde_json::json!({ "kind": "stdout_error", "error": e.to_string() }))
                                .ok();
                            let mut inner = inner_arc.lock().unwrap();
                            McpHostRuntime::push_traffic(
                                &mut inner,
                                McpTrafficEvent::ParseError {
                                    at: McpHostRuntime::now_ms(),
                                    server_id: server_id.clone(),
                                    pid: proc_pid,
                                    generation: gen,
                                    framing: "unknown".to_string(),
                                    detail: "stdout_read_error".to_string(),
                                    preview: e.to_string(),
                                },
                            );
                            break;
                        }
                    }
                }
                app.emit("mcp://state", serde_json::json!({ "kind": "exited" })).ok();
                let leaked = {
                    let mut map = pending.lock().unwrap();
                    let leaked = map.len();
                    for (_id, slot) in map.drain() {
                        let _ = slot.tx.send(Err("mcp_process_closed".to_string()));
                    }
                    leaked
                };
                if leaked > 0 {
                    *last_error.lock().unwrap() = Some(format!("mcp_pending_leak_detected:{}", leaked));
                }
                let mut inner = inner_arc.lock().unwrap();
                McpHostRuntime::push_traffic(
                    &mut inner,
                    McpTrafficEvent::ProcessClosed {
                        at: McpHostRuntime::now_ms(),
                        server_id: server_id.clone(),
                        pid: proc_pid,
                        generation: gen,
                        code: None,
                    },
                );
                if inner.generation == gen && inner.pid == proc_pid {
                    inner.proc = None;
                    inner.pid = None;
                    inner.state = "STOPPED".to_string();
                }
            });
        }

        {
            let app = self.app.clone();
            let inner_arc = self.inner.clone();
            let last_error = self.last_error.clone();
            let server_id = server_id.clone();
            let gen = generation;
            let proc_pid = pid;
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    match line {
                        Ok(text) => {
                            app.emit(
                                "mcp://raw_stderr",
                                serde_json::json!({ "serverId": server_id.clone(), "pid": proc_pid, "generation": gen, "text": text.clone() }),
                            )
                            .ok();
                            let mut inner = inner_arc.lock().unwrap();
                            McpHostRuntime::push_traffic(
                                &mut inner,
                                McpTrafficEvent::RawStderr { at: McpHostRuntime::now_ms(), server_id: server_id.clone(), pid: proc_pid, generation: gen, text },
                            );
                        }
                        Err(e) => {
                            *last_error.lock().unwrap() = Some(e.to_string());
                            app.emit("mcp://state", serde_json::json!({ "kind": "stderr_error", "error": e.to_string() }))
                                .ok();
                            break;
                        }
                    }
                }
            });
        }

        Ok(())
    }

    fn write_notification(&self, method: &str, params: Value) -> Result<(), String> {
        let (framing, stdin) = {
            let guard = self.inner.lock().unwrap();
            let p = guard.proc.as_ref().ok_or("mcp_not_running")?;
            (p.framing, p.stdin.clone())
        };
        let msg = serde_json::json!({ "jsonrpc": "2.0", "method": method, "params": params });
        let body = msg.to_string();
        let payload: Vec<u8> = match framing {
            Framing::Line => {
                let mut v = body.into_bytes();
                v.push(b'\n');
                v
            }
            Framing::ContentLength => {
                let bytes = body.as_bytes();
                let mut v = format!("Content-Length: {}\r\n\r\n", bytes.len()).into_bytes();
                v.extend_from_slice(bytes);
                v
            }
        };
        {
            let mut w = stdin.lock().unwrap();
            w.write_all(&payload).map_err(|e| e.to_string())?;
            w.flush().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn request_internal(&self, method: &str, params: Value, timeout_ms: u64, timeout_code: &str) -> Result<Value, String> {
        let (id, framing, pending_map, stdin, server_id, generation, pid) = {
            let guard = self.inner.lock().unwrap();
            let p = guard.proc.as_ref().ok_or("mcp_not_running")?;
            let id = self.next_id.fetch_add(1, Ordering::Relaxed).to_string();
            (id, p.framing, p.pending.clone(), p.stdin.clone(), guard.server_id.clone(), guard.generation, guard.pid)
        };

        let msg = serde_json::json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        let body = msg.to_string();
        let payload: Vec<u8> = match framing {
            Framing::Line => {
                let mut v = body.into_bytes();
                v.push(b'\n');
                v
            }
            Framing::ContentLength => {
                let bytes = body.as_bytes();
                let mut v = format!("Content-Length: {}\r\n\r\n", bytes.len()).into_bytes();
                v.extend_from_slice(bytes);
                v
            }
        };

        let (tx, rx) = mpsc::channel::<Result<Value, String>>();
        {
            let mut pending = pending_map.lock().unwrap();
            pending.insert(
                id.clone(),
                PendingSlot { tx, method: method.to_string(), created_at: Self::now_ms(), generation, pid },
            );
        }
        {
            let mut w = stdin.lock().unwrap();
            w.write_all(&payload).map_err(|e| e.to_string())?;
            w.flush().map_err(|e| e.to_string())?;
        }
        {
            let mut inner = self.inner.lock().unwrap();
            Self::push_traffic(
                &mut inner,
                McpTrafficEvent::Request { at: Self::now_ms(), server_id: server_id.clone(), pid, generation, id: id.clone(), method: method.to_string(), json: msg.clone() },
            );
        }
        self.app
            .emit(
                "mcp://request",
                serde_json::json!({
                    "serverId": server_id.clone(),
                    "pid": pid,
                    "generation": generation,
                    "id": id.clone(),
                    "method": method,
                    "framing": framing.as_str()
                }),
            )
            .ok();

        match rx.recv_timeout(Duration::from_millis(timeout_ms.max(1))) {
            Ok(res) => res,
            Err(_) => {
                let mut map = pending_map.lock().unwrap();
                map.remove(&id);
                Err(timeout_code.to_string())
            }
        }
    }

    fn handshake(&self, protocol_version: &str, init_timeout_ms: u64, tools_timeout_ms: u64) -> Result<Vec<Value>, String> {
        self.set_state("INITIALIZING", Some(protocol_version.to_string()));
        let init_params = serde_json::json!({
            "protocolVersion": protocol_version,
            "capabilities": {},
            "clientInfo": { "name": "knez-control-app", "version": "dev" }
        });
        let _init = self.request_internal("initialize", init_params, init_timeout_ms, "mcp_timeout_initialize")?;

        self.set_state("INITIALIZED", None);
        let should_notify = {
            let mut inner = self.inner.lock().unwrap();
            if inner.initialized_notified {
                false
            } else {
                inner.initialized_notified = true;
                true
            }
        };
        if should_notify {
            let _ = self.write_notification("notifications/initialized", serde_json::json!({}));
        }

        self.set_state("DISCOVERING", None);
        let tools_res = self.request_internal("tools/list", serde_json::json!({}), tools_timeout_ms, "mcp_timeout_tools_list")?;
        let tools = tools_res
            .get("tools")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if tools.is_empty() {
            return Err("mcp_server_no_tools".to_string());
        }
        Ok(tools)
    }

    pub fn start(&self, cfg: McpStdioServerConfig) -> Result<McpRuntimeStatus, String> {
        self.stop().ok();
        *self.last_error.lock().unwrap() = None;
        {
            let mut inner = self.inner.lock().unwrap();
            inner.server_id = cfg.id.clone();
            inner.generation = inner.generation.saturating_add(1);
            inner.protocol_version = None;
            inner.tools.clear();
            inner.initialized_notified = false;
            inner.pid = None;
        }
        self.set_state("STARTING", Some(cfg.id.clone()));

        let is_npx = is_npx_command(&cfg.command);
        let init_timeout_ms = if is_npx { 60000 } else { 15000 };
        let tools_timeout_ms = 60000;

        let framings: [Framing; 2] = {
            let preferred = if cfg.framing.as_deref().unwrap_or("").trim().is_empty() && is_npx {
                Framing::Line
            } else {
                Framing::from_opt(cfg.framing.as_deref())
            };
            if preferred == Framing::Line {
                [Framing::Line, Framing::ContentLength]
            } else {
                [Framing::ContentLength, Framing::Line]
            }
        };
        let protocol_versions = ["2024-11-05", "1.0"];

        let mut last_err: Option<String> = None;
        for framing in framings {
            for protocol_version in protocol_versions {
                let attempt = (framing.as_str().to_string(), protocol_version.to_string());
                match self.start_process(&cfg, framing) {
                    Ok(()) => match self.handshake(protocol_version, init_timeout_ms, tools_timeout_ms) {
                        Ok(tools) => {
                            let mut inner = self.inner.lock().unwrap();
                            inner.protocol_version = Some(protocol_version.to_string());
                            inner.tools = tools;
                            drop(inner);
                            self.set_state("READY", None);
                            return Ok(self.status());
                        }
                        Err(e) => {
                            last_err = Some(e.clone());
                            self.stop().ok();
                            let err_short: String = e.chars().take(240).collect();
                            self.set_state(
                                "ERROR",
                                Some(format!(
                                    "handshake_failed framing={} protocol={} err={}",
                                    attempt.0, attempt.1, err_short
                                )),
                            );
                        }
                    },
                    Err(e) => {
                        last_err = Some(e.clone());
                        self.stop().ok();
                        let err_short: String = e.chars().take(240).collect();
                        self.set_state(
                            "ERROR",
                            Some(format!(
                                "handshake_failed framing={} protocol={} err={}",
                                attempt.0, attempt.1, err_short
                            )),
                        );
                    }
                }
            }
        }

        let msg = last_err.unwrap_or_else(|| "mcp_start_failed".to_string());
        *self.last_error.lock().unwrap() = Some(msg.clone());
        Err(msg)
    }

    pub fn request(&self, method: String, params: Option<Value>, timeout_ms: u64) -> Result<Value, String> {
        let (id, framing, pending_map, stdin, server_id, generation, pid) = {
            let guard = self.inner.lock().unwrap();
            let p = guard.proc.as_ref().ok_or("mcp_not_running")?;
            if guard.state != "READY" {
                return Err("mcp_not_ready".to_string());
            }
            if method == "initialize" {
                return Err("mcp_duplicate_initialize".to_string());
            }
            if method == "tools/call" {
                let name = params
                    .as_ref()
                    .and_then(|v| v.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if name.is_empty() {
                    return Err("mcp_invalid_params".to_string());
                }
                let exists = guard.tools.iter().any(|t| t.get("name").and_then(|v| v.as_str()) == Some(name));
                if !exists {
                    return Err(format!("mcp_tool_not_found:{}", name));
                }
            }
            let id = self.next_id.fetch_add(1, Ordering::Relaxed).to_string();
            (id, p.framing, p.pending.clone(), p.stdin.clone(), guard.server_id.clone(), guard.generation, guard.pid)
        };

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params.unwrap_or_else(|| serde_json::json!({}))
        });

        let body = msg.to_string();
        let payload: Vec<u8> = match framing {
            Framing::Line => {
                let mut v = body.into_bytes();
                v.push(b'\n');
                v
            }
            Framing::ContentLength => {
                let bytes = body.as_bytes();
                let mut v = format!("Content-Length: {}\r\n\r\n", bytes.len()).into_bytes();
                v.extend_from_slice(bytes);
                v
            }
        };

        let (tx, rx) = mpsc::channel::<Result<Value, String>>();
        {
            let mut pending = pending_map.lock().unwrap();
            pending.insert(
                id.clone(),
                PendingSlot { tx, method: method.clone(), created_at: Self::now_ms(), generation, pid },
            );
        }

        {
            let mut w = stdin.lock().unwrap();
            w.write_all(&payload).map_err(|e| e.to_string())?;
            w.flush().map_err(|e| e.to_string())?;
        }
        self.app
            .emit(
                "mcp://request",
                serde_json::json!({
                    "serverId": server_id.clone(),
                    "pid": pid,
                    "generation": generation,
                    "id": id.clone(),
                    "method": method.clone(),
                    "framing": framing.as_str()
                }),
            )
            .ok();
        {
            let mut inner = self.inner.lock().unwrap();
            Self::push_traffic(
                &mut inner,
                McpTrafficEvent::Request { at: Self::now_ms(), server_id: server_id.clone(), pid, generation, id: id.clone(), method: msg["method"].as_str().unwrap_or("").to_string(), json: msg.clone() },
            );
        }

        let started = Instant::now();
        match rx.recv_timeout(Duration::from_millis(timeout_ms.max(1))) {
            Ok(res) => {
                self.app
                    .emit(
                        "mcp://response",
                        serde_json::json!({ "serverId": server_id.clone(), "pid": pid, "generation": generation, "id": msg["id"], "ok": res.is_ok(), "method": method }),
                    )
                    .ok();
                res
            }
            Err(_) => {
                {
                    let mut map = pending_map.lock().unwrap();
                    map.remove(&id);
                }
                let elapsed = started.elapsed().as_millis() as u64;
                self.app.emit("mcp://state", serde_json::json!({ "kind": "timeout", "id": msg["id"], "elapsed_ms": elapsed })).ok();
                let method = msg.get("method").and_then(|v| v.as_str()).unwrap_or("");
                let classified = if method == "initialize" {
                    "mcp_timeout_initialize"
                } else if method == "tools/list" {
                    "mcp_timeout_tools_list"
                } else if method == "tools/call" {
                    "mcp_timeout_tools_call"
                } else if method == "shutdown" {
                    "mcp_timeout_shutdown"
                } else {
                    "mcp_timeout_request"
                };
                Err(classified.to_string())
            }
        }
    }
}

fn try_parse_message(buf: &[u8]) -> Option<(Option<Value>, usize, Option<String>)> {
    if buf.is_empty() {
        return None;
    }

    let probe = if buf.len() > 32 { &buf[..32] } else { buf };
    let probe_text = String::from_utf8_lossy(probe).to_lowercase();
    if probe_text.starts_with("content-length:") {
        let header_end = find_bytes(buf, b"\r\n\r\n").or_else(|| find_bytes(buf, b"\n\n"))?;
        let sep_len = if buf.get(header_end..header_end + 4) == Some(b"\r\n\r\n") { 4 } else { 2 };
        let header = &buf[..header_end];
        let header_text = String::from_utf8_lossy(header);
        let len = header_text
            .lines()
            .find_map(|l| {
                let l = l.trim();
                if l.to_lowercase().starts_with("content-length:") {
                    l.split(':').nth(1)?.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })?;
        let body_start = header_end + sep_len;
        let body_end = body_start + len;
        if buf.len() < body_end {
            return None;
        }
        let body_bytes = &buf[body_start..body_end];
        let body_text = String::from_utf8_lossy(body_bytes).to_string();
        let json = serde_json::from_str::<Value>(&body_text).ok();
        return Some((json, body_end, Some(body_text)));
    }

    if let Some(nl) = find_byte(buf, b'\n') {
        let mut line = buf[..nl].to_vec();
        let consumed = nl + 1;
        if line.last() == Some(&b'\r') {
            line.pop();
        }
        let text = String::from_utf8_lossy(&line).trim().to_string();
        if text.is_empty() {
            return Some((None, consumed, None));
        }
        let json = serde_json::from_str::<Value>(&text).ok();
        return Some((json, consumed, Some(text)));
    }

    None
}

fn find_byte(haystack: &[u8], needle: u8) -> Option<usize> {
    haystack.iter().position(|b| *b == needle)
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    for i in 0..=(haystack.len() - needle.len()) {
        if &haystack[i..i + needle.len()] == needle {
            return Some(i);
        }
    }
    None
}

fn is_npx_command(command: &str) -> bool {
    let base = command.split(['\\', '/']).last().unwrap_or("").trim().to_lowercase();
    base == "npx" || base == "npx.cmd"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_npx_commands() {
        assert!(is_npx_command("npx"));
        assert!(is_npx_command("npx.cmd"));
        assert!(is_npx_command("C:\\\\Users\\\\me\\\\AppData\\\\Roaming\\\\npm\\\\npx.cmd"));
        assert!(!is_npx_command("node"));
        assert!(!is_npx_command("C:\\\\tools\\\\python.exe"));
    }
}
