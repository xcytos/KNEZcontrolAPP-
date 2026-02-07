param()

$ErrorActionPreference = "Stop"

function Log($msg) {
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Output "[$ts] $msg"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$RepoRoot = Resolve-Path (Join-Path $AppDir "..")
$TaqwinDir = Join-Path $RepoRoot "TAQWIN_V1"

if (-not (Test-Path $TaqwinDir)) {
  throw "TAQWIN_V1 folder not found at: $TaqwinDir"
}

Push-Location $TaqwinDir
try {
  Log "Starting TAQWIN MCP server (core/mcp_server.py)..."
  & python -u ".\core\mcp_server.py"
} finally {
  Pop-Location
}
