# CDP Startup Guide - Background Automation

## Quick Start (Choose One Method)

### Method 1: NPM Script (Recommended)
```bash
npm run dev:all:cdp
```

### Method 2: Direct Script
```powershell
.\start-with-cdp.ps1
```

### Method 3: Manual Command
```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222 --remote-allow-origins=*"
npm run tauri dev
```

## Verify CDP is Active

Open browser: `http://localhost:9222`

You should see JSON with inspectable targets:
```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=localhost:9222/...",
    "id": "...",
    "title": "knez-control-app",
    "type": "page",
    "url": "http://localhost:1420/",
    "webSocketDebuggerUrl": "ws://localhost:9222/..."
  }
]
```

## Test Background Automation

Use Native Windows MCP with CDP backend:

```
Tool: connect_window
Parameters: {
  "app_name": "knez-control-app",
  "backend_strategy": "cdp"
}
```

## Benefits

✅ **ZERO cursor interference** - Your cursor stays free  
✅ **No window popping** - Automation happens in background  
✅ **JavaScript injection** - Direct DOM manipulation  
✅ **Faster execution** - No physical mouse simulation  
✅ **More reliable** - No timing issues with cursor movements

## Troubleshooting

### CDP Not Working
1. Check if port 9222 is available: `netstat -ano | findstr 9222`
2. Verify environment variable: `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`
3. Restart Tauri completely

### "Connection Refused" or "403 Forbidden"
- Make sure app was started AFTER setting environment variable with `--remote-allow-origins=*`
- Check firewall isn't blocking port 9222
- Restart Tauri completely with updated flags

### MCP Still Using PyWinAuto
- Make sure to specify `"backend_strategy": "cdp"` in connect_window
- Verify CDP is active at `http://localhost:9222`

## Scripts Created

| File | Purpose |
|------|---------|
| `start-with-cdp.ps1` | Quick launcher with CDP |
| `scripts/dev-all-cdp.ps1` | Full stack (Ollama + KNEZ + CDP) |
| `npm run dev:all:cdp` | NPM command for full stack with CDP |

## Default Behavior

**Without CDP**: PyWinAuto backend (pops window, moves cursor)  
**With CDP**: True background automation (invisible to user)

---

**Status**: ✅ Ready to use  
**Last Updated**: June 24, 2026
