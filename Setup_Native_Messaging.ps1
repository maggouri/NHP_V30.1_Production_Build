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

function Get-NodeExePath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\node\node.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    try {
        $whereOutput = & where.exe node 2>$null
        if ($whereOutput) {
            foreach ($line in @($whereOutput)) {
                $candidate = [string]$line
                if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
                if (Test-Path -LiteralPath $candidate) {
                    return (Resolve-Path -LiteralPath $candidate).Path
                }
            }
        }
    } catch { }
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }
    return $null
}

$nodeExePath = Get-NodeExePath
if (-not $nodeExePath) {
    throw "Node.js not found. Install Node.js LTS from https://nodejs.org/ or add it to PATH, then re-run registration."
}

if ([string]::IsNullOrWhiteSpace($ExtensionId)) {
    $ExtensionId = Get-ExtensionIdFromPreferences -RootProjectDir $resolvedProjectDir
}

if ([string]::IsNullOrWhiteSpace($ExtensionId)) {
    Write-Warning "Could not auto-detect extension ID from Chrome Preferences."
    Write-Warning "Using packaged default: $DefaultExtensionId"
    Write-Warning "If your extension ID differs, re-run: addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.bat YOUR_EXTENSION_ID"
    $ExtensionId = $DefaultExtensionId
}

$allowedOrigin = "chrome-extension://$ExtensionId/"
$defaultOrigin = "chrome-extension://$DefaultExtensionId/"
$allowedOrigins = @($allowedOrigin, $defaultOrigin)
$examplePath = Join-Path $nativeHostDir "com.nhp.server_launcher.example.json"
foreach ($seedPath in @($manifestPath, $examplePath)) {
    if (-not (Test-Path -LiteralPath $seedPath)) { continue }
    try {
        $existingRaw = [System.IO.File]::ReadAllText($seedPath).TrimStart([char]0xFEFF)
        $existing = $existingRaw | ConvertFrom-Json
        if ($existing.allowed_origins) {
            $allowedOrigins += @($existing.allowed_origins)
        }
    } catch {
        Write-Warning "Could not merge origins from '$seedPath': $($_.Exception.Message)"
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
Write-Host "[NOTE] Host launcher path (absolute, current App Root): $hostLauncherPath"
Write-Host "[NOTE] Native host script expected at: $hostScriptPath"
Write-Host "[NOTE] After moving the build folder, re-run Register or Start All (portable repair)."
