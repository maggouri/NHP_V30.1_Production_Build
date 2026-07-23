$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root 'server_logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$nodeCommand = Get-Command node -ErrorAction Stop
$env:NHP_CREATY_PORT = '3020'
$outLog = Join-Path $logDir 'creaty-3020.out.log'
$errLog = Join-Path $logDir 'creaty-3020.err.log'

Start-Process `
    -WindowStyle Hidden `
    -FilePath $nodeCommand.Source `
    -ArgumentList 'creaty-server.js' `
    -WorkingDirectory $root `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog | Out-Null

Start-Sleep -Seconds 4
