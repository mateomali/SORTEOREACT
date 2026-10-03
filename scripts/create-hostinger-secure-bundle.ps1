#requires -Version 5.1
<#
.SYNOPSIS
    Crea un bundle de despliegue SEGURO para Hostinger (sitio existente).

.DESCRIPTION
    Empaqueta unicamente los archivos que la aplicacion necesita en runtime y
    aplica un .htaccess endurecido. A diferencia de
    create-hostinger-safe-bundle.ps1, este script:

      * Nunca incluye config.php (credenciales de produccion).
      * Nunca incluye hostinger_diag.php (diagnostico sin autenticacion que
        filtra host, usuario, nombre de la base, rutas y version de PHP).
      * Nunca incluye scripts/ (scripts CLI de importacion/migracion que quedan
        accesibles por HTTP y usan $argv sin guarda PHP_SAPI).
      * No incluye artefactos de desarrollo (SQL, CSV, Markdown, package.json,
        vite.config.js, capturas de pantalla, src/, tests/, docs/).
      * Genera un .htaccess que bloquea archivos sensibles, extensiones no
        runtime, dotfiles y el acceso directo a lib/ e includes/.
      * Valida la sintaxis PHP (php -l) y escanea el bundle buscando secretos
        antes de comprimir. Si algo falla, no genera el ZIP.

.PARAMETER OutDir
    Carpeta de salida. Por defecto dist/ en la raiz del proyecto.

.PARAMETER SkipPhpLint
    Omite la validacion de sintaxis PHP (solo si no hay PHP disponible).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/create-hostinger-secure-bundle.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/create-hostinger-secure-bundle.ps1 -OutDir deploy
#>
[CmdletBinding()]
param(
    [string] $OutDir,
    [switch] $SkipPhpLint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string] $Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string] $Message)
    Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string] $Message)
    Write-Host "    !!  $Message" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path $root 'dist'
}
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$OutDir = (Resolve-Path -LiteralPath $OutDir).Path

$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$name   = "goodfellas-hostinger-secure-$stamp"
$target = Join-Path $OutDir $name

# El ZIP se arma con nombre temporal y solo recibe su nombre definitivo al
# final. Asi una ejecucion fallida nunca deja un artefacto que parezca
# desplegable pero este incompleto o mal formado.
$zipPath = Join-Path $OutDir "$name.zip"
$zipTemp = Join-Path $OutDir "$name.building.zip"

trap {
    # Un build fallido no debe dejar nada desplegable: ni ZIP ni carpeta.
    foreach ($artifact in @($zipTemp, $zipPath)) {
        if ($artifact -and (Test-Path -LiteralPath $artifact)) {
            Remove-Item -LiteralPath $artifact -Force -ErrorAction SilentlyContinue
        }
    }
    if ($target -and (Test-Path -LiteralPath $target)) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
    }
    break
}

