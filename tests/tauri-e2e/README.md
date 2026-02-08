# Tauri E2E

This suite launches the desktop app in dev mode and attaches Playwright via WebView2 CDP.

## Prerequisites
- KNEZ reachable at `http://127.0.0.1:8000/health` (the runner will reuse it, or attempt to spawn it).
- Windows: WebView2 installed (required for CDP).

## Run
- `npm run e2e:tauri`

## Notes
- The runner will terminate any process listening on ports `5173` (Vite) and `9222` (CDP) before starting, to reduce flakiness on Windows.
