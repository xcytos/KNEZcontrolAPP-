# start-ollama.ps1
# Verifies Ollama installation, starts daemon, and waits for readiness.

Write-Host "Verifying Ollama installation..." -ForegroundColor Cyan

if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Error "Ollama not found in PATH. Please install Ollama from https://ollama.com/"
    exit 1
}

# Check if running
$running = Get-Process "ollama" -ErrorAction SilentlyContinue
if (-not $running) {
    Write-Host "Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 5
} else {
    Write-Host "Ollama is already running." -ForegroundColor Green
}

# Verify readiness
Write-Host "Waiting for Ollama API..." -ForegroundColor Cyan
$retries = 0
$maxRetries = 10
$ready = $false

while ($retries -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -ErrorAction Stop
        $ready = $true
        break
    } catch {
        Write-Host "Waiting for Ollama (attempt $($retries + 1)/$maxRetries)..."
        Start-Sleep -Seconds 2
        $retries++
    }
}

if (-not $ready) {
    Write-Error "Ollama failed to start or is unreachable on port 11434."
    exit 1
}

Write-Host "Ollama is READY." -ForegroundColor Green
exit 0
