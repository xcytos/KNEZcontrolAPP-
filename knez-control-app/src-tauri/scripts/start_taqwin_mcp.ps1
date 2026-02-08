param()

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$RepoRoot = Resolve-Path (Join-Path $AppDir "..")
$ConfigPath = Join-Path $AppDir "src-tauri\mcp\mcp.config.json"

if (-not (Test-Path $ConfigPath)) {
  throw "MCP config not found at: $ConfigPath"
}

try {
  $CfgRaw = Get-Content -Raw -Path $ConfigPath -Encoding UTF8
  $Cfg = $CfgRaw | ConvertFrom-Json
} catch {
  throw "Failed to parse MCP config: $ConfigPath"
}

$DefaultKey = "taqwin-v1-ultimate-session"
$Servers = $Cfg.servers
if (-not $Servers) {
  $Servers = $Cfg
} else {
  $Schema = [string]$Cfg.schema_version
  if ($Schema -and $Schema -ne "1") {
    throw "Unsupported MCP config schema_version: $Schema"
  }
}

$SelectedKey = $DefaultKey
if (-not ($Servers.PSObject.Properties.Name -contains $SelectedKey)) {
  $SelectedKey = $Servers.PSObject.Properties[0].Name
}
if (-not $SelectedKey) {
  throw "MCP config has no entries: $ConfigPath"
}

$Entry = $Servers.$SelectedKey
$Cmd = [string]$Entry.command
$Args = @()
if ($Entry.args) {
  $Args = @($Entry.args | ForEach-Object { [string]$_ })
}

$WorkingDir = [string]$Entry.working_directory
if (-not $WorkingDir) {
  throw "MCP config entry missing working_directory: $SelectedKey"
}
if (-not ([System.IO.Path]::IsPathRooted($WorkingDir))) {
  $WorkingDir = Join-Path $RepoRoot $WorkingDir
}
if (-not (Test-Path $WorkingDir)) {
  throw "MCP working directory not found: $WorkingDir"
}

if ($Entry.env) {
  foreach ($p in $Entry.env.PSObject.Properties) {
    $envName = [string]$p.Name
    $envValue = [string]$p.Value
    if ($envName) {
      Set-Item -Path "Env:$envName" -Value $envValue
    }
  }
}

if (-not $Cmd) {
  throw "MCP config entry missing command: $SelectedKey"
}

Push-Location $WorkingDir
try {
  & $Cmd @Args
} finally {
  Pop-Location
}
