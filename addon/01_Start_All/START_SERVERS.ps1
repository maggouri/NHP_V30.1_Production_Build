# NHP Portable - unified server launcher (PowerShell)
$ErrorActionPreference = 'Stop'
$startDir = $PSScriptRoot
$addonDir = Split-Path -Parent $startDir
$projectRoot = Split-Path -Parent $addonDir

. (Join-Path $projectRoot 'utils\nhp-portable-paths.ps1')
$null = Set-NhpPortableEnv -AppRoot $projectRoot
Set-Location -LiteralPath $projectRoot

$init = Join-Path $addonDir '_shared\_NHP_Portable_Init.cmd'
if (-not (Test-Path -LiteralPath $init)) {
    Write-Error "Missing: $init"
    exit 1
}
& cmd.exe /c "`"$init`""
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$launcher = Join-Path $startDir 'NHP_Start_All_Servers.bat'
& cmd.exe /c "`"$launcher`""
exit $LASTEXITCODE