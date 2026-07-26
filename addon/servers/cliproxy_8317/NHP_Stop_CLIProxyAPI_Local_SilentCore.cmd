@echo off

setlocal EnableExtensions

chcp 65001 >nul 2>&1

call "%~dp0..\..\_shared\_NHP_Init.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-cliproxyapi-local.ps1"

exit /b %ERRORLEVEL%

