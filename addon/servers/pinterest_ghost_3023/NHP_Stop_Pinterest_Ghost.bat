@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title NHP - Stop Pinterest Ghost (3023)
call "%~dp0..\..\_shared\_NHP_Init.cmd"
echo إيقاف Pinterest Ghost (3023)...
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3023/shutdown' -Method POST -TimeoutSec 3 | Out-Null } catch {}"
call "%NHP_ROOT%\Stop_Pinterest_Server.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%NHP_ROOT%\NHP_Check_Server_Ports.ps1"
pause
endlocal
