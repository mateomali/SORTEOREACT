param(
    [int] $Port = 8000
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$tmpDir = Join-Path $projectRoot '.tmp'
$phpExe = 'C:\xampp\php\php.exe'
$mysqlExe = 'C:\xampp\mysql\bin\mysqld.exe'
$mysqlIni = 'C:\xampp\mysql\bin\my.ini'
$mysqlBase = 'C:\xampp\mysql'

New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

if (-not (Test-Path $phpExe)) {
    throw "No encontre PHP en $phpExe. Instala XAMPP o ajusta la ruta en este script."
}

if (-not (Test-Path $mysqlExe)) {
    throw "No encontre MySQL en $mysqlExe. Instala XAMPP o ajusta la ruta en este script."
}

$mysqlConnection = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

if (-not $mysqlConnection) {
    $mysqlOut = Join-Path $tmpDir 'mysql.out.log'
    $mysqlErr = Join-Path $tmpDir 'mysql.err.log'

    Start-Process `
        -FilePath $mysqlExe `
        -ArgumentList @("--defaults-file=$mysqlIni", '--standalone') `
        -WorkingDirectory $mysqlBase `
        -RedirectStandardOutput $mysqlOut `
        -RedirectStandardError $mysqlErr `
        -PassThru `
        -WindowStyle Hidden | Out-Null

    Start-Sleep -Seconds 3
}

$mysqlConnection = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

if (-not $mysqlConnection) {
    throw "MySQL no quedo escuchando en el puerto 3306. Revisa $tmpDir\mysql.err.log."
}

$escapedProjectRoot = [regex]::Escape($projectRoot.Path)
$existingPhpProcess = Get-CimInstance Win32_Process -Filter "name = 'php.exe'" |
    Where-Object {
        $_.CommandLine -match '-S\s+127\.0\.0\.1:(\d+)' -and
        $_.CommandLine -match "-t\s+`"?$escapedProjectRoot`"?"
    } |
    Select-Object -First 1

if ($existingPhpProcess) {
    $existingPhpProcess.CommandLine -match '-S\s+127\.0\.0\.1:(\d+)' | Out-Null
    $selectedPort = [int] $Matches[1]
    $url = "http://127.0.0.1:$selectedPort/"

    try {
        $statusCode = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10).StatusCode
    } catch {
        $statusCode = "sin respuesta: $($_.Exception.Message)"
    }

    [pscustomobject]@{
        Url = $url
        PhpProcessId = $existingPhpProcess.ProcessId
        MysqlProcessId = $mysqlConnection.OwningProcess
        Status = $statusCode
        ReusedExistingPhpServer = $true
        PhpErrorLog = Join-Path $tmpDir 'php-server.err.log'
        MysqlErrorLog = Join-Path $tmpDir 'mysql.err.log'
    }
    exit 0
}

$selectedPort = $Port
while (
    Get-NetTCPConnection -LocalPort $selectedPort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }
) {
    $selectedPort++
}

$phpOut = Join-Path $tmpDir 'php-server.out.log'
$phpErr = Join-Path $tmpDir 'php-server.err.log'

$phpProcess = Start-Process `
    -FilePath $phpExe `
    -ArgumentList @('-S', "127.0.0.1:$selectedPort", '-t', $projectRoot.Path) `
    -WorkingDirectory $projectRoot.Path `
    -RedirectStandardOutput $phpOut `
    -RedirectStandardError $phpErr `
    -PassThru `
    -WindowStyle Hidden

Start-Sleep -Seconds 1

$url = "http://127.0.0.1:$selectedPort/"

try {
    $statusCode = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10).StatusCode
} catch {
    $statusCode = "sin respuesta: $($_.Exception.Message)"
}

[pscustomobject]@{
    Url = $url
    PhpProcessId = $phpProcess.Id
    MysqlProcessId = $mysqlConnection.OwningProcess
    Status = $statusCode
    ReusedExistingPhpServer = $false
    PhpErrorLog = $phpErr
    MysqlErrorLog = Join-Path $tmpDir 'mysql.err.log'
}
