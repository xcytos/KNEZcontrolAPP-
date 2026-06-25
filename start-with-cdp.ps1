#!/usr/bin/env pwsh
# Quick launcher for knez-control-app with CDP enabled

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  KNEZ Control App - CDP Mode (Background Automation)        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Enabling CDP for WebView2..." -ForegroundColor Yellow
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222 --remote-allow-origins=*"
Write-Host "✅ CDP Port: 9222 (with remote-allow-origins)" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Verify CDP is active:" -ForegroundColor Yellow
Write-Host "   http://localhost:9222" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Starting Tauri app..." -ForegroundColor Yellow
Write-Host ""

npm run tauri dev