# UTF-8 sin BOM: imprescindible para .htaccess (un BOM rompe la config de Apache).
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-TextFile {
    param([string] $Path, [string] $Content)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# ---------------------------------------------------------------------------
# Politica de inclusion
# ---------------------------------------------------------------------------
# Archivos de raiz que SI van (ademas de los *.php permitidos).
$rootFilesIncluded = @('goodfellas.apk')

# Archivos de raiz que NUNCA van, con el motivo (para el reporte de auditoria).
$rootFilesExcluded = [ordered]@{
    'config.php'              = 'Contiene credenciales de produccion (DB_PASS / ADMIN_PASSWORD). El servidor conserva el suyo.'
    'hostinger_diag.php'      = 'Diagnostico sin autenticacion: filtra host, usuario y nombre de la base, rutas del servidor y version de PHP.'
    'sorteo original.php'     = 'Artefacto de desarrollo sin referencias en la aplicacion.'
}

# Directorios copiados recursivamente.
$directoriesIncluded = @('assets', 'includes', 'lib')

# Dentro de assets/, no hace falta el origen de Tailwind (solo lo usa el build).
$assetsExcluded = @('tailwind.input.css')

# ---------------------------------------------------------------------------
# Secreto: se leen los valores reales de config.php para escanear el bundle
# sin escribir credenciales dentro de este script.
# ---------------------------------------------------------------------------
function Get-LocalSecretLiterals {
    param([string] $ConfigPath)

    $literals = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        return $literals
    }

    # Nombres de constantes que aparecen en config.php pero no son secretos:
    # si se tomaran como literales, el escaneo daria falsos positivos al
    # encontrarlos como texto normal dentro del codigo.
    $constantNames = @(
        'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_CHARSET',
        'ADMIN_PASSWORD', 'APP_NAME', 'APP_PUBLIC_URL'
    )

    $lines = Get-Content -LiteralPath $ConfigPath
    foreach ($line in $lines) {
        # Solo lineas que definen algo sensible.
        if ($line -notmatch 'GOODFELLAS_(DB_PASS|DB_USER|ADMIN_PASSWORD|DB_NAME|DB_HOST)') {
            continue
        }
        if ($line -match 'DB_HOST' -and $line -match "'localhost'") {
            continue
        }

        foreach ($m in [regex]::Matches($line, "'([^']*)'")) {
            $value = $m.Groups[1].Value
            # Descartar la propia clave de entorno, nombres de constantes y valores triviales.
            if ($value -like 'GOODFELLAS_*') { continue }
            if ($constantNames -contains $value) { continue }
            if ($value -in @('', 'localhost', 'root', 'utf8mb4')) { continue }
            if ($value.Length -lt 4) { continue }
            if (-not $literals.Contains($value)) { [void] $literals.Add($value) }
        }
    }

    return $literals
}

$secretLiterals = @(Get-LocalSecretLiterals -ConfigPath (Join-Path $root 'config.php'))

# ---------------------------------------------------------------------------
# .htaccess endurecido
# ---------------------------------------------------------------------------
$htaccessContent = @'
# Goodfellas Futbol - configuracion Apache para Hostinger.
# Generado por scripts/create-hostinger-secure-bundle.ps1
# Los patrones son relativos (sin ^/) para funcionar tanto en la raiz del
# dominio como en un subdirectorio (por ejemplo /sorteo).

DirectoryIndex index.php

AddType application/vnd.android.package-archive .apk

# Sin listado de directorios.
Options -Indexes

# --- Archivos que nunca deben servirse por HTTP ------------------------------
<FilesMatch "^(config\.php|config\.local\.php|database\.sql|jugadores\.csv|package(-lock)?\.json|composer\.(json|lock)|README\.md|php\.ini|\.user\.ini|\.htaccess|\.htpasswd|\.env.*|\.git.*)$">
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Deny from all
  </IfModule>
</FilesMatch>

# --- Extensiones que no forman parte del runtime -----------------------------
# assets/ solo contiene .js, .css, .png, .jpg y .svg, por lo que bloquear estas
# extensiones no afecta a ninguna peticion legitima de la aplicacion.
# Se exceptua robots.txt con un lookahead negativo: si el hosting tiene uno,
# bloquearlo afectaria al indexado del sitio.
<FilesMatch "^(?!robots\.txt$).*\.(sql|sqlite|db|csv|md|log|ps1|sh|bat|cmd|bak|old|orig|save|swp|ini|yml|yaml|json|lock|dist|txt|tmpl|tpl)$">
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Deny from all
  </IfModule>
</FilesMatch>

# --- Directorios de desarrollo que nunca deben existir en produccion ---------
RedirectMatch 404 (?i)/(scripts|node_modules|vendor|src|tests|test-results|docs|outputs|storage|dist)(/|$)

# --- Datos locales y copias de seguridad -------------------------------------
RedirectMatch 404 (?i)/(logs|backup|tmp)(/|$)
# Se mantienen los bloqueos del .htaccess anterior (/.git, /.tmp) y se suman
# los directorios de trabajo habituales del proyecto.
RedirectMatch 404 (?i)/\.(git|svn|hg|env|vscode|idea|tmp|tools|deploy|DS_Store)(/|$)

