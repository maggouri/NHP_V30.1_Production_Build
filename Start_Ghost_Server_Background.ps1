param()

$ErrorActionPreference = 'Stop'

function Test-GhostPing {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3019/ping' -TimeoutSec 3
        return ($response.Content -match '"ok"\s*:\s*true')
    } catch {
        return $false
    }
}

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host '========================================'
Write-Host '   Ghost Server Background Start'
Write-Host '========================================'
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[ERROR] Node.js is not available in PATH.'
    exit 1
}

if (Test-GhostPing) {
    Write-Host '[OK] Ghost Server is already running on port 3019.'
    exit 0
}

Write-Host '[INFO] Starting TeePublic Ghost (3019) in the background...'
$portLauncher = Join-Path $projectDir 'Start_Ghost_Server_On_Port_Hidden.cmd'
Start-Process -FilePath $portLauncher -ArgumentList @('3019') -WorkingDirectory $projectDir -WindowStyle Hidden

for ($i = 0; $i -lt 12; $i += 1) {
    Start-Sleep -Seconds 1
    if (Test-GhostPing) {
        Write-Host '[SUCCESS] Ghost Server is now running in the background.'
        exit 0
    }
}

Write-Host '[ERROR] Could not confirm Ghost Server startup.'
Write-Host 'Check: server_logs\server.log'
exit 1
