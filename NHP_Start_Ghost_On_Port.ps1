param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [int]$MaxWaitSeconds = 120
)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$hidden = Join-Path $root 'Start_Ghost_Server_On_Port_Hidden.cmd'

function Test-NhpGhostPing {
    param([int]$GhostPort)
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:$GhostPort/ping" -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

function Stop-NhpGhostListenerOnPort {
    param([int]$GhostPort)
    $portPattern = (":{0}(\s|$)" -f $GhostPort)
    netstat -ano | ForEach-Object {
        $line = $_.Trim()
        if ($line -match $portPattern -and $line -match 'LISTENING') {
            $procId = ($line -split '\s+')[-1]
            if ($procId -match '^\d+$') {
                $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
                if ($proc -and ($proc.CommandLine -match 'ghost-server\.js')) {
                    Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
    Start-Sleep -Milliseconds 800
}

if (-not (Test-Path -LiteralPath $hidden)) {
    Write-Host "ERROR: $hidden not found" -ForegroundColor Red
    exit 1
}

Stop-NhpGhostListenerOnPort -GhostPort $Port
$p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'call', "`"$hidden`"", "$Port", 'force') -WorkingDirectory $root -WindowStyle Hidden -PassThru
$waitMs = [Math]::Max(5000, [int]($MaxWaitSeconds * 1000))
$exited = $p.WaitForExit($waitMs)
if (-not $exited) {
    Write-Host "WARN: Start_Ghost_Server_On_Port_Hidden.cmd still running after ${MaxWaitSeconds}s for port $Port (continuing ping wait)." -ForegroundColor Yellow
} elseif ($p.ExitCode -ne 0) {
    Write-Host "WARN: Start_Ghost_Server_On_Port_Hidden.cmd exited with code $($p.ExitCode) for port $Port." -ForegroundColor Yellow
}

$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
while ((Get-Date) -lt $deadline) {
    if (Test-NhpGhostPing -GhostPort $Port) { exit 0 }
    Start-Sleep -Seconds 2
}

Write-Host "WARN: Ghost on port $Port did not respond to /ping within ${MaxWaitSeconds}s." -ForegroundColor Yellow
exit 1