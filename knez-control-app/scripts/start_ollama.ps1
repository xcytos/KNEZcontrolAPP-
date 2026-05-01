# Start Ollama server script
# This script starts Ollama in the background

Write-Host "Starting Ollama server..."

# Check if Ollama is already running
$ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if ($ollamaProcess) {
    Write-Host "Ollama is already running (PID: $($ollamaProcess.Id))"
    exit 0
}

# Try to find Ollama installation
$ollamaPaths = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "$env:PROGRAMFILES\Ollama\ollama.exe",
    "ollama.exe"
)

$ollamaExe = $null
foreach ($path in $ollamaPaths) {
    if (Test-Path $path) {
        $ollamaExe = $path
        break
    }
}

if (-not $ollamaExe) {
    Write-Error "Ollama executable not found. Please install Ollama first."
    exit 1
}

Write-Host "Found Ollama at: $ollamaExe"

# Start Ollama server
try {
    Start-Process -FilePath $ollamaExe -ArgumentList "serve" -NoNewWindow -PassThru
    Write-Host "Ollama server started successfully"
} catch {
    Write-Error "Failed to start Ollama: $_"
    exit 1
}
