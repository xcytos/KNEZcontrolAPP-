# MCP Troubleshooting (Control App)

## Where to look first
- MCP Registry → Inspector → Logs (Traffic/Stdout/Stderr/Parse)
- MCP Registry → Inspector → Server panel (state/pid/framing/last_ok/last_error)

## Common problems and fixes

### 1) “TAQWIN MCP request timed out …”
Most timeouts are not framing problems if `initialize` already succeeded. Common causes:
- KNEZ endpoint is down/unreachable (tool discovery/calls can stall while TAQWIN waits on KNEZ).
- The MCP server is busy or blocked (Python buffering, slow startup, long tool execution).

What to do:
- In Inspector, check the **KNEZ** banner (for taqwin) and click **Check**.
- Increase **tools/list timeout** in the Server panel before clicking tools/list.
- Use Inspector logs to confirm whether you received any stdout/stderr after the request.

### 2) “shell.kill not allowed (shell:allow-kill)”
The desktop app needs Tauri shell permissions to kill spawned processes.
- This project enables `shell:allow-kill` in `src-tauri/capabilities/default.json`.
- Stop also has a Windows `taskkill` fallback so Stop works even if kill permission is restricted.

### 3) tools/list never returns
If you see `initialize ok` but `tools/list timed out`:
- Make sure KNEZ is healthy if the server depends on it (taqwin).
- Increase tools/list timeout (60–180s is normal for large tool registries).
- Check Stdout/Stderr tabs for server-side errors or stack traces.

### 4) MCP config saves but servers behave oddly
Use **Apply** in the Inspector config editor to validate without writing to disk.
Use **Save** only after issues are resolved.

### 5) Noisy “/mcp/registry/report 405”
Runtime reporting is disabled by default. Enable it only when the KNEZ backend supports it:
- Set `VITE_ENABLE_MCP_RUNTIME_REPORT=true` for the Control App dev/build environment.

## Tips
- Prefer Python `-u` and `PYTHONUNBUFFERED=1` for stdio MCP servers.
- Use Inspector → Copy logs to share a reproducible diagnostic bundle.

