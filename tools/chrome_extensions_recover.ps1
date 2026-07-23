$ErrorActionPreference = 'Continue'

Write-Host '=== Chrome Extensions Recovery ===' -ForegroundColor Cyan

try {
    $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction Stop
} catch {
    Write-Host "Cannot query chrome processes: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$bad = @()
foreach ($pr in $procs) {
    $cl = [string]$pr.CommandLine
    if ($cl -match '--disable-extensions(?!-file-access-check)' -or $cl -match '--disable-extensions-except=') {
        $bad += $pr
    }
}

if ($bad.Count -eq 0) {
    Write-Host 'No restrictive Chrome flags found on running processes.' -ForegroundColor Green
} else {
    Write-Host "Restrictive Chrome processes found: $($bad.Count)" -ForegroundColor Yellow
    foreach ($b in $bad) {
        Write-Host "Stopping PID $($b.ProcessId) ..."
        try {
            Stop-Process -Id $b.ProcessId -Force -ErrorAction Stop
            Write-Host "  stopped" -ForegroundColor Green
        } catch {
            Write-Host "  failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Start-Sleep -Milliseconds 800

try {
    $chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
    if (-not (Test-Path $chromePath)) {
        $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
    }
    if (-not (Test-Path $chromePath)) {
        throw 'Chrome executable not found'
    }
    Start-Process -FilePath $chromePath -ArgumentList @('--profile-directory=Default','chrome://extensions/') | Out-Null
    Write-Host 'Launched Chrome Default profile to extensions page.' -ForegroundColor Green
} catch {
    Write-Host "Failed to launch Chrome: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host '=== Recovery script finished ===' -ForegroundColor Cyan
