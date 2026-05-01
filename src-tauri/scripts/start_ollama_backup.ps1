# start-ollama.ps1
# Zero-tolerance Ollama verification and startup

Write-Host "=== OLLAMA ZERO-TOLERANCE STARTUP ===" -ForegroundColor Cyan

# Check if Ollama is available, if not, auto-install
if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama not found in PATH, initiating auto-installation..." -ForegroundColor Yellow
    
    # Run the ensure_ollama script
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ensureScript = Join-Path $scriptDir "ensure_ollama.ps1"
    
    if (Test-Path $ensureScript) {
        Write-Host "Running auto-installation script..."
        try {
            & $ensureScript
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Auto-installation failed"
                exit 1
            }
            Write-Host "✓ Auto-installation completed" -ForegroundColor Green
        } catch {
            Write-Error "Auto-installation failed: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-Error "Auto-installation script not found: $ensureScript"
        exit 1
    }
} else {
    Write-Host "✓ Ollama found in PATH" -ForegroundColor Green
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
