# Fix locale comma decimals in rem/em (e.g. 18,75rem -> 18.75rem)
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$utf8 = New-Object System.Text.UTF8Encoding $false
$files = @(
    (Join-Path $Root 'popup.html'),
    (Join-Path $Root 'extension-theme.css'),
    (Join-Path $Root 'prompt_bag_overlay.js'),
    (Join-Path $Root 'niche_commander.html')
) + (Get-ChildItem (Join-Path $Root 'modules') -Recurse -Include *.css,*.html -File | ForEach-Object { $_.FullName })

$changed = @()
foreach ($path in ($files | Sort-Object -Unique)) {
    if (-not (Test-Path $path)) { continue }
    $text = [System.IO.File]::ReadAllText($path, $utf8)
    $after = $text
    $after = [regex]::Replace($after, '(\d+),(\d+)(?=rem\b)', '${1}.${2}')
    $after = [regex]::Replace($after, '(\d+),(\d+)(?=em\b)', '${1}.${2}')
    if ($path -match 'popup\.html$') {
        $after = $after -replace '(body\.nhp-popup-mode \{[^}]*?)max-width:\s*5rem', '${1}max-width: 50rem'
        $after = $after -replace '(#panel-note\.notes-compact \.notes-popover \{[^}]*?)max-width:\s*2rem', '${1}max-width: 20rem'
        $after = $after -replace '(#panel-note\.notes-compact \.notes-popover \{[^}]*?)max-height:\s*2rem', '${1}max-height: 20rem'
        $after = $after -replace '@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*font-size: 100%; /\* NHP: 1rem = 16px default \*/\s*', '@media (prefers-reduced-motion: reduce) {`n      :root {`n        '
    }
    if ($after -ne $text) {
        [System.IO.File]::WriteAllText($path, $after, $utf8)
        $changed += $path
    }
}
Write-Output "Fixed $($changed.Count) files"