# --- Diagnostico sin autenticacion (excluido de este bundle) -----------------
RedirectMatch 404 (?i)/hostinger_diag\.php$

# --- Acceso directo a librerias internas -------------------------------------
# lib/ e includes/ solo se cargan con require __DIR__ desde PHP; ninguna pagina
# ni asset los solicita por HTTP.
RedirectMatch 404 (?i)/(lib|includes)/
'@

# ---------------------------------------------------------------------------
# Construccion
# ---------------------------------------------------------------------------
Write-Step "Construyendo bundle seguro en $target"
New-Item -ItemType Directory -Path $target -Force | Out-Null

$copiedRootPhp    = New-Object System.Collections.Generic.List[string]
$skippedRootPhp   = New-Object System.Collections.Generic.List[string]

# 1) Paginas PHP de raiz (todas menos las excluidas).
Get-ChildItem -LiteralPath $root -File -Filter '*.php' | Sort-Object Name | ForEach-Object {
    if ($rootFilesExcluded.Contains($_.Name)) {
        $skippedRootPhp.Add($_.Name)
        return
    }
    Copy-Item -LiteralPath $_.FullName -Destination $target
    $copiedRootPhp.Add($_.Name)
}

# 2) Archivos de raiz explicitamente permitidos (APK de la home).
foreach ($file in $rootFilesIncluded) {
    $source = Join-Path $root $file
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination $target
    } else {
        Write-Warn "$file no existe en la raiz; la home quedara con el enlace de descarga roto."
    }
}

# 3) Directorios de runtime.
foreach ($dir in $directoriesIncluded) {
    $source = Join-Path $root $dir
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Falta el directorio requerido: $dir"
    }
    Copy-Item -LiteralPath $source -Destination $target -Recurse

    if ($dir -eq 'assets') {
        foreach ($excluded in $assetsExcluded) {
            $path = Join-Path (Join-Path $target 'assets') $excluded
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force
            }
        }
    }
}

# 4) Blindaje defensivo de uploads/ (se copia el archivo existente tal cual,
#    para que un despliegue limpio tambien quede protegido sin alterar el del
#    servidor). No se copia ningun dato de uploads/.
$uploadsHtaccess = Join-Path $root 'uploads\.htaccess'
if (Test-Path -LiteralPath $uploadsHtaccess) {
    $uploadsDir = Join-Path $target 'uploads'
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Copy-Item -LiteralPath $uploadsHtaccess -Destination $uploadsDir
}

# 5) .htaccess endurecido.
Write-TextFile -Path (Join-Path $target '.htaccess') -Content $htaccessContent

Write-Ok "Archivos copiados: $((Get-ChildItem -LiteralPath $target -Recurse -File -Force).Count)"

# ---------------------------------------------------------------------------
# Aserciones de seguridad
# ---------------------------------------------------------------------------
Write-Step 'Aplicando aserciones de seguridad'

$bundledFiles = Get-ChildItem -LiteralPath $target -Recurse -File -Force
$bundledRelative = $bundledFiles | ForEach-Object { $_.FullName.Substring($target.Length + 1) }
$problems = New-Object System.Collections.Generic.List[string]

# a) Ningun archivo prohibido.
$forbiddenNames = @('config.php', 'hostinger_diag.php', 'sorteo original.php')
foreach ($bad in $forbiddenNames) {
    if ($bundledRelative -contains $bad) {
        $problems.Add("Archivo prohibido presente en el bundle: $bad")
    }
}

