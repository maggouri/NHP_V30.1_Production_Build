# Rewrites native-host\com.nhp.server_launcher.json "path" + HKCU registry to the
# current App Root. Chrome Native Messaging requires an absolute host path, so we
# never commit a machine-specific path — Register / Start-All repair it locally.
param(
    [string]$ProjectDir = ""
)

$ErrorActionPreference = 'Stop'

function Resolve-NhpProjectDir {
    param([string]$Candidate)
    if (-not [string]::IsNullOrWhiteSpace($Candidate)) {
        return (Resolve-Path -LiteralPath $Candidate).Path
    }
    if ($PSScriptRoot) {
        $fromUtils = Split-Path -Parent $PSScriptRoot
        if (Test-Path -LiteralPath (Join-Path $fromUtils 'native-host\nhp_native_host.cmd')) {
            return (Resolve-Path -LiteralPath $fromUtils).Path
        }
    }
    throw 'ProjectDir not found. Pass -ProjectDir or run from the NHP App Root tree.'
}

$resolvedProjectDir = Resolve-NhpProjectDir -Candidate $ProjectDir
$nativeHostDir = Join-Path $resolvedProjectDir 'native-host'
$hostLauncherPath = Join-Path $nativeHostDir 'nhp_native_host.cmd'
$manifestPath = Join-Path $nativeHostDir 'com.nhp.server_launcher.json'
$examplePath = Join-Path $nativeHostDir 'com.nhp.server_launcher.example.json'
$registryKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.nhp.server_launcher'
$defaultOrigin = 'chrome-extension://bhhahkcjolghbigcognobplmgdbkmekb/'

if (-not (Test-Path -LiteralPath $hostLauncherPath)) {
    throw "Missing native host launcher: $hostLauncherPath"
}

if (-not (Test-Path -LiteralPath $nativeHostDir)) {
    New-Item -Path $nativeHostDir -ItemType Directory -Force | Out-Null
}

$allowedOrigins = @($defaultOrigin)
if (Test-Path -LiteralPath $manifestPath) {
    try {
        $existingRaw = [System.IO.File]::ReadAllText($manifestPath).TrimStart([char]0xFEFF)
        $existing = $existingRaw | ConvertFrom-Json
        if ($existing.allowed_origins) {
            $allowedOrigins += @($existing.allowed_origins)
        }
    } catch {
        Write-Warning "Could not read existing native-host manifest origins: $($_.Exception.Message)"
    }
} elseif (Test-Path -LiteralPath $examplePath) {
    try {
        $exampleRaw = [System.IO.File]::ReadAllText($examplePath).TrimStart([char]0xFEFF)
        $example = $exampleRaw | ConvertFrom-Json
        if ($example.allowed_origins) {
            $allowedOrigins += @($example.allowed_origins)
        }
    } catch {
        Write-Warning "Could not read example native-host manifest: $($_.Exception.Message)"
    }
}

$allowedOrigins = @(
    $allowedOrigins |
        ForEach-Object { [string]$_ } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -match '^chrome-extension://' } |
        Select-Object -Unique
)

$manifestObject = [ordered]@{
    name            = 'com.nhp.server_launcher'
    description     = 'NHP local launcher host'
    path            = $hostLauncherPath
    type            = 'stdio'
    allowed_origins = @($allowedOrigins)
}

$manifestJson = ($manifestObject | ConvertTo-Json -Depth 10)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

New-Item -Path $registryKey -Force | Out-Null
Set-ItemProperty -Path $registryKey -Name '(default)' -Value $manifestPath

Write-Host "[Portable] Native Messaging host path -> $hostLauncherPath"
exit 0
