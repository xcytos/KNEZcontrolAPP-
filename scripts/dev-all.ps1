param()

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ScriptsDir = Join-Path $RepoRoot "src-tauri\scripts"

Write-Host "Starting local stack (Ollama + KNEZ)..." -ForegroundColor Cyan
& "powershell.exe" -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptsDir "start_local_stack.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starting Tauri dev app..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  & npm run tauri -- dev
} finally {
  Pop-Location
}

