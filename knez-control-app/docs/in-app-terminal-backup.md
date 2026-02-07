# In‑App Terminal (Backup) — Starting KNEZ Safely

This app includes a small in‑app terminal as a safety backup in case the normal Start/Force Start flow is stuck.

## Open the Console

1. Launch the desktop (Tauri) app.
2. Click the floating **terminal button** at the bottom-right.
3. Switch to the **Terminal** tab.

## Allowed Commands (Safe List)

The in‑app terminal intentionally runs only a small allow‑listed set of commands:

- **Start Local Stack**: starts Ollama + KNEZ together
- **Start KNEZ**: starts only KNEZ (FastAPI/Uvicorn)
- **Start Ollama**: starts only Ollama
- **Verify Delivery**: runs a delivery verification script
- **Stop Python (taskkill)**: stops Python processes (use only if a launch is stuck)
- **PowerShell (custom)**: runs a custom PowerShell command (advanced / dev use)

## Recommended Recovery Steps

### A) Normal “stuck starting” recovery

1. Run **Stop Python (taskkill)**.
2. Run **Start Local Stack**.
3. Wait until you see the stack report readiness in output.
4. Open **Settings → Connection** and press **Check Health**.

### B) If Ollama is already running

1. Run **Start KNEZ**.
2. Then **Settings → Connection → Check Health**.

### C) If KNEZ is running but UI won’t connect

1. Open **Settings → Connection**.
2. Confirm the endpoint is `http://localhost:8000`.
3. Press **Check Health**.
4. If it fails, run **Verify Delivery** in the terminal and review the output.

## Notes

- This terminal is only available in the desktop app. Web mode cannot spawn local processes.
- Use the “Stop Python” option carefully. It can terminate unrelated Python processes.
