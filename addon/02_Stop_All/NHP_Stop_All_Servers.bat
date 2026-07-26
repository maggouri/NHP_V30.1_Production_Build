@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Stop All Servers
call "%~dp0..\_shared\NHP_Stop_All_Servers_SilentCore.bat"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\..\NHP_Check_Server_Ports.ps1"
echo.
pause
endlocal
exit /b 0
