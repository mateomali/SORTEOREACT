$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dist = Join-Path $root 'dist'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$name = "goodfellas-hostinger-safe-$stamp"
$target = Join-Path $dist $name

New-Item -ItemType Directory -Path $target | Out-Null

foreach ($pattern in @('*.php', '.htaccess')) {
    Get-ChildItem -Path $root -File -Filter $pattern | ForEach-Object {
        # Preserve the production config on the server; never package local credentials.
        if ($_.Name -ieq 'config.php') { return }
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
}

foreach ($dir in @('assets', 'includes', 'lib', 'scripts')) {
    $source = Join-Path $root $dir
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination $target -Recurse
    }
}

$copiedScripts = Join-Path $target 'scripts'
if (Test-Path $copiedScripts) {
    Get-ChildItem -Path $copiedScripts -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @('.ps1', '.sql') } |
        ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
    }
    Get-ChildItem -Path $copiedScripts -Directory -Recurse |
        Sort-Object FullName -Descending |
        Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
        Remove-Item -Force
}

$zipPath = Join-Path $dist "$name.zip"
Compress-Archive -Path (Join-Path $target '*') -DestinationPath $zipPath -Force

$instructionsPath = Join-Path $dist "$name.INSTRUCCIONES.txt"
@'
ACTUALIZACION SEGURA PARA HOSTINGER (sitio existente)
1. Hacer copia de seguridad de los archivos y la base de datos del servidor.
2. Extraer el ZIP en la carpeta actual de la aplicacion (donde esta index.php), sobrescribiendo solo los archivos incluidos.
3. Conservar en el servidor config.php, jugadores.csv, uploads/ y todos los datos existentes. No borrar la carpeta del sitio antes de subir.
4. El ZIP no contiene configuracion ni credenciales locales, SQL, CSV de jugadores ni archivos de uploads. Requiere la configuracion y los datos del sitio existente.
5. Despues de subir, comprobar inicio de sesion, inicio, jugadores, sorteo e historial.
'@ | Set-Content -LiteralPath $instructionsPath -Encoding utf8

$manifestPath = Join-Path $dist "$name.manifest.txt"
$fileList = Get-ChildItem -LiteralPath $target -Recurse -File | Sort-Object FullName
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
@(
    "Bundle: $name.zip",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "Files: $($fileList.Count)",
    "ZIP SHA-256: $zipHash",
    '',
    'Included files:',
    ($fileList | ForEach-Object { $_.FullName.Substring($target.Length + 1) })
) | Set-Content -LiteralPath $manifestPath -Encoding utf8

[PSCustomObject]@{
    Bundle = $target
    Zip = $zipPath
    Instructions = $instructionsPath
    Manifest = $manifestPath
    SHA256 = $zipHash
    Files = $fileList.Count
    ZipSizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
}
