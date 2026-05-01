# start-ollama.ps1
# Zero-tolerance Ollama verification and startup

Write-Host "=== OLLAMA ZERO-TOLERANCE STARTUP ===" -ForegroundColor Cyan

# Check if Ollama is available, if not, check common installation paths
$ollamaPath = $null
$foundInPath = $false

# First check if in PATH
if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
    $foundInPath = $true
    Write-Host "Ollama found in PATH" -ForegroundColor Green
} else {
    # Check common installation paths
    $commonPaths = @(
        "$env:USERPROFILE\AppData\Local\Programs\Ollama\ollama.exe",
        "C:\Program Files\Ollama\ollama.exe",
        "C:\Program Files (x86)\Ollama\ollama.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $ollamaPath = $path
            Write-Host "Found Ollama at: $path" -ForegroundColor Green
            break
        }
    }
    
    if (-not $ollamaPath -and -not $foundInPath) {
        Write-Host "Ollama not found, initiating auto-installation..." -ForegroundColor Yellow
        
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
                Write-Host "Auto-installation completed" -ForegroundColor Green
                $foundInPath = $true
            } catch {
                Write-Error "Auto-installation failed: $($_.Exception.Message)"
                exit 1
            }
        } else {
            Write-Error "Auto-installation script not found: $ensureScript"
            exit 1
        }
    }
}

# Check if running
$running = Get-Process "ollama" -ErrorAction SilentlyContinue
if (-not $running) {
    Write-Host "Starting Ollama..." -ForegroundColor Yellow
    
    # Use the found path or default command
    if ($ollamaPath) {
        Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
    } else {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    }
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
