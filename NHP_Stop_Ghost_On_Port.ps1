param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = 'SilentlyContinue'

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/shutdown" -Method POST -TimeoutSec 3 | Out-Null
    Start-Sleep -Milliseconds 800
} catch {}

$portPattern = (":{0}(\s|$)" -f $Port)
$stopped = $false
netstat -ano | ForEach-Object {
    $line = $_.Trim()
    if ($line -match $portPattern -and $line -match 'LISTENING') {
        $procId = ($line -split '\s+')[-1]
        if ($procId -match '^\d+$') {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
            if ($proc -and ($proc.CommandLine -match 'ghost-server\.js')) {
                Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
                Write-Host "[OK]   Ghost stopped on port $Port (PID $procId)" -ForegroundColor Green
                $stopped = $true
            }
        }
    }
}

if (-not $stopped) {
    Write-Host "[INFO] No Ghost listener on port $Port" -ForegroundColor Yellow
}
exit 0
