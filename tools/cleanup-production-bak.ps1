# NHP Production Cleanup — moves .bak files to _archive_bak/ (does NOT delete).
# Usage: powershell -ExecutionPolicy Bypass -File tools/cleanup-production-bak.ps1
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$archiveRoot = Join-Path $Root '_archive_bak'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$dest = Join-Path $archiveRoot $stamp

$skipDirs = @(
    '_archive_bak',
    'node_modules',
    '.git',
    'server_profiles',
    'server_profiles_pinterest'
)

Write-Host "NHP cleanup: scanning for .bak files under $Root"

if (-not (Test-Path $archiveRoot)) {
    New-Item -ItemType Directory -Path $archiveRoot | Out-Null
}
New-Item -ItemType Directory -Path $dest | Out-Null

$moved = 0
Get-ChildItem -Path $Root -Recurse -Filter '*.bak' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
    $skip = $false
    foreach ($part in $skipDirs) {
        if ($rel -like "$part*") { $skip = $true; break }
    }
    if ($skip) { return }

    $target = Join-Path $dest $rel
    $targetDir = Split-Path -Parent $target
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Move-Item -LiteralPath $_.FullName -Destination $target -Force
    Write-Host "MOVED: $rel"
    $moved++
}

Write-Host "Done. Moved $moved file(s) to $dest"
