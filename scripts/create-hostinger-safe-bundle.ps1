$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dist = Join-Path $root 'dist'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$name = "goodfellas-hostinger-safe-$stamp"
$target = Join-Path $dist $name

New-Item -ItemType Directory -Path $target | Out-Null

foreach ($pattern in @('*.php', '.htaccess', 'jugadores.csv')) {
    Get-ChildItem -Path $root -File -Filter $pattern | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
}

foreach ($dir in @('assets', 'includes', 'lib', 'scripts', 'uploads')) {
    $source = Join-Path $root $dir
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination $target -Recurse
    }
}

$copiedScripts = Join-Path $target 'scripts'
if (Test-Path $copiedScripts) {
    Get-ChildItem -Path $copiedScripts -Filter '*.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
    }
}

$zipPath = Join-Path $dist "$name.zip"
Compress-Archive -Path (Join-Path $target '*') -DestinationPath $zipPath -Force

[PSCustomObject]@{
    Bundle = $target
    Zip = $zipPath
    Files = (Get-ChildItem $target -Recurse -File | Measure-Object).Count
    ZipSizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
}
