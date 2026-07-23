# Start CLIProxyAPI local (hidden) on port 8317 for NHP addon backup.
param(
    [int]$Port = 8317,
    [int]$MaxWaitSeconds = 75
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# servers\cliproxy_8317 -> addon
$addonDir = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$projectRoot = Split-Path -Parent $addonDir
. (Join-Path $projectRoot 'utils\nhp-portable-paths.ps1')
$portable = Set-NhpPortableEnv -AppRoot $projectRoot
$localDir = Join-Path $addonDir 'cliproxyapi-local'
$logDir = $portable.LogDir
$tmpDir = Join-Path $portable.DataRoot '.tmp'
$outLog = Join-Path $logDir 'cliproxy-8317.out.log'
$errLog = Join-Path $logDir 'cliproxy-8317.err.log'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir | Out-Null }
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }

function Test-CliProxyListening {
    param([int]$ListenPort)
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:$ListenPort/v1/models" -Headers @{ Authorization = 'Bearer nhp-local-cliproxy-key' } -TimeoutSec 3
        return $true
    } catch {
        try {
            $tcp = Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue
            return [bool]$tcp
        } catch {
            return $false
        }
    }
}

if (Test-CliProxyListening -ListenPort $Port) {
    Write-Host "[OK] CLIProxyAPI already listening on port $Port"
    exit 0
}

$exeCandidates = @(
    (Join-Path $localDir 'cli-proxy-api.exe'),
    (Join-Path $tmpDir 'CLIProxyAPI_7.2.27_windows_amd64\cli-proxy-api.exe'),
    (Join-Path $projectRoot '.tmp\CLIProxyAPI_7.2.27_windows_amd64\cli-proxy-api.exe'),
    (Join-Path $projectRoot 'CLIProxyAPI_render_fix\cli-proxy-api.exe')
)

$exePath = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exePath) {
    Write-Error ("cli-proxy-api.exe not found under addon\cliproxyapi-local or {0}. Run addon\cliproxyapi-local\sync-from-github.ps1 first." -f (Join-Path $tmpDir 'CLIProxyAPI_7.2.27_windows_amd64'))
    exit 1
}

if (-not (Test-Path (Join-Path $localDir 'cli-proxy-api.exe'))) {
    Copy-Item -LiteralPath $exePath -Destination (Join-Path $localDir 'cli-proxy-api.exe') -Force
}

$configPath = Join-Path $localDir 'config.yaml'
if (-not (Test-Path $configPath)) {
    Write-Error "Missing config: $configPath"
    exit 1
}

$authDir = Join-Path $localDir 'auths'
if (-not (Test-Path $authDir)) { New-Item -ItemType Directory -Path $authDir | Out-Null }

function Escape-VbsEmbed {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return '' }
    return $Value.Replace('"', '""')
}

$launcher = Join-Path $env:TEMP 'nhp_cliproxy_local_hidden.vbs'
$exeFull = Join-Path $localDir 'cli-proxy-api.exe'
$vbsLocalDir = Escape-VbsEmbed $localDir
$vbsExe = Escape-VbsEmbed $exeFull
$vbsOutLog = Escape-VbsEmbed $outLog
$vbsErrLog = Escape-VbsEmbed $errLog
$vbsRunLine = 'shell.Run "cmd.exe /c cd /d """ & "' + $vbsLocalDir + '" & """ && """ & "' + $vbsExe + '" & """ >> """ & "' + $vbsOutLog + '" & """ 2>> """ & "' + $vbsErrLog + '" & """", 0, False'
@(
    'Set shell = CreateObject("WScript.Shell")'
    $vbsRunLine
) | Set-Content -LiteralPath $launcher -Encoding ASCII

wscript.exe $launcher

$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
while ((Get-Date) -lt $deadline) {
    if (Test-CliProxyListening -ListenPort $Port) {
        Write-Host "[OK] CLIProxyAPI started on http://127.0.0.1:$Port"
        exit 0
    }
    Start-Sleep -Seconds 2
}

Write-Warning "CLIProxyAPI process launched but port $Port not ready yet. Check $errLog"
exit 2