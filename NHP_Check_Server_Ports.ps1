# Used by NHP_Start_All_Servers.bat and NHP_Restart_All_Servers.bat (-WaitForAll).

param(
    [switch]$WaitForAll,
    [int]$MaxWaitSeconds = 120
)

$ErrorActionPreference = 'SilentlyContinue'

$checks = @(
    @{ Port = 3019; Label = 'TeePublic Ghost' },
    @{ Port = 3020; Label = 'Creaty Signup' },
    @{ Port = 3021; Label = 'Redbubble Ghost' },
    @{ Port = 3022; Label = 'Amazon Ghost' },
    @{ Port = 3023; Label = 'Pinterest Ghost' },
    @{ Port = 3024; Label = 'Creaty Workflow Ghost' },
    @{ Port = 3031; Label = 'AI Bridge' },
    @{ Port = 8317; Label = 'CLIProxyAPI Local' }
)

function Test-NhpCliProxyPing {
    param([int]$Port)
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/v1/models" -Headers @{ Authorization = 'Bearer nhp-local-cliproxy-key' } -TimeoutSec 4 -UseBasicParsing
        return $true
    } catch {
        try {
            $null = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ping" -TimeoutSec 3
            return $true
        } catch {
            return $false
        }
    }
}

function Test-NhpServerPing {
    param([int]$Port)
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ping" -TimeoutSec 3
        return $true
    } catch {
        return $false
    }
}

function Test-NhpPortOnline {
    param([int]$Port)
    if ($Port -eq 8317) { return Test-NhpCliProxyPing -Port $Port }
    return Test-NhpServerPing -Port $Port
}

if ($WaitForAll) {
    $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $allUp = $true
        foreach ($item in $checks) {
            if (-not (Test-NhpPortOnline -Port $item.Port)) {
                $allUp = $false
                break
            }
        }
        if ($allUp) { break }
        Start-Sleep -Seconds 2
    }
}

$ok = 0
$failed = @()
foreach ($item in $checks) {
    $p = $item.Port
    $label = $item.Label
    $online = Test-NhpPortOnline -Port $p
    if ($online) {
        Write-Host "[OK]   $label (port $p)" -ForegroundColor Green
        $ok += 1
    } else {
        Write-Host "[OFF]  $label (port $p)" -ForegroundColor Yellow
        $failed += "$label ($p)"
    }
}
Write-Host ""
if ($ok -eq $checks.Count) {
    Write-Host "All $($checks.Count) servers are online." -ForegroundColor Green
} else {
    Write-Host "$ok / $($checks.Count) servers responded. Check server_logs if some are OFF." -ForegroundColor Yellow
    if ($failed.Count) {
        Write-Host ("Failed: " + ($failed -join ' | ')) -ForegroundColor Yellow
    }
}