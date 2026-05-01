# ensure_ollama.ps1
# Zero-tolerance Ollama installation and verification script

param(
    [string]$InstallPath = "$env:USERPROFILE\ollama",
    [string]$Version = "latest",
    [switch]$Force = $false
)

Write-Host "=== OLLAMA ZERO-TOLERANCE INSTALLATION ===" -ForegroundColor Cyan
Write-Host "Install Path: $InstallPath"
Write-Host "Version: $Version"
Write-Host "Force Install: $Force"
Write-Host ""

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to download file with retry
function Download-WithRetry {
    param(
        [string]$Url,
        [string]$OutputPath,
        [int]$MaxRetries = 3,
        [int]$RetryDelay = 2000
    )
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            Write-Host "Downloading... (Attempt $i/$MaxRetries)"
            Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing -TimeoutSec 300
            if (Test-Path $OutputPath) {
                $size = (Get-Item $OutputPath).Length
                Write-Host "Download successful: $([math]::Round($size / 1MB, 2)) MB"
                return $true
            }
        } catch {
            Write-Warning "Download attempt $i failed: $($_.Exception.Message)"
            if ($i -lt $MaxRetries) {
                Write-Host "Retrying in $RetryDelay ms..."
                Start-Sleep -Milliseconds $RetryDelay
            }
        }
    }
    return $false
}

# Function to add to PATH permanently
function Add-ToPath {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return $false
    }
    
    # Get current PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    
    # Check if already in PATH
    if ($currentPath -split ";" -contains $Path) {
        Write-Host "Path already in PATH: $Path" -ForegroundColor Green
        return $true
    }
    
    # Add to PATH
    $newPath = $currentPath + ";" + $Path
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    
    # Update current session
    $env:PATH = $newPath
    
    Write-Host "Added to PATH: $Path" -ForegroundColor Green
    return $true
}

# Function to verify Ollama installation
function Test-OllamaInstallation {
    try {
        $result = & ollama --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Ollama verified: $result" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Warning "Ollama verification failed: $($_.Exception.Message)"
    }
    return $false
}

# Function to start Ollama service
function Start-OllamaService {
    Write-Host "Starting Ollama service..." -ForegroundColor Yellow
    
    # Check if already running
    $running = Get-Process "ollama" -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "Ollama already running (PID: $($running.Id))" -ForegroundColor Green
        return $true
    }
    
    # Start Ollama
    try {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -PassThru | Out-Null
        Write-Host "Ollama service started" -ForegroundColor Green
        
        # Wait for service to be ready
        $maxWait = 30
        for ($i = 1; $i -le $maxWait; $i++) {
            try {
                $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
                Write-Host "Ollama service ready after ${i}s" -ForegroundColor Green
                return $true
            } catch {
                Write-Host "Waiting for Ollama service... ($i/$maxWait)"
                Start-Sleep -Seconds 1
            }
        }
        
        Write-Warning "Ollama service failed to start within ${maxWait}s"
        return $false
    } catch {
        Write-Error "Failed to start Ollama service: $($_.Exception.Message)"
        return $false
    }
}

# STEP 1: Check if Ollama is already installed and working
Write-Host "STEP 1: Checking existing Ollama installation..." -ForegroundColor Cyan
if (-not $Force -and (Test-OllamaInstallation)) {
    Write-Host "Ollama already installed and working" -ForegroundColor Green
    if (Start-OllamaService) {
        Write-Host "Ollama service ready" -ForegroundColor Green
        exit 0
    } else {
        Write-Warning "Ollama installed but service failed to start, proceeding with reinstall..."
        $Force = $true
    }
}

# STEP 2: Create installation directory
Write-Host "STEP 2: Preparing installation directory..." -ForegroundColor Cyan
if (-not (Test-Path $InstallPath)) {
    try {
        New-Item -Path $InstallPath -ItemType Directory -Force | Out-Null
        Write-Host "Created installation directory: $InstallPath" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create installation directory: $($_.Exception.Message)"
        exit 1
    }
}

# STEP 3: Download Ollama
Write-Host "STEP 3: Downloading Ollama..." -ForegroundColor Cyan

# Determine download URL
if ($Version -eq "latest") {
    # Get latest release from GitHub API
    try {
        Write-Host "Fetching latest version information..."
        $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/ollama/ollama/releases/latest" -UseBasicParsing
        $Version = $releaseInfo.tag_name.TrimStart('v')
        Write-Host "Latest version: $Version"
    } catch {
        Write-Warning "Failed to fetch latest version, using fallback v0.1.47"
        $Version = "0.1.47"
    }
}

$downloadUrl = "https://github.com/ollama/ollama/releases/download/v${Version}/ollama-windows-amd64.zip"
$zipPath = Join-Path $InstallPath "ollama-windows-amd64.zip"
$extractPath = Join-Path $InstallPath "extracted"

Write-Host "Download URL: $downloadUrl"
Write-Host "Local Path: $zipPath"

# Download with retry
if (-not (Download-WithRetry -Url $downloadUrl -OutputPath $zipPath)) {
    Write-Error "Failed to download Ollama after multiple attempts"
    exit 1
}

# STEP 4: Extract Ollama
Write-Host "STEP 4: Extracting Ollama..." -ForegroundColor Cyan
try {
    # Remove old extraction if exists
    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force
    }
    
    # Extract
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    # Move executable to install path
    $exeSource = Join-Path $extractPath "ollama.exe"
    $exeTarget = Join-Path $InstallPath "ollama.exe"
    
    if (Test-Path $exeSource) {
        Move-Item -Path $exeSource -Destination $exeTarget -Force
        Write-Host "Ollama executable extracted to: $exeTarget" -ForegroundColor Green
    } else {
        Write-Error "Ollama executable not found in extracted archive"
        exit 1
    }
    
    # Cleanup
    Remove-Item -Path $zipPath -Force
    Remove-Item -Path $extractPath -Recurse -Force
    
} catch {
    Write-Error "Failed to extract Ollama: $($_.Exception.Message)"
    exit 1
}

# STEP 5: Add to PATH
Write-Host "STEP 5: Adding to PATH..." -ForegroundColor Cyan
if (-not (Add-ToPath -Path $InstallPath)) {
    Write-Error "Failed to add Ollama to PATH"
    exit 1
}

# STEP 6: Verify installation
Write-Host "STEP 6: Verifying installation..." -ForegroundColor Cyan
if (Test-OllamaInstallation) {
    Write-Host "Ollama installation verified" -ForegroundColor Green
} else {
    Write-Error "Ollama installation verification failed"
    exit 1
}

# STEP 7: Start service
Write-Host "STEP 7: Starting Ollama service..." -ForegroundColor Cyan
if (Start-OllamaService) {
    Write-Host "Ollama service started and ready" -ForegroundColor Green
} else {
    Write-Warning "Ollama installed but service failed to start"
    exit 1
}

Write-Host ""
Write-Host "=== OLLAMA INSTALLATION COMPLETE ===" -ForegroundColor Green
Write-Host "Ollama installed at: $InstallPath"
Write-Host "Added to PATH"
Write-Host "Service running on http://localhost:11434"
Write-Host "Ready for use"
Write-Host ""

exit 0
