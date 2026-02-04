# start-stack.ps1
# Master script to orchestrate local stack bring-up.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = "$ScriptDir\stack-startup.log"

function Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogLine = "[$Timestamp] $Message"
    Write-Host $Message -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value $LogLine -Force
}

Log "=== KNEZ LOCAL STACK ORCHESTRATION ==="

# 1. Start Ollama
Log "[1/2] Starting Ollama..."
& "$ScriptDir\start-ollama.ps1"
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: Ollama startup failed with exit code $LASTEXITCODE"
    exit 1
}

# 2. Start KNEZ
Log "[2/2] Starting KNEZ..."
& "$ScriptDir\start-knez.ps1"
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: KNEZ startup failed with exit code $LASTEXITCODE"
    exit 1
}

Log "=== STACK READY ==="
Log "Ollama: http://localhost:11434"
Log "KNEZ:   http://localhost:8000"
exit 0
