param(
    [string] $BindAddress = '0.0.0.0',
    [int] $Port = 8000,
    [switch] $EnsureFirewall,
    [switch] $FullHttpCheck
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$tmpDir = Join-Path $projectRoot '.tmp'
$runtimeDir = Join-Path $tmpDir 'runtime'
$phpExe = 'C:\xampp\php\php.exe'
$mysqlExe = 'C:\xampp\mysql\bin\mysqld.exe'
$mysqlIni = 'C:\xampp\mysql\bin\my.ini'
$mysqlBase = 'C:\xampp\mysql'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-FirewallRule {
    param(
        [int] $LocalPort
    )

    if (-not $EnsureFirewall) {
        return 'no solicitado'
    }

    if (-not (Test-IsAdministrator)) {
        return 'omitido: ejecuta como administrador para abrir Windows Firewall automaticamente'
    }

    $ruleName = "Goodfellas Futbol servidor local TCP $LocalPort"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($existingRule) {
        return "ya existia: $ruleName"
    }

    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $LocalPort `
        -Profile Domain,Private `
        -Description 'Permite acceder al servidor local de Goodfellas Futbol desde la red local.' |
        Out-Null

    return "creada: $ruleName"
}

function Get-ServerStatus {
    param(
        [string] $Url,
        [int] $LocalPort
    )

    if ($FullHttpCheck) {
        try {
            return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10).StatusCode
        } catch {
            return "sin respuesta: $($_.Exception.Message)"
        }
    }

    $connection = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($connection) {
        return 'escuchando'
    }

    return 'sin puerto activo'
}

New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

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
    $mysqlOut = Join-Path $runtimeDir 'mysql.out.log'
    $mysqlErr = Join-Path $runtimeDir 'mysql.err.log'

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
    throw "MySQL no quedo escuchando en el puerto 3306. Revisa $runtimeDir\mysql.err.log."
}

$escapedProjectRoot = [regex]::Escape($projectRoot.Path)
$bindAddressPattern = [regex]::Escape($BindAddress)
$existingPhpProcess = Get-CimInstance Win32_Process -Filter "name = 'php.exe'" |
    Where-Object {
        $_.CommandLine -match "-S\s+$bindAddressPattern`:(\d+)" -and
        $_.CommandLine -match "-t\s+`"?$escapedProjectRoot`"?"
    } |
    Select-Object -First 1

if ($existingPhpProcess) {
    $existingPhpProcess.CommandLine -match "-S\s+$bindAddressPattern`:(\d+)" | Out-Null
    $selectedPort = [int] $Matches[1]
    $firewallStatus = Ensure-FirewallRule -LocalPort $selectedPort
    $localUrl = "http://127.0.0.1:$selectedPort/"
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Sort-Object InterfaceMetric |
        Select-Object -ExpandProperty IPAddress -First 1
    $networkUrl = if ($lanIp) { "http://$lanIp`:$selectedPort/" } else { $null }

    $statusCode = Get-ServerStatus -Url $localUrl -LocalPort $selectedPort

    $result = [pscustomobject]@{
        Url = $localUrl
        NetworkUrl = $networkUrl
        BindAddress = $BindAddress
        PhpProcessId = $existingPhpProcess.ProcessId
        MysqlProcessId = $mysqlConnection.OwningProcess
        Status = $statusCode
        ReusedExistingPhpServer = $true
        FirewallStatus = $firewallStatus
        PhpErrorLog = Join-Path $runtimeDir 'php-server.err.log'
        MysqlErrorLog = Join-Path $runtimeDir 'mysql.err.log'
    }

    Write-Host "Servidor local listo: $localUrl"
    if ($networkUrl) {
        Write-Host "Red local: $networkUrl"
    }
    $result
    exit 0
}

$selectedPort = $Port
while (
    Get-NetTCPConnection -LocalPort $selectedPort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }
) {
    $selectedPort++
}

$firewallStatus = Ensure-FirewallRule -LocalPort $selectedPort
$phpOut = Join-Path $runtimeDir 'php-server.out.log'
$phpErr = Join-Path $runtimeDir 'php-server.err.log'

$phpProcess = Start-Process `
    -FilePath $phpExe `
    -ArgumentList @('-S', "$BindAddress`:$selectedPort", '-t', $projectRoot.Path) `
    -WorkingDirectory $projectRoot.Path `
    -RedirectStandardOutput $phpOut `
    -RedirectStandardError $phpErr `
    -PassThru `
    -WindowStyle Hidden

Start-Sleep -Seconds 1

$localUrl = "http://127.0.0.1:$selectedPort/"
$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object InterfaceMetric |
    Select-Object -ExpandProperty IPAddress -First 1
$networkUrl = if ($lanIp) { "http://$lanIp`:$selectedPort/" } else { $null }

$statusCode = Get-ServerStatus -Url $localUrl -LocalPort $selectedPort

$result = [pscustomobject]@{
    Url = $localUrl
    NetworkUrl = $networkUrl
    BindAddress = $BindAddress
    PhpProcessId = $phpProcess.Id
    MysqlProcessId = $mysqlConnection.OwningProcess
    Status = $statusCode
    ReusedExistingPhpServer = $false
    FirewallStatus = $firewallStatus
    PhpErrorLog = $phpErr
    MysqlErrorLog = Join-Path $runtimeDir 'mysql.err.log'
}

Write-Host "Servidor local listo: $localUrl"
if ($networkUrl) {
    Write-Host "Red local: $networkUrl"
}
$result
