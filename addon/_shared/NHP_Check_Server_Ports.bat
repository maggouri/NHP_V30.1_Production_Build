@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Check Server Ports
call "%~dp0_NHP_Init.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1" %*
echo.
pause
endlocal