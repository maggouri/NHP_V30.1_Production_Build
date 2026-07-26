@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Stop Redbubble Ghost (3021)
call "%~dp0..\..\_shared\_NHP_Init.cmd"
echo إيقاف Redbubble Ghost (3021)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Stop_Ghost_On_Port.ps1" -Port 3021
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
pause
endlocal
