# Comprehensive Chrome extension audit (Default profile + running processes)
$ErrorActionPreference = 'Continue'
$base = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
$def = Join-Path $base 'Default'
$localStatePath = Join-Path $base 'Local State'
$prefsPath = Join-Path $def 'Preferences'
$extDir = Join-Path $def 'Extensions'

Write-Host '=== NHP Chrome Extension Audit ===' -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format o)"

Write-Host "`n-- Local State / profile identity --" -ForegroundColor Yellow
if (-not (Test-Path $localStatePath)) {
    Write-Host "MISSING Local State: $localStatePath" -ForegroundColor Red
} else {
    try {
        $ls = Get-Content $localStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $info = $ls.profile.info_cache.Default
        Write-Host "Default user_name: $($info.user_name)"
        Write-Host "Default gaia_name: $($info.gaia_name)"
    } catch {
        Write-Host "Failed parsing Local State: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n-- Default profile paths --" -ForegroundColor Yellow
Write-Host "Preferences exists: $(Test-Path $prefsPath)"
Write-Host "Extensions dir exists: $(Test-Path $extDir)"

if (Test-Path $extDir) {
    $dirs = Get-ChildItem $extDir -Directory -ErrorAction SilentlyContinue
    Write-Host "Extension package folder count: $($dirs.Count)"
}

Write-Host "`n-- Preferences.extensions.settings --" -ForegroundColor Yellow
if (-not (Test-Path $prefsPath)) {
    Write-Host 'No Preferences file.' -ForegroundColor Red
} else {
    try {
        $raw = Get-Content $prefsPath -Raw -Encoding UTF8
        $j = $raw | ConvertFrom-Json
        $set = $j.extensions.settings
        if (-not $set) {
            Write-Host 'No extensions.settings key (unexpected if extensions installed).' -ForegroundColor Red
        } else {
            $props = @($set.PSObject.Properties)
            Write-Host "Registered extension entries: $($props.Count)"
            $state0 = 0
            $state1 = 0
            $other = 0
            $blocked = @()
            foreach ($p in $props) {
                $o = $p.Value
                $st = $o.state
                if ($null -eq $st) { $other++ ; continue }
                switch ([int]$st) {
                    0 { $state0++ ; $blocked += $p.Name }
                    1 { $state1++ }
                    default { $other++ }
                }
            }
            Write-Host "state=1 (enabled convention): $state1"
            Write-Host "state=0 (disabled convention): $state0"
            Write-Host "other/null state: $other"
            if ($blocked.Count -gt 0 -and $blocked.Count -le 25) {
                Write-Host 'Disabled IDs:' ($blocked -join ', ')
            } elseif ($blocked.Count -gt 25) {
                Write-Host "Disabled IDs (first 25):" (($blocked | Select-Object -First 25) -join ', ')
            }
        }

        $alerts = $j.extensions.alerts
        if ($alerts) {
            Write-Host "`nextensions.alerts present (may indicate corruption/disable):" -ForegroundColor DarkYellow
            Write-Host ($alerts | ConvertTo-Json -Compress -Depth 4).Substring(0, [Math]::Min(400, (($alerts | ConvertTo-Json -Compress -Depth 4).Length)))
        }
    } catch {
        Write-Host "Preferences parse failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n-- Secure Preferences.extensions.settings --" -ForegroundColor Yellow
$securePrefsPath = Join-Path $def 'Secure Preferences'
if (-not (Test-Path $securePrefsPath)) {
    Write-Host 'No Secure Preferences file.' -ForegroundColor Red
} else {
    try {
        $secureRaw = Get-Content $securePrefsPath -Raw -Encoding UTF8
        $secureJson = $secureRaw | ConvertFrom-Json
        $secureSettings = $secureJson.extensions.settings
        if (-not $secureSettings) {
            Write-Host 'No extensions.settings in Secure Preferences.' -ForegroundColor Red
        } else {
            $secureProps = @($secureSettings.PSObject.Properties)
            Write-Host "Secure Preferences extension entries: $($secureProps.Count)"
        }
    } catch {
        Write-Host "Secure Preferences parse failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n-- Running chrome.exe command lines (disable-extensions scan) --" -ForegroundColor Yellow
try {
    $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction Stop
    $bad = @()
    foreach ($pr in $procs) {
        $cl = [string]$pr.CommandLine
        if ($cl -match '--disable-extensions(?!-file-access-check)') { $bad += $pr.ProcessId }
        if ($cl -match '--disable-extensions-except=') { $bad += $pr.ProcessId }
    }
    $bad = $bad | Sort-Object -Unique
    Write-Host "chrome.exe process count: $($procs.Count)"
    if ($bad.Count -eq 0) {
        Write-Host 'No --disable-extensions / --disable-extensions-except on running Chrome PIDs.' -ForegroundColor Green
    } else {
        Write-Host "WARNING: restrictive extension flags on PIDs: $($bad -join ', ')" -ForegroundColor Red
        $procs | Where-Object { $bad -contains $_.ProcessId } | Select-Object -First 8 ProcessId, CommandLine | ForEach-Object {
            Write-Host "PID $($_.ProcessId):" $_.CommandLine.Substring(0, [Math]::Min(240, $_.CommandLine.Length))
        }
    }
} catch {
    Write-Host "Process query failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== End audit ===" -ForegroundColor Cyan

Write-Host "`n-- Potential launcher sources (Direct/swapper) --" -ForegroundColor Yellow
try {
    $runKeys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'
    )
    foreach ($rk in $runKeys) {
        if (-not (Test-Path $rk)) { continue }
        $item = Get-ItemProperty $rk -ErrorAction SilentlyContinue
        if (-not $item) { continue }
        $props = $item.PSObject.Properties | Where-Object {
            $_.Name -notmatch '^PS(Path|ParentPath|ChildName|Drive|Provider)$'
        }
        foreach ($p in $props) {
            $v = [string]$p.Value
            if ($v -match 'Direct\\swapper|disable-extensions-except|ProgramData\\Direct') {
                Write-Host "RunKey hit: $rk -> $($p.Name) = $v" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "Run key scan failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
        $_.TaskName -match 'direct|swapper|chrome' -or $_.TaskPath -match 'direct|swapper'
    }
    foreach ($t in $tasks) {
        $ti = $t | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue
        $xml = [string]([xml](Export-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction SilentlyContinue)).OuterXml
        if ($xml -match 'Direct\\swapper|disable-extensions-except|ProgramData\\Direct') {
            Write-Host "ScheduledTask hit: $($t.TaskPath)$($t.TaskName)" -ForegroundColor Red
            if ($ti) { Write-Host "  LastRun: $($ti.LastRunTime)  NextRun: $($ti.NextRunTime)" }
        }
    }
} catch {
    Write-Host "Scheduled task scan failed: $($_.Exception.Message)" -ForegroundColor Red
}
