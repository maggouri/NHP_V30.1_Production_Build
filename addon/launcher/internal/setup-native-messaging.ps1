param(
    [string]$ProjectDir = $PSScriptRoot,
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$DefaultExtensionId = "bhhahkcjolghbigcognobplmgdbkmekb"

function Resolve-ProjectDir {
    param([string]$Candidate)
    $resolved = Resolve-Path -LiteralPath $Candidate -ErrorAction Stop
    return $resolved.Path
}

function Get-ExtensionIdFromPreferences {
    param([string]$RootProjectDir)

    $normalizedProject = $RootProjectDir.ToLowerInvariant().TrimEnd('\')
    $preferenceCandidates = @(
        (Join-Path $RootProjectDir "ai_chrome_profile\Default\Preferences"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Default\Preferences"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Profile 1\Preferences"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Profile 2\Preferences")
    )

    foreach ($prefsPath in $preferenceCandidates) {
        if (-not (Test-Path -LiteralPath $prefsPath)) { continue }
        try {
            $prefs = Get-Content -LiteralPath $prefsPath -Raw | ConvertFrom-Json
            $settings = $prefs.extensions.settings
            if (-not $settings) { continue }
            foreach ($entry in $settings.PSObject.Properties) {
                $extId = $entry.Name
                $extVal = $entry.Value
                $extPath = ""
                if ($extVal -and $extVal.path) {
                    $extPath = [string]$extVal.path
                }
                if ([string]::IsNullOrWhiteSpace($extPath)) { continue }
                $normalizedExtPath = $extPath.ToLowerInvariant().TrimEnd('\')
                if ($normalizedExtPath -eq $normalizedProject) {
                    return $extId
                }
            }
        } catch {
            Write-Warning "Failed reading Preferences at '$prefsPath': $($_.Exception.Message)"
        }
    }

    return $null
}

$resolvedProjectDir = Resolve-ProjectDir -Candidate $ProjectDir
$nativeHostDir = Join-Path $resolvedProjectDir "native-host"
$hostScriptPath = Join-Path $nativeHostDir "nhp_native_host.js"
$hostLauncherPath = Join-Path $nativeHostDir "nhp_native_host.cmd"
$manifestPath = Join-Path $nativeHostDir "com.nhp.server_launcher.json"
$registryKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.nhp.server_launcher"

if (-not (Test-Path -LiteralPath $hostScriptPath)) {
    throw "Missing native host script: $hostScriptPath"
}
if (-not (Test-Path -LiteralPath $hostLauncherPath)) {
    throw "Missing native host launcher: $hostLauncherPath"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js not found in PATH. Install Node.js first."
}

if ([string]::IsNullOrWhiteSpace($ExtensionId)) {
    $ExtensionId = Get-ExtensionIdFromPreferences -RootProjectDir $resolvedProjectDir
}

if ([string]::IsNullOrWhiteSpace($ExtensionId)) {
    Write-Warning "Could not auto-detect extension ID from Chrome Preferences."
    Write-Warning "Using packaged default: $DefaultExtensionId"
    Write-Warning "If your extension ID differs, re-run: addon\launcher\REGISTER_NATIVE.cmd YOUR_EXTENSION_ID"
    $ExtensionId = $DefaultExtensionId
}

$allowedOrigin = "chrome-extension://$ExtensionId/"
$defaultOrigin = "chrome-extension://$DefaultExtensionId/"
$allowedOrigins = @($allowedOrigin, $defaultOrigin)
if (Test-Path -LiteralPath $manifestPath) {
    try {
        $existingRaw = [System.IO.File]::ReadAllText($manifestPath).TrimStart([char]0xFEFF)
        $existing = $existingRaw | ConvertFrom-Json
        if ($existing.allowed_origins) {
            $allowedOrigins += @($existing.allowed_origins)
        }
    } catch {
        Write-Warning "Could not merge existing allowed_origins: $($_.Exception.Message)"
    }
}
$allowedOrigins = $allowedOrigins | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^chrome-extension://' } | Select-Object -Unique

$manifestObject = [ordered]@{
    name = "com.nhp.server_launcher"
    description = "NHP local launcher host"
    path = $hostLauncherPath
    type = "stdio"
    allowed_origins = @($allowedOrigins)
}

if (-not (Test-Path -LiteralPath $nativeHostDir)) {
    New-Item -Path $nativeHostDir -ItemType Directory -Force | Out-Null
}

$manifestJson = ($manifestObject | ConvertTo-Json -Depth 10)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

New-Item -Path $registryKey -Force | Out-Null
Set-ItemProperty -Path $registryKey -Name "(default)" -Value $manifestPath

Write-Host "[OK] Native messaging manifest written: $manifestPath"
Write-Host "[OK] Registry updated: HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.nhp.server_launcher"
Write-Host "[OK] Allowed origins:"
$allowedOrigins | ForEach-Object { Write-Host "       $_" }
Write-Host "[NOTE] Host launcher path: $hostLauncherPath"
Write-Host "[NOTE] Native host script expected at: $hostScriptPath"
