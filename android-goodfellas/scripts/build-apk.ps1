param(
    [string] $JavaHome = 'C:\sorteo\.tools\jdk17\jdk-17.0.18+8',
    [string] $Gradle = 'C:\sorteo\.tools\gradle\gradle-8.10.2\bin\gradle.bat',
    [string] $SigningStore = '',
    [string] $SigningPasswordFile = ''
)
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (!$SigningStore) { $SigningStore = Join-Path $project '..\.tmp\signing\goodfellas-release.jks' }
if (!$SigningPasswordFile) { $SigningPasswordFile = Join-Path $project '..\.tmp\signing\goodfellas-release-password.txt' }
foreach ($required in @((Join-Path $JavaHome 'bin\java.exe'), $Gradle, $SigningStore, $SigningPasswordFile)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Falta un requisito de compilacion: $required" }
}
$env:JAVA_HOME = $JavaHome
$env:DEBUG = ''
Push-Location $project
try {
    & $Gradle --console=plain --no-daemon assembleRelease testDebugUnitTest lintRelease "-PgoodfellasSigningStore=$SigningStore" "-PgoodfellasSigningPasswordFile=$SigningPasswordFile"
    if ($LASTEXITCODE -ne 0) { throw 'No se genero una APK validada.' }
    Write-Host "APK: $project\app\build\outputs\apk\release\app-release.apk"
} finally { Pop-Location }
