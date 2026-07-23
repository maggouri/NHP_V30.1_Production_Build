# NHP extension UI: convert layout px -> rem (16px base). Keeps 1px, 0, shadows, blur filters.
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$utf8 = New-Object System.Text.UTF8Encoding $false

function Should-SkipLine([string]$line) {
    return $line -match '(?i)(box-shadow|text-shadow|filter\s*:|backdrop-filter|blur\s*\(|drop-shadow\s*\()'
}

function Convert-PxToken([string]$numStr) {
    $val = [double]$numStr
    if ($val -eq 0) { return '0' }
    if ($val -eq 1) { return '1px' }
    $rem = $val / 16.0
    $common = @{
        2 = '0.125rem'; 3 = '0.1875rem'; 4 = '0.25rem'; 5 = '0.3125rem'; 6 = '0.375rem'
        7 = '0.4375rem'; 8 = '0.5rem'; 9 = '0.5625rem'; 10 = '0.625rem'; 11 = '0.6875rem'
        12 = '0.75rem'; 13 = '0.8125rem'; 14 = '0.875rem'; 15 = '0.9375rem'; 16 = '1rem'
        18 = '1.125rem'; 20 = '1.25rem'; 24 = '1.5rem'; 28 = '1.75rem'; 32 = '2rem'
        36 = '2.25rem'; 40 = '2.5rem'; 42 = '2.625rem'; 44 = '2.75rem'; 48 = '3rem'
        56 = '3.5rem'; 58 = '3.625rem'; 60 = '3.75rem'; 64 = '4rem'; 68 = '4.25rem'
        70 = '4.375rem'; 76 = '4.75rem'; 80 = '5rem'; 92 = '5.75rem'; 100 = '6.25rem'
        120 = '7.5rem'; 150 = '9.375rem'; 200 = '12.5rem'; 400 = '25rem'; 420 = '26.25rem'
        440 = '27.5rem'; 450 = '28.125rem'; 480 = '30rem'; 500 = '31.25rem'; 580 = '36.25rem'
        600 = '37.5rem'; 640 = '40rem'; 1180 = '73.75rem'
    }
    $i = [int]$val
    if ($val -eq $i -and $common.ContainsKey($i)) { return $common[$i] }
    $s = ('{0:0.####}' -f $rem, [System.Globalization.CultureInfo]::InvariantCulture).TrimEnd('0').TrimEnd('.')
    return "${s}rem"
}

function Convert-Line([string]$line) {
    if (Should-SkipLine $line) { return $line }
    # Pill / circle hacks (999px) — keep px
    if ($line -match 'border-radius[^;]*999px') { return $line }
    return [regex]::Replace($line, '(\d+(?:\.\d+)?)px', {
        param($m)
        Convert-PxToken $m.Groups[1].Value
    })
}

function Convert-Content([string]$text) {
    ($text -split "`r?`n" | ForEach-Object { Convert-Line $_ }) -join "`n"
}

function Ensure-RootFontSize([string]$text, [bool]$isCssOnly) {
    if ($text -notmatch ':root\s*\{') { return $text }
    if ($text -match '(?m):root\s*\{[^}]*font-size\s*:') { return $text }
    return [regex]::Replace($text, '(:root\s*\{)', "`$1`n      font-size: 100%; /* NHP: 1rem = 16px default */", 1)
}

$patterns = @(
    (Join-Path $Root 'extension-theme.css'),
    (Join-Path $Root 'launcher.html'),
    (Join-Path $Root 'popup.html'),
    (Join-Path $Root 'prompt_bag_overlay.js'),
    (Join-Path $Root 'niche_commander.html')
)
$patterns += Get-ChildItem (Join-Path $Root 'modules') -Recurse -Include *.css,*.html -File | ForEach-Object { $_.FullName }

$changed = @()
foreach ($path in ($patterns | Sort-Object -Unique)) {
    if (-not (Test-Path $path)) { continue }
    $before = [System.IO.File]::ReadAllText($path, $utf8)
    $after = Convert-Content $before
    if ($path -match '\.(css|html)$') {
        $after = Ensure-RootFontSize $after ($path -match '\.css$')
    }
    if ($path -match 'launcher\.html$' -and $after -notmatch ':root') {
        $after = $after -replace '(<style>)', "`$1`n    :root { font-size: 100%; }`n"
    }
    if ($after -ne $before) {
        [System.IO.File]::WriteAllText($path, $after, $utf8)
        $changed += $path
    }
}

Write-Output "Changed $($changed.Count) files:"
$changed | ForEach-Object { Write-Output $_ }
