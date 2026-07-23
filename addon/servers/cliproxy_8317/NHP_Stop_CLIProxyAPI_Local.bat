@echo off

setlocal EnableExtensions

chcp 65001 >nul 2>&1

title NHP - Stop CLIProxyAPI Local (8317)

call "%~dp0..\..\_shared\_NHP_Init.cmd"

echo إيقاف CLIProxyAPI المحلي...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-cliproxyapi-local.ps1"

echo.

pause

