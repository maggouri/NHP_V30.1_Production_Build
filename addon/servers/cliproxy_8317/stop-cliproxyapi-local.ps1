# Stop CLIProxyAPI local on port 8317.
param(
    [int]$Port = 8317
)

$ErrorActionPreference = 'SilentlyContinue'

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
    Write-Host "CLIProxyAPI is not running on port $Port."
    exit 0
}

$targetIds = [System.Collections.Generic.HashSet[int]]::new()
foreach ($connection in $connections) {
    [void]$targetIds.Add([int]$connection.OwningProcess)
    $proc = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $connection.OwningProcess) -ErrorAction SilentlyContinue
    if ($proc -and $proc.Name -match 'cli-proxy-api') {
        if ($proc.ParentProcessId) { [void]$targetIds.Add([int]$proc.ParentProcessId) }
    }
}

foreach ($targetId in $targetIds) {
    $process = Get-Process -Id $targetId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host ("Stopping PID {0} ({1})" -f $targetId, $process.ProcessName)
        Stop-Process -Id $targetId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Done."
exit 0
