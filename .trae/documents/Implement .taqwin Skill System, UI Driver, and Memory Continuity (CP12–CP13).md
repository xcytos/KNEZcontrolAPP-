## Overview
- Add a persistent skill system under .taqwin that the app loads at startup, remembers across sessions, and auto-appends learnings/mistakes to each skill’s SKILL.md.
- Deliver a Terminal Master skill (Windows/Linux) focused on fast, disciplined execution; an in-app UI Driver skill for real clicks on the actual dev/tauri window; plus 5 supportive skills.
- Remove emojis across UI and replace with icons/text; improve memory/session continuity and display.

## Directory & Loader
- Create .taqwin/skills/<skill-name>/SKILL.md with frontmatter (name, description, tags, version) and body guidelines.
- Implement SkillsRegistry (src/services/SkillsRegistry.ts) that:
  - Scans .taqwin/skills/*/SKILL.md on app start
  - Parses frontmatter + body; exposes list of skills to the app
  - Provides appendLearning(skillName, entry) to add a timestamped section under “Learnings”
- Hook into ChatService/KnezClient error/refusal paths to call appendLearning() when a failure maps to a skill domain (e.g., terminal ops or UI driver).

## Skill Authoring (Initial Set)
- T1: terminal-master
  - Description: “Disciplined, fast terminal execution for Windows/Linux/macOS; invoke when optimizing cp/mv/rm, process mgmt, or shell ergonomics.”
  - Content: Best practices (PowerShell/Bash), safety flags, speed helpers (xcopy/robocopy, rsync), process control, path handling on Windows.
- T2: ui-driver
  - Description: “Drive real clicks/inputs on the loaded app window; invoke when validating actual UI flows in dev/tauri.”
  - Content: DOM querying, event dispatch, deterministic waits, no headless-only tests; integrates with Diagnostics.
- T3: extraction-optimizer — guidance on batching, caching, and de-duplication for web extraction.
- T4: memory-curator — rules for summarization, tagging, retention, cross-session linking.
- T5: security-auditor — checks for secrets, unsafe logs, external calls; invoke before release.
- T6: error-diagnoser — structured triage, minimal repro, logging conventions; invoke on failures.
- T7: prompt-engineer — system/user prompt hygiene, context packing, tool hints.

## UI Driver Implementation
- Add UiDriverService (src/services/UiDriverService.ts):
  - API: click(selector), type(selector, text), waitVisible(selector), getText(selector)
  - Executes in the same window as the dev/tauri app (no separate headless runner)
- Extend TestRunner:
  - New test: “UI Navigation Smoke”: open Chat view, toggle Web Search, send message, verify assistant bubble updates.
- Update Diagnostics TestPanel to show UI steps and logs.

## Memory & Session Continuity (T8–T15)
- PersistenceService: confirm browser/Tauri fallback (already added) and expand to store index (.taqwin/sessions/index.json) for listing sessions.
- MemoryExplorer/session listing: show session continuity, recent sessions, and active session badge.
- Replace emojis with text or icon components (e.g., Heroicons or internal SVGs) across Chat/Sidebar/Panel.
- Add “Session Resume” quick actions to CommandPalette and LineagePanel.

## Removal of Emojis
- Replace visual emojis in:
  - Chat bubbles (assistant/user markers)
  - Sidebar items
  - Tool buttons
- Use existing icon components or lightweight inline SVGs.

## Integration & Tickets
- CP12 — Skill System & UI Driver
  - CP12-1: SkillsRegistry and file watcher
  - CP12-2: terminal-master SKILL.md
  - CP12-3: ui-driver SKILL.md and UiDriverService
  - CP12-4: Extend TestRunner with UI Navigation Smoke
  - CP12-5: Map failures to skill learnings (append to SKILL.md)
  - CP12-6: Diagnostics: detailed logs per skill
  - CP12-7: CommandPalette entry “Skills” view (optional, list skills)
- CP13 — Memory/Session Continuity & UI Icons
  - CP13-1: sessions index & loader
  - CP13-2: MemoryExplorer session continuity display
  - CP13-3: Replace emojis with icons/text globally
  - CP13-4: CommandPalette quick “Resume Last Session”
  - CP13-5: Final verification & build

## Verification
- Launch dev server and Tauri build; use OpenPreview to validate the same window.
- Run Diagnostics:
  - System Response, Web Search, Persistence — must pass
  - UI Navigation Smoke — must pass
- Inspect .taqwin/skills SKILL.md files after induced failures to confirm learnings append.

## Notes
- Skills live under .taqwin/skills to align with your governance folder.
- No external headless browser; interactions occur in the live dev/tauri window.

Please confirm the plan. Upon approval, I will: create the skills folder & SKILL.md files, implement the registry + UI driver, update diagnostics tests, remove emojis, and deliver CP12–CP13 with build verification.