# Tauri E2E

This suite launches the desktop app in dev mode and runs Playwright tests via WebView2 CDP.

## Prerequisites
- KNEZ reachable at `http://127.0.0.1:8000/health` (the runner will reuse it, or attempt to spawn it).
- Windows: WebView2 installed (required for CDP).

## Run
- `npm run e2e:tauri`
- If you already have the desktop app running, reuse it with:
  - `TAURI_CDP_URL=http://127.0.0.1:<port> npm run e2e:tauri`
  - or `TAURI_REUSE=1 npm run e2e:tauri` (reuses the last successful CDP URL saved by the runner)

## Notes
- The runner will terminate any process listening on port `5173` (Vite) and the chosen CDP port before starting, to reduce flakiness on Windows.
- You can pin the CDP port via `TAURI_CDP_PORT` if needed for debugging.
