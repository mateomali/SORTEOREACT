@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "PS_SCRIPT=%PROJECT_ROOT%\scripts\levantar-servidor-local.ps1"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Solicitando permisos de administrador para abrir Windows Firewall...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title Goodfellas Futbol - Servidor local
cd /d "%PROJECT_ROOT%"

echo.
echo Levantando Goodfellas Futbol para esta PC y la red local...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$result = & '%PS_SCRIPT%' -BindAddress '0.0.0.0' -Port 8000 -EnsureFirewall;" ^
    "$result | Format-List;" ^
    "$url = if ($result.NetworkUrl) { $result.NetworkUrl } else { $result.Url };" ^
    "if ($url) { Start-Process $url; Write-Host ''; Write-Host ('Abierto en el navegador: ' + $url) }" ^
    "Write-Host '';" ^
    "Read-Host 'Presiona ENTER para detener el servidor PHP';" ^
    "if ($result.PhpProcessId) { Stop-Process -Id $result.PhpProcessId -ErrorAction SilentlyContinue; Write-Host 'Servidor PHP detenido.' }"

if errorlevel 1 (
    echo.
    echo No se pudo levantar el servidor. Revisa los mensajes anteriores.
    echo.
    pause
    exit /b 1
)

exit /b 0
