param(
    [string]$ProtocolUrl = ''
)

$ErrorActionPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectDir

$url = [string]$ProtocolUrl
if ($url -like 'nhp-ai-servers-stop:*') {
    & "$projectDir\Stop_NonAutopilot_Servers.cmd"
    exit 0
}

if ($url -like 'nhp-ai-chrome-restart:*') {
    & "$projectDir\Restart_AI_Controlled_Chrome.cmd"
    exit 0
}

if ($url -like 'nhp-ai-chrome:*') {
    & "$projectDir\Start_AI_Controlled_Chrome.cmd"
    exit 0
}

& "$projectDir\Start_NonAutopilot_Servers.cmd"
