$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path $root 'api'
$dashboardDir = Join-Path $root 'parking-dashboard'
$printServerDir = Join-Path $root 'print-server'

function Start-NodeProcess {
  param(
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [Parameter(Mandatory=$true)][string]$Command,
    [Parameter(Mandatory=$true)][string]$Title
  )

  Start-Process -FilePath "powershell" -WorkingDirectory $WorkingDirectory -WindowStyle Minimized -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    "Set-Location `"$WorkingDirectory`"; `$host.UI.RawUI.WindowTitle = `"$Title`"; $Command"
  )
}

Start-NodeProcess -WorkingDirectory $apiDir -Title 'MR COCHE - API' -Command 'node .\index.js'
Start-NodeProcess -WorkingDirectory $printServerDir -Title 'MR COCHE - PRINT SERVER' -Command 'node .\index.js'

$distServer = Join-Path $dashboardDir 'dist\parking-dashboard\server\server.mjs'
if (Test-Path $distServer) {
  Start-NodeProcess -WorkingDirectory $dashboardDir -Title 'MR COCHE - DASHBOARD (SSR)' -Command '$env:PORT=4200; node .\dist\parking-dashboard\server\server.mjs'
} else {
  Start-NodeProcess -WorkingDirectory $dashboardDir -Title 'MR COCHE - DASHBOARD (DEV)' -Command 'npm run start -- --port 4200'
}
