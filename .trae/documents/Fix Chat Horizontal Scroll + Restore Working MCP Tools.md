## Evidence-Based Findings

* **Chat horizontal scroll is caused by child elements exceeding width**: Chat container in [ChatPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/ChatPane.tsx#L895-L925) only has `overflow-y-auto` (no `overflow-x-hidden`).

* **Multiple** **`<pre>`** **blocks intentionally enable horizontal scrolling**:

  * Code blocks: [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx#L29-L55) uses `overflow-x-auto`.

  * Tool args/results: [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx#L145-L174) uses `overflow-x-auto`.

  * SYSTEM blocks: [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx#L201-L218) uses `overflow-x-auto`.

* **Normal message text can still overflow**: [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx#L78-L92) has `whitespace-pre-wrap` but no `break-words/break-all`, so long unbroken tokens (URLs, hashes) can force horizontal scroll.

* **Your MCP log shows initialize succeeds but tools/list stalls**:

  * You have `MCP initialize ok` then `MCP request tools/list` and UI remains `LISTING_TOOLS`.

  * Current client sends **tools/list with no params field** (because `params` is omitted when cursor is null): [McpStdioClient.listTools](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts#L596-L605).

  * Many Python MCP servers accept optional params, but a strict/buggy server can block if params is missing. This exactly matches your symptom: initialize ok, tools/list never returns.

* **Registry confusion is real and comes from how we merge sources**:

  * Registry merges **KNEZ snapshot first**; local config servers are only injected if missing: [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx#L104-L129).

  * Therefore `taqwin-v1-ultimate-session` showing `active` with `local_config=false` means: **KNEZ backend says it’s active**. It is not created by local config UI.

  * Local servers injected by UI are hard-coded as `status: "inactive"` even when Inspector says `LISTING_TOOLS`, so the UI can look “offline” while the process is running.

* USE PROPER MCP , example for working or other mcp platforms: vscode , trae etc : ( mcp.json(location:"C:\Users\user\AppData\Roaming\KNEZ-CONTROL-APP\User\mcp.json") 

* figure out wht use in this location , how it helps run and connect mcp servers crrrectly in betsw ay and apply on knez-control-app

  ```jsonc
  {
      "mcpServers": {
          "shadcn-ui": {
              "command": "npx",
              "args": [
                  "shadcn@latest",
                  "mcp"
              ],
              "env": {},
              "fromGalleryId": "byted-mcp.shadcn-ui",
              "disabled": true
          },
          "taqwin": {
            "command": "C:\\Users\\syedm\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
            "args": [
              "-u",
              "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1\\main.py"
            ],
            "env": {
              "PYTHONUNBUFFERED": "1"
            },
            "workingDirectory": "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1"
          }
      }
  }
  ```

##

Files: [ChatPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/ChatPane.tsx), [MessageItem.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/MessageItem.tsx), [ChatTerminalPane.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/chat/ChatTerminalPane.tsx)

* Add **`overflow-x-hidden max-w-full min-w-0`** to the scroll container in ChatPane so no child can force global x-scroll.

* Replace all chat `<pre>` blocks from `overflow-x-auto` to:

  * `whitespace-pre-wrap break-words overflow-x-hidden max-w-full`

  * For monospaced tool names / ids: add `break-all` where needed.

* Ensure message bubble container has `min-w-0` and content wrappers have `break-words`.

* Fix terminal output container similarly (`break-words overflow-x-hidden`).

* Verification: open a chat with long URLs, JSON, and command output; ensure **no horizontal scrollbar appears** in the chat panel.

### 2) Make MCP tools/list Actually Return (Stop “Pending Forever”)

Files: [McpStdioClient.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/client/McpStdioClient.ts), [TaqwinMcpService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/mcp/taqwin/TaqwinMcpService.ts)

* Change `tools/list` requests to always include params, even if empty:

  * `this.request("tools/list", cursor ? {cursor} : {})`

  * This produces a JSON-RPC request with a `params` object, which fixes strict servers that block when params is absent.

* Make `notifications/initialized` compatible with strict servers by sending `{ params: {} }` (still valid JSON-RPC; avoids servers that assume params exists).

* Add a **single, explicit retry path** only for tools/list:

  * If tools/list times out once, immediately retry with **line request framing** (not parsing framing; request framing) and record which framing succeeded.

  * This is tightly scoped to tools/list only, to avoid lifecycle over-engineering.

* Verification: from the Inspector and Tools modal, `tools/list` returns a non-empty tool array; state transitions to READY only after tools list success.

### 3) Fix Registry Truthfulness (No “Offline While Running”)

File: [McpRegistryView.tsx](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/features/mcp/McpRegistryView.tsx)

* For `local_config` entries, derive status from Inspector runtime state:

  * `STARTING/LISTING_TOOLS/DISCOVERING` → show “connecting”

  * `READY/INITIALIZED` → show “active/operational”

  * `ERROR` → show “error” with lastError visible

  * `IDLE/STOPPED` → show “inactive/offline”

* Add explicit `source` labeling:

  * If item came from KNEZ snapshot → show `source=knez_registry`

  * If item injected from local config → show `source=local_config`

* Verification: your shown case will render consistently:

  * `taqwin` local\_config=true + LISTING\_TOOLS will not be displayed as inactive/offline.

  * `taqwin-v1-ultimate-session` local\_config=false will be shown as KNEZ-owned (not “mock”).

### 4) Stop Search Noise Until MCP Search Works

Files: [ChatService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ChatService.ts), [ExtractionService.ts](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src/services/ExtractionService.ts)

* When TAQWIN web\_intelligence call fails, do not silently fall back to browser “proxy” search that is policy-disabled.

* Instead:

  * Return an explicit `[SYSTEM: Search Disabled]` block once per session (or show UI toast), and keep chat flowing.

* Verification: no more repeated console warnings; chat doesn’t stall.

## Execution & Verification

* Implement changes in the files above.

* Run a clean build.

* Run the desktop app and validate:

  * Chat panel: no horizontal scrolling.

  * MCP: initialize → notifications/initialized → tools/list completes.

  * Registry: local\_config status reflects Inspector state.

* Update Playwright e2e selectors only if UI semantics changed.

## Expected Post-Fix State (Binary)

* Chat UI horizontal scroll: **BROKEN → FIXED**

* TAQWIN MCP tools/list: **PARTIALLY CONNECTED → CONNECTED** (if server actually implements tools/list)

* Registry status: **MISLEADING → TRUSTWORTHY**

If TAQWIN still hangs after forcing params on tools/list, the remaining unknown becomes TAQWIN server-side tools/list handler. Verification would be: inspect stderrTail / server logs in Inspector to confirm the server receives tools/list and responds.
