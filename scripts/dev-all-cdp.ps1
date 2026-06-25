param()

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ScriptsDir = Join-Path $RepoRoot "src-tauri\scripts"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting knez-control-app with CDP ENABLED" -ForegroundColor Green
Write-Host "   Background automation: TRUE (no cursor interference)" -ForegroundColor Green
Write-Host "   CDP Port: 9222" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

# Enable CDP for WebView2
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222 --remote-allow-origins=*"
Write-Host "✅ CDP Environment Variable Set (with remote-allow-origins)" -ForegroundColor Green

Write-Host "`nStarting local stack (Ollama + KNEZ)..." -ForegroundColor Cyan
& "powershell.exe" -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptsDir "start_local_stack.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStarting Tauri dev app with CDP..." -ForegroundColor Cyan
Write-Host "   Verify CDP: http://localhost:9222" -ForegroundColor Yellow
Push-Location $RepoRoot
try {
  & npm run tauri -- dev
} finally {
  Pop-Location
}
