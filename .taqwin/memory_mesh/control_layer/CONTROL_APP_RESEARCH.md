# CONTROL APP RESEARCH & INTERFACE DYNAMICS

Canonical (PROMPT-1): `../../research/CONTROL_APP_RESEARCH.md`

## UX & Interaction (Questions 1-10)
1.  **What is the maximum render frame rate for the Chat Interface?**
    - *Target*: 60fps. Virtualized lists are used for long history to maintain smoothness.
2.  **How does the Control App handle "Markdown Rendering" of massive code blocks?**
    - *Optimization*: Code blocks > 1000 lines are truncated with a "Show More" button.
3.  **Can the Control App "Voice" the AI response?**
    - *Feature*: Yes, via Web Speech API (TTS) integration in `VoiceInput.tsx`.
4.  **Does the "Terminal" pane support full TTY interaction (Vim/Nano)?**
    - *Limitation*: No, it is a non-interactive shell (stdin/stdout). Interactive apps hang.
5.  **How does the Control App "Visualize" the Memory Mesh?**
    - *UI*: The `MemoryExplorer.tsx` uses a node-link graph (D3.js or similar) to show connections.
6.  **Can the Control App "Theme" itself based on AI mood?**
    - *Dynamic*: Yes, `ThemeContext` can listen to `sentiment` events.
7.  **Does the App support "Multi-Monitor" layouts?**
    - *Windowing*: Tauri supports multiple windows, but the app is currently single-window.
8.  **How are "Toast Notifications" prioritized?**
    - *Priority*: Error > Warning > Info. Errors persist until dismissed.
9.  **Can the User "Drag and Drop" files into the chat?**
    - *Input*: Yes, processed as file path references.
10. **Does the App work "Offline"?**
    - *Connectivity*: Yes, if using local KNEZ models.

## Performance & Rendering (Questions 11-20)
11. **What is the memory footprint of the Electron/Tauri frontend?**
    - *Benchmark*: ~150MB RAM idle. Significantly lighter than Electron.
12. **How does the App handle "Streaming" tokens from KNEZ?**
    - *Protocol*: Server-Sent Events (SSE) or WebSocket. Updates React state in chunks.
13. **Is there a "Search" function for the Chat History?**
    - *Search*: Yes, client-side regex search in `ChatUtils.ts`.
14. **How quickly does the App "Load" a 10,000 message session?**
    - *Performance*: < 2 seconds using indexedDB or SQLite pagination.
15. **Does the App "Cache" web images?**
    - *Caching*: Standard browser cache.
16. **Can the App "Export" the session to PDF?**
    - *Export*: Yes, via `window.print()` styling or explicit PDF generation library.
17. **How does the App handle "WebGL" contexts for the Graph View?**
    - *Resource*: Manages context loss/restore to prevent crashes on sleep/wake.
18. **Is the "Diff View" for code edits syntax highlighted?**
    - *UI*: Yes, using `Monaco Editor` diff view.
19. **Does the App support "Keyboard Shortcuts" for everything?**
    - *Accessibility*: Yes, `CommandPalette.tsx` maps actions to keys (Ctrl+K, etc.).
20. **How are "Large File" uploads handled?**
    - *Strategy*: Streamed directly to disk, not loaded into RAM.

## System Integration (Questions 21-30)
21. **How does the App "Detect" if KNEZ is down?**
    - *Healthcheck*: Polling `/health` endpoint every 5s.
22. **Can the App "Restart" the KNEZ backend?**
    - *Control*: Yes, it can spawn/kill the child process.
23. **How does the App "Authenticate" with the MCP Server?**
    - *Security*: Token-based handshake or local pipe permissions.
24. **Can the App "Update" itself?**
    - *Distribution*: Yes, via Tauri Updater (checking GitHub Releases).
25. **Does the App "Log" telemetry to the cloud?**
    - *Privacy*: No. All logs are local in `.taqwin/logs`.
26. **Can the App "Minimize to Tray"?**
    - *OS*: Yes, keeps KNEZ running in background.
27. **How does the App handle "Clipboard" privacy?**
    - *Policy*: Only reads clipboard when user explicitly pastes.
28. **Can multiple Control Apps connect to one KNEZ?**
    - *Architecture*: Yes, KNEZ supports multiple clients via WebSocket.
29. **Is the App "Sandboxed" by the OS?**
    - *Security*: Yes, standard macOS/Windows app sandboxing rules apply.
30. **What is the "Easter Egg" in the Control App?**
    - *Fun*: Konami code might trigger "Matrix Mode".
