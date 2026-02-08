param(
  [string]$LogLevel = "INFO"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$RepoRoot = Resolve-Path (Join-Path $AppDir "..")
$TaqwinDir = Join-Path $RepoRoot "TAQWIN_V1"

if (-not (Test-Path $TaqwinDir)) {
  throw "TAQWIN_V1 folder not found at: $TaqwinDir"
}

$LogFile = Join-Path $TaqwinDir "data\logs\taqwin_v1.log"
[Console]::Error.WriteLine("TAQWIN MCP log file: $LogFile")
[Console]::Error.WriteLine("TAQWIN MCP log level: $LogLevel")

Push-Location $TaqwinDir
try {
  $env:TAQWIN_LOG_LEVEL = $LogLevel
  $env:PYTHONUNBUFFERED = "1"

  $Py = Get-Command py -ErrorAction SilentlyContinue
  if ($Py) {
    & py -3 -u -m core.mcp_server
  } else {
    & python -u -m core.mcp_server
  }
} finally {
  Pop-Location
}

