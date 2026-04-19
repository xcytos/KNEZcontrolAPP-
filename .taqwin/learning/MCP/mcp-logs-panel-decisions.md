# MCP Logs Panel — Design Decisions

**Date:** 2026-04-19  
**Scope:** `knez-control-app` MCP Inspector + Registry  
**Files modified:** `McpRegistryView.tsx`, `McpInspectorPanel.tsx`

---

## Decision 1 — Logs button navigates to Inspector (not floating panel)

**Options considered:**
- Floating overlay pinned bottom-right
- Navigate to Inspector tab with logs highlighted
- Inline drawer expanding in Registry card

**Chosen:** Navigate to Inspector tab with logs highlighted.

**Rationale:**
- The Inspector already has full log infrastructure (traffic events, stdout/stderr tails, state display)
- A floating panel would duplicate this infrastructure
- The Inspector provides more context (server config, tool list, status) alongside logs
- Avoids creating a second subscription to `mcpInspectorService` for a floating component

**Implementation:** 
```
onClick Logs:
  1. mcpInspectorService.setSelectedId(serverId)
  2. setTab("inspector")
  3. mcpInspectorService.handshake(serverId) — start/restart
  4. dispatch "mcp-inspector-focus-logs" event (200ms delay to let tab render)
```

---

## Decision 2 — Added "Lifecycle" tab as the primary log view

**Problem:** The existing Traffic/Stdout/Stderr/Parse tabs show raw protocol data that is difficult to read at a glance. The user wanted to see:
```
[HH:MM:SS] Connecting: npx -y @playwright/mcp
[HH:MM:SS] Connected. PID=24876
[HH:MM:SS] Listing tools...
[HH:MM:SS] Got 21 tools: browser_close, browser_click, ...
```

**Solution:** Synthesize a `lifecycleLogs` array from existing `McpTrafficEvent` stream:
- `spawn_error` → "Spawn failed: …" (error)
- `request[initialize]` → "Connecting: <command> <args>"
- `response[capabilities]` → "Connected. PID=…"
- `request[tools/list]` → "Listing tools…"
- `response[tools]` → "Got N tools: tool1, tool2, …"
- `raw_stderr` (JSON structured) → parsed `[logger] message` at correct level
- `raw_stderr` (plain text) → shown as-is
- `process_closed` → "Process exited (code=N)"
- `st.lastError` fallback → shown if no events exist

**Why Lifecycle is the default tab:** It is the most actionable view for debugging connection issues. Traffic/Stdout/Stderr are available for deeper protocol inspection.

---

## Decision 3 — Removed Spawn, Initialize, Test Connect, Call Disabled from Inspector

**Elements removed:**

| Element | Reason |
|---|---|
| `Spawn` button | Redundant — `Start` (Handshake) already spawns + initializes |
| `Initialize` button | Redundant — covered by Handshake flow |
| `Test Connect` button | Redundant — same as Handshake |
| `Call Disabled` button + args textarea + timeout input | Completely disabled, served no purpose; tool execution is owned by ChatService |

**Elements kept:**
- `Start` (calls `handshake`) — primary action
- `Stop` — needed for manual lifecycle control
- `Restart` — needed for quick server reset
- `List Tools` — useful to refresh tool cache independently
- `tools/list timeout` input — critical for slow Python servers (TAQWIN takes ~6s)

**Design principle:** Inspector is read/observe, not execute. Tool execution belongs to ChatService.

---

## Decision 4 — Lifecycle tab scroll + auto-focus on Logs button click

**Flow:**
1. Registry `Logs` button fires `handshake()` + dispatches `"mcp-inspector-focus-logs"` event
2. Inspector listens for `"mcp-inspector-focus-logs"` and:
   - Sets `logTab` to `"lifecycle"`
   - Calls `logsSectionRef.current?.scrollIntoView()`
3. `Start` and `Restart` buttons in Inspector also switch to Lifecycle tab automatically

**Why custom event (not prop/state):** The Registry and Inspector are sibling tabs in `McpRegistryView`. The event bridges between them without prop-drilling through the parent, consistent with the existing `"mcp-inspector-open-config"` pattern.

---

## Decision 5 — Copy button adapts to active tab

When on `Lifecycle` tab, Copy exports human-readable log lines:
```
[HH:MM:SS] ✓ Connecting: python.exe main.py
[HH:MM:SS] ✓ Connected. PID=24876
```

When on Traffic/Stdout/Stderr/Parse, Copy exports raw protocol text. This makes the lifecycle view useful for bug reports and support.

---

## Architecture Impact

- No new services or stores needed — all data from existing `McpInspectorService.getTraffic()`
- `lifecycleLogs` is computed via `useMemo` — zero runtime cost until Inspector renders
- The `"mcp-inspector-focus-logs"` event is a one-way signal (fire-and-forget), consistent with `"mcp-inspector-open-config"`
- Tool count display added to Tools section header for quick reference
