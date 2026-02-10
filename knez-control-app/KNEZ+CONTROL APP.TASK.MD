# KNEZ + Control App: MCP Reliability & Inspector Upgrade (15 Tickets)

## Goal
Make MCP in `knez-control-app` reliable and debuggable for any MCP server config (Python stdio, npx stdio, etc.). Users should be able to paste an MCP config, connect, and either successfully use tools or see meaningful, actionable logs and recovery actions.

## Current Symptoms (from logs)
- `initialize` succeeds, but `tools/list` often times out.
- When KNEZ (`http://127.0.0.1:8000`) is down, TAQWIN MCP discovery/calls can stall and time out.
- Inspector cleanup calls `child.kill()` and throws `shell.kill not allowed (shell:allow-kill)`, causing unhandled rejections.
- `/mcp/registry/report` returns 405 and produces noisy browser console errors.

## Target Examples (must work)
### Example A: Node MCP via npx
```json
{
  "mcpServers": {
    "shadcn-ui": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"],
      "env": {},
      "disabled": true
    }
  }
}
```

### Example B: TAQWIN MCP via Python stdio
```json
{
  "mcpServers": {
    "taqwin": {
      "command": "C:\\\\Users\\\\syedm\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python313\\\\python.exe",
      "args": ["-u", "C:\\\\Users\\\\syedm\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1\\\\main.py"],
      "env": { "PYTHONUNBUFFERED": "1" }
    }
  }
}
```

## Tickets (15)
1. Add `shell:allow-kill` capability OR implement Windows `taskkill` fallback for stop.
2. Make MCP stop/cleanup best-effort and never crash the UI.
3. Fix inspector session cleanup to catch async stop errors (no unhandled rejections).
4. Add per-server operation queue to serialize start/init/list/call and avoid overlap.
5. Gate tools/list and tools/call on KNEZ health; show clear “KNEZ offline” banner.
6. Add adjustable timeouts (tools/list and tools/call) and safe defaults (60–180s list).
7. Improve timeout diagnostics: always show method, framing, pid, and last stdout/stderr.
8. Eliminate `/mcp/registry/report` console noise (use native http + cache-disable on 404/405).
9. Improve inspector status reflection: lifecycle state, last_ok, last_error, durations, tool-cache age.
10. Improve inspector logs UX: filter/search, copy, auto-scroll, export.
11. Improve registry cards: show local config presence, last_ok/last_error, one-click Inspect.
12. Improve config save behavior: validate, “apply without restart”, prevent stop-loop on save.
13. Add Playwright coverage for MCP Registry → Inspector (renders + can start/init).
14. Add a short troubleshooting runbook (permissions + KNEZ health + interpreting logs).
15. Repo hygiene + release: ignore artifacts, ensure commits only include intended files; run build/tests, commit, push.

## Definition of Done
- No unhandled rejections from MCP stop/cleanup.
- “Stop” works even when `shell:allow-kill` is unavailable (fallback).
- When KNEZ is offline, UI explains it and avoids pointless tools/list storms.
- Inspector shows actionable logs and request/response traffic.
- `npm test`, `npm run build`, `npm run e2e:tauri` pass.
- Changes are committed and pushed with only intended files tracked.

