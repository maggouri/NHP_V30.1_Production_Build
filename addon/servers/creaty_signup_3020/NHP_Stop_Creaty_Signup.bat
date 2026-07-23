@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Stop Creaty Signup (3020)
call "%~dp0..\..\_shared\_NHP_Init.cmd"
echo إيقاف Creaty Signup (3020)...
call "%NHP_ROOT%\Stop_Creaty_Server.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
pause
endlocal
