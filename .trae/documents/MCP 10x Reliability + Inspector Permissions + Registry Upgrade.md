## What’s happening (root cause)

* The MCP server **initializes successfully** (you receive the initialize result), but **tools/list times out**. In your logs, at the same time the Control App shows `GET http://127.0.0.1:8000/health net::ERR_CONNECTION_REFUSED` and `/state/overview` refused. That strongly suggests TAQWIN MCP is trying to reach the KNEZ endpoint during tools discovery/calls and is stalling when KNEZ is offline.

* The inspector currently throws `shell.kill not allowed (shell:allow-kill)` because `McpStdioClient.stop()` calls `child.kill()` but your Tauri capabilities do not include `shell:allow-kill`.

  * Capabilities file: [default.json](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/capabilities/default.json#L5-L171)

  * The current `stop()` implementation: [McpStdioClient.stop](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts#L193-L200)

* The unhandled rejection comes from `reconcileSessions()` calling `void old.client.stop();` (async rejection not caught).

  * [McpInspectorService.reconcileSessions](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/inspector/McpInspectorService.ts#L290-L321)

<br />

TASK 1: CREATE KNEZ+ CONTROL APP.TASK.MD FILE WHICH TO GIVE TO A DEVLOPER OR TEAM OF KNEZ TO ENSUR EIT IS CONNECTED BRIEF ON 15 TICKETS FOR THEM WHO ARE IN BOTH AND HAVE ACCES STO BOTH KNEZ AND CONTROL APP REPO)

THEN EXECUTE ALL TICKETS(ANY TYPE OF MCP SHOULD BE USABLE WITH ADD NEW MCP , PASTE CONFIG AND THEY ARE CONNECTED OR SHOW MENIGFUL LOGS IN INSPECTION AND REGISTRY , FOR EXAAMPLE({
"mcpServers": {
"shadcn-ui": {
"command": "npx",
"args": \[
"shadcn\@latest",
"mcp"
],
"env": {},
"disabled": true
}
}
},({

  "mcpServers": {

    "taqwin": {

      "command": "C:\\\Users\\\syedm\\\AppData\\\Local\\\Programs\\\Python\\\Python313\\\python.exe",

      "args": \[

        "-u",

        "C:\\\Users\\\syedm\\\Downloads\\\ASSETS\\\controlAPP\\\TAQWIN\_V1\\\main.py"

      ],

      "env": {

        "PYTHONUNBUFFERED": "1"

      }

    }

  }

})

## 15 Tickets (and what I’ll implement)

1. **Add kill permission or kill fallback**

* Add `shell:allow-kill` to Tauri capabilities OR implement Windows `taskkill` fallback so Stop works even without allow-kill.

1. **Make Stop/cleanup never crash UI**

* Make `McpStdioClient.stop()` best-effort (no throw on permission denial) and ensure inspector cleanup always `.catch(() => {})`.

1. **Fix reconcileSessions async error handling**

* Replace `void old.client.stop()` with `void old.client.stop().catch(() => {})`.

1. **Add per-server operation queue**

* Serialize `start/initialize/tools/list/tools/call` per server to avoid overlapping requests (reduces deadlocks and repeated stopping).

1. **KNEZ health gate for tools/list + tools/call**

* If current KNEZ profile endpoint is down, show a clear banner and avoid tools/list storms; add a “Retry when KNEZ healthy” button.

1. **Make tools/list timeout adaptive + user-controlled**

* Add UI controls: tools/list timeout (default 60–180s), and “don’t stop process on timeout”.

1. **Improve timeout diagnostics (method=unknown)**

* Always surface the exact request method and last stdout/stderr lines in TAQWIN MCP error messages.

1. **Fix /mcp/registry/report 405 noise**

* Route runtime reporting through Tauri http plugin when available (avoids browser “Failed to load resource”) and cache-disable on 404/405.

1. **Inspector: richer status + reflection**

* Show lifecycle state, pid, framing, last\_ok, last\_error, durations, and tool-cache age; auto-refresh.

1. **Inspector: better logs UX**

* Add filters (kind/search), auto-scroll toggle, “copy event”/“copy tail”, and export.

1. **Registry cards: connect to inspector state**

* Add “configured locally” indicator, show last\_ok/last\_error, and a one-click “Inspect”.

1. **Host config: validate + safer Save**

* Prevent Save from triggering process-stop loops; show per-server validation inline; add “apply without restarting” option.

1. **E2E: add Inspector coverage**

* Extend Playwright to open MCP Registry → Inspector tab and verify it renders + can start/init the configured server.

1. **Troubleshooting docs**

* Add a short runbook: permissions (`allow-kill`), KNEZ endpoint health, interpreting logs.

1. **Repo hygiene + commit/push(just git add -A and commit with detaile dmessga e and push)**

* Add ignores for artifacts (e.g. `tests/tauri-e2e/puppeteer-artifacts/`) and ensure commits only include `knez-control-app` changes.

* Run `npm test`, `npm run e2e:tauri`, `npm run build`, then git commit + push.

## Implementation Order

* First fix permissions + stop safety (Tickets 1–3) so the inspector can’t crash.

* Then fix the real timeout driver: KNEZ health gating + tools/list timeouts + serialized ops (Tickets 4–7).

* Then finish UI/registry polish + reporting + E2E + docs + git hygiene (Tickets 8–15).

## Acceptance Criteria

* No `shell.kill not allowed` unhandled rejections.

* Inspector can Start/Stop reliably, and tools/list does not spam-stop or crash.

* When KNEZ is down, UI explains it and avoids pointless tools/list calls.

* `/mcp/registry/report` stops producing console noise.

* Build + unit + tauri e2e pass; commit and push include only intended files.

