# NHP portable path helpers for PowerShell launchers.
# Dot-source: . "$PSScriptRoot\nhp-portable-paths.ps1"  (from utils\)
# Or:         . (Join-Path $AppRoot 'utils\nhp-portable-paths.ps1')

function Get-NhpAppRoot {
    param([string]$Hint = '')
    if ($env:NHP_APP_ROOT -and (Test-Path -LiteralPath $env:NHP_APP_ROOT)) {
        return (Resolve-Path -LiteralPath $env:NHP_APP_ROOT).Path
    }
    if ($env:NHP_ROOT_DIR -and (Test-Path -LiteralPath $env:NHP_ROOT_DIR)) {
        return (Resolve-Path -LiteralPath $env:NHP_ROOT_DIR).Path
    }
    if ($env:NHP_ROOT -and (Test-Path -LiteralPath $env:NHP_ROOT)) {
        return (Resolve-Path -LiteralPath $env:NHP_ROOT).Path
    }
    if ($Hint -and (Test-Path -LiteralPath $Hint)) {
        return (Resolve-Path -LiteralPath $Hint).Path
    }
    throw 'NHP App Root could not be resolved'
}

function Get-NhpDataRoot {
    param([string]$AppRoot)
    if ($env:NHP_DATA_ROOT -and $env:NHP_DATA_ROOT.Trim()) {
        return [System.IO.Path]::GetFullPath($env:NHP_DATA_ROOT.Trim())
    }
    $parent = Split-Path -Parent $AppRoot
    return (Join-Path $parent 'NHP_DATA')
}

function Set-NhpPortableEnv {
    param([string]$AppRoot)
    $app = Get-NhpAppRoot -Hint $AppRoot
    $data = Get-NhpDataRoot -AppRoot $app
    $env:NHP_APP_ROOT = $app
    $env:NHP_DATA_ROOT = $data
    $env:NHP_ROOT = $app
    $env:NHP_ROOT_DIR = $app
    if (-not (Test-Path -LiteralPath $data)) {
        New-Item -ItemType Directory -Path $data -Force | Out-Null
    }
    $subdirs = @(
        'generated_designs', 'server_logs', 'server_profiles', 'server_profiles_creaty',
        'server_profiles_creaty_preview', 'server_profiles_pinterest', 'profile_backups',
        'profile_backups_pinterest', 'profile_browser_locks', 'temp_uploads',
        'temp_uploads_ai_bridge', 'temp_uploads_pinterest', 'metadata_store', 'backups', '.tmp', 'archive'
    )
    foreach ($name in $subdirs) {
        $p = Join-Path $data $name
        if (-not (Test-Path -LiteralPath $p)) {
            New-Item -ItemType Directory -Path $p -Force | Out-Null
        }
    }
    return @{ AppRoot = $app; DataRoot = $data; LogDir = (Join-Path $data 'server_logs') }
}

function Get-NhpLogDir {
    param([string]$AppRoot)
    $data = Get-NhpDataRoot -AppRoot (Get-NhpAppRoot -Hint $AppRoot)
    return (Join-Path $data 'server_logs')
}
