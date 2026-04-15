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
    try {
        Add-Content -Path $LogFile -Value $LogLine -Force -ErrorAction Stop
    } catch {
        # Ignore log file errors, continue with console output
    }
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

# Check port and cleanup existing processes
$portUsed = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portUsed) {
    Log "WARNING: Port 8000 is in use. Cleaning up existing processes..."
    Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*KNEZ*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
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
    
    # Set DEFAULT_MODEL environment variable for LocalBackend
    $env:DEFAULT_MODEL = "qwen2.5:7b-instruct-q4_K_M"
    Log "Set DEFAULT_MODEL: $env:DEFAULT_MODEL"
    
    Log "Starting uvicorn process..."
    
    $proc = Start-Process "uvicorn" -ArgumentList "knez.knez_core.app:app --app-dir . --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow
    Log "Uvicorn process started with ID: $($proc.Id)"
} finally {
    Pop-Location
}

if (-not $proc) {
    Log "ERROR: Failed to start uvicorn process"
    exit 1
}

Log "KNEZ process spawned. Assuming RUNNING."
exit 0
