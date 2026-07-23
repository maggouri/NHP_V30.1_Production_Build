param(
    [Parameter(Mandatory = $false)]
    [string]$ProtocolUrl = ''
)

$ErrorActionPreference = 'Stop'

function Get-QueryParams {
    param([string]$Url)

    $params = @{}
    if ([string]::IsNullOrWhiteSpace($Url)) { return $params }

    try {
        $uri = [System.Uri]$Url
        $query = $uri.Query
        if ($query.StartsWith('?')) { $query = $query.Substring(1) }
        foreach ($pair in ($query -split '&')) {
            if ([string]::IsNullOrWhiteSpace($pair)) { continue }
            $kv = $pair -split '=', 2
            $key = [System.Uri]::UnescapeDataString($kv[0])
            $value = if ($kv.Length -gt 1) { [System.Uri]::UnescapeDataString($kv[1]) } else { '' }
            if (-not [string]::IsNullOrWhiteSpace($key)) {
                $params[$key] = $value
            }
        }
    } catch {
    }

    return $params
}

function Get-ChromePath {
    $candidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    throw 'Chrome executable not found.'
}

function Stop-ProfileChromeInstances {
    param([string]$ProfileDir)

    if ([string]::IsNullOrWhiteSpace($ProfileDir)) { return }

    $processes = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq 'chrome.exe' -and
            $_.CommandLine -and
            $_.CommandLine -like "*$ProfileDir*"
        }

    if (-not $processes) { return }

    foreach ($process in $processes) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
        } catch {
        }
    }

    Start-Sleep -Milliseconds 1200
}

function Get-DebugPort {
    param([string]$Seed)

    $text = [string]($Seed)
    if ([string]::IsNullOrWhiteSpace($text)) { $text = 'default' }

    try {
        $nodePort = & node -e "const seed = process.argv[1] || 'default'; let hash = 0; for (let i = 0; i < seed.length; i += 1) { hash = ((hash << 5) - hash) + seed.charCodeAt(i); hash |= 0; } console.log(9322 + (Math.abs(hash) % 200));" -- $text 2>$null
        if ($LASTEXITCODE -eq 0 -and $nodePort) {
            return [int]($nodePort | Select-Object -First 1)
        }
    } catch {
    }

    $basePort = 9322
    $hash = 0
    foreach ($char in $text.ToCharArray()) {
        $hash = (($hash -shl 5) - $hash) + [int][char]$char
        $hash = $hash -band 0x7fffffff
    }

    return $basePort + ($hash % 200)
}

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$params = Get-QueryParams -Url $ProtocolUrl

$email = [string]($params['email'])
$targetUrl = [string]($params['targetUrl'])

if ([string]::IsNullOrWhiteSpace($email)) {
    $email = 'session_account'
}

if ([string]::IsNullOrWhiteSpace($targetUrl)) {
    $targetUrl = 'https://www.teepublic.com/users/sign_in'
}

$safeEmail = ($email -replace '[^a-zA-Z0-9]', '_')
$profileDir = Join-Path $projectDir "server_profiles\$safeEmail"
$debugPort = Get-DebugPort -Seed "${email}_upload"

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$chromePath = Get-ChromePath
Stop-ProfileChromeInstances -ProfileDir $profileDir

Start-Process -FilePath $chromePath -ArgumentList @(
    '--new-window',
    '--no-first-run',
    '--disable-features=Translate',
    "--remote-debugging-port=$debugPort",
    "--user-data-dir=$profileDir",
    $targetUrl
) -WorkingDirectory (Split-Path $chromePath)
