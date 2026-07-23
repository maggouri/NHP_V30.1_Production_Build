# Sync CLIProxyAPI binary + auth/config from GitHub project folders into addon\cliproxyapi-local
$ErrorActionPreference = 'Stop'
$localDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$addonDir = Split-Path -Parent $localDir
$projectRoot = Split-Path -Parent $addonDir
. (Join-Path $projectRoot 'utils\nhp-portable-paths.ps1')
$portable = Set-NhpPortableEnv -AppRoot $projectRoot
$renderDir = Join-Path $projectRoot 'CLIProxyAPI_render_fix'
$binaryDirData = Join-Path $portable.DataRoot '.tmp\CLIProxyAPI_7.2.27_windows_amd64'
$binaryDirLegacy = Join-Path $projectRoot '.tmp\CLIProxyAPI_7.2.27_windows_amd64'
$binaryDir = if (Test-Path $binaryDirData) { $binaryDirData } else { $binaryDirLegacy }

if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir | Out-Null }

$exeSources = @(
    (Join-Path $binaryDir 'cli-proxy-api.exe'),
    (Join-Path $renderDir 'cli-proxy-api.exe')
)
$exe = $exeSources | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($exe) {
    Copy-Item -LiteralPath $exe -Destination (Join-Path $localDir 'cli-proxy-api.exe') -Force
    Write-Host "Copied binary: $exe"
} else {
    Write-Warning ("Binary not found — place CLIProxyAPI Windows build under: {0}" -f (Join-Path $portable.DataRoot '.tmp\CLIProxyAPI_7.2.27_windows_amd64'))
}

$configSources = @(
    (Join-Path $renderDir 'config.render.yaml'),
    (Join-Path $renderDir 'config.example.yaml'),
    (Join-Path $binaryDir 'config.example.yaml')
)
$configSrc = $configSources | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($configSrc -and -not (Test-Path (Join-Path $localDir 'config.yaml'))) {
    Copy-Item -LiteralPath $configSrc -Destination (Join-Path $localDir 'config.yaml') -Force
    Write-Host "Seeded config from: $configSrc"
}

$authSrc = Join-Path $renderDir 'auths'
$authDst = Join-Path $localDir 'auths'
if (Test-Path $authSrc) {
    if (-not (Test-Path $authDst)) { New-Item -ItemType Directory -Path $authDst | Out-Null }
    Copy-Item -Path (Join-Path $authSrc '*') -Destination $authDst -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Synced auth files from: $authSrc"
} else {
    if (-not (Test-Path $authDst)) { New-Item -ItemType Directory -Path $authDst | Out-Null }
}

Write-Host "Local CLIProxyAPI folder ready: $localDir"
