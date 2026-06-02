param(
    [string] $Database = 'u552541920_futbol',
    [string] $SqlPath = '',
    [string] $MysqlUser = 'root',
    [string] $MysqlPassword = '',
    [string] $MysqlHost = '127.0.0.1',
    [int] $MysqlPort = 3306,
    [switch] $SkipBackup
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$tmpDir = Join-Path $projectRoot '.tmp'
$backupDir = Join-Path $tmpDir 'db-backups'
$runtimeDir = Join-Path $tmpDir 'runtime'
$mysqlExe = 'C:\xampp\mysql\bin\mysql.exe'
$mysqldumpExe = 'C:\xampp\mysql\bin\mysqldump.exe'
$mysqldExe = 'C:\xampp\mysql\bin\mysqld.exe'
$mysqlIni = 'C:\xampp\mysql\bin\my.ini'
$mysqlBase = 'C:\xampp\mysql'

if ([string]::IsNullOrWhiteSpace($SqlPath)) {
    $SqlPath = Join-Path $projectRoot 'database.sql'
}

$resolvedSqlPath = Resolve-Path $SqlPath

foreach ($requiredPath in @($mysqlExe, $mysqldumpExe, $mysqldExe, $mysqlIni, $resolvedSqlPath.Path)) {
    if (-not (Test-Path $requiredPath)) {
        throw "No encontre $requiredPath."
    }
}

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$mysqlConnection = Get-NetTCPConnection -LocalPort $MysqlPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

if (-not $mysqlConnection) {
    $mysqlOut = Join-Path $runtimeDir 'mysql.out.log'
    $mysqlErr = Join-Path $runtimeDir 'mysql.err.log'

    Start-Process `
        -FilePath $mysqldExe `
        -ArgumentList @("--defaults-file=$mysqlIni", '--standalone') `
        -WorkingDirectory $mysqlBase `
        -RedirectStandardOutput $mysqlOut `
        -RedirectStandardError $mysqlErr `
        -PassThru `
        -WindowStyle Hidden | Out-Null

    Start-Sleep -Seconds 3
}

$mysqlConnection = Get-NetTCPConnection -LocalPort $MysqlPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

if (-not $mysqlConnection) {
    throw "MySQL no quedo escuchando en el puerto $MysqlPort. Revisa $runtimeDir\mysql.err.log."
}

$mysqlAuthArgs = @('-h', $MysqlHost, '-P', "$MysqlPort", '-u', $MysqlUser)
if ($MysqlPassword -ne '') {
    $mysqlAuthArgs += "-p$MysqlPassword"
}

$databaseExistsQuery = "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$Database';"
$databaseExists = & $mysqlExe @mysqlAuthArgs '-N' '-B' '-e' $databaseExistsQuery

$backupPath = $null
if ($databaseExists -and -not $SkipBackup) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupPath = Join-Path $backupDir "$Database`_$timestamp.sql"
    & $mysqldumpExe @mysqlAuthArgs '--single-transaction' '--routines' '--triggers' $Database |
        Set-Content -Path $backupPath -Encoding UTF8
}

& $mysqlExe @mysqlAuthArgs '-e' "DROP DATABASE IF EXISTS ``$Database``; CREATE DATABASE ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo recrear la base $Database."
}

Get-Content -LiteralPath $resolvedSqlPath.Path -Raw -Encoding UTF8 |
    & $mysqlExe @mysqlAuthArgs $Database '--default-character-set=utf8mb4' '--binary-mode=1'
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo importar $($resolvedSqlPath.Path) en $Database."
}

$tableCount = & $mysqlExe @mysqlAuthArgs '-N' '-B' '-e' "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '$Database';"
$playerCount = & $mysqlExe @mysqlAuthArgs '-N' '-B' $Database '-e' 'SELECT COUNT(*) FROM players;'
$matchCount = & $mysqlExe @mysqlAuthArgs '-N' '-B' $Database '-e' 'SELECT COUNT(*) FROM matches;'

[pscustomobject]@{
    Database = $Database
    SqlPath = $resolvedSqlPath.Path
    BackupPath = $backupPath
    MysqlProcessId = $mysqlConnection.OwningProcess
    Tables = [int] $tableCount
    Players = [int] $playerCount
    Matches = [int] $matchCount
}
