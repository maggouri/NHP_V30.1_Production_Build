@echo off

setlocal EnableExtensions

chcp 65001 >nul 2>&1

title NHP - Start CLIProxyAPI Local (8317)

call "%~dp0..\..\_shared\_NHP_Init.cmd"

echo تشغيل CLIProxyAPI المحلي على المنفذ 8317...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-cliproxyapi-local.ps1"

echo.

pause

