# CLIProxyAPI local status on port 8317.
param([int]$Port = 8317)

$ErrorActionPreference = 'SilentlyContinue'
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/v1/models" -Headers @{ Authorization = 'Bearer nhp-local-cliproxy-key' } -TimeoutSec 4 -UseBasicParsing
    if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        Write-Host "[OK] CLIProxyAPI local (port $Port)"
        exit 0
    }
} catch {}

$tcp = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($tcp) {
    Write-Host "[WARN] Port $Port is listening but /v1/models did not respond"
    exit 2
}

Write-Host "[OFF] CLIProxyAPI local (port $Port)"
exit 1
