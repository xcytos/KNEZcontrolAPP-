## NEXTPLAN (CP7-16 → CP7-30)

### Major (Architecture & Security)
- **CP7-16**: Implement secure backend authentication (API Key / JWT) to lock down KNEZ port.
- **CP7-17**: Integrate real local LLM (Ollama) binding verification in Health Check.
- **CP7-18**: Implement full offline-first memory sync (SQLite on Desktop -> KNEZ).
- **CP7-19**: Add "Safe Mode" boot option (disable all agents/MCPs on startup).
- **CP7-20**: Implement automated backup of .taqwin and KNEZ data before updates.

### Minor (Features & UX)
- **CP7-21**: Add "Network Graph" view for MCP resource relationships.
- **CP7-22**: Implement drag-and-drop file ingestion into Chat (mapped to MCP filesystem).
- **CP7-23**: Add keyboard shortcuts for common actions (Launch, Stop, Clear Chat).
- **CP7-24**: Improve log viewer with search/filter regex support.
- **CP7-25**: Add "Presence" indicator to system tray (Red/Green dot).

### Micro (Polish & Fixes)
- **CP7-26**: Fix scroll jitter in ChatPane during high-speed streaming.
- **CP7-27**: Add tooltip explanations for all governance controls.
- **CP7-28**: Persist "Sidebar collapsed" state preference.
- **CP7-29**: Standardize error toast messages with error codes.
- **CP7-30**: Optimize startup time by parallelizing health check and UI hydration.
