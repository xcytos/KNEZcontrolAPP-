# Execution Law (Solo / Autonomous · Checkpointed)

Stamped: 2026-02-10T01:00+05:30

## Mode
- MODE: SOLO / AUTONOMOUS
- TOOL AUTHORITY: TAQWIN MCP (primary)

## Plan → Execute Discipline
- Before modifying code or memory structure, produce an explicit plan artifact (Prompt record).
- Execution must follow the plan in order; deviations must be logged.

## Checkpoint Budget
- Target checkpoint boundary: every 50K tokens of generated output or equivalent work volume.
- PROMPT-1 hard barrier: `checkpoints/checkpoint_0001.md` must be written and execution halts.

## Halt Conditions
Execution must HALT if:
- a file cannot be read
- required memory structure cannot be written
- boundaries conflict
- hallucination risk is detected

## Completion Contract (PROMPT-1)
PROMPT-1 completion output is restricted to:
- CHECKPOINT-0001 COMPLETE
- SYSTEM STATE: STABLE
- READY FOR NEXT AUTHORIZATION

## Tauri Testing Rule (CDP-First)

IF testing Tauri application:
  → MUST use CDP connection (playwright.connect_cdp)
  → DO NOT use standard browser tools (mcp0_browser_*)
  → IF CDP not available → STOP execution → REPORT error

CDP Connection Requirements:
  → Endpoint: http://localhost:9222
  → Enable: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
  → Attach to WebView2 page
  → Retry until connection succeeds

CDP Validation (Mandatory):
  → GET http://localhost:9222/json
  → Verify targets exist
  → IF empty → STOP → report "Tauri not running with CDP"

Page Selection Logic:
  → Iterate all pages
  → Select page matching app URL/title
  → Do NOT assume pages[0] is correct