# b) Ninguna extension de desarrollo.
$forbiddenExtensions = @('.sql', '.csv', '.ps1', '.md', '.json', '.txt', '.log', '.yml', '.yaml', '.ini', '.bak', '.html')
foreach ($rel in $bundledRelative) {
    # Politica de valoracion leida por PHP en runtime; sigue bloqueada por HTTP.
    if ($rel.Replace('\', '/') -eq 'assets/player-rating-policy.json') { continue }
    if ($forbiddenExtensions -contains ([System.IO.Path]::GetExtension($rel)).ToLowerInvariant()) {
        $problems.Add("Extension no permitida en el bundle: $rel")
    }
}

# c) Ninguna carpeta de desarrollo.
foreach ($dir in @('scripts', 'node_modules', 'src', 'tests', 'docs', 'backup', 'logs', 'tmp', 'outputs', 'dist')) {
    if ($bundledRelative | Where-Object { $_ -like "$dir\*" -or $_ -eq $dir }) {
        $problems.Add("Directorio no permitido en el bundle: $dir/")
    }
}

# d) Ninguna credencial hardcodeada ni secreto local.
#    Nota: [System.IO.Path]::GetExtension('.htaccess') devuelve cadena vacia,
#    por eso tambien se comparan nombres sin extension.
$textExtensions = @('.php', '.js', '.css', '.svg', '.json')
$textFileNames  = @('.htaccess')
foreach ($file in $bundledFiles) {
    $isText = ($textExtensions -contains $file.Extension.ToLowerInvariant()) -or ($textFileNames -contains $file.Name)
    if (-not $isText) { continue }

    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($content)) { continue }
    $rel = $file.FullName.Substring($target.Length + 1)

    if ($content -match "define\s*\(\s*['""](DB_PASS|DB_USER|ADMIN_PASSWORD)['""]") {
        $problems.Add("Posible credencial embebida en $rel")
    }

    foreach ($secret in $secretLiterals) {
        if ($content.Contains($secret)) {
            $problems.Add("Secreto local encontrado en $rel (valor no mostrado)")
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host ''
    foreach ($p in $problems) { Write-Host "    XX  $p" -ForegroundColor Red }
    throw "El bundle no supero las aserciones de seguridad ($($problems.Count) problema(s)). No se genero el ZIP."
}
Write-Ok 'Sin archivos prohibidos, sin extensiones de desarrollo, sin credenciales.'

# e) El .htaccess conserva todas las protecciones exigidas. Evita que una
#    edicion futura elimine blindajes de forma silenciosa.
#    Los valores son subcadenas LITERALES del archivo (se comparan con
#    .Contains), por eso los escapes van tal cual aparecen en el texto.
$requiredHtaccessRules = [ordered]@{
    'DirectoryIndex index.php'             = 'DirectoryIndex index.php'
    'Tipo MIME del APK'                    = 'application/vnd.android.package-archive'
    'Sin listado de directorios'           = 'Options -Indexes'
    'Bloqueo de config.php'                = 'config\.php'
    'Bloqueo de jugadores.csv'             = 'jugadores\.csv'
    'Bloqueo de package.json'              = 'package(-lock)?\.json'
    'Bloqueo de node_modules'              = 'node_modules'
    'Bloqueo de /.git'                     = 'git|svn|hg'
    'Bloqueo de /.tmp y /.tools'           = 'tmp|tools|deploy'
    'Bloqueo de /logs, /backup y /tmp'     = 'logs|backup|tmp'
    'Bloqueo de hostinger_diag.php'        = 'hostinger_diag\.php'
    'Bloqueo de acceso a lib/ e includes/' = '(lib|includes)'
}
foreach ($rule in $requiredHtaccessRules.GetEnumerator()) {
    if (-not $htaccessContent.Contains($rule.Value)) {
        $problems.Add("El .htaccess no contiene la proteccion requerida: $($rule.Key)")
    }
}
if ($problems.Count -gt 0) {
    Write-Host ''
    foreach ($p in $problems) { Write-Host "    XX  $p" -ForegroundColor Red }
    throw "El .htaccess perdio protecciones ($($problems.Count)). No se genero el ZIP."
}
Write-Ok "El .htaccess conserva las $($requiredHtaccessRules.Count) protecciones requeridas."

# ---------------------------------------------------------------------------
# Validacion de sintaxis PHP
# ---------------------------------------------------------------------------
$phpFiles = $bundledFiles | Where-Object { $_.Extension -ieq '.php' }
$phpCommand = Get-Command php -ErrorAction SilentlyContinue
$phpExe = if ($phpCommand) { $phpCommand.Source } else { $null }
if (-not $phpExe -and (Test-Path -LiteralPath 'C:\xampp\php\php.exe')) {
    $phpExe = 'C:\xampp\php\php.exe'
}

if ($phpExe -and -not $SkipPhpLint) {
    Write-Step "Validando sintaxis PHP de $($phpFiles.Count) archivo(s) con $phpExe"
    $lintErrors = New-Object System.Collections.Generic.List[string]
    foreach ($file in $phpFiles) {
        $output = & $phpExe -l $file.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            $lintErrors.Add(($output | Out-String).Trim())
        }
    }
    if ($lintErrors.Count -gt 0) {
        Write-Host ''
        foreach ($e in $lintErrors) { Write-Host "    XX  $e" -ForegroundColor Red }
        throw "Hay $($lintErrors.Count) archivo(s) PHP con errores de sintaxis. No se genero el ZIP."
    }
    Write-Ok "Sintaxis PHP correcta en $($phpFiles.Count) archivo(s)."
} else {
    Write-Warn 'PHP no disponible o -SkipPhpLint: se omite la validacion de sintaxis.'
}

# ---------------------------------------------------------------------------
# ZIP
# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $zipTemp) { Remove-Item -LiteralPath $zipTemp -Force }

# El ZIP se arma entrada por entrada por dos motivos:
#   1. ZipFile::CreateFromDirectory usa "\" como separador en .NET Framework,
#      lo que produce rutas invalidas al extraer en el Linux de Hostinger.
#   2. Compress-Archive no garantiza la inclusion de archivos que empiezan
#      con punto (.htaccess).
$zipStream = [System.IO.File]::Open($zipTemp, [System.IO.FileMode]::Create)
try {
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in ($bundledFiles | Sort-Object FullName)) {
            $entryName = $file.FullName.Substring($target.Length + 1).Replace('\', '/')
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $entryStream = $entry.Open()
            try {
                $fileStream = [System.IO.File]::OpenRead($file.FullName)
                try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
            } finally { $entryStream.Dispose() }
        }
    } finally {
        $archive.Dispose()
    }
} finally {
    $zipStream.Dispose()
}

$zipEntries = [System.IO.Compression.ZipFile]::OpenRead($zipTemp)
try {
    $entryNames = @($zipEntries.Entries | ForEach-Object { $_.FullName })
} finally {
    $zipEntries.Dispose()
}

Write-Step 'Verificando el contenido del ZIP'
if ($entryNames -notcontains '.htaccess') {
    throw 'El ZIP no contiene .htaccess en la raiz. Abortado.'
}
Write-Ok '.htaccess presente en la raiz del ZIP.'

# Rutas con separador POSIX: imprescindible para extraer en Linux.
$backslashEntries = @($entryNames | Where-Object { $_.Contains('\') })
if ($backslashEntries.Count -gt 0) {
    throw "El ZIP tiene $($backslashEntries.Count) entrada(s) con separador '\'. Abortado."
}
Write-Ok 'Todas las entradas usan separador POSIX (/).'

foreach ($required in @('index.php', 'configuracion.php', 'goodfellas.apk', 'assets/tailwind.css', 'assets/contrast-overrides.css', 'assets/pitch-cards.css', 'assets/react/react-app.js', 'lib/helpers.php', 'includes/header.php', 'uploads/.htaccess')) {
    if ($entryNames -notcontains $required) {
        throw "Falta un archivo requerido en el ZIP: $required"
    }
}
Write-Ok 'Todos los archivos requeridos presentes.'
if ($entryNames -notcontains 'assets/player-rating-policy.json') {
    throw 'Falta la politica de valoracion requerida por PHP. Abortado.'
}
if ($entryNames -contains 'config.php') { throw 'El ZIP contiene config.php. Abortado.' }
if ($entryNames | Where-Object { $_ -like '*hostinger_diag.php' }) { throw 'El ZIP contiene hostinger_diag.php. Abortado.' }
if ($entryNames -contains 'assets/tailwind.input.css') { throw 'El ZIP contiene el origen de Tailwind. Abortado.' }

# Superadas todas las verificaciones, el ZIP temporal recibe su nombre final.
Move-Item -LiteralPath $zipTemp -Destination $zipPath -Force
Write-Ok "ZIP publicado como $name.zip"

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()

# ---------------------------------------------------------------------------
# Manifiesto, instrucciones y reporte de auditoria
# ---------------------------------------------------------------------------
Write-Step 'Escribiendo manifiesto, instrucciones y reporte'

$manifestPath = Join-Path $OutDir "$name.manifest.txt"
$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add("Bundle: $name.zip")
$manifestLines.Add("Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
$manifestLines.Add("Archivos: $($bundledRelative.Count)")
$manifestLines.Add("ZIP SHA-256: $zipHash")
$manifestLines.Add("Tamano ZIP: $([Math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB")
$manifestLines.Add('')
$manifestLines.Add('SHA-256 por archivo:')
foreach ($file in ($bundledFiles | Sort-Object FullName)) {
    $rel = $file.FullName.Substring($target.Length + 1)
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestLines.Add("$hash  $rel")
}
Write-TextFile -Path $manifestPath -Content (($manifestLines -join [Environment]::NewLine) + [Environment]::NewLine)

$reportPath = Join-Path $OutDir "$name.auditoria.txt"
$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add('REPORTE DE AUDITORIA DEL BUNDLE')
$reportLines.Add("Bundle: $name.zip")
$reportLines.Add('')
$reportLines.Add('Paginas PHP de raiz incluidas:')
foreach ($f in $copiedRootPhp) { $reportLines.Add("  + $f") }
$reportLines.Add('')
$reportLines.Add('Archivos de raiz excluidos:')
foreach ($f in $skippedRootPhp) { $reportLines.Add("  - $f") }
$reportLines.Add('')
$reportLines.Add('Directorios incluidos: assets/ (sin tailwind.input.css), includes/, lib/, uploads/.htaccess')
$reportLines.Add('Excepcion runtime: assets/player-rating-policy.json (leido por PHP, bloqueado por HTTP y escaneado por secretos).')
$reportLines.Add('Directorios excluidos: scripts/, src/, tests/, docs/, backup/, logs/, tmp/, outputs/, dist/, node_modules/, android-goodfellas/, uploads/players/')
$reportLines.Add('')
$reportLines.Add('Endurecimiento aplicado en .htaccess:')
$reportLines.Add('  - Options -Indexes (sin listado de directorios)')
$reportLines.Add('  - Bloqueo de config.php, database.sql, jugadores.csv, package*.json, composer.*, .env*, .git*, .htaccess, .htpasswd, php.ini')
$reportLines.Add('  - Bloqueo de extensiones sql/csv/md/log/ps1/sh/bak/old/ini/yml/json/lock/txt/dist')
$reportLines.Add('  - 404 para /scripts, /node_modules, /vendor, /src, /tests, /docs, /outputs, /dist, /storage')
$reportLines.Add('  - 404 para /logs, /backup, /tmp y dotfiles')
$reportLines.Add('  - 404 explicito para hostinger_diag.php')
$reportLines.Add('  - 404 para acceso directo a /lib/ y /includes/')
$reportLines.Add('')
$reportLines.Add("Secretos locales escaneados: $($secretLiterals.Count) valor(es) de config.php (no se listan aqui).")
$reportLines.Add("Validacion de sintaxis PHP: $(if ($phpExe -and -not $SkipPhpLint) { "OK ($($phpFiles.Count) archivos)" } else { 'OMITIDA' })")
Write-TextFile -Path $reportPath -Content (($reportLines -join [Environment]::NewLine) + [Environment]::NewLine)

$instructionsPath = Join-Path $OutDir "$name.INSTRUCCIONES.txt"
$instructions = @'
DESPLIEGUE SEGURO EN HOSTINGER (sitio existente)
================================================

QUE ES ESTE BUNDLE
------------------
Actualizacion de codigo de la aplicacion. NO es una instalacion desde cero:
no trae configuracion, ni base de datos, ni fotos de jugadores.

NO INCLUYE (a proposito)
------------------------
  config.php          -> tus credenciales de produccion. El servidor conserva el suyo.
  hostinger_diag.php  -> diagnostico sin login que filtraba datos de la base y rutas.
  scripts/            -> scripts CLI de importacion/migracion, accesibles por HTTP.
  SQL, CSV, Markdown, package.json, vite.config.js, capturas, src/, tests/, docs/.

ANTES DE SUBIR
--------------
1. Copia de seguridad de los archivos del servidor.
2. Copia de seguridad de la base de datos (hPanel > Bases de datos > Exportar, o backup.php).
3. Anota la version de PHP del hosting (debe ser 8.0 o superior).

COMO SUBIR
----------
4. Extrae el ZIP en la carpeta actual de la aplicacion (donde esta index.php),
   sobrescribiendo solo los archivos incluidos.
5. NO borres la carpeta del sitio antes de subir. Se conservan:
     config.php, uploads/, logs/, y todos los datos existentes.
6. El ZIP incluye uploads/.htaccess con el mismo contenido que ya tenias; sirve
   para que un despliegue en carpeta limpia tambien quede protegido. No borra fotos.
7. El ZIP incluye goodfellas.apk para que el boton "Descarga la app" de la home
   siga funcionando. Si tu APK del servidor es mas nuevo, no lo sobrescribas.

DESPUES DE SUBIR
----------------
8. Verifica que config.php siga en el servidor y que uploads/ conserve las fotos.
9. Comprueba en el navegador: inicio, login, jugadores, sorteo, capitanes,
   encuentros, historial, estadisticas, perfil y junta de votaciones.
10. Confirma que estos devuelven 404 (es lo esperado):
      /hostinger_diag.php
      /scripts/
      /lib/helpers.php
      /includes/header.php
      /database.sql
    Si /hostinger_diag.php responde con texto, borra ese archivo del servidor.

ENDURECIMIENTO PENDIENTE (RECOMENDADO)
--------------------------------------
11. config.php en el servidor contiene DB_PASS y ADMIN_PASSWORD con valores por
    defecto escritos en el codigo. Muevelos a variables de entorno de Hostinger
    (GOODFELLAS_DB_PASS, GOODFELLAS_ADMIN_PASSWORD, GOODFELLAS_DB_USER) y cambia
    esas contrasenas: tambien estan en el repositorio local.
12. Comprueba que la contrasena del panel de admin no sea la misma que la de MySQL.

ROLLBACK
--------
13. Si algo falla: restaura la copia de seguridad de los archivos y de la base.
    El bundle no modifica datos por si mismo, solo codigo.
'@
Write-TextFile -Path $instructionsPath -Content $instructions

# ---------------------------------------------------------------------------
# Resumen
# ---------------------------------------------------------------------------
[PSCustomObject]@{
    Bundle         = $target
    Zip            = $zipPath
    Manifiesto     = $manifestPath
    Auditoria      = $reportPath
    Instrucciones  = $instructionsPath
    SHA256         = $zipHash
    Archivos       = $bundledRelative.Count
    ZipMB          = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    PhpValidados   = if ($phpExe -and -not $SkipPhpLint) { $phpFiles.Count } else { 0 }
}
