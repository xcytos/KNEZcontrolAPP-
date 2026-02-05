# start-knez.ps1
# Starts KNEZ uvicorn server and verifies health.

param (
    [string]$KnezRoot = "$PSScriptRoot\..\..\..\KNEZ" # Relative to script location
)

$LogFile = "$env:TEMP\knez-startup.log"
function Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogLine = "[$Timestamp] $Message"
    Write-Host $Message -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value $LogLine -Force
}

Log "Starting KNEZ startup script..."
$KnezPath = Resolve-Path $KnezRoot -ErrorAction SilentlyContinue

if (-not $KnezPath) {
    Log "ERROR: KNEZ root not found at $KnezRoot"
    exit 1
}

Log "Resolved KNEZ path: $($KnezPath.Path)"
$env:PYTHONPATH = $KnezPath.Path
Log "Set PYTHONPATH: $env:PYTHONPATH"

# Check port
$portUsed = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portUsed) {
    Log "WARNING: Port 8000 is in use."
}

# Venv activation
$venvPath = Join-Path $KnezPath.Path ".venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Log "Activating venv at $venvPath"
    . $venvPath
} else {
    Log "No venv found, using system python/uvicorn"
}

# Start uvicorn
Push-Location $KnezPath.Path
try {
    $env:PYTHONPATH = $PWD.Path + ";" + $env:PYTHONPATH
    Log "Final PYTHONPATH: $env:PYTHONPATH"
    Log "Starting uvicorn process..."
    
    $proc = Start-Process "uvicorn" -ArgumentList "knez.knez_core.app:app --app-dir . --host 0.0.0.0 --port 8000 --reload" -PassThru -NoNewWindow
    Log "Uvicorn process started with ID: $($proc.Id)"
} finally {
    Pop-Location
}

if (-not $proc) {
    Log "ERROR: Failed to start uvicorn process"
    exit 1
}

Log "Waiting for /health check..."
$retries = 0
$maxRetries = 15
$ready = $false

while ($retries -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction Stop
        if ($response.status -eq "ok") {
            $ready = $true
            Log "Health check passed!"
            break
        }
    } catch {
        Log "Health check attempt $($retries + 1) failed: $($_.Exception.Message)"
        Start-Sleep -Seconds 2
        $retries++
    }
}

if (-not $ready) {
    Log "ERROR: KNEZ failed to start or /health check failed after retries."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Log "KNEZ is READY."
exit 0
