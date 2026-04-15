# CDP Enablement for Tauri WebView2

## Correct Method (Production-Ready)

Use environment variable, NOT config file:

```bash
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run tauri dev
```

## Why Environment Variable?

- **Officially supported** by WebView2 for remote debugging
- **Stable** - avoids WebView freezing issues known with additionalBrowserArguments in config
- **Portable** - works across different Tauri v2 configurations
- **Safe** - doesn't modify app configuration files

## Incorrect Method (Do Not Use)

```json
"app": {
  "windows": [
    {
      "webview": {
        "webview2": {
          "additionalBrowserArguments": "--remote-debugging-port=9222"
        }
      }
    }
  ]
}
```

**Why this is risky:**
- Not guaranteed to work in Tauri v2
- Can break WebViews
- Known issues with WebView freezing

## CDP Endpoint

Once enabled, CDP is accessible at:
- **Endpoint:** http://localhost:9222
- **Targets:** http://localhost:9222/json
- **Protocol:** Chrome DevTools Protocol

## Verification

To verify CDP is running:

```bash
curl http://localhost:9222/json
```

Expected response: JSON array with WebView2 targets

## Development Workflow

```bash
# Enable CDP and start Tauri dev
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run tauri dev

# In another terminal, verify CDP is available
curl http://localhost:9222/json
```

## Production Deployment

For production builds, CDP should be disabled for security:

```bash
# Production (no CDP)
npm run tauri build
```

CDP is only for development/testing environments.
